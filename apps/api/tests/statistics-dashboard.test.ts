import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';

describe('Statistics & Dashboard API (/api/statistics e /api/dashboard): Exatidão Não-Circular e Fronteiras', () => {
  let user: Awaited<ReturnType<typeof createStudyUser>>;
  let childTopic: { id: string };

  beforeAll(async () => {
    user = await createStudyUser('StatsDashUser');

    // Fuso America/Rio_Branco (UTC-5) e semana iniciando na segunda-feira
    await prisma.user.update({
      where: { id: user.user.id },
      data: { timezone: 'America/Rio_Branco', week_starts_on: 'MONDAY' },
    });

    childTopic = await prisma.topic.create({
      data: {
        user_id: user.user.id,
        subject_id: user.subject.id,
        parent_id: user.topic.id,
        name: 'Álgebra Linear',
        archived: false,
      },
    });
  });

  afterEach(async () => {
    await prisma.practiceRecord.deleteMany({ where: { user_id: user.user.id } });
    await prisma.sessionEvaluation.deleteMany({ where: { user_id: user.user.id } });
    await prisma.sessionEvent.deleteMany({ where: { user_id: user.user.id } });
    await prisma.sessionBlock.deleteMany({ where: { user_id: user.user.id } });
    await prisma.studySession.deleteMany({ where: { user_id: user.user.id } });
    await prisma.plannedBlock.deleteMany({ where: { user_id: user.user.id } });
    await prisma.plannedSession.deleteMany({ where: { user_id: user.user.id } });
    await prisma.goal.deleteMany({ where: { user_id: user.user.id } });
    await prisma.topic.update({
      where: { id: childTopic.id },
      data: { archived: false },
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { id: user.user.id } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('FIXTURE NÃO-CIRCULAR (calculada à mão): retorna totais exatos de overview, bySubject, byTopic (com arquivado) e dailySeries', async () => {
    // Semana de 2026-10-12 a 2026-10-18 em America/Rio_Branco (UTC-5):
    // 1. Agenda:
    // - 2026-10-13T09:00 local = 2026-10-13T14:00:00.000Z (PLANNED, 60 min)
    // - 2026-10-14T14:00 local = 2026-10-14T19:00:00.000Z (DONE, 30 min)
    // - 2026-10-15T10:00 local = 2026-10-15T15:00:00.000Z (SKIPPED, 45 min -> ignorada)
    await prisma.plannedSession.createMany({
      data: [
        {
          user_id: user.user.id,
          subject_id: user.subject.id,
          topic_id: user.topic.id,
          scheduled_start: new Date('2026-10-13T14:00:00.000Z'),
          planned_minutes: 60,
          status: 'PLANNED',
        },
        {
          user_id: user.user.id,
          subject_id: user.subject.id,
          topic_id: childTopic.id,
          scheduled_start: new Date('2026-10-14T19:00:00.000Z'),
          planned_minutes: 30,
          status: 'DONE',
        },
        {
          user_id: user.user.id,
          subject_id: user.subject.id,
          topic_id: user.topic.id,
          scheduled_start: new Date('2026-10-15T15:00:00.000Z'),
          planned_minutes: 45,
          status: 'SKIPPED',
        },
      ],
    });

    // 2. Sessão 1 (FINISHED em 2026-10-13T09:00 local = 2026-10-13T14:00:00.000Z):
    // Bloco planejado = 40 min (2400s). Bruto = 3000s (14:00Z -> 14:50Z), Pausa = 300s (14:10Z -> 14:15Z) => Efetivo = 2700s (45 min).
    const s1 = await prisma.studySession.create({
      data: {
        user_id: user.user.id,
        topic_id: user.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-13T14:00:00.000Z'),
        ended_at: new Date('2026-10-13T14:50:00.000Z'),
      },
    });
    const b1 = await prisma.sessionBlock.create({
      data: {
        user_id: user.user.id,
        study_session_id: s1.id,
        kind: 'NEW_CONTENT',
        planned_minutes: 40,
        position: 0,
      },
    });
    await prisma.sessionEvent.createMany({
      data: [
        {
          user_id: user.user.id,
          study_session_id: s1.id,
          block_id: b1.id,
          type: 'BLOCK_START',
          occurred_at: new Date('2026-10-13T14:00:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: s1.id,
          block_id: b1.id,
          type: 'PAUSE',
          occurred_at: new Date('2026-10-13T14:10:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: s1.id,
          block_id: b1.id,
          type: 'RESUME',
          occurred_at: new Date('2026-10-13T14:15:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: s1.id,
          block_id: b1.id,
          type: 'BLOCK_FINISH',
          occurred_at: new Date('2026-10-13T14:50:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: s1.id,
          block_id: null,
          type: 'SESSION_FINISH',
          occurred_at: new Date('2026-10-13T14:50:00.000Z'),
        },
      ],
    });

    // 3. Sessão 2 (avulsa FINISHED em 2026-10-14T23:50 local = 2026-10-15T04:50:00.000Z, no subassunto childTopic):
    // Bloco planejado = 20 min (1200s). Bruto = 2400s (04:50Z -> 05:30Z), Distração declarada = 600s => Efetivo = 1800s (30 min).
    // Prática: 12 questões, 9 acertos.
    const s2 = await prisma.studySession.create({
      data: {
        user_id: user.user.id,
        topic_id: childTopic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-15T04:50:00.000Z'),
        ended_at: new Date('2026-10-15T05:30:00.000Z'),
      },
    });
    const b2 = await prisma.sessionBlock.create({
      data: {
        user_id: user.user.id,
        study_session_id: s2.id,
        kind: 'PRACTICE',
        planned_minutes: 20,
        position: 0,
      },
    });
    await prisma.sessionEvent.createMany({
      data: [
        {
          user_id: user.user.id,
          study_session_id: s2.id,
          block_id: b2.id,
          type: 'BLOCK_START',
          occurred_at: new Date('2026-10-15T04:50:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: s2.id,
          block_id: b2.id,
          type: 'DISTRACTION_DECLARED',
          occurred_at: new Date('2026-10-15T05:30:00.000Z'),
          declared_seconds: 600,
        },
        {
          user_id: user.user.id,
          study_session_id: s2.id,
          block_id: b2.id,
          type: 'BLOCK_FINISH',
          occurred_at: new Date('2026-10-15T05:30:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: s2.id,
          block_id: null,
          type: 'SESSION_FINISH',
          occurred_at: new Date('2026-10-15T05:30:00.000Z'),
        },
      ],
    });
    await prisma.practiceRecord.create({
      data: {
        user_id: user.user.id,
        study_session_id: s2.id,
        block_id: b2.id,
        topic_id: childTopic.id,
        questions: 12,
        correct: 9,
      },
    });

    // Arquiva o subassunto para validar que o histórico permanece visível e marcado com archived: true
    await prisma.topic.update({
      where: { id: childTopic.id },
      data: { archived: true },
    });

    const statsRes = await request(app)
      .get('/api/statistics?range=week&date=2026-10-14')
      .set('Cookie', user.cookie);

    expect(statsRes.status).toBe(200);
    const { overview, bySubject, byTopic, dailySeries } = statsRes.body.data;

    // Constantes literais calculadas à mão:
    expect(overview.agendaPlannedMinutes).toBe(90);
    expect(overview.executedPlannedSeconds).toBe(3600);
    expect(overview.effectiveSeconds).toBe(4500);
    expect(overview.effectiveMinutes).toBeCloseTo(75, 5);
    expect(overview.totalSessionSeconds).toBe(5400);
    expect(overview.effectiveness).toBeCloseTo(83.333333, 3);
    expect(overview.adherence).toBeCloseTo(125, 5);
    expect(overview.completedSessionsCount).toBe(2);
    expect(overview.activeDaysCount).toBe(2);
    expect(overview.totalDaysInPeriod).toBe(7);
    expect(overview.totalQuestions).toBe(12);
    expect(overview.totalCorrect).toBe(9);
    expect(overview.totalErrors).toBe(3);
    expect(overview.accuracy).toBeCloseTo(75, 5);

    expect(bySubject).toHaveLength(1);
    expect(bySubject[0].effectiveMinutes).toBeCloseTo(75, 5);
    expect(bySubject[0].totalQuestions).toBe(12);

    // byTopic sem dupla contagem:
    const parentRow = byTopic.find((r: any) => r.topicId === user.topic.id);
    const childRow = byTopic.find((r: any) => r.topicId === childTopic.id);
    expect(parentRow.effectiveMinutes).toBeCloseTo(45, 5);
    expect(parentRow.totalQuestions).toBe(0);
    expect(childRow.effectiveMinutes).toBeCloseTo(30, 5);
    expect(childRow.totalQuestions).toBe(12);
    expect(childRow.archived).toBe(true);
    expect(childRow.hasSufficientQuestions).toBe(true);

    // Verifica que a sessão iniciada às 23:50 de 2026-10-14 local caiu em 2026-10-14 na série diária
    const day14 = dailySeries.find((d: any) => d.date === '2026-10-14');
    expect(day14.effectiveMinutes).toBeCloseTo(30, 5);
    expect(day14.questions).toBe(12);

    // Permite filtrar diretamente pelo assunto arquivado
    const archivedFilterRes = await request(app)
      .get(`/api/statistics?range=week&date=2026-10-14&topic_id=${childTopic.id}`)
      .set('Cookie', user.cookie);
    expect(archivedFilterRes.status).toBe(200);
    expect(archivedFilterRes.body.data.overview.effectiveMinutes).toBeCloseTo(30, 5);
  });

  it('SEMANA QUE ATRAVESSA O MÊS (2026-10-30): sessão planejada em 2026-11-01 entra no weekSummary e metas semanais do Dashboard, mas não no resumo mensal de outubro', async () => {
    // Em 2026-10-30 (sexta-feira), a semana vai de 2026-10-26 (segunda) a 2026-11-01 (domingo).
    // Criamos uma sessão planejada em 2026-10-27 (50 min) e outra em 2026-11-01 (40 min).
    await prisma.plannedSession.createMany({
      data: [
        {
          user_id: user.user.id,
          subject_id: user.subject.id,
          topic_id: user.topic.id,
          scheduled_start: new Date('2026-10-27T15:00:00.000Z'), // 10:00 local em 2026-10-27
          planned_minutes: 50,
          status: 'PLANNED',
        },
        {
          user_id: user.user.id,
          subject_id: user.subject.id,
          topic_id: user.topic.id,
          scheduled_start: new Date('2026-11-01T15:00:00.000Z'), // 10:00 local em 2026-11-01
          planned_minutes: 40,
          status: 'PLANNED',
        },
      ],
    });

    // Meta semanal para a semana de 2026-10-26 e sessão concluída em 2026-11-01 (30 min efetivos)
    await prisma.goal.create({
      data: {
        user_id: user.user.id,
        kind: 'EFFORT',
        metric: 'EFFECTIVE_MINUTES',
        period: 'WEEK',
        period_start_local_date: '2026-10-26',
        target_value: 60,
        subject_id: user.subject.id,
      },
    });

    const sNov1 = await prisma.studySession.create({
      data: {
        user_id: user.user.id,
        topic_id: user.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-11-01T16:00:00.000Z'), // 11:00 local em 2026-11-01
        ended_at: new Date('2026-11-01T16:30:00.000Z'),
      },
    });
    const bNov1 = await prisma.sessionBlock.create({
      data: {
        user_id: user.user.id,
        study_session_id: sNov1.id,
        kind: 'REVIEW',
        planned_minutes: 30,
        position: 0,
      },
    });
    await prisma.sessionEvent.createMany({
      data: [
        {
          user_id: user.user.id,
          study_session_id: sNov1.id,
          block_id: bNov1.id,
          type: 'BLOCK_START',
          occurred_at: new Date('2026-11-01T16:00:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: sNov1.id,
          block_id: bNov1.id,
          type: 'BLOCK_FINISH',
          occurred_at: new Date('2026-11-01T16:30:00.000Z'),
        },
        {
          user_id: user.user.id,
          study_session_id: sNov1.id,
          block_id: null,
          type: 'SESSION_FINISH',
          occurred_at: new Date('2026-11-01T16:30:00.000Z'),
        },
      ],
    });

    const dashRes = await request(app)
      .get('/api/dashboard?date=2026-10-30')
      .set('Cookie', user.cookie);

    expect(dashRes.status).toBe(200);
    const dash = dashRes.body.data;

    // 1. weekSummary deve incluir AMBAS as sessões planejadas (50 + 40 = 90) e a sessão concluída de 2026-11-01 (30 min)
    expect(dash.weekSummary.overview.agendaPlannedMinutes).toBe(90);
    expect(dash.weekSummary.overview.effectiveMinutes).toBeCloseTo(30, 5);

    // 2. Meta semanal em dash.goals deve contabilizar os 30 min estudados em 2026-11-01
    const weekGoal = dash.goals.find((g: any) => g.period === 'WEEK');
    expect(weekGoal).toBeDefined();
    expect(weekGoal.current_value).toBeCloseTo(30, 5);

    // 3. nextSession em 2026-10-30 (como não há sessão planejada em 2026-10-30, busca a futura em 2026-11-01 com isFutureDay: true)
    expect(dash.today.nextSession).toBeDefined();
    expect(dash.today.nextSession.isFutureDay).toBe(true);
    expect(dash.today.nextSession.localDate).toBe('2026-11-01');

    // 4. O resumo mensal de outubro (GET /api/statistics?range=month&date=2026-10-30) NÃO inclui 2026-11-01
    const octStatsRes = await request(app)
      .get('/api/statistics?range=month&date=2026-10-30')
      .set('Cookie', user.cookie);
    expect(octStatsRes.status).toBe(200);
    expect(octStatsRes.body.data.overview.agendaPlannedMinutes).toBe(50);
    expect(octStatsRes.body.data.overview.effectiveMinutes).toBe(0);
  });

  it('FASE 8 - CLASSIFICAÇÃO 70/30 E JANELA UNIFICADA: retorna classification exato (20q/15c + GOOD/MASTERED -> 77.55 REGULAR, displayScore 77.5) em /api/statistics (mesmo com range=day) e classificationSummary em /api/dashboard', async () => {
    // Sessão 1 em 2026-10-10: 10 questões, 8 acertos, avaliação GOOD (67)
    const s1 = await prisma.studySession.create({
      data: {
        user_id: user.user.id,
        topic_id: user.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-10T14:00:00.000Z'),
        ended_at: new Date('2026-10-10T15:00:00.000Z'),
      },
    });
    await prisma.practiceRecord.create({
      data: {
        user_id: user.user.id,
        study_session_id: s1.id,
        topic_id: user.topic.id,
        questions: 10,
        correct: 8,
      },
    });
    await prisma.sessionEvaluation.create({
      data: {
        user_id: user.user.id,
        study_session_id: s1.id,
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
      },
    });

    // Sessão 2 em 2026-10-14: 10 questões, 7 acertos, avaliação MASTERED (100)
    // Total nos 30 dias até 2026-10-15: 20 questões, 15 acertos (75%), avaliações [67, 100] (média 83.5)
    // finalScore = 0.7 * 75 + 0.3 * 83.5 = 52.5 + 25.05 = 77.55 -> REGULAR, displayScore = 77.5
    const s2 = await prisma.studySession.create({
      data: {
        user_id: user.user.id,
        topic_id: user.topic.id,
        status: 'FINISHED',
        started_at: new Date('2026-10-14T14:00:00.000Z'),
        ended_at: new Date('2026-10-14T15:00:00.000Z'),
      },
    });
    await prisma.practiceRecord.create({
      data: {
        user_id: user.user.id,
        study_session_id: s2.id,
        topic_id: user.topic.id,
        questions: 10,
        correct: 7,
      },
    });
    await prisma.sessionEvaluation.create({
      data: {
        user_id: user.user.id,
        study_session_id: s2.id,
        understanding: 'MASTERED',
        focus: 'HIGH',
        difficulty: 'EASY',
      },
    });

    // Consultando range=day em 2026-10-15 (dia sem sessões): a tabela do dia tem 0 questões no dia,
    // mas classification usa a janela de 30 dias até 2026-10-15 com as 20 questões!
    const statsDayRes = await request(app)
      .get('/api/statistics?range=day&date=2026-10-15')
      .set('Cookie', user.cookie);

    expect(statsDayRes.status).toBe(200);
    const topicRow = statsDayRes.body.data.byTopic.find((t: any) => t.topicId === user.topic.id);
    expect(topicRow).toBeDefined();
    expect(topicRow.totalQuestions).toBe(0); // no dia 15/10
    expect(topicRow.classification).toBeDefined();
    expect(topicRow.classification.classification).toBe('REGULAR');
    expect(topicRow.classification.displayScore).toBe(77.5);
    expect(topicRow.classification.questionsInWindow).toBe(20);
    expect(topicRow.classification.correctInWindow).toBe(15);
    expect(topicRow.classification.windowEndLocalDate).toBe('2026-10-15');
    expect(topicRow.classification.windowStartLocalDate).toBe('2026-09-16');

    // childTopic nunca foi estudado nos 30 dias -> não entra em byTopic nem em classificationSummary
    const childRow = statsDayRes.body.data.byTopic.find((t: any) => t.topicId === childTopic.id);
    expect(childRow).toBeUndefined();

    const dashRes = await request(app)
      .get('/api/dashboard?date=2026-10-15')
      .set('Cookie', user.cookie);

    expect(dashRes.status).toBe(200);
    const dash = dashRes.body.data;
    expect(dash.classificationSummary).toEqual({
      strongCount: 0,
      regularCount: 1,
      weakCount: 0,
      insufficientCount: 0,
    });
    expect(dash.subjectProgress[0].classification).toBeDefined();
    expect(dash.subjectProgress[0].classification.classification).toBe('REGULAR');
    expect(dash.subjectProgress[0].classification.displayScore).toBe(77.5);
  });
});
