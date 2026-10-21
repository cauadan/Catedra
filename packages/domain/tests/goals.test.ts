import { describe, it, expect } from 'vitest';
import {
  MIN_QUESTIONS,
  GOAL_KINDS,
  GOAL_METRICS,
  GOAL_PERIODS,
  GOAL_STATUSES,
  goalCreateSchema,
  goalUpdateSchema,
  goalCopySchema,
  goalListQuerySchema,
  validateGoalTargetValue,
  getTopicSubtreeIds,
  calculateGoalProgress,
  type GoalProgressSessionInput,
} from '../src/goals';
import { localDateTimeToUtc, getGoalPeriodWindowUtc } from '../src/calendar';

describe('Constantes e Schemas Zod de Metas (goals.ts)', () => {
  it('exporta constantes oficiais', () => {
    expect(MIN_QUESTIONS).toBe(10);
    expect(GOAL_KINDS).toEqual(['EFFORT', 'RESULT']);
    expect(GOAL_METRICS).toEqual([
      'EFFECTIVE_MINUTES',
      'QUESTIONS',
      'TOPICS_COMPLETED',
      'REVIEWS',
      'ACCURACY',
    ]);
    expect(GOAL_PERIODS).toEqual(['DAY', 'WEEK', 'MONTH']);
    expect(GOAL_STATUSES).toEqual([
      'ACHIEVED',
      'IN_PROGRESS',
      'MISSED',
      'UPCOMING',
      'INSUFFICIENT_DATA',
    ]);
  });

  it('valida coerência entre kind e metric e limites de target_value em goalCreateSchema', () => {
    // EFFORT + EFFECTIVE_MINUTES válido
    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'EFFECTIVE_MINUTES',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 300,
      }).success
    ).toBe(true);

    // RESULT + ACCURACY válido
    expect(
      goalCreateSchema.safeParse({
        kind: 'RESULT',
        metric: 'ACCURACY',
        period: 'MONTH',
        period_start_local_date: '2026-10-01',
        target_value: 82.5,
      }).success
    ).toBe(true);

    // Permite informar subject_id e topic_id juntos (validação de pertencimento na API)
    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'DAY',
        period_start_local_date: '2026-10-14',
        target_value: 20,
        subject_id: 'subj-1',
        topic_id: 'top-1',
      }).success
    ).toBe(true);

    // Rejeita EFFORT com ACCURACY
    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'ACCURACY',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 80,
      }).success
    ).toBe(false);

    // Rejeita RESULT com métrica de esforço
    expect(
      goalCreateSchema.safeParse({
        kind: 'RESULT',
        metric: 'QUESTIONS',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 50,
      }).success
    ).toBe(false);

    // Rejeita métrica de esforço com valor fracionário ou <= 0
    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 10.5,
      }).success
    ).toBe(false);

    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'EFFECTIVE_MINUTES',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 0,
      }).success
    ).toBe(false);

    // Rejeita ACCURACY fora de [1, 100]
    expect(
      goalCreateSchema.safeParse({
        kind: 'RESULT',
        metric: 'ACCURACY',
        period: 'MONTH',
        period_start_local_date: '2026-10-01',
        target_value: 105,
      }).success
    ).toBe(false);

    expect(
      goalCreateSchema.safeParse({
        kind: 'RESULT',
        metric: 'ACCURACY',
        period: 'MONTH',
        period_start_local_date: '2026-10-01',
        target_value: 0,
      }).success
    ).toBe(false);

    // Rejeita data inválida ou campos extras (.strict())
    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'DAY',
        period_start_local_date: '2026-02-30',
        target_value: 20,
      }).success
    ).toBe(false);

    expect(
      goalCreateSchema.safeParse({
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'DAY',
        period_start_local_date: '2026-10-14',
        target_value: 20,
        extra: 'invalido',
      }).success
    ).toBe(false);
  });

  it('valida goalUpdateSchema, validateGoalTargetValue, goalCopySchema e goalListQuerySchema com .strict()', () => {
    expect(goalUpdateSchema.safeParse({ target_value: 50 }).success).toBe(true);
    expect(goalUpdateSchema.safeParse({ target_value: 50, extra: 1 }).success).toBe(false);

    expect(validateGoalTargetValue('EFFECTIVE_MINUTES', 60).ok).toBe(true);
    expect(validateGoalTargetValue('EFFECTIVE_MINUTES', 60.5).ok).toBe(false);
    expect(validateGoalTargetValue('ACCURACY', 85.5).ok).toBe(true);
    expect(validateGoalTargetValue('ACCURACY', 101).ok).toBe(false);

    expect(goalCopySchema.safeParse({ period: 'WEEK', target_date: '2026-10-19' }).success).toBe(true);
    expect(goalCopySchema.safeParse({ period: 'WEEK', target_date: '2026-02-30' }).success).toBe(false);
    expect(goalCopySchema.safeParse({ period: 'WEEK', target_date: '2026-10-19', foo: 'bar' }).success).toBe(false);

    expect(goalListQuerySchema.safeParse({ period: 'DAY', date: '2026-10-14' }).success).toBe(true);
    expect(goalListQuerySchema.safeParse({}).success).toBe(true);
    expect(goalListQuerySchema.safeParse({ date: '2026-13-01' }).success).toBe(false);
    expect(goalListQuerySchema.safeParse({ period: 'YEAR' }).success).toBe(false);
  });
});

describe('getTopicSubtreeIds', () => {
  it('retorna o próprio tópico raiz, filhos, netos e descendentes arquivados', () => {
    const topics = [
      { id: 't-root', parent_id: null, subject_id: 's1', archived: false },
      { id: 't-child-1', parent_id: 't-root', subject_id: 's1', archived: false },
      { id: 't-grandchild-archived', parent_id: 't-child-1', subject_id: 's1', archived: true },
      { id: 't-other', parent_id: null, subject_id: 's1', archived: false },
    ];
    const subtree = getTopicSubtreeIds('t-root', topics);
    expect(Array.from(subtree).sort()).toEqual(['t-child-1', 't-grandchild-archived', 't-root']);
    expect(subtree.has('t-other')).toBe(false);
  });
});

describe('calculateGoalProgress', () => {
  const tz = 'America/Rio_Branco';
  const topics = [
    { id: 't-alg', parent_id: null, subject_id: 's-mat', archived: false },
    { id: 't-alg-lin', parent_id: 't-alg', subject_id: 's-mat', archived: true },
    { id: 't-geo', parent_id: null, subject_id: 's-mat', archived: false },
    { id: 't-port', parent_id: null, subject_id: 's-port', archived: false },
  ];

  function makeSession(overrides: {
    id: string;
    topicId: string;
    status?: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
    startedAtLocal: string;
    durationSec: number;
    blockKind?: 'REVIEW' | 'NEW_CONTENT' | 'PRACTICE';
    finishBlock?: boolean;
    practices?: Array<{ topic_id: string; questions: number; correct: number }>;
  }): GoalProgressSessionInput {
    const startUtc = localDateTimeToUtc(overrides.startedAtLocal, tz);
    const endUtc = new Date(startUtc.getTime() + overrides.durationSec * 1000);
    const blockId = `${overrides.id}-b1`;
    const kind = overrides.blockKind ?? 'NEW_CONTENT';
    const finishBlock = overrides.finishBlock ?? true;
    const status = overrides.status ?? 'FINISHED';

    const events = [
      { type: 'BLOCK_START' as const, block_id: blockId, occurred_at: startUtc },
      ...(finishBlock
        ? [{ type: 'BLOCK_FINISH' as const, block_id: blockId, occurred_at: endUtc }]
        : []),
      ...(status === 'FINISHED'
        ? [{ type: 'SESSION_FINISH' as const, block_id: null, occurred_at: endUtc }]
        : []),
    ];

    return {
      id: overrides.id,
      topic_id: overrides.topicId,
      status,
      started_at: startUtc,
      ended_at: status === 'FINISHED' ? endUtc : null,
      planned_start: null,
      blocks: [{ id: blockId, kind, planned_minutes: 30, position: 0 }],
      events,
      practice_records: overrides.practices ?? [],
    };
  }

  it('calcula EFFECTIVE_MINUTES em ponto flutuante exato (sem Math.floor), respeita subárvore (inclusive arquivados) e ignora sessões não FINISHED ou fora da janela', () => {
    const windowUtc = getGoalPeriodWindowUtc('2026-10-12', 'WEEK', tz, 1);
    const sessions: GoalProgressSessionInput[] = [
      // 45.5 minutos (2730s) no tópico pai
      makeSession({ id: 's1', topicId: 't-alg', startedAtLocal: '2026-10-13T10:00', durationSec: 2730 }),
      // 30 minutos (1800s) no subassunto arquivado às 23:50 de domingo (ainda na semana local!)
      makeSession({ id: 's2', topicId: 't-alg-lin', startedAtLocal: '2026-10-18T23:50', durationSec: 1800 }),
      // Sessão IN_PROGRESS (deve ser ignorada)
      makeSession({ id: 's3', topicId: 't-alg', status: 'IN_PROGRESS', startedAtLocal: '2026-10-14T10:00', durationSec: 3600 }),
      // Sessão em outro assunto fora da subárvore
      makeSession({ id: 's4', topicId: 't-geo', startedAtLocal: '2026-10-14T12:00', durationSec: 1800 }),
      // Sessão na segunda seguinte 00:05 (fora da janela)
      makeSession({ id: 's5', topicId: 't-alg', startedAtLocal: '2026-10-19T00:05', durationSec: 1800 }),
    ];

    const res = calculateGoalProgress({
      goal: {
        kind: 'EFFORT',
        metric: 'EFFECTIVE_MINUTES',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 60,
        subject_id: 's-mat',
        topic_id: 't-alg',
      },
      windowUtc,
      sessions,
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });

    // 2730 + 1800 = 4530s = 75.5 min
    expect(res.currentValue).toBeCloseTo(75.5, 5);
    expect(res.progressPercent).toBe(100); // limitado a 100
    expect(res.status).toBe('ACHIEVED');
    expect(res.isAchieved).toBe(true);
  });

  it('filtra QUESTIONS pelo PracticeRecord.topic_id herdando started_at da StudySession FINISHED', () => {
    const windowUtc = getGoalPeriodWindowUtc('2026-10-12', 'WEEK', tz, 1);
    const sessions: GoalProgressSessionInput[] = [
      // Sessão principal era de Português, mas teve prática registrada em Álgebra Linear (subárvore de t-alg)
      makeSession({
        id: 's1',
        topicId: 't-port',
        startedAtLocal: '2026-10-14T10:00',
        durationSec: 1800,
        practices: [
          { topic_id: 't-alg-lin', questions: 15, correct: 12 },
          { topic_id: 't-port', questions: 10, correct: 8 },
        ],
      }),
    ];

    const res = calculateGoalProgress({
      goal: {
        kind: 'EFFORT',
        metric: 'QUESTIONS',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 30,
        subject_id: 's-mat',
        topic_id: 't-alg',
      },
      windowUtc,
      sessions,
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });

    expect(res.currentValue).toBe(15);
    expect(res.progressPercent).toBeCloseTo(50, 5);
    expect(res.status).toBe('IN_PROGRESS');
    expect(res.isAchieved).toBe(false);
  });

  it('calcula TOPICS_COMPLETED (topic_id distintos de sessões FINISHED com tempo efetivo > 0) e REVIEWS (blocos REVIEW concluídos com tempo efetivo > 0)', () => {
    const windowUtc = getGoalPeriodWindowUtc('2026-10-12', 'WEEK', tz, 1);
    const s1 = makeSession({
      id: 's1',
      topicId: 't-alg',
      startedAtLocal: '2026-10-13T10:00',
      durationSec: 1200,
      blockKind: 'REVIEW',
      finishBlock: true,
    });
    const s2 = makeSession({
      id: 's2',
      topicId: 't-alg', // mesmo tópico de s1 -> conta apenas 1 tópico distinto
      startedAtLocal: '2026-10-14T10:00',
      durationSec: 1200,
      blockKind: 'REVIEW',
      finishBlock: true,
    });
    const s3ZeroEffective = makeSession({
      id: 's3',
      topicId: 't-geo',
      startedAtLocal: '2026-10-15T10:00',
      durationSec: 0, // tempo efetivo 0 -> não conta nem em TOPICS_COMPLETED nem em REVIEWS
      blockKind: 'REVIEW',
      finishBlock: true,
    });
    const s4UnfinishedBlock = makeSession({
      id: 's4',
      topicId: 't-alg-lin',
      startedAtLocal: '2026-10-16T10:00',
      durationSec: 600,
      blockKind: 'REVIEW',
      finishBlock: false, // sem BLOCK_FINISH -> não conta como bloco REVIEW concluído, mas sessão tem tempo efetivo > 0
    });

    const topicsRes = calculateGoalProgress({
      goal: {
        kind: 'EFFORT',
        metric: 'TOPICS_COMPLETED',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 3,
        subject_id: 's-mat',
        topic_id: null,
      },
      windowUtc,
      sessions: [s1, s2, s3ZeroEffective, s4UnfinishedBlock],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-20T12:00', tz), // período encerrado
    });

    // t-alg e t-alg-lin tiveram effectiveSeconds > 0 (t-geo teve 0)
    expect(topicsRes.currentValue).toBe(2);
    expect(topicsRes.status).toBe('MISSED');

    const reviewsRes = calculateGoalProgress({
      goal: {
        kind: 'EFFORT',
        metric: 'REVIEWS',
        period: 'WEEK',
        period_start_local_date: '2026-10-12',
        target_value: 2,
        subject_id: 's-mat',
        topic_id: null,
      },
      windowUtc,
      sessions: [s1, s2, s3ZeroEffective, s4UnfinishedBlock],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });

    // Apenas s1 e s2 possuem bloco REVIEW com BLOCK_FINISH e effectiveSeconds > 0
    expect(reviewsRes.currentValue).toBe(2);
    expect(reviewsRes.status).toBe('ACHIEVED');
  });

  it('aplica ordem estrita de precedência para ACCURACY: UPCOMING -> INSUFFICIENT_DATA -> ACHIEVED -> MISSED -> IN_PROGRESS', () => {
    const windowUtc = getGoalPeriodWindowUtc('2026-10-12', 'WEEK', tz, 1);
    const goal = {
      kind: 'RESULT' as const,
      metric: 'ACCURACY' as const,
      period: 'WEEK' as const,
      period_start_local_date: '2026-10-12',
      target_value: 80,
      subject_id: 's-mat',
      topic_id: null,
    };

    // 1. UPCOMING (antes de startUtc, mesmo com 0 questões -> UPCOMING vence INSUFFICIENT_DATA)
    const upcomingRes = calculateGoalProgress({
      goal,
      windowUtc,
      sessions: [],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-10T12:00', tz),
    });
    expect(upcomingRes.status).toBe('UPCOMING');
    expect(upcomingRes.progressPercent).toBeNull();
    expect(upcomingRes.currentValue).toBeNull();
    expect(upcomingRes.questionsCount).toBe(0);

    // 2. INSUFFICIENT_DATA (< 10 questões no período presente ou passado, mesmo com 100% de acerto)
    const eightQuestionsSession = makeSession({
      id: 's-8q',
      topicId: 't-alg',
      startedAtLocal: '2026-10-13T10:00',
      durationSec: 1200,
      practices: [{ topic_id: 't-alg', questions: 8, correct: 8 }],
    });
    const insufficientPresent = calculateGoalProgress({
      goal,
      windowUtc,
      sessions: [eightQuestionsSession],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });
    expect(insufficientPresent.status).toBe('INSUFFICIENT_DATA');
    expect(insufficientPresent.isAchieved).toBe(false);
    expect(insufficientPresent.progressPercent).toBeNull();
    expect(insufficientPresent.questionsCount).toBe(8);
    expect(insufficientPresent.currentValue).toBeCloseTo(100, 5);

    const insufficientPast = calculateGoalProgress({
      goal,
      windowUtc,
      sessions: [eightQuestionsSession],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-25T12:00', tz),
    });
    expect(insufficientPast.status).toBe('INSUFFICIENT_DATA');

    // 3. ACHIEVED (>= 10 questões e accuracy >= target_value)
    const achievedSession = makeSession({
      id: 's-10q-ok',
      topicId: 't-alg',
      startedAtLocal: '2026-10-13T10:00',
      durationSec: 1200,
      practices: [{ topic_id: 't-alg', questions: 10, correct: 9 }],
    });
    const achievedRes = calculateGoalProgress({
      goal,
      windowUtc,
      sessions: [achievedSession],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });
    expect(achievedRes.status).toBe('ACHIEVED');
    expect(achievedRes.isAchieved).toBe(true);
    expect(achievedRes.currentValue).toBeCloseTo(90, 5);
    expect(achievedRes.progressPercent).toBe(100);

    // 4. IN_PROGRESS vs MISSED (>= 10 questões e accuracy < target_value)
    const lowAccuracySession = makeSession({
      id: 's-10q-low',
      topicId: 't-alg',
      startedAtLocal: '2026-10-13T10:00',
      durationSec: 1200,
      practices: [{ topic_id: 't-alg', questions: 10, correct: 6 }], // 60% < 80%
    });
    const inProgressRes = calculateGoalProgress({
      goal,
      windowUtc,
      sessions: [lowAccuracySession],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-15T12:00', tz),
    });
    expect(inProgressRes.status).toBe('IN_PROGRESS');
    expect(inProgressRes.isAchieved).toBe(false);
    expect(inProgressRes.progressPercent).toBeCloseTo(75, 5);

    const missedRes = calculateGoalProgress({
      goal,
      windowUtc,
      sessions: [lowAccuracySession],
      topics,
      referenceNow: localDateTimeToUtc('2026-10-19T00:00', tz), // exato endUtc
    });
    expect(missedRes.status).toBe('MISSED');
    expect(missedRes.isAchieved).toBe(false);
  });
});
