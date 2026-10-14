import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser, backdateSession } from './helpers/study-fixtures.js';

describe('Study Session API: Timer Flow, Blocks, Finish and Cancel (@estudos/api)', () => {
  let user: Awaited<ReturnType<typeof createStudyUser>>;
  let otherUser: Awaited<ReturnType<typeof createStudyUser>>;

  beforeAll(async () => {
    user = await createStudyUser('FlowUser');
    otherUser = await createStudyUser('FlowOtherUser');
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [user.user.id, otherUser.user.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deve registrar eventos manuais (PAUSE, RESUME) e rejeitar transições inválidas (409)', async () => {
    // 1. Criar sessão avulsa com 2 blocos
    const resCreate = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user.cookie)
      .send({
        topic_id: user.topic.id,
        blocks: [
          { kind: 'REVIEW', planned_minutes: 10 },
          { kind: 'PRACTICE', planned_minutes: 20 },
        ],
      });
    expect(resCreate.status).toBe(201);
    const session = resCreate.body.data;

    // 2. PAUSE válido
    const resPause = await request(app)
      .post(`/api/study-sessions/${session.id}/events`)
      .set('Cookie', user.cookie)
      .send({ type: 'PAUSE' });
    expect(resPause.status).toBe(200);
    expect(resPause.body.data.session_events.at(-1).type).toBe('PAUSE');

    // 3. PAUSE repetido -> 409 INVALID_TRANSITION
    const resPause2 = await request(app)
      .post(`/api/study-sessions/${session.id}/events`)
      .set('Cookie', user.cookie)
      .send({ type: 'PAUSE' });
    expect(resPause2.status).toBe(409);
    expect(resPause2.body.error.code).toBe('INVALID_TRANSITION');

    // 4. DISTRACTION_START em PAUSED -> 409 INVALID_TRANSITION
    const resDist = await request(app)
      .post(`/api/study-sessions/${session.id}/events`)
      .set('Cookie', user.cookie)
      .send({ type: 'DISTRACTION_START' });
    expect(resDist.status).toBe(409);

    // 5. RESUME -> 200
    const resResume = await request(app)
      .post(`/api/study-sessions/${session.id}/events`)
      .set('Cookie', user.cookie)
      .send({ type: 'RESUME' });
    expect(resResume.status).toBe(200);
    expect(resResume.body.data.session_events.at(-1).type).toBe('RESUME');
  });

  it('deve validar avanço de etapa: rejeitar bloco inativo ou último bloco, e avançar com sucesso', async () => {
    const activeRes = await request(app)
      .get('/api/study-sessions/active')
      .set('Cookie', user.cookie);
    const session = activeRes.body.data;
    const b1 = session.session_blocks[0];
    const b2 = session.session_blocks[1];

    // Tentativa de finalizar b2 enquanto b1 está ativo -> 409 BLOCK_NOT_ACTIVE
    const resFinishB2 = await request(app)
      .post(`/api/study-sessions/${session.id}/blocks/${b2.id}/finish`)
      .set('Cookie', user.cookie)
      .send({});
    expect(resFinishB2.status).toBe(409);
    expect(resFinishB2.body.error.code).toBe('BLOCK_NOT_ACTIVE');

    // Bloco inexistente -> 404
    const resFinishNotFound = await request(app)
      .post(`/api/study-sessions/${session.id}/blocks/00000000-0000-0000-0000-000000000000/finish`)
      .set('Cookie', user.cookie)
      .send({});
    expect(resFinishNotFound.status).toBe(404);

    // Finalizar b1 com sucesso (sem corpo)
    const resFinishB1 = await request(app)
      .post(`/api/study-sessions/${session.id}/blocks/${b1.id}/finish`)
      .set('Cookie', user.cookie);
    expect(resFinishB1.status).toBe(200);
    expect(resFinishB1.body.data.metrics.activeBlockId).toBe(b2.id);

    // Tentativa de finalizar b2 com /blocks/:id/finish sendo o último bloco -> 409 LAST_BLOCK
    const resFinishLast = await request(app)
      .post(`/api/study-sessions/${session.id}/blocks/${b2.id}/finish`)
      .set('Cookie', user.cookie)
      .send({});
    expect(resFinishLast.status).toBe(409);
    expect(resFinishLast.body.error.code).toBe('LAST_BLOCK');
    expect(resFinishLast.body.error.message).toBe('Use a conclusão da sessão para encerrar a última etapa.');
  });

  it('deve rejeitar distração declarada excedente com 422 sem alterar estado ou inserir eventos', async () => {
    const activeRes = await request(app)
      .get('/api/study-sessions/active')
      .set('Cookie', user.cookie);
    const session = activeRes.body.data;
    const countBefore = session.session_events.length;

    // Tentativa de declarar 10 minutos logo após o início do bloco (sem tempo disponível) -> 422
    const resExceeded = await request(app)
      .post(`/api/study-sessions/${session.id}/finish`)
      .set('Cookie', user.cookie)
      .send({ declared_minutes: 10 });

    expect(resExceeded.status).toBe(422);
    expect(resExceeded.body.error.code).toBe('DECLARED_DISTRACTION_EXCEEDED');

    // Sessão continua IN_PROGRESS e nenhum evento foi gravado
    const checkRes = await request(app)
      .get('/api/study-sessions/active')
      .set('Cookie', user.cookie);
    expect(checkRes.body.data.status).toBe('IN_PROGRESS');
    expect(checkRes.body.data.session_events).toHaveLength(countBefore);
  });

  it('deve concluir a sessão com sucesso após tempo decorrido e registrar distração declarada válida', async () => {
    const activeRes = await request(app)
      .get('/api/study-sessions/active')
      .set('Cookie', user.cookie);
    const session = activeRes.body.data;

    // Recuar o tempo em 600 segundos (10 minutos)
    await backdateSession(session.id, 600);

    // Concluir declarando 3 minutos de distração
    const resFinish = await request(app)
      .post(`/api/study-sessions/${session.id}/finish`)
      .set('Cookie', user.cookie)
      .send({ declared_minutes: 3 });

    expect(resFinish.status).toBe(200);
    const finished = resFinish.body.data;
    expect(finished.status).toBe('FINISHED');
    expect(finished.ended_at).toBeDefined();

    // Eventos: deve conter DISTRACTION_DECLARED com 180s, BLOCK_FINISH e SESSION_FINISH
    const declaredEv = finished.session_events.find((e: any) => e.type === 'DISTRACTION_DECLARED');
    expect(declaredEv).toBeDefined();
    expect(declaredEv.declared_seconds).toBe(180);

    const finishEv = finished.session_events.find((e: any) => e.type === 'SESSION_FINISH');
    expect(finishEv).toBeDefined();

    // Métricas: total >= 600s, efetivo = total - 180s
    expect(finished.metrics.totalSeconds).toBeGreaterThanOrEqual(600);
    expect(finished.metrics.effectiveSeconds).toBe(
      finished.metrics.totalSeconds - 180
    );

    // Tentativa de mutação em sessão FINISHED -> 409 SESSION_NOT_IN_PROGRESS
    const resMut = await request(app)
      .post(`/api/study-sessions/${session.id}/events`)
      .set('Cookie', user.cookie)
      .send({ type: 'PAUSE' });
    expect(resMut.status).toBe(409);
    expect(resMut.body.error.code).toBe('SESSION_NOT_IN_PROGRESS');
  });

  it('deve cancelar sessão vinculada e reverter PlannedSession para PLANNED apenas se ainda estiver DONE', async () => {
    // 1. Criar PlannedSession para otherUser
    const planned = await prisma.plannedSession.create({
      data: {
        user_id: otherUser.user.id,
        subject_id: otherUser.subject.id,
        topic_id: otherUser.topic.id,
        scheduled_start: new Date(),
        planned_minutes: 30,
        status: 'PLANNED',
        planned_blocks: {
          create: [{ user_id: otherUser.user.id, kind: 'REVIEW', planned_minutes: 30, position: 1 }],
        },
      },
    });

    // 2. Iniciar estudo a partir da PlannedSession
    const resStart = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', otherUser.cookie)
      .send({ planned_session_id: planned.id });
    expect(resStart.status).toBe(201);
    const studySessionId = resStart.body.data.id;

    // PlannedSession está DONE
    const pDone = await prisma.plannedSession.findUnique({ where: { id: planned.id } });
    expect(pDone?.status).toBe('DONE');

    // 3. Cancelar estudo
    const resCancel = await request(app)
      .post(`/api/study-sessions/${studySessionId}/cancel`)
      .set('Cookie', otherUser.cookie);
    expect(resCancel.status).toBe(200);
    expect(resCancel.body.data.status).toBe('CANCELLED');
    expect(resCancel.body.data.metrics).toBeNull();

    // 4. PlannedSession deve ter revertido para PLANNED
    const pReverted = await prisma.plannedSession.findUnique({ where: { id: planned.id } });
    expect(pReverted?.status).toBe('PLANNED');

    // 5. Cenário seguro: Se a PlannedSession já tivesse sido alterada para SKIPPED, não sobrescrever
    await prisma.plannedSession.update({
      where: { id: planned.id },
      data: { status: 'SKIPPED' },
    });

    // Criar outra sessão vinculada fictícia em DONE
    const sessionFake = await prisma.studySession.create({
      data: {
        user_id: otherUser.user.id,
        planned_session_id: planned.id,
        topic_id: otherUser.topic.id,
        status: 'IN_PROGRESS',
      },
    });

    await request(app)
      .post(`/api/study-sessions/${sessionFake.id}/cancel`)
      .set('Cookie', otherUser.cookie);

    const pStillSkipped = await prisma.plannedSession.findUnique({ where: { id: planned.id } });
    expect(pStillSkipped?.status).toBe('SKIPPED');
  });

  it('deve retornar 404 em todas as mutações se a sessão pertencer a outro usuário', async () => {
    // Buscar sessão de otherUser
    const session = await prisma.studySession.findFirst({
      where: { user_id: otherUser.user.id },
    });

    const res1 = await request(app)
      .post(`/api/study-sessions/${session!.id}/events`)
      .set('Cookie', user.cookie)
      .send({ type: 'PAUSE' });
    expect(res1.status).toBe(404);

    const res2 = await request(app)
      .post(`/api/study-sessions/${session!.id}/blocks/some-block/finish`)
      .set('Cookie', user.cookie);
    expect(res2.status).toBe(404);

    const res3 = await request(app)
      .post(`/api/study-sessions/${session!.id}/finish`)
      .set('Cookie', user.cookie);
    expect(res3.status).toBe(404);

    const res4 = await request(app)
      .post(`/api/study-sessions/${session!.id}/cancel`)
      .set('Cookie', user.cookie);
    expect(res4.status).toBe(404);
  });
});
