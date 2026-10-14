import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';

describe('Study Session API: Creation and Queries (@estudos/api)', () => {
  let user1: Awaited<ReturnType<typeof createStudyUser>>;
  let user2: Awaited<ReturnType<typeof createStudyUser>>;

  beforeAll(async () => {
    user1 = await createStudyUser('User1Create');
    user2 = await createStudyUser('User2Create');
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [user1.user.id, user2.user.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deve rejeitar requisição sem cookie com 401', async () => {
    const resActive = await request(app).get('/api/study-sessions/active');
    expect(resActive.status).toBe(401);

    const resCreate = await request(app).post('/api/study-sessions').send({});
    expect(resCreate.status).toBe(401);
  });

  it('deve criar sessão avulsa válida (Modo 2) e recuperá-la em /active', async () => {
    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user1.cookie)
      .send({
        topic_id: user1.topic.id,
        blocks: [
          { kind: 'PRACTICE', planned_minutes: 20 },
          { kind: 'REVIEW', planned_minutes: 10 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    const session = res.body.data;
    expect(session.status).toBe('IN_PROGRESS');
    expect(session.planned_session_id).toBeNull();
    expect(session.topic_id).toBe(user1.topic.id);
    expect(session.session_blocks).toHaveLength(2);

    // Ordem canônica REVIEW -> PRACTICE com position 1 e 2
    expect(session.session_blocks[0].kind).toBe('REVIEW');
    expect(session.session_blocks[0].position).toBe(1);
    expect(session.session_blocks[1].kind).toBe('PRACTICE');
    expect(session.session_blocks[1].position).toBe(2);

    // Deve ter gerado BLOCK_START no primeiro bloco
    expect(session.session_events).toHaveLength(1);
    expect(session.session_events[0].type).toBe('BLOCK_START');
    expect(session.session_events[0].block_id).toBe(session.session_blocks[0].id);

    // Testar GET /active
    const resActive = await request(app)
      .get('/api/study-sessions/active')
      .set('Cookie', user1.cookie);

    expect(resActive.status).toBe(200);
    expect(resActive.body.server_now).toBeDefined();
    expect(resActive.body.data).toBeDefined();
    expect(resActive.body.data.id).toBe(session.id);
    expect(resActive.body.data.metrics.activeBlockId).toBe(session.session_blocks[0].id);
  });

  it('deve rejeitar criação de nova sessão se já houver uma IN_PROGRESS com 409 ACTIVE_SESSION_EXISTS', async () => {
    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user1.cookie)
      .send({
        topic_id: user1.topic.id,
        blocks: [{ kind: 'REVIEW', planned_minutes: 15 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_SESSION_EXISTS');
    expect(res.body.error.message).toBe('Você já tem uma sessão de estudo em andamento.');
  });

  it('deve isolar multi-tenancy e permitir que user2 inicie sua própria sessão', async () => {
    // Para user2, active deve ser null inicialmente
    const resActiveInit = await request(app)
      .get('/api/study-sessions/active')
      .set('Cookie', user2.cookie);
    expect(resActiveInit.status).toBe(200);
    expect(resActiveInit.body.data).toBeNull();

    // Criar sessão para user2 a partir de PlannedSession (Modo 1)
    const planned = await prisma.plannedSession.create({
      data: {
        user_id: user2.user.id,
        subject_id: user2.subject.id,
        topic_id: user2.topic.id,
        scheduled_start: new Date(),
        planned_minutes: 45,
        priority: 'HIGH',
        status: 'PLANNED',
        planned_blocks: {
          create: [
            { user_id: user2.user.id, kind: 'REVIEW', planned_minutes: 15, position: 1 },
            { user_id: user2.user.id, kind: 'PRACTICE', planned_minutes: 30, position: 2 },
          ],
        },
      },
    });

    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user2.cookie)
      .send({ planned_session_id: planned.id });

    expect(res.status).toBe(201);
    expect(res.body.data.planned_session_id).toBe(planned.id);
    expect(res.body.data.session_blocks).toHaveLength(2);

    // PlannedSession deve ter transicionado para DONE
    const updatedPlanned = await prisma.plannedSession.findUnique({
      where: { id: planned.id },
    });
    expect(updatedPlanned?.status).toBe('DONE');
  });

  it('deve aplicar fallback criando bloco NEW_CONTENT se PlannedSession não possuir PlannedBlocks', async () => {
    // Limpar sessão ativa de user2 cancelando
    const active = await prisma.studySession.findFirst({
      where: { user_id: user2.user.id, status: 'IN_PROGRESS' },
    });
    if (active) {
      await prisma.studySession.update({
        where: { id: active.id },
        data: { status: 'CANCELLED' },
      });
    }

    const plannedNoBlocks = await prisma.plannedSession.create({
      data: {
        user_id: user2.user.id,
        subject_id: user2.subject.id,
        topic_id: user2.topic.id,
        scheduled_start: new Date(),
        planned_minutes: 50,
        status: 'PLANNED',
      },
    });

    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user2.cookie)
      .send({ planned_session_id: plannedNoBlocks.id });

    expect(res.status).toBe(201);
    expect(res.body.data.session_blocks).toHaveLength(1);
    expect(res.body.data.session_blocks[0].kind).toBe('NEW_CONTENT');
    expect(res.body.data.session_blocks[0].planned_minutes).toBe(50);
    expect(res.body.data.session_blocks[0].position).toBe(1);
  });

  it('deve rejeitar Modo 1 se a PlannedSession não estiver PLANNED (409 PLANNED_SESSION_NOT_AVAILABLE)', async () => {
    // Limpar sessão ativa de user2
    const active = await prisma.studySession.findFirst({
      where: { user_id: user2.user.id, status: 'IN_PROGRESS' },
    });
    if (active) {
      await prisma.studySession.update({
        where: { id: active.id },
        data: { status: 'CANCELLED' },
      });
    }

    const skippedPlanned = await prisma.plannedSession.create({
      data: {
        user_id: user2.user.id,
        subject_id: user2.subject.id,
        topic_id: user2.topic.id,
        scheduled_start: new Date(),
        planned_minutes: 30,
        status: 'SKIPPED',
      },
    });

    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user2.cookie)
      .send({ planned_session_id: skippedPlanned.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLANNED_SESSION_NOT_AVAILABLE');
  });

  it('deve retornar 404 para planned_session de outro usuário ou inexistente', async () => {
    await prisma.studySession.updateMany({
      where: { user_id: user1.user.id, status: 'IN_PROGRESS' },
      data: { status: 'CANCELLED' },
    });

    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user1.cookie)
      .send({ planned_session_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('deve rejeitar Modo 2 se o assunto estiver arquivado com 400 TOPIC_ARCHIVED', async () => {
    const archivedTopic = await prisma.topic.create({
      data: {
        user_id: user2.user.id,
        subject_id: user2.subject.id,
        name: 'Assunto Arquivado',
        archived: true,
      },
    });

    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user2.cookie)
      .send({
        topic_id: archivedTopic.id,
        blocks: [{ kind: 'REVIEW', planned_minutes: 20 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOPIC_ARCHIVED');
  });

  it('deve bloquear criação com 409 PENDING_EVALUATION_EXISTS se houver sessão FINISHED sem avaliação', async () => {
    // Criar uma sessão FINISHED sem avaliação para user2
    await prisma.studySession.create({
      data: {
        user_id: user2.user.id,
        topic_id: user2.topic.id,
        status: 'FINISHED',
        started_at: new Date(Date.now() - 3600000),
        ended_at: new Date(),
        session_blocks: {
          create: [{ user_id: user2.user.id, kind: 'PRACTICE', planned_minutes: 30, position: 1 }],
        },
      },
    });

    // Tentativa de criar nova sessão
    const res = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user2.cookie)
      .send({
        topic_id: user2.topic.id,
        blocks: [{ kind: 'PRACTICE', planned_minutes: 30 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PENDING_EVALUATION_EXISTS');
    expect(res.body.error.message).toBe('Você tem uma sessão concluída aguardando avaliação.');

    // GET /pending-evaluation deve retornar essa sessão com metrics
    const resPending = await request(app)
      .get('/api/study-sessions/pending-evaluation')
      .set('Cookie', user2.cookie);

    expect(resPending.status).toBe(200);
    expect(resPending.body.data).toBeDefined();
    expect(resPending.body.data.status).toBe('FINISHED');
    expect(resPending.body.data.evaluation).toBeNull();
    expect(resPending.body.data.metrics).toBeDefined();
  });

  it('deve retornar 404 ao tentar acessar GET /:id de outro usuário', async () => {
    // Buscar id da sessão de user2
    const s2 = await prisma.studySession.findFirst({
      where: { user_id: user2.user.id },
    });

    const res = await request(app)
      .get(`/api/study-sessions/${s2!.id}`)
      .set('Cookie', user1.cookie); // user1 tentando acessar sessão de user2

    expect(res.status).toBe(404);
  });
});
