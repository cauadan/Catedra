import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';
import { localDateTimeToUtc } from '@estudos/domain';

describe('Goals API (/api/goals): Integração e Concorrência em PostgreSQL Real', () => {
  let userA: Awaited<ReturnType<typeof createStudyUser>>;
  let userB: Awaited<ReturnType<typeof createStudyUser>>;
  let childTopicA: { id: string };
  let otherSubjectA: { id: string };

  beforeAll(async () => {
    userA = await createStudyUser('GoalsUserA');
    userB = await createStudyUser('GoalsUserB');

    // Atualiza fuso de userA para America/Rio_Branco para testar fronteiras de fuso
    await prisma.user.update({
      where: { id: userA.user.id },
      data: { timezone: 'America/Rio_Branco', week_starts_on: 'MONDAY' },
    });

    childTopicA = await prisma.topic.create({
      data: {
        user_id: userA.user.id,
        subject_id: userA.subject.id,
        parent_id: userA.topic.id,
        name: 'Subassunto Álgebra Linear',
      },
    });

    otherSubjectA = await prisma.subject.create({
      data: {
        user_id: userA.user.id,
        name: 'Outra Matéria',
        color: '#EF4444',
      },
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await prisma.goal.deleteMany({
      where: { user_id: { in: [userA.user.id, userB.user.id] } },
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [userA.user.id, userB.user.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('POST /api/goals cria meta normalizando period_start_local_date, infere subject_id a partir de topic_id e valida compatibilidade subject_id/topic_id', async () => {
    // 1. Apenas topic_id informado -> infere subject_id e normaliza 2026-10-30 (sexta) para 2026-10-26 (segunda)
    const createRes = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'EFFORT',
        metric: 'EFFECTIVE_MINUTES',
        period: 'WEEK',
        period_start_local_date: '2026-10-30',
        target_value: 120,
        topic_id: childTopicA.id,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.period_start_local_date).toBe('2026-10-26');
    expect(createRes.body.data.subject_id).toBe(userA.subject.id);
    expect(createRes.body.data.topic_id).toBe(childTopicA.id);
    expect(createRes.body.data.is_archived_scope).toBe(false);

    // 2. subject_id e topic_id incompatíveis -> 400 Bad Request
    const mismatchRes = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'WEEK',
        period_start_local_date: '2026-10-26',
        target_value: 30,
        subject_id: otherSubjectA.id,
        topic_id: childTopicA.id,
      });
    expect(mismatchRes.status).toBe(400);

    // 3. Tópico de outro usuário -> 404 Not Found
    const foreignRes = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'WEEK',
        period_start_local_date: '2026-10-26',
        target_value: 30,
        topic_id: userB.topic.id,
      });
    expect(foreignRes.status).toBe(404);
  });

  it('rejeita criação de meta para matéria ou assunto arquivado (400), mas retorna meta existente com is_archived_scope: true após arquivamento', async () => {
    const tempTopic = await prisma.topic.create({
      data: {
        user_id: userA.user.id,
        subject_id: userA.subject.id,
        name: 'Tópico Temporário',
        archived: false,
      },
    });

    const createRes = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'DAY',
        period_start_local_date: '2026-10-14',
        target_value: 25,
        topic_id: tempTopic.id,
      });
    expect(createRes.status).toBe(201);

    // Arquiva o tópico
    await prisma.topic.update({
      where: { id: tempTopic.id },
      data: { archived: true },
    });

    // Tentar criar nova meta para tópico arquivado -> 400
    const blockedRes = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'EFFORT',
        metric: 'EFFECTIVE_MINUTES',
        period: 'DAY',
        period_start_local_date: '2026-10-14',
        target_value: 60,
        topic_id: tempTopic.id,
      });
    expect(blockedRes.status).toBe(400);

    // Listagem continua retornando a meta já existente com is_archived_scope: true
    const listRes = await request(app)
      .get('/api/goals?period=DAY&date=2026-10-14')
      .set('Cookie', userA.cookie);
    expect(listRes.status).toBe(200);
    const archivedGoal = listRes.body.data.find((g: any) => g.id === createRes.body.data.id);
    expect(archivedGoal).toBeDefined();
    expect(archivedGoal.is_archived_scope).toBe(true);
  });

  it('PATCH /api/goals/:id valida target_value conforme a métrica da meta existente e DELETE /api/goals/:id exclui a meta', async () => {
    const effortGoal = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'DAY',
        period_start_local_date: '2026-10-14',
        target_value: 20,
      });
    expect(effortGoal.status).toBe(201);

    const accuracyGoal = await request(app)
      .post('/api/goals')
      .set('Cookie', userA.cookie)
      .send({
        kind: 'RESULT',
        metric: 'ACCURACY',
        period: 'DAY',
        period_start_local_date: '2026-10-14',
        target_value: 80,
      });
    expect(accuracyGoal.status).toBe(201);

    // Valor fracionário em meta de esforço -> 400
    const badEffortPatch = await request(app)
      .patch(`/api/goals/${effortGoal.body.data.id}`)
      .set('Cookie', userA.cookie)
      .send({ target_value: 25.5 });
    expect(badEffortPatch.status).toBe(400);

    // Valor > 100 em meta ACCURACY -> 400
    const badAccPatch = await request(app)
      .patch(`/api/goals/${accuracyGoal.body.data.id}`)
      .set('Cookie', userA.cookie)
      .send({ target_value: 105 });
    expect(badAccPatch.status).toBe(400);

    // Atualização válida -> 200
    const okPatch = await request(app)
      .patch(`/api/goals/${effortGoal.body.data.id}`)
      .set('Cookie', userA.cookie)
      .send({ target_value: 40 });
    expect(okPatch.status).toBe(200);
    expect(okPatch.body.data.target_value).toBe(40);

    // Exclusão por outro usuário -> 404
    const foreignDel = await request(app)
      .delete(`/api/goals/${effortGoal.body.data.id}`)
      .set('Cookie', userB.cookie);
    expect(foreignDel.status).toBe(404);

    // Exclusão pelo dono -> 204
    const okDel = await request(app)
      .delete(`/api/goals/${effortGoal.body.data.id}`)
      .set('Cookie', userA.cookie);
    expect(okDel.status).toBe(204);
  });

  it('CONCORRÊNCIA: duas chamadas simultâneas de POST /api/goals idênticas resultam em [201, 409 GOAL_ALREADY_EXISTS] e apenas 1 registro no banco', async () => {
    const payload = {
      kind: 'EFFORT',
      metric: 'EFFECTIVE_MINUTES',
      period: 'WEEK',
      period_start_local_date: '2026-10-12',
      target_value: 300,
      subject_id: userA.subject.id,
    };

    const [res1, res2] = await Promise.all([
      request(app).post('/api/goals').set('Cookie', userA.cookie).send(payload),
      request(app).post('/api/goals').set('Cookie', userA.cookie).send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.error.code).toBe('GOAL_ALREADY_EXISTS');

    const dbGoals = await prisma.goal.findMany({
      where: {
        user_id: userA.user.id,
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
      },
    });
    expect(dbGoals).toHaveLength(1);
  });

  it('CONCORRÊNCIA: duas chamadas simultâneas de POST /api/goals/copy têm sucesso (201/200), a soma de copiedCount equivale a uma única cópia e ignora escopos arquivados', async () => {
    // Cria 2 metas na semana anterior (2026-10-05): 1 ativa e 1 em tópico que será arquivado
    const tempArchivedTopic = await prisma.topic.create({
      data: {
        user_id: userA.user.id,
        subject_id: userA.subject.id,
        name: 'Tópico para Arquivar antes do Copy',
        archived: false,
      },
    });

    await prisma.goal.createMany({
      data: [
        {
          user_id: userA.user.id,
          kind: 'EFFORT',
          metric: 'EFFECTIVE_MINUTES',
          period: 'WEEK',
          period_start_local_date: '2026-10-05',
          target_value: 240,
          subject_id: userA.subject.id,
          topic_id: null,
        },
        {
          user_id: userA.user.id,
          kind: 'RESULT',
          metric: 'ACCURACY',
          period: 'WEEK',
          period_start_local_date: '2026-10-05',
          target_value: 80,
          subject_id: userA.subject.id,
          topic_id: userA.topic.id,
        },
        {
          user_id: userA.user.id,
          kind: 'EFFORT',
          metric: 'QUESTIONS',
          period: 'WEEK',
          period_start_local_date: '2026-10-05',
          target_value: 50,
          subject_id: userA.subject.id,
          topic_id: tempArchivedTopic.id,
        },
      ],
    });

    // Arquiva tempArchivedTopic -> não deve ser copiada
    await prisma.topic.update({
      where: { id: tempArchivedTopic.id },
      data: { archived: true },
    });

    const copyPayload = {
      period: 'WEEK',
      target_date: '2026-10-14', // normaliza para 2026-10-12
    };

    const [c1, c2] = await Promise.all([
      request(app).post('/api/goals/copy').set('Cookie', userA.cookie).send(copyPayload),
      request(app).post('/api/goals/copy').set('Cookie', userA.cookie).send(copyPayload),
    ]);

    expect([200, 201]).toContain(c1.status);
    expect([200, 201]).toContain(c2.status);

    const totalCopied = c1.body.copiedCount + c2.body.copiedCount;
    expect(totalCopied).toBe(2); // Apenas as 2 metas com escopo ativo

    // Verifica que quem copiou > 0 retornou 201 e quem copiou 0 retornou 200
    for (const r of [c1, c2]) {
      if (r.body.copiedCount > 0) {
        expect(r.status).toBe(201);
      } else {
        expect(r.status).toBe(200);
      }
      expect(r.body.data).toHaveLength(2);
    }

    const copiedInDb = await prisma.goal.findMany({
      where: {
        user_id: userA.user.id,
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
      },
    });
    expect(copiedInDb).toHaveLength(2);
  });
});
