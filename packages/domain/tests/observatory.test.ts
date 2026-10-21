import { describe, expect, it } from 'vitest';
import {
  ACCURACY_DROP_ALERT_POINTS,
  ADHERENCE_ALERT_THRESHOLD,
  buildClassificationIndex,
  calculateTopicClassification,
  CLASSIFICATION_EPSILON,
  CLASSIFICATION_WINDOW_DAYS,
  CONSISTENCY_ALERT_MIN_DAYS,
  DEFAULT_STUDY_THRESHOLDS,
  EFFECTIVENESS_ALERT_THRESHOLD,
  getClassificationWindow,
  LOW_UNDERSTANDING_THRESHOLD,
  MAX_TOPIC_RECOMMENDATIONS,
  MIN_DISTRACTION_ANALYSIS_SECONDS,
  MIN_QUESTIONS,
  MIN_QUESTIONS_FOR_RATING,
  NEGLECT_DAYS,
  PLANNING_GAP_ALERT_MINUTES,
  SCORE_WEIGHT_ACCURACY,
  SCORE_WEIGHT_UNDERSTANDING,
  STRONG_THRESHOLD,
  WEAK_THRESHOLD,
} from '../src/index.js';

describe('Fase 8 - Tarefa 1: Thresholds, Janela de Classificação e Nota 70/30', () => {
  const windowInfo = {
    windowStartLocalDate: '2026-09-22',
    windowEndLocalDate: '2026-10-21',
  };

  it('exporta todas as constantes de limiar de thresholds.ts e preserva compatibilidade com MIN_QUESTIONS_FOR_RATING', () => {
    expect(MIN_QUESTIONS).toBe(10);
    expect(MIN_QUESTIONS_FOR_RATING).toBe(MIN_QUESTIONS);
    expect(SCORE_WEIGHT_ACCURACY).toBe(0.7);
    expect(SCORE_WEIGHT_UNDERSTANDING).toBe(0.3);
    expect(STRONG_THRESHOLD).toBe(80);
    expect(WEAK_THRESHOLD).toBe(60);
    expect(CLASSIFICATION_EPSILON).toBe(1e-9);
    expect(LOW_UNDERSTANDING_THRESHOLD).toBe(50);
    expect(MAX_TOPIC_RECOMMENDATIONS).toBe(5);
    expect(CLASSIFICATION_WINDOW_DAYS).toBe(30);
    expect(NEGLECT_DAYS).toBe(7);
    expect(MIN_DISTRACTION_ANALYSIS_SECONDS).toBe(1800);
    expect(ADHERENCE_ALERT_THRESHOLD).toBe(70);
    expect(PLANNING_GAP_ALERT_MINUTES).toBe(60);
    expect(EFFECTIVENESS_ALERT_THRESHOLD).toBe(75);
    expect(ACCURACY_DROP_ALERT_POINTS).toBe(10);
    expect(CONSISTENCY_ALERT_MIN_DAYS).toBe(3);
    expect(DEFAULT_STUDY_THRESHOLDS.MIN_QUESTIONS).toBe(10);
  });

  it('retorna INSUFFICIENT_DATA com 9 questões e classifica com 10 questões', () => {
    const res9 = calculateTopicClassification(
      { totalQuestions: 9, totalCorrect: 9, understandingScores: [100] },
      windowInfo
    );
    expect(res9.classification).toBe('INSUFFICIENT_DATA');
    expect(res9.label).toBe('Dados insuficientes');
    expect(res9.finalScore).toBeNull();
    expect(res9.displayScore).toBeNull();
    expect(res9.usedFallback).toBe(false);
    expect(res9.weightsUsed).toBeNull();
    expect(res9.recommendedAction).toBe('COLLECT_MORE_DATA');
    expect(res9.questionsInWindow).toBe(9);
    expect(res9.correctInWindow).toBe(9);

    const res10 = calculateTopicClassification(
      { totalQuestions: 10, totalCorrect: 8, understandingScores: [100] },
      windowInfo
    );
    expect(res10.classification).toBe('STRONG');
    expect(res10.label).toBe('Ponto forte');
    expect(res10.recommendedAction).toBe('MAINTAIN');
  });

  it('aplica fallback de 100% acurácia quando evaluationsCount === 0 e totalQuestions >= 10', () => {
    const res = calculateTopicClassification(
      { totalQuestions: 20, totalCorrect: 15, understandingScores: [] },
      windowInfo
    );
    expect(res.usedFallback).toBe(true);
    expect(res.weightsUsed).toEqual({ accuracy: 1, understanding: 0 });
    expect(res.finalScore).toBe(75);
    expect(res.displayScore).toBe(75);
    expect(res.classification).toBe('REGULAR');
    expect(res.recommendedAction).toBe('MORE_PRACTICE');
  });

  it('valida fronteiras exatas 59 (WEAK), 60 (REGULAR), 79 (REGULAR), 80 (STRONG) e truncamento em 79.96 (79.9 REGULAR)', () => {
    const c59 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 59, understandingScores: [] },
      windowInfo
    );
    expect(c59.classification).toBe('WEAK');
    expect(c59.displayScore).toBe(59);
    expect(c59.recommendedAction).toBe('REVIEW_AND_PRACTICE');

    const c60 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 60, understandingScores: [] },
      windowInfo
    );
    expect(c60.classification).toBe('REGULAR');
    expect(c60.displayScore).toBe(60);
    expect(c60.recommendedAction).toBe('MORE_PRACTICE');

    const c79 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 79, understandingScores: [] },
      windowInfo
    );
    expect(c79.classification).toBe('REGULAR');
    expect(c79.displayScore).toBe(79);

    const c80 = calculateTopicClassification(
      { totalQuestions: 100, totalCorrect: 80, understandingScores: [] },
      windowInfo
    );
    expect(c80.classification).toBe('STRONG');
    expect(c80.displayScore).toBe(80);
    expect(c80.recommendedAction).toBe('MAINTAIN');

    // 79.96 algebrico: 0.7 * 79.8 + 0.3 * 80.33333333333333 = 55.86 + 24.1 = 79.96
    const c7996 = calculateTopicClassification(
      {
        totalQuestions: 1000,
        totalCorrect: 798,
        understandingScores: [80.33333333333333],
      },
      windowInfo
    );
    expect(c7996.classification).toBe('REGULAR');
    expect(c7996.displayScore).toBe(79.9);
  });

  it('varre combinações IEEE 754 onde 0.7 * A + 0.3 * U equivale algebricamente a 60 ou 80 e garante classificação correta com CLASSIFICATION_EPSILON', () => {
    let foundImprecision60 = 0;
    let foundImprecision80 = 0;

    for (let u = 0; u <= 100; u++) {
      // 0.7 * A + 0.3 * U = 60 => A = (600 - 3 * u) / 7
      // Usamos totalQuestions = 700, totalCorrect = (600 - 3 * u) * 7 => accuracy = (600 - 3*u)/7
      const num60 = 600 - 3 * u;
      if (num60 >= 0 && num60 <= 700) {
        const rawA = num60 / 7;
        const rawFinal = 0.7 * rawA + 0.3 * u;
        if (rawFinal < 60) foundImprecision60++;

        const res60 = calculateTopicClassification(
          { totalQuestions: 700, totalCorrect: num60, understandingScores: [u] },
          windowInfo
        );
        expect(res60.classification).toBe('REGULAR');
        expect(res60.displayScore).toBe(60);
      }

      const num80 = 800 - 3 * u;
      if (num80 >= 0 && num80 <= 700) {
        const rawA = num80 / 7;
        const rawFinal = 0.7 * rawA + 0.3 * u;
        if (rawFinal < 80) foundImprecision80++;

        const res80 = calculateTopicClassification(
          { totalQuestions: 700, totalCorrect: num80, understandingScores: [u] },
          windowInfo
        );
        expect(res80.classification).toBe('STRONG');
        expect(res80.displayScore).toBe(80);
      }
    }

    expect(foundImprecision60).toBeGreaterThan(0);
    expect(foundImprecision80).toBeGreaterThan(0);
  });

  it('permite injeção de thresholds customizados mudando a classificação ao alterar STRONG_THRESHOLD', () => {
    const customThresholds = {
      ...DEFAULT_STUDY_THRESHOLDS,
      STRONG_THRESHOLD: 90,
    };
    const resDefault = calculateTopicClassification(
      { totalQuestions: 10, totalCorrect: 8, understandingScores: [100] },
      windowInfo
    );
    // 0.7 * 80 + 0.3 * 100 = 86
    expect(resDefault.classification).toBe('STRONG');

    const resCustom = calculateTopicClassification(
      { totalQuestions: 10, totalCorrect: 8, understandingScores: [100] },
      windowInfo,
      customThresholds
    );
    expect(resCustom.classification).toBe('REGULAR');
  });

  it('calcula lowUnderstandingSignal de forma independente quando média de entendimento < 50 e evaluationsCount > 0', () => {
    const highAccLowUnd = calculateTopicClassification(
      { totalQuestions: 20, totalCorrect: 20, understandingScores: [0, 33] },
      windowInfo
    );
    expect(highAccLowUnd.lowUnderstandingSignal).toBe(true);
    expect(highAccLowUnd.classification).toBe('REGULAR'); // 0.7*100 + 0.3*16.5 = 74.95

    const boundary50 = calculateTopicClassification(
      { totalQuestions: 5, totalCorrect: 5, understandingScores: [33, 67] },
      windowInfo
    );
    expect(boundary50.lowUnderstandingSignal).toBe(false);
    expect(boundary50.classification).toBe('INSUFFICIENT_DATA');
  });

  it('calcula getClassificationWindow usando min(periodEndLocalDate, todayLocalDate) e 30 dias locais', () => {
    const refNow = new Date('2026-10-21T15:00:00.000Z');
    // Caso 1: período termina no futuro da semana atual (ex.: domingo 2026-10-25, mas hoje é 2026-10-21)
    const wCurrent = getClassificationWindow('2026-10-25', refNow, 'America/Sao_Paulo');
    expect(wCurrent.classificationEndLocalDate).toBe('2026-10-21');
    expect(wCurrent.windowEndLocalDate).toBe('2026-10-21');
    expect(wCurrent.windowStartLocalDate).toBe('2026-09-22');

    // Caso 2: período passado (ex.: semana encerrada em 2026-10-11)
    const wPast = getClassificationWindow('2026-10-11', refNow, 'America/Sao_Paulo');
    expect(wPast.classificationEndLocalDate).toBe('2026-10-11');
    expect(wPast.windowEndLocalDate).toBe('2026-10-11');
    expect(wPast.windowStartLocalDate).toBe('2026-09-12');
  });

  it('constrói índice de classificação por assunto (direto, sem descendentes) e por matéria (soma questões + média simples de avaliações), incluindo apenas itens com atividade na janela', () => {
    const refNow = new Date('2026-10-21T15:00:00.000Z');
    const win = getClassificationWindow('2026-10-21', refNow, 'America/Sao_Paulo');

    const subjects = [
      { id: 'sub-1', name: 'Matemática', color: '#3b82f6', archived: false },
      { id: 'sub-empty', name: 'História', color: '#ef4444', archived: false },
    ];
    const topics = [
      { id: 'top-parent', subject_id: 'sub-1', parent_id: null, name: 'Álgebra', archived: false },
      { id: 'top-child', subject_id: 'sub-1', parent_id: 'top-parent', name: 'Polinômios', archived: false },
      { id: 'top-never', subject_id: 'sub-1', parent_id: null, name: 'Geometria', archived: false },
    ];

    const sessions = [
      {
        id: 'sess-1',
        topic_id: 'top-parent',
        status: 'FINISHED' as const,
        started_at: new Date('2026-10-10T14:00:00.000Z'),
        ended_at: new Date('2026-10-10T15:00:00.000Z'),
        planned_start: null,
        blocks: [],
        events: [],
        practice_records: [{ topic_id: 'top-parent', questions: 20, correct: 15 }],
        evaluation: { understanding: 'GOOD' as const },
      },
      {
        id: 'sess-2',
        topic_id: 'top-child',
        status: 'FINISHED' as const,
        started_at: new Date('2026-10-12T14:00:00.000Z'),
        ended_at: new Date('2026-10-12T15:00:00.000Z'),
        planned_start: null,
        blocks: [],
        events: [],
        practice_records: [{ topic_id: 'top-child', questions: 5, correct: 5 }],
        evaluation: { understanding: 'MASTERED' as const },
      },
      // Sessão cancelada não deve entrar
      {
        id: 'sess-cancelled',
        topic_id: 'top-never',
        status: 'CANCELLED' as const,
        started_at: new Date('2026-10-12T16:00:00.000Z'),
        ended_at: new Date('2026-10-12T17:00:00.000Z'),
        planned_start: null,
        blocks: [],
        events: [],
        practice_records: [{ topic_id: 'top-never', questions: 30, correct: 30 }],
        evaluation: { understanding: 'MASTERED' as const },
      },
    ];

    const idx = buildClassificationIndex({
      sessions,
      subjects,
      topics,
      window: win,
    });

    // top-never e sub-empty não possuem atividade válida na janela => fora do índice
    expect(idx.byTopic.has('top-never')).toBe(false);
    expect(idx.bySubject.has('sub-empty')).toBe(false);

    // top-parent não soma questões de top-child (20 questões, 15 acertos, 1 avaliação GOOD=67)
    const parentClass = idx.byTopic.get('top-parent')!;
    expect(parentClass).toBeDefined();
    expect(parentClass.questionsInWindow).toBe(20);
    expect(parentClass.correctInWindow).toBe(15);
    expect(parentClass.evaluationsCount).toBe(1);
    // 0.7 * 75 + 0.3 * 67 = 52.5 + 20.1 = 72.6
    expect(parentClass.displayScore).toBe(72.6);

    // sub-1 soma todas as questões (20 + 5 = 25, acertos 15 + 5 = 20 => 80%) e faz média simples das avaliações (67 e 100 => 83.5)
    // 0.7 * 80 + 0.3 * 83.5 = 56 + 25.05 = 81.05 => STRONG, displayScore 81
    const subClass = idx.bySubject.get('sub-1')!;
    expect(subClass).toBeDefined();
    expect(subClass.questionsInWindow).toBe(25);
    expect(subClass.correctInWindow).toBe(20);
    expect(subClass.evaluationsCount).toBe(2);
    expect(subClass.classification).toBe('STRONG');
    expect(subClass.displayScore).toBe(81);
  });
});

import {
  calculateWeeklyObservatory,
  localDateTimeToUtc,
  observatoryQuerySchema,
} from '../src/index.js';

function makeStudySession(params: {
  id: string;
  topic_id: string;
  startedAt: Date;
  totalSeconds: number;
  pausedSeconds?: number;
  distractedRealtimeSeconds?: number;
  distractedDeclaredSeconds?: number;
  plannedMinutes?: number;
  status?: 'FINISHED' | 'IN_PROGRESS' | 'CANCELLED';
  questions?: number;
  correct?: number;
  understanding?: 'NONE' | 'PARTIAL' | 'GOOD' | 'MASTERED';
}) {
  const {
    id,
    topic_id,
    startedAt,
    totalSeconds,
    pausedSeconds = 0,
    distractedRealtimeSeconds = 0,
    distractedDeclaredSeconds = 0,
    plannedMinutes = 60,
    status = 'FINISHED',
    questions = 0,
    correct = 0,
    understanding,
  } = params;

  const blockId = `${id}-b1`;
  const startMs = startedAt.getTime();
  const endMs = startMs + totalSeconds * 1000;

  const events: Array<{
    id: string;
    block_id: string | null;
    type:
      | 'BLOCK_START'
      | 'PAUSE'
      | 'RESUME'
      | 'DISTRACTION_START'
      | 'DISTRACTION_END'
      | 'DISTRACTION_DECLARED'
      | 'BLOCK_FINISH'
      | 'SESSION_FINISH';
    occurred_at: Date;
    declared_seconds: number | null;
  }> = [
    {
      id: `${id}-ev-start`,
      block_id: blockId,
      type: 'BLOCK_START',
      occurred_at: new Date(startMs),
      declared_seconds: null,
    },
  ];

  let cursorMs = startMs + 1000;
  if (pausedSeconds > 0) {
    events.push({
      id: `${id}-ev-pause`,
      block_id: blockId,
      type: 'PAUSE',
      occurred_at: new Date(cursorMs),
      declared_seconds: null,
    });
    cursorMs += pausedSeconds * 1000;
    events.push({
      id: `${id}-ev-resume`,
      block_id: blockId,
      type: 'RESUME',
      occurred_at: new Date(cursorMs),
      declared_seconds: null,
    });
    cursorMs += 1000;
  }

  if (distractedRealtimeSeconds > 0) {
    events.push({
      id: `${id}-ev-dstart`,
      block_id: blockId,
      type: 'DISTRACTION_START',
      occurred_at: new Date(cursorMs),
      declared_seconds: null,
    });
    cursorMs += distractedRealtimeSeconds * 1000;
    events.push({
      id: `${id}-ev-dend`,
      block_id: blockId,
      type: 'DISTRACTION_END',
      occurred_at: new Date(cursorMs),
      declared_seconds: null,
    });
  }

  if (distractedDeclaredSeconds > 0) {
    events.push({
      id: `${id}-ev-ddec`,
      block_id: blockId,
      type: 'DISTRACTION_DECLARED',
      occurred_at: new Date(endMs - 500),
      declared_seconds: distractedDeclaredSeconds,
    });
  }

  events.push({
    id: `${id}-ev-bfin`,
    block_id: blockId,
    type: 'BLOCK_FINISH',
    occurred_at: new Date(endMs),
    declared_seconds: null,
  });

  if (status === 'FINISHED') {
    events.push({
      id: `${id}-ev-sfin`,
      block_id: null,
      type: 'SESSION_FINISH',
      occurred_at: new Date(endMs),
      declared_seconds: null,
    });
  }

  return {
    id,
    topic_id,
    status,
    started_at: new Date(startMs),
    ended_at: status === 'FINISHED' ? new Date(endMs) : null,
    planned_start: null,
    blocks: [
      {
        id: blockId,
        kind: 'NEW_CONTENT' as const,
        planned_minutes: plannedMinutes,
        position: 0,
      },
    ],
    events,
    practice_records:
      questions > 0 ? [{ topic_id, questions, correct }] : [],
    evaluation: understanding ? { understanding } : null,
  };
}

describe('Fase 8 - Tarefa 2: Motor do Observatório Semanal e Alertas Determinísticos', () => {
  const tz = 'America/Rio_Branco';

  it('valida observatoryQuerySchema com .strict()', () => {
    expect(observatoryQuerySchema.safeParse({}).success).toBe(true);
    expect(observatoryQuerySchema.safeParse({ date: '2026-10-21' }).success).toBe(true);
    expect(observatoryQuerySchema.safeParse({ date: '2026-02-30' }).success).toBe(false);
    expect(observatoryQuerySchema.safeParse({ date: '2026-10-21', extra: 'x' }).success).toBe(false);
  });

  it('retorna hasAnyData=false e variações null (sem NaN) quando o usuário é novo e não tem dados', () => {
    const refNow = localDateTimeToUtc('2026-10-21T14:00', tz); // Quarta-feira
    const report = calculateWeeklyObservatory({
      selectedLocalDate: '2026-10-21',
      referenceNow: refNow,
      timezone: tz,
      weekStartsOn: 'MONDAY',
      sessions: [],
      plannedSessions: [],
      subjects: [],
      topics: [],
    });

    expect(report.hasAnyData).toBe(false);
    expect(report.isPartialWeek).toBe(true);
    expect(report.elapsedDaysCount).toBe(3); // Seg(19), Ter(20), Qua(21)
    expect(report.weekComparison.deltaEffectiveMinutesPercent).toBeNull();
    expect(report.weekComparison.deltaAccuracyPoints).toBeNull();
    expect(report.pauseAndDistractionAnalysis.highestDistractionSubject).toBeNull();
    expect(report.pauseAndDistractionAnalysis.highestDistractionDay).toBeNull();
    expect(report.insightsAndRecommendations).toEqual([]);
  });

  it('atribui sessão iniciada às 23:50 locais (America/Rio_Branco) no domingo à semana correta conforme week_starts_on', () => {
    // 2026-10-18 é domingo. 23:50 em Rio Branco (UTC-5) = 2026-10-19T04:50:00Z
    const sunNight = localDateTimeToUtc('2026-10-18T23:50', tz);
    const refNow = localDateTimeToUtc('2026-10-21T12:00', tz);

    const subjects = [
      {
        id: 's1',
        name: 'Física',
        color: '#3B82F6',
        archived: false,
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
    ];
    const topics = [
      { id: 't1', subject_id: 's1', parent_id: null, name: 'Óptica', archived: false },
    ];
    const s = makeStudySession({
      id: 'sess-sun',
      topic_id: 't1',
      startedAt: sunNight,
      totalSeconds: 3600,
      questions: 12,
      correct: 10,
    });

    // Com week_starts_on = MONDAY, 2026-10-18 pertence à semana anterior (12/10 a 18/10), não à semana de 19/10 a 25/10
    const repMon = calculateWeeklyObservatory({
      selectedLocalDate: '2026-10-18',
      referenceNow: refNow,
      timezone: tz,
      weekStartsOn: 'MONDAY',
      sessions: [s],
      plannedSessions: [],
      subjects,
      topics,
    });
    expect(repMon.weekStartLocalDate).toBe('2026-10-12');
    expect(repMon.weekEndLocalDate).toBe('2026-10-18');
    expect(repMon.weekComparison.selectedWeek.effectiveMinutes).toBe(60);

    // Com week_starts_on = SUNDAY, 2026-10-18 é o primeiro dia da semana 18/10 a 24/10
    const repSun = calculateWeeklyObservatory({
      selectedLocalDate: '2026-10-18',
      referenceNow: refNow,
      timezone: tz,
      weekStartsOn: 'SUNDAY',
      sessions: [s],
      plannedSessions: [],
      subjects,
      topics,
    });
    expect(repSun.weekStartLocalDate).toBe('2026-10-18');
    expect(repSun.weekEndLocalDate).toBe('2026-10-24');
    expect(repSun.weekComparison.selectedWeek.effectiveMinutes).toBe(60);
  });

  it('compara recorte parcial de dias equivalentes e usa evaluationInstant ao consultar semana passada (protegendo matéria recém-criada)', () => {
    // Semana selecionada passada: 2026-10-05 a 2026-10-11 (encerrada)
    const refNow = localDateTimeToUtc('2026-10-21T15:00', tz);
    const subjects = [
      {
        id: 's-old',
        name: 'Química',
        color: '#10b981',
        archived: false,
        created_at: localDateTimeToUtc('2026-09-01T10:00', tz), // criada > 7 dias antes de 11/10
      },
      {
        id: 's-new-at-past-week',
        name: 'Biologia',
        color: '#f59e0b',
        archived: false,
        // criada em 2026-10-08 (apenas 3 dias antes do fim da semana consultada 11/10, mas 13 dias antes de refNow 21/10)
        created_at: localDateTimeToUtc('2026-10-08T10:00', tz),
      },
    ];
    const topics = [
      { id: 't-q', subject_id: 's-old', parent_id: null, name: 'Estequiometria', archived: false },
    ];

    const plannedSessions = [
      {
        id: 'ps-past',
        subject_id: 's-old',
        topic_id: 't-q',
        scheduled_start: localDateTimeToUtc('2026-10-06T10:00', tz),
        planned_minutes: 90,
        status: 'PLANNED' as const,
      },
    ];

    const repPast = calculateWeeklyObservatory({
      selectedLocalDate: '2026-10-07',
      referenceNow: refNow,
      timezone: tz,
      weekStartsOn: 'MONDAY',
      sessions: [],
      plannedSessions,
      subjects,
      topics,
    });

    expect(repPast.isPartialWeek).toBe(false);
    expect(repPast.elapsedDaysCount).toBe(7);
    // s-old não teve estudo nos 7 dias até 2026-10-11 => negligenciada
    // s-new-at-past-week tinha só 3 dias de vida no evaluationInstant (fim de 2026-10-11) => NÃO negligenciada!
    expect(repPast.neglectedSubjects.map((s) => s.subjectId)).toEqual(['s-old']);
  });

  it('dispara e ordena alertas determinísticos respeitando amostra mínima de 1800s, consistência proporcional, limite MAX_TOPIC_RECOMMENDATIONS=5 e exclusão de arquivados', () => {
    // Semana encerrada: 2026-10-12 a 2026-10-18. Hoje: 2026-10-21.
    const refNow = localDateTimeToUtc('2026-10-21T12:00', tz);

    const subjects = [
      {
        id: 's-active',
        name: 'Direito Constitucional',
        color: '#3b82f6',
        archived: false,
        created_at: localDateTimeToUtc('2026-08-01T00:00', tz),
      },
      {
        id: 's-neglected',
        name: 'Direito Administrativo',
        color: '#ef4444',
        archived: false,
        created_at: localDateTimeToUtc('2026-08-01T00:00', tz),
      },
      {
        id: 's-archived',
        name: 'Matéria Arquivada',
        color: '#64748b',
        archived: true,
        created_at: localDateTimeToUtc('2026-08-01T00:00', tz),
      },
    ];

    // 6 tópicos fracos ativos para testar limite MAX_TOPIC_RECOMMENDATIONS = 5 e ordenação por menor finalScore + desempate por id
    const topics = [
      { id: 't-weak-1', subject_id: 's-active', parent_id: null, name: 'Fraco 1', archived: false },
      { id: 't-weak-2', subject_id: 's-active', parent_id: null, name: 'Fraco 2', archived: false },
      { id: 't-weak-3', subject_id: 's-active', parent_id: null, name: 'Fraco 3', archived: false },
      { id: 't-weak-4', subject_id: 's-active', parent_id: null, name: 'Fraco 4', archived: false },
      { id: 't-weak-5', subject_id: 's-active', parent_id: null, name: 'Fraco 5', archived: false },
      { id: 't-weak-6', subject_id: 's-active', parent_id: null, name: 'Fraco 6', archived: false },
      { id: 't-reg-1', subject_id: 's-active', parent_id: null, name: 'Regular 1', archived: false },
      { id: 't-str-1', subject_id: 's-active', parent_id: null, name: 'Forte 1', archived: false },
      { id: 't-str-2', subject_id: 's-active', parent_id: null, name: 'Forte 2', archived: false },
      { id: 't-arch', subject_id: 's-active', parent_id: null, name: 'Tópico Arquivado', archived: true },
      { id: 't-sub-arch', subject_id: 's-archived', parent_id: null, name: 'Tópico de Matéria Arquivada', archived: false },
    ];

    // Semana anterior (05/10 a 11/10): alta acurácia (90% em 20 questões)
    const prevWeekSession = makeStudySession({
      id: 'sess-prev',
      topic_id: 't-str-1',
      startedAt: localDateTimeToUtc('2026-10-06T10:00', tz),
      totalSeconds: 3600,
      questions: 20,
      correct: 18, // 90%
      understanding: 'MASTERED',
    });

    // Semana selecionada (12/10 a 18/10):
    // 1 único dia ativo (13/10) -> dispara alert:low-consistency (< 3 dias)
    // Total session = 3600s (>= 1800s), com 1200s distraído -> efetivo 2400s (40 min) -> effectiveness = 66.67% (< 75% -> alert:low-effectiveness)
    // Planejado do bloco = 60 min (3600s) -> adherence = 2400/3600 = 66.67% (< 70% -> alert:low-adherence)
    // Acurácia na semana selecionada: 60 questões, 20 acertos (33.33%) -> queda de > 10 pontos vs 90% -> alert:accuracy-drop
    const curSessions = [
      makeStudySession({
        id: 'sess-cur-1',
        topic_id: 't-weak-1',
        startedAt: localDateTimeToUtc('2026-10-13T10:00', tz),
        totalSeconds: 3600,
        distractedRealtimeSeconds: 2400,
        plannedMinutes: 60,
        questions: 10,
        correct: 2, // 20%
      }),
      makeStudySession({
        id: 'sess-cur-2',
        topic_id: 't-weak-2',
        startedAt: localDateTimeToUtc('2026-10-13T12:00', tz),
        totalSeconds: 600,
        plannedMinutes: 10,
        questions: 10,
        correct: 3, // 30%
      }),
      makeStudySession({
        id: 'sess-cur-3',
        topic_id: 't-weak-3',
        startedAt: localDateTimeToUtc('2026-10-13T13:00', tz),
        totalSeconds: 600,
        plannedMinutes: 10,
        questions: 10,
        correct: 3, // 30% (empate com t-weak-2 -> desempate por id)
      }),
      makeStudySession({
        id: 'sess-cur-4',
        topic_id: 't-weak-4',
        startedAt: localDateTimeToUtc('2026-10-13T14:00', tz),
        totalSeconds: 600,
        plannedMinutes: 10,
        questions: 10,
        correct: 4, // 40%
      }),
      makeStudySession({
        id: 'sess-cur-5',
        topic_id: 't-weak-5',
        startedAt: localDateTimeToUtc('2026-10-13T15:00', tz),
        totalSeconds: 600,
        plannedMinutes: 10,
        questions: 10,
        correct: 5, // 50%
      }),
      makeStudySession({
        id: 'sess-cur-6',
        topic_id: 't-weak-6',
        startedAt: localDateTimeToUtc('2026-10-13T16:00', tz),
        totalSeconds: 600,
        plannedMinutes: 10,
        questions: 10,
        correct: 5, // 55% se 11/20, aqui 5/10 = 50%, mas é o 6º -> cortado pelo MAX_TOPIC_RECOMMENDATIONS=5
      }),
      makeStudySession({
        id: 'sess-reg',
        topic_id: 't-reg-1',
        startedAt: localDateTimeToUtc('2026-10-01T10:00', tz), // nos 30 dias
        totalSeconds: 1800,
        questions: 10,
        correct: 7, // 70% REGULAR
      }),
      makeStudySession({
        id: 'sess-str-2',
        topic_id: 't-str-2',
        startedAt: localDateTimeToUtc('2026-10-02T10:00', tz), // nos 30 dias
        totalSeconds: 1800,
        questions: 10,
        correct: 10, // 100% STRONG (maior que t-str-1 que tem ~93%)
        understanding: 'MASTERED',
      }),
      makeStudySession({
        id: 'sess-arch',
        topic_id: 't-arch',
        startedAt: localDateTimeToUtc('2026-10-13T17:00', tz),
        totalSeconds: 600,
        questions: 10,
        correct: 1,
      }),
      makeStudySession({
        id: 'sess-sub-arch',
        topic_id: 't-sub-arch',
        startedAt: localDateTimeToUtc('2026-10-13T18:00', tz),
        totalSeconds: 600,
        questions: 10,
        correct: 1,
      }),
    ];

    // Agenda planejada: 300 min na semana -> gap >= 60 min -> alert:planning-gap
    const plannedSessions = [
      {
        id: 'ps-1',
        subject_id: 's-active',
        topic_id: 't-weak-1',
        scheduled_start: localDateTimeToUtc('2026-10-13T08:00', tz),
        planned_minutes: 300,
        status: 'PLANNED' as const,
      },
    ];

    const report = calculateWeeklyObservatory({
      selectedLocalDate: '2026-10-15',
      referenceNow: refNow,
      timezone: tz,
      weekStartsOn: 'MONDAY',
      sessions: [prevWeekSession, ...curSessions],
      plannedSessions,
      subjects,
      topics,
    });

    // Tópicos arquivados ou de matéria arquivada não entram em topicClassification nem em insights
    const allClassifiedTopicIds = [
      ...report.topicClassification.weak.map((t) => t.topicId),
      ...report.topicClassification.regular.map((t) => t.topicId),
      ...report.topicClassification.strong.map((t) => t.topicId),
      ...report.topicClassification.insufficient.map((t) => t.topicId),
    ];
    expect(allClassifiedTopicIds).not.toContain('t-arch');
    expect(allClassifiedTopicIds).not.toContain('t-sub-arch');

    const ids = report.insightsAndRecommendations.map((i) => i.id);

    // Máximo 5 weak-topic recommendations (t-weak-6 fica de fora)
    const weakRecIds = ids.filter((id) => id.startsWith('weak-topic:'));
    expect(weakRecIds).toEqual([
      'weak-topic:t-weak-1',
      'weak-topic:t-weak-2',
      'weak-topic:t-weak-3',
      'weak-topic:t-weak-4',
      'weak-topic:t-weak-5',
    ]);

    // Em HIGH: itens com finalScore vêm antes de alert:accuracy-drop (sem finalScore)
    const highItems = report.insightsAndRecommendations.filter((i) => i.severity === 'HIGH');
    expect(highItems.map((i) => i.id)).toEqual([
      'weak-topic:t-weak-1',
      'weak-topic:t-weak-2',
      'weak-topic:t-weak-3',
      'weak-topic:t-weak-4',
      'weak-topic:t-weak-5',
      'alert:accuracy-drop',
    ]);

    // Em MEDIUM: todos sem finalScore, desempate alfabético por id
    const mediumItems = report.insightsAndRecommendations.filter((i) => i.severity === 'MEDIUM');
    expect(mediumItems.map((i) => i.id)).toEqual([
      'alert:low-adherence',
      'alert:low-consistency',
      'alert:low-effectiveness',
      'neglected-subject:s-neglected',
    ]);

    // Em LOW: regular-topic:t-reg-1 (com finalScore) antes de alert:planning-gap (sem finalScore)
    const lowItems = report.insightsAndRecommendations.filter((i) => i.severity === 'LOW');
    expect(lowItems.map((i) => i.id)).toEqual([
      'regular-topic:t-reg-1',
      'alert:planning-gap',
    ]);

    // Em INFO (pontos fortes): ordenado por MAIOR finalScore (t-str-2 100 > t-str-1 93)
    const infoItems = report.insightsAndRecommendations.filter((i) => i.severity === 'INFO');
    expect(infoItems.map((i) => i.id)).toEqual([
      'strong-topic:t-str-2',
      'strong-topic:t-str-1',
    ]);

    // Todos possuem evidence não vazio
    for (const item of report.insightsAndRecommendations) {
      expect(item.evidence.length).toBeGreaterThan(0);
    }
  });

  it('não dispara alertas de queda de desempenho, aderência ou foco quando totalSessionSeconds < 1800s e respeita consistência proporcional em semana parcial', () => {
    // Quinta-feira (elapsedDaysCount = 4 -> ceil(3 * 4 / 7) = 2 dias esperados)
    const refNow = localDateTimeToUtc('2026-10-22T12:00', tz);
    const subjects = [
      {
        id: 's1',
        name: 'História',
        color: '#3b82f6',
        archived: false,
        created_at: localDateTimeToUtc('2026-10-20T00:00', tz), // recém-criada
      },
    ];
    const topics = [
      { id: 't1', subject_id: 's1', parent_id: null, name: 'Brasil Colônia', archived: false },
    ];

    // Apenas 1200s (< 1800s) na semana atual, em 1 único dia ativo (terça 20/10)
    const sCur = makeStudySession({
      id: 'sess-short',
      topic_id: 't1',
      startedAt: localDateTimeToUtc('2026-10-20T10:00', tz),
      totalSeconds: 1200,
      distractedRealtimeSeconds: 600, // 50% foco, mas < 1800s
      plannedMinutes: 60, // baixa aderência, mas < 1800s
      questions: 15,
      correct: 5,
    });
    const sPrev = makeStudySession({
      id: 'sess-prev-ok',
      topic_id: 't1',
      startedAt: localDateTimeToUtc('2026-10-13T10:00', tz),
      totalSeconds: 3600,
      questions: 15,
      correct: 15,
    });

    const report = calculateWeeklyObservatory({
      selectedLocalDate: '2026-10-22',
      referenceNow: refNow,
      timezone: tz,
      weekStartsOn: 'MONDAY',
      sessions: [sPrev, sCur],
      plannedSessions: [],
      subjects,
      topics,
    });

    const ids = report.insightsAndRecommendations.map((i) => i.id);
    expect(ids).not.toContain('alert:accuracy-drop');
    expect(ids).not.toContain('alert:low-adherence');
    expect(ids).not.toContain('alert:low-effectiveness');
    // Mas consistência proporcional dispara porque elapsedDaysCount=4 (esperado ceil(12/7)=2, ativo=1)
    expect(ids).toContain('alert:low-consistency');
  });
});
