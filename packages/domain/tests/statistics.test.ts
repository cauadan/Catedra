import { describe, it, expect } from 'vitest';
import {
  STATISTICS_RANGES,
  statisticsQuerySchema,
  dashboardQuerySchema,
  calculatePeriodStatistics,
} from '../src/statistics';
import { localDateTimeToUtc, getWeekWindowUtc } from '../src/calendar';

describe('Schemas Zod de Estatísticas e Dashboard (statistics.ts)', () => {
  it('valida statisticsQuerySchema (range=day|week|month|30d&date=...) com .strict()', () => {
    expect(statisticsQuerySchema.safeParse({}).success).toBe(true);
    expect(
      statisticsQuerySchema.safeParse({
        range: '30d',
        date: '2026-10-30',
        subject_id: 'subj-1',
        topic_id: 'top-1',
      }).success
    ).toBe(true);
    expect(STATISTICS_RANGES).toEqual(['day', 'week', 'month', '30d']);

    // Rejeita range desconhecido, data inválida ou parâmetros extras (ex: from/to)
    expect(statisticsQuerySchema.safeParse({ range: 'custom' }).success).toBe(false);
    expect(statisticsQuerySchema.safeParse({ date: '2026-02-30' }).success).toBe(false);
    expect(
      statisticsQuerySchema.safeParse({ range: 'week', from: '2026-10-01', to: '2026-10-07' }).success
    ).toBe(false);
  });

  it('valida dashboardQuerySchema com .strict()', () => {
    expect(dashboardQuerySchema.safeParse({}).success).toBe(true);
    expect(dashboardQuerySchema.safeParse({ date: '2026-10-30' }).success).toBe(true);
    expect(dashboardQuerySchema.safeParse({ date: '2026-02-30' }).success).toBe(false);
    expect(dashboardQuerySchema.safeParse({ date: '2026-10-30', extra: '1' }).success).toBe(false);
  });
});

describe('calculatePeriodStatistics', () => {
  const tz = 'America/Rio_Branco';
  const subjects = [
    { id: 's-mat', name: 'Matemática', color: '#3B82F6', archived: false },
    { id: 's-port', name: 'Português', color: '#10B981', archived: false },
  ];
  const topics = [
    { id: 't-alg', name: 'Álgebra', parent_id: null, subject_id: 's-mat', archived: false },
    { id: 't-alg-lin', name: 'Álgebra Linear', parent_id: 't-alg', subject_id: 's-mat', archived: true },
    { id: 't-sint', name: 'Sintaxe', parent_id: null, subject_id: 's-port', archived: false },
  ];

  it('retorna null em effectiveness, adherence e accuracy quando período está vazio (sem NaN)', () => {
    const w = getWeekWindowUtc('2026-10-14', tz, 1);
    const res = calculatePeriodStatistics({
      windowUtc: w,
      days: w.days,
      timezone: tz,
      plannedSessions: [],
      studySessions: [],
      subjects,
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });

    expect(res.overview.agendaPlannedMinutes).toBe(0);
    expect(res.overview.executedPlannedSeconds).toBe(0);
    expect(res.overview.effectiveSeconds).toBe(0);
    expect(res.overview.effectiveMinutes).toBe(0);
    expect(res.overview.totalSessionSeconds).toBe(0);
    expect(res.overview.effectiveness).toBeNull();
    expect(res.overview.adherence).toBeNull();
    expect(res.overview.completedSessionsCount).toBe(0);
    expect(res.overview.activeDaysCount).toBe(0);
    expect(res.overview.totalDaysInPeriod).toBe(7);
    expect(res.overview.totalQuestions).toBe(0);
    expect(res.overview.totalCorrect).toBe(0);
    expect(res.overview.totalErrors).toBe(0);
    expect(res.overview.accuracy).toBeNull();
    expect(res.dailySeries).toHaveLength(7);
  });

  it('calcula overview, bySubject, byTopic (sem dupla contagem hierárquica), dailySeries e formulaMetadata com valores exatos', () => {
    const w = getWeekWindowUtc('2026-10-14', tz, 1); // 2026-10-12 a 2026-10-18

    // Agenda:
    // - PLANNED 60m em 2026-10-13 (entra em agendaPlannedMinutes)
    // - DONE 30m em 2026-10-14 (entra em agendaPlannedMinutes)
    // - SKIPPED 45m em 2026-10-15 (NÃO entra em agendaPlannedMinutes conforme correção 6)
    const plannedSessions = [
      {
        id: 'ps-1',
        subject_id: 's-mat',
        topic_id: 't-alg',
        scheduled_start: localDateTimeToUtc('2026-10-13T09:00', tz),
        planned_minutes: 60,
        status: 'PLANNED' as const,
      },
      {
        id: 'ps-2',
        subject_id: 's-mat',
        topic_id: 't-alg-lin',
        scheduled_start: localDateTimeToUtc('2026-10-14T14:00', tz),
        planned_minutes: 30,
        status: 'DONE' as const,
      },
      {
        id: 'ps-3',
        subject_id: 's-port',
        topic_id: 't-sint',
        scheduled_start: localDateTimeToUtc('2026-10-15T10:00', tz),
        planned_minutes: 45,
        status: 'SKIPPED' as const,
      },
    ];

    // Sessões executadas FINISHED:
    // Sessão 1 (em 2026-10-13): bloco planejado 40m (2400s). Total = 3000s, Pausa = 300s => Efetivo = 2700s (45 min)
    const s1Start = localDateTimeToUtc('2026-10-13T09:00', tz);
    const s1Pause = new Date(s1Start.getTime() + 1000 * 1000);
    const s1Resume = new Date(s1Start.getTime() + 1300 * 1000);
    const s1End = new Date(s1Start.getTime() + 3000 * 1000);

    // Sessão 2 (avulsa em 2026-10-14, no subassunto arquivado t-alg-lin): bloco planejado 20m (1200s). Total = 2400s, Distração declarada = 600s => Efetivo = 1800s (30 min)
    // Prática: 12 questões, 9 acertos em t-alg-lin
    const s2Start = localDateTimeToUtc('2026-10-14T20:00', tz);
    const s2End = new Date(s2Start.getTime() + 2400 * 1000);

    const studySessions = [
      {
        id: 'ss-1',
        topic_id: 't-alg',
        status: 'FINISHED' as const,
        started_at: s1Start,
        ended_at: s1End,
        planned_start: s1Start,
        blocks: [{ id: 'b-1', kind: 'NEW_CONTENT' as const, planned_minutes: 40, position: 0 }],
        events: [
          { type: 'BLOCK_START' as const, block_id: 'b-1', occurred_at: s1Start },
          { type: 'PAUSE' as const, block_id: 'b-1', occurred_at: s1Pause },
          { type: 'RESUME' as const, block_id: 'b-1', occurred_at: s1Resume },
          { type: 'BLOCK_FINISH' as const, block_id: 'b-1', occurred_at: s1End },
          { type: 'SESSION_FINISH' as const, block_id: null, occurred_at: s1End },
        ],
        practice_records: [],
      },
      {
        id: 'ss-2',
        topic_id: 't-alg-lin',
        status: 'FINISHED' as const,
        started_at: s2Start,
        ended_at: s2End,
        planned_start: null,
        blocks: [{ id: 'b-2', kind: 'PRACTICE' as const, planned_minutes: 20, position: 0 }],
        events: [
          { type: 'BLOCK_START' as const, block_id: 'b-2', occurred_at: s2Start },
          {
            type: 'DISTRACTION_DECLARED' as const,
            block_id: 'b-2',
            occurred_at: s2End,
            declared_seconds: 600,
          },
          { type: 'BLOCK_FINISH' as const, block_id: 'b-2', occurred_at: s2End },
          { type: 'SESSION_FINISH' as const, block_id: null, occurred_at: s2End },
        ],
        practice_records: [{ topic_id: 't-alg-lin', questions: 12, correct: 9 }],
      },
    ];

    const res = calculatePeriodStatistics({
      windowUtc: w,
      days: w.days,
      timezone: tz,
      plannedSessions,
      studySessions,
      subjects,
      topics,
      referenceNow: localDateTimeToUtc('2026-10-16T12:00', tz),
    });

    // agendaPlannedMinutes = 60 + 30 = 90 (SKIPPED 45 ignorado)
    expect(res.overview.agendaPlannedMinutes).toBe(90);
    // executedPlannedSeconds = (40 + 20) * 60 = 3600
    expect(res.overview.executedPlannedSeconds).toBe(3600);
    // effectiveSeconds = 2700 + 1800 = 4500 -> effectiveMinutes = 75
    expect(res.overview.effectiveSeconds).toBe(4500);
    expect(res.overview.effectiveMinutes).toBeCloseTo(75, 5);
    // totalSessionSeconds = 3000 + 2400 = 5400
    expect(res.overview.totalSessionSeconds).toBe(5400);
    // effectiveness = (4500 / 5400) * 100 = 83.3333...
    expect(res.overview.effectiveness).toBeCloseTo((4500 / 5400) * 100, 5);
    // adherence = (4500 / 3600) * 100 = 125% (ultrapassa 100% sem truncar!)
    expect(res.overview.adherence).toBeCloseTo(125, 5);
    expect(res.overview.completedSessionsCount).toBe(2);
    expect(res.overview.activeDaysCount).toBe(2);
    expect(res.overview.totalDaysInPeriod).toBe(7);
    expect(res.overview.totalQuestions).toBe(12);
    expect(res.overview.totalCorrect).toBe(9);
    expect(res.overview.totalErrors).toBe(3);
    expect(res.overview.accuracy).toBeCloseTo(75, 5);

    // byTopic: agrupamento direto sem somar o filho (t-alg-lin) na linha do pai (t-alg)
    const rowAlg = res.byTopic.find((t) => t.topicId === 't-alg');
    const rowAlgLin = res.byTopic.find((t) => t.topicId === 't-alg-lin');
    expect(rowAlg).toBeDefined();
    expect(rowAlg!.effectiveMinutes).toBeCloseTo(45, 5);
    expect(rowAlg!.totalQuestions).toBe(0);
    expect(rowAlg!.hasSufficientQuestions).toBe(false);

    expect(rowAlgLin).toBeDefined();
    expect(rowAlgLin!.effectiveMinutes).toBeCloseTo(30, 5);
    expect(rowAlgLin!.totalQuestions).toBe(12);
    expect(rowAlgLin!.totalCorrect).toBe(9);
    expect(rowAlgLin!.accuracy).toBeCloseTo(75, 5);
    expect(rowAlgLin!.archived).toBe(true);
    expect(rowAlgLin!.hasSufficientQuestions).toBe(true);

    // Quando filtramos por topicId = 't-alg', inclui toda a subárvore (t-alg + t-alg-lin)
    const filteredByParent = calculatePeriodStatistics({
      windowUtc: w,
      days: w.days,
      timezone: tz,
      plannedSessions,
      studySessions,
      subjects,
      topics,
      filterTopicId: 't-alg',
      referenceNow: localDateTimeToUtc('2026-10-16T12:00', tz),
    });
    expect(filteredByParent.overview.effectiveMinutes).toBeCloseTo(75, 5);
    expect(filteredByParent.overview.agendaPlannedMinutes).toBe(90);
    expect(filteredByParent.overview.totalQuestions).toBe(12);
  });
});
