import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';

describe('Study Session API: Concurrency Tests (Promise.all em PostgreSQL Real)', () => {
  let user: Awaited<ReturnType<typeof createStudyUser>>;

  beforeAll(async () => {
    user = await createStudyUser('ConcurrencyUser');
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: user.user.id },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('duas chamadas concorrentes de criação (POST /) resultam em exatamente 1 sucesso (201) e 1 conflito (409)', async () => {
    const payload = {
      topic_id: user.topic.id,
      blocks: [{ kind: 'REVIEW', planned_minutes: 15 }],
    };

    const [res1, res2] = await Promise.all([
      request(app).post('/api/study-sessions').set('Cookie', user.cookie).send(payload),
      request(app).post('/api/study-sessions').set('Cookie', user.cookie).send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const res409 = res1.status === 409 ? res1 : res2;
    expect(res409.body.error.code).toBe('ACTIVE_SESSION_EXISTS');

    // Confirmar integridade física no PostgreSQL: exatamente 1 sessão ativa
    const activeSessions = await prisma.studySession.findMany({
      where: { user_id: user.user.id, status: 'IN_PROGRESS' },
    });
    expect(activeSessions).toHaveLength(1);
  });

  it('duas chamadas concorrentes de evento (PAUSE duplo) resultam em exatamente 1 sucesso (200) e 1 conflito (409)', async () => {
    const activeSession = await prisma.studySession.findFirstOrThrow({
      where: { user_id: user.user.id, status: 'IN_PROGRESS' },
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/study-sessions/${activeSession.id}/events`)
        .set('Cookie', user.cookie)
        .send({ type: 'PAUSE' }),
      request(app)
        .post(`/api/study-sessions/${activeSession.id}/events`)
        .set('Cookie', user.cookie)
        .send({ type: 'PAUSE' }),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const res409 = res1.status === 409 ? res1 : res2;
    expect(res409.body.error.code).toBe('INVALID_TRANSITION');

    // Confirmar no banco: exatamente 1 evento PAUSE inserido
    const pauseEvents = await prisma.sessionEvent.findMany({
      where: { study_session_id: activeSession.id, type: 'PAUSE' },
    });
    expect(pauseEvents).toHaveLength(1);
  });

  it('duas chamadas concorrentes de avaliação (POST /:id/evaluation) resultam em exatamente 1 sucesso (201) e 1 conflito (409)', async () => {
    const activeSession = await prisma.studySession.findFirstOrThrow({
      where: { user_id: user.user.id, status: 'IN_PROGRESS' },
    });

    // Concluir a sessão primeiro
    await request(app)
      .post(`/api/study-sessions/${activeSession.id}/finish`)
      .set('Cookie', user.cookie);

    const payload = {
      understanding: 'GOOD',
      focus: 'HIGH',
      difficulty: 'NORMAL',
      notes: 'Avaliação concorrente.',
    };

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/study-sessions/${activeSession.id}/evaluation`)
        .set('Cookie', user.cookie)
        .send(payload),
      request(app)
        .post(`/api/study-sessions/${activeSession.id}/evaluation`)
        .set('Cookie', user.cookie)
        .send(payload),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const res409 = res1.status === 409 ? res1 : res2;
    expect(res409.body.error.code).toBe('EVALUATION_ALREADY_EXISTS');

    // Confirmar no banco: exatamente 1 registro em session_evaluations
    const evaluations = await prisma.sessionEvaluation.findMany({
      where: { study_session_id: activeSession.id },
    });
    expect(evaluations).toHaveLength(1);
  });
});
