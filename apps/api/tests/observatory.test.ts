import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';

describe('Observatory API (GET /api/observatory): Segurança, Fuso, Fixture 70/30 e Consistência entre 3 Telas', () => {
  let userA: Awaited<ReturnType<typeof createStudyUser>>;
  let userB: Awaited<ReturnType<typeof createStudyUser>>;

  beforeAll(async () => {
    userA = await createStudyUser('ObsUserA');
    userB = await createStudyUser('ObsUserB');

    await prisma.user.update({
      where: { id: userA.user.id },
      data: { timezone: 'America/Rio_Branco', week_starts_on: 'MONDAY' },
    });
    await prisma.user.update({
      where: { id: userB.user.id },
      data: { timezone: 'America/Rio_Branco', week_starts_on: 'MONDAY' },
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    const userIds = [userA.user.id, userB.user.id];
    await prisma.practiceRecord.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.sessionEvaluation.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.sessionEvent.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.sessionBlock.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.studySession.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.plannedBlock.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.plannedSession.deleteMany({ where: { user_id: { in: userIds } } });
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

  it('retorna 401 sem sessão e garante isolamento estrito entre usuários', async () => {
    const unauth = await request(app).get('/api/observatory');
    expect(unauth.status).toBe(401);

    // Cria sessão apenas para userB
    const sb = await prisma.studySession.create({
      data: {
        user_id: userB.user.id,
        topic_id: userB.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-14T14:00:00.000Z'),
        ended_at: new Date('2026-10-14T15:00:00.000Z'),
      },
    });
    await prisma.practiceRecord.create({
      data: {
        user_id: userB.user.id,
        study_session_id: sb.id,
        topic_id: userB.topic.id,
        questions: 20,
        correct: 18,
      },
    });

    const resA = await request(app)
      .get('/api/observatory?date=2026-10-14')
      .set('Cookie', userA.cookie);

    expect(resA.status).toBe(200);
    expect(resA.body.data.hasAnyData).toBe(false);
    expect(resA.body.data.topicClassification.strong).toEqual([]);
  });

  it('rejeita semana futura com 400 Bad Request e valida query params com Zod .strict()', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-21T15:00:00.000Z'));

    const futureRes = await request(app)
      .get('/api/observatory?date=2026-10-28')
      .set('Cookie', userA.cookie);

    expect(futureRes.status).toBe(400);
    expect(futureRes.body.error.message).toBe(
      'Não é possível consultar o Observatório para semanas futuras.'
    );

    const invalidDateRes = await request(app)
      .get('/api/observatory?date=2026-02-30')
      .set('Cookie', userA.cookie);
    expect(invalidDateRes.status).toBe(400);

    const extraKeyRes = await request(app)
      .get('/api/observatory?date=2026-10-21&foo=bar')
      .set('Cookie', userA.cookie);
    expect(extraKeyRes.status).toBe(400);
  });

  it('atribui sessão às 23:50 locais (America/Rio_Branco) na virada de semana, valida fixture 70/30 calculada à mão e semana parcial com vi.setSystemTime', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Quarta-feira 2026-10-21T15:00Z (10:00 em Rio Branco) -> semana atual parcial (elapsedDaysCount = 3)
    vi.setSystemTime(new Date('2026-10-21T15:00:00.000Z'));

    // Sessão 1: Domingo 2026-10-18 às 23:50 em America/Rio_Branco = 2026-10-19T04:50:00.000Z
    // Pertence à semana anterior (12/10 a 18/10), mas cai na janela de 30 dias da semana atual!
    // 10 questões, 8 acertos, avaliação GOOD (67)
    const s1 = await prisma.studySession.create({
      data: {
        user_id: userA.user.id,
        topic_id: userA.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-19T04:50:00.000Z'),
        ended_at: new Date('2026-10-19T05:20:00.000Z'),
      },
    });
    const b1 = await prisma.sessionBlock.create({
      data: {
        user_id: userA.user.id,
        study_session_id: s1.id,
        kind: 'PRACTICE',
        planned_minutes: 30,
        position: 0,
      },
    });
    await prisma.sessionEvent.createMany({
      data: [
        {
          user_id: userA.user.id,
          study_session_id: s1.id,
          block_id: b1.id,
          type: 'BLOCK_START',
          occurred_at: new Date('2026-10-19T04:50:00.000Z'),
        },
        {
          user_id: userA.user.id,
          study_session_id: s1.id,
          block_id: b1.id,
          type: 'BLOCK_FINISH',
          occurred_at: new Date('2026-10-19T05:20:00.000Z'),
        },
        {
          user_id: userA.user.id,
          study_session_id: s1.id,
          block_id: null,
          type: 'SESSION_FINISH',
          occurred_at: new Date('2026-10-19T05:20:00.000Z'),
        },
      ],
    });
    await prisma.practiceRecord.create({
      data: {
        user_id: userA.user.id,
        study_session_id: s1.id,
        topic_id: userA.topic.id,
        questions: 10,
        correct: 8,
      },
    });
    await prisma.sessionEvaluation.create({
      data: {
        user_id: userA.user.id,
        study_session_id: s1.id,
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
      },
    });

    // Sessão 2: Terça-feira 2026-10-20 às 10:00 local = 2026-10-20T15:00:00.000Z (na semana atual 19/10 a 25/10)
    // 10 questões, 7 acertos, avaliação MASTERED (100)
    const s2 = await prisma.studySession.create({
      data: {
        user_id: userA.user.id,
        topic_id: userA.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-20T15:00:00.000Z'),
        ended_at: new Date('2026-10-20T16:00:00.000Z'),
      },
    });
    const b2 = await prisma.sessionBlock.create({
      data: {
        user_id: userA.user.id,
        study_session_id: s2.id,
        kind: 'PRACTICE',
        planned_minutes: 60,
        position: 0,
      },
    });
    await prisma.sessionEvent.createMany({
      data: [
        {
          user_id: userA.user.id,
          study_session_id: s2.id,
          block_id: b2.id,
          type: 'BLOCK_START',
          occurred_at: new Date('2026-10-20T15:00:00.000Z'),
        },
        {
          user_id: userA.user.id,
          study_session_id: s2.id,
          block_id: b2.id,
          type: 'BLOCK_FINISH',
          occurred_at: new Date('2026-10-20T16:00:00.000Z'),
        },
        {
          user_id: userA.user.id,
          study_session_id: s2.id,
          block_id: null,
          type: 'SESSION_FINISH',
          occurred_at: new Date('2026-10-20T16:00:00.000Z'),
        },
      ],
    });
    await prisma.practiceRecord.create({
      data: {
        user_id: userA.user.id,
        study_session_id: s2.id,
        topic_id: userA.topic.id,
        questions: 10,
        correct: 7,
      },
    });
    await prisma.sessionEvaluation.create({
      data: {
        user_id: userA.user.id,
        study_session_id: s2.id,
        understanding: 'MASTERED',
        focus: 'HIGH',
        difficulty: 'EASY',
      },
    });

    // 1. Consulta semana passada encerrada (2026-10-12 a 2026-10-18) -> inclui s1 (23:50 de 18/10)
    const pastRes = await request(app)
      .get('/api/observatory?date=2026-10-18')
      .set('Cookie', userA.cookie);
    expect(pastRes.status).toBe(200);
    expect(pastRes.body.data.isPartialWeek).toBe(false);
    expect(pastRes.body.data.weekComparison.selectedWeek.effectiveMinutes).toBe(30);
    expect(pastRes.body.data.weekComparison.selectedWeek.totalQuestions).toBe(10);

    // 2. Consulta semana atual parcial (2026-10-19 a 2026-10-25) -> inclui apenas s2 na semana (60 min, 10q),
    // mas a classificação de 30 dias até hoje (2026-10-21) inclui s1 + s2 (20q, 15c, GOOD+MASTERED -> 77.55 REGULAR, displayScore 77.5)!
    const curRes = await request(app)
      .get('/api/observatory?date=2026-10-21')
      .set('Cookie', userA.cookie);
    expect(curRes.status).toBe(200);
    expect(curRes.body.data.isPartialWeek).toBe(true);
    expect(curRes.body.data.elapsedDaysCount).toBe(3);
    expect(curRes.body.data.weekComparison.selectedWeek.effectiveMinutes).toBe(60);
    expect(curRes.body.data.weekComparison.selectedWeek.totalQuestions).toBe(10);

    const regTopic = curRes.body.data.topicClassification.regular.find(
      (t: any) => t.topicId === userA.topic.id
    );
    expect(regTopic).toBeDefined();
    expect(regTopic.classification.classification).toBe('REGULAR');
    expect(regTopic.classification.displayScore).toBe(77.5);
    expect(regTopic.classification.questionsInWindow).toBe(20);
    expect(regTopic.classification.correctInWindow).toBe(15);

    // 3. CONSISTÊNCIA ENTRE AS 3 TELAS (deep equal do objeto classification entre /api/statistics?range=week, /api/dashboard e /api/observatory)
    const [statsWeekRes, dashRes] = await Promise.all([
      request(app)
        .get('/api/statistics?range=week&date=2026-10-21')
        .set('Cookie', userA.cookie),
      request(app)
        .get('/api/dashboard?date=2026-10-21')
        .set('Cookie', userA.cookie),
    ]);

    expect(statsWeekRes.status).toBe(200);
    expect(dashRes.status).toBe(200);

    const statsTopicClass = statsWeekRes.body.data.byTopic.find(
      (t: any) => t.topicId === userA.topic.id
    )?.classification;
    const statsSubjectClass = statsWeekRes.body.data.bySubject.find(
      (s: any) => s.subjectId === userA.subject.id
    )?.classification;
    const dashSubjectClass = dashRes.body.data.subjectProgress.find(
      (s: any) => s.subjectId === userA.subject.id
    )?.classification;
    const obsSubjectClass = curRes.body.data.subjectClassification.find(
      (s: any) => s.subjectId === userA.subject.id
    )?.classification;

    expect(statsTopicClass).toEqual(regTopic.classification);
    expect(statsSubjectClass).toEqual(dashSubjectClass);
    expect(dashSubjectClass).toEqual(obsSubjectClass);
  });
});
