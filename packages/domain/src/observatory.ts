/**
 * Classificação de Assuntos/Matérias (70/30 + fallback 100%) e Motor do Observatório Semanal (Fase 8).
 * Funções puras — sem banco de dados, sem I/O.
 */

import {
  addDaysToLocalDate,
  getDayWindowUtc,
  getRolling30DaysWindowUtc,
  utcToLocalDate,
} from './calendar.js';
import { type GoalProgressSessionInput } from './goals.js';
import {
  calculateAccuracy,
  normalizeUnderstandingScore,
  type UnderstandingLevelDTO,
} from './practice.js';
import {
  type StatisticsSubjectInput,
  type StatisticsTopicInput,
} from './statistics.js';
import {
  DEFAULT_STUDY_THRESHOLDS,
  type StudyThresholds,
} from './thresholds.js';

export const TOPIC_CLASSIFICATION_VALUES = [
  'STRONG',
  'REGULAR',
  'WEAK',
  'INSUFFICIENT_DATA',
] as const;

export type TopicClassificationValue = (typeof TOPIC_CLASSIFICATION_VALUES)[number];

export const RECOMMENDED_ACTION_VALUES = [
  'MAINTAIN',
  'MORE_PRACTICE',
  'REVIEW_AND_PRACTICE',
  'COLLECT_MORE_DATA',
] as const;

export type RecommendedActionValue = (typeof RECOMMENDED_ACTION_VALUES)[number];

export const TOPIC_CLASSIFICATION_LABELS: Record<TopicClassificationValue, string> = {
  STRONG: 'Ponto forte',
  REGULAR: 'Regular',
  WEAK: 'Ponto fraco',
  INSUFFICIENT_DATA: 'Dados insuficientes',
};

export const RECOMMENDED_ACTION_LABELS: Record<RecommendedActionValue, string> = {
  MAINTAIN: 'Manter ritmo',
  MORE_PRACTICE: 'Mais prática',
  REVIEW_AND_PRACTICE: 'Revisão + prática',
  COLLECT_MORE_DATA: 'Coletar mais dados',
};

export const UNDERSTANDING_SCORES: Record<UnderstandingLevelDTO, number> = {
  NONE: 0,
  PARTIAL: 33,
  GOOD: 67,
  MASTERED: 100,
};

export interface ClassificationWindowInfo {
  windowStartLocalDate: string;
  windowEndLocalDate: string;
}

export interface ClassificationWindowResult extends ClassificationWindowInfo {
  classificationEndLocalDate: string;
  startUtc: Date;
  endUtc: Date;
}

export interface TopicClassification {
  classification: TopicClassificationValue;
  label: string;
  finalScore: number | null;
  displayScore: number | null;
  accuracyScore: number | null;
  understandingAvgScore: number | null;
  evaluationsCount: number;
  usedFallback: boolean;
  weightsUsed: { accuracy: number; understanding: number } | null;
  recommendedAction: RecommendedActionValue;
  recommendedActionLabel: string;
  lowUnderstandingSignal: boolean;
  windowStartLocalDate: string;
  windowEndLocalDate: string;
  questionsInWindow: number;
  correctInWindow: number;
}

/**
 * Calcula a janela unificada de classificação de 30 dias locais terminando em
 * `classificationEndLocalDate = min(periodEndLocalDate, todayLocalDate)`.
 */
export function getClassificationWindow(
  periodEndLocalDate: string,
  referenceNow: Date,
  timezone: string,
  thresholds: StudyThresholds = DEFAULT_STUDY_THRESHOLDS
): ClassificationWindowResult {
  const todayLocalDate = utcToLocalDate(referenceNow, timezone);
  const classificationEndLocalDate =
    periodEndLocalDate < todayLocalDate ? periodEndLocalDate : todayLocalDate;

  const windowEndLocalDate = classificationEndLocalDate;
  const windowStartLocalDate = addDaysToLocalDate(
    classificationEndLocalDate,
    -(thresholds.CLASSIFICATION_WINDOW_DAYS - 1)
  );

  if (thresholds.CLASSIFICATION_WINDOW_DAYS === 30) {
    const rolling = getRolling30DaysWindowUtc(classificationEndLocalDate, timezone);
    return {
      classificationEndLocalDate,
      windowStartLocalDate: rolling.startLocalDate,
      windowEndLocalDate: rolling.endLocalDate,
      startUtc: rolling.startUtc,
      endUtc: rolling.endUtc,
    };
  }

  const startDay = getDayWindowUtc(windowStartLocalDate, timezone);
  const endDay = getDayWindowUtc(windowEndLocalDate, timezone);
  return {
    classificationEndLocalDate,
    windowStartLocalDate,
    windowEndLocalDate,
    startUtc: startDay.startUtc,
    endUtc: endDay.endUtc,
  };
}

/**
 * Calcula a nota consolidada (70% acurácia + 30% autoavaliação, ou fallback 100% acurácia),
 * truncando `displayScore` com `CLASSIFICATION_EPSILON` e sinalizando baixo entendimento.
 */
export function calculateTopicClassification(
  input: {
    totalQuestions: number;
    totalCorrect: number;
    understandingScores: ReadonlyArray<number>;
  },
  windowInfo: ClassificationWindowInfo,
  thresholds: StudyThresholds = DEFAULT_STUDY_THRESHOLDS
): TopicClassification {
  const { totalQuestions, totalCorrect, understandingScores } = input;
  const evaluationsCount = understandingScores.length;
  const accuracyScore = calculateAccuracy(totalCorrect, totalQuestions);

  let understandingAvgScore: number | null = null;
  if (evaluationsCount > 0) {
    let sum = 0;
    for (const s of understandingScores) {
      sum += s;
    }
    understandingAvgScore = sum / evaluationsCount;
  }

  const lowUnderstandingSignal =
    evaluationsCount > 0 &&
    understandingAvgScore !== null &&
    understandingAvgScore + thresholds.CLASSIFICATION_EPSILON <
      thresholds.LOW_UNDERSTANDING_THRESHOLD;

  if (totalQuestions < thresholds.MIN_QUESTIONS || accuracyScore === null) {
    return {
      classification: 'INSUFFICIENT_DATA',
      label: TOPIC_CLASSIFICATION_LABELS.INSUFFICIENT_DATA,
      finalScore: null,
      displayScore: null,
      accuracyScore,
      understandingAvgScore,
      evaluationsCount,
      usedFallback: false,
      weightsUsed: null,
      recommendedAction: 'COLLECT_MORE_DATA',
      recommendedActionLabel: RECOMMENDED_ACTION_LABELS.COLLECT_MORE_DATA,
      lowUnderstandingSignal,
      windowStartLocalDate: windowInfo.windowStartLocalDate,
      windowEndLocalDate: windowInfo.windowEndLocalDate,
      questionsInWindow: totalQuestions,
      correctInWindow: totalCorrect,
    };
  }

  let finalScore: number;
  let usedFallback: boolean;
  let weightsUsed: { accuracy: number; understanding: number };

  if (evaluationsCount > 0 && understandingAvgScore !== null) {
    finalScore =
      thresholds.SCORE_WEIGHT_ACCURACY * accuracyScore +
      thresholds.SCORE_WEIGHT_UNDERSTANDING * understandingAvgScore;
    usedFallback = false;
    weightsUsed = {
      accuracy: thresholds.SCORE_WEIGHT_ACCURACY,
      understanding: thresholds.SCORE_WEIGHT_UNDERSTANDING,
    };
  } else {
    finalScore = accuracyScore;
    usedFallback = true;
    weightsUsed = { accuracy: 1, understanding: 0 };
  }

  const adjustedScore = finalScore + thresholds.CLASSIFICATION_EPSILON;
  const displayScore = Math.floor(adjustedScore * 10) / 10;

  let classification: TopicClassificationValue;
  let recommendedAction: RecommendedActionValue;

  if (adjustedScore >= thresholds.STRONG_THRESHOLD) {
    classification = 'STRONG';
    recommendedAction = 'MAINTAIN';
  } else if (adjustedScore >= thresholds.WEAK_THRESHOLD) {
    classification = 'REGULAR';
    recommendedAction = 'MORE_PRACTICE';
  } else {
    classification = 'WEAK';
    recommendedAction = 'REVIEW_AND_PRACTICE';
  }

  return {
    classification,
    label: TOPIC_CLASSIFICATION_LABELS[classification],
    finalScore,
    displayScore,
    accuracyScore,
    understandingAvgScore,
    evaluationsCount,
    usedFallback,
    weightsUsed,
    recommendedAction,
    recommendedActionLabel: RECOMMENDED_ACTION_LABELS[recommendedAction],
    lowUnderstandingSignal,
    windowStartLocalDate: windowInfo.windowStartLocalDate,
    windowEndLocalDate: windowInfo.windowEndLocalDate,
    questionsInWindow: totalQuestions,
    correctInWindow: totalCorrect,
  };
}

/**
 * Constrói mapas de classificação de 30 dias para assuntos (`byTopic`, cálculo direto sem descendentes)
 * e matérias (`bySubject`, soma todas as questões da matéria e tira média simples das avaliações).
 * Apenas itens com atividade na janela de 30 dias (sessão FINISHED ou PracticeRecord) entram nos mapas.
 */
export function buildClassificationIndex(params: {
  sessions: ReadonlyArray<GoalProgressSessionInput>;
  subjects: ReadonlyArray<StatisticsSubjectInput>;
  topics: ReadonlyArray<StatisticsTopicInput>;
  window: ClassificationWindowResult;
  thresholds?: StudyThresholds;
}): {
  byTopic: Map<string, TopicClassification>;
  bySubject: Map<string, TopicClassification>;
} {
  const {
    sessions,
    subjects,
    topics,
    window,
    thresholds = DEFAULT_STUDY_THRESHOLDS,
  } = params;

  const subjectById = new Map<string, StatisticsSubjectInput>();
  for (const s of subjects) {
    subjectById.set(s.id, s);
  }

  const topicById = new Map<string, StatisticsTopicInput>();
  for (const t of topics) {
    topicById.set(t.id, t);
  }

  interface AggBucket {
    totalQuestions: number;
    totalCorrect: number;
    understandingScores: number[];
    hasActivity: boolean;
  }

  const topicBuckets = new Map<string, AggBucket>();
  const subjectBuckets = new Map<string, AggBucket>();

  const ensureTopicBucket = (topicId: string): AggBucket => {
    let b = topicBuckets.get(topicId);
    if (!b) {
      b = { totalQuestions: 0, totalCorrect: 0, understandingScores: [], hasActivity: false };
      topicBuckets.set(topicId, b);
    }
    return b;
  };

  const ensureSubjectBucket = (subjectId: string): AggBucket => {
    let b = subjectBuckets.get(subjectId);
    if (!b) {
      b = { totalQuestions: 0, totalCorrect: 0, understandingScores: [], hasActivity: false };
      subjectBuckets.set(subjectId, b);
    }
    return b;
  };

  const windowStartMs = window.startUtc.getTime();
  const windowEndMs = window.endUtc.getTime();

  for (const session of sessions) {
    if (session.status !== 'FINISHED') continue;
    const startedMs = session.started_at.getTime();
    if (startedMs < windowStartMs || startedMs >= windowEndMs) continue;

    const sessionTopic = topicById.get(session.topic_id);
    if (sessionTopic) {
      const tb = ensureTopicBucket(sessionTopic.id);
      tb.hasActivity = true;

      if (session.evaluation) {
        tb.understandingScores.push(
          normalizeUnderstandingScore(session.evaluation.understanding)
        );
      }

      if (subjectById.has(sessionTopic.subject_id)) {
        const sb = ensureSubjectBucket(sessionTopic.subject_id);
        sb.hasActivity = true;
        if (session.evaluation) {
          sb.understandingScores.push(
            normalizeUnderstandingScore(session.evaluation.understanding)
          );
        }
      }
    }

    for (const pr of session.practice_records) {
      const prTopic = topicById.get(pr.topic_id);
      if (!prTopic) continue;

      const tb = ensureTopicBucket(prTopic.id);
      if (pr.questions > 0) {
        tb.hasActivity = true;
      }
      tb.totalQuestions += pr.questions;
      tb.totalCorrect += pr.correct;

      if (subjectById.has(prTopic.subject_id)) {
        const sb = ensureSubjectBucket(prTopic.subject_id);
        if (pr.questions > 0) {
          sb.hasActivity = true;
        }
        sb.totalQuestions += pr.questions;
        sb.totalCorrect += pr.correct;
      }
    }
  }

  const windowInfo: ClassificationWindowInfo = {
    windowStartLocalDate: window.windowStartLocalDate,
    windowEndLocalDate: window.windowEndLocalDate,
  };

  const byTopic = new Map<string, TopicClassification>();
  for (const [topicId, bucket] of topicBuckets.entries()) {
    if (!bucket.hasActivity) continue;
    byTopic.set(
      topicId,
      calculateTopicClassification(bucket, windowInfo, thresholds)
    );
  }

  const bySubject = new Map<string, TopicClassification>();
  for (const [subjectId, bucket] of subjectBuckets.entries()) {
    if (!bucket.hasActivity) continue;
    bySubject.set(
      subjectId,
      calculateTopicClassification(bucket, windowInfo, thresholds)
    );
  }

  return { byTopic, bySubject };
}

import { z } from 'zod';
import {
  getWeekWindowUtc,
  isValidLocalDate,
  parseWeekStartsOn,
} from './calendar.js';
import {
  type StatisticsPlannedSessionInput,
} from './statistics.js';
import {
  calculateBlockTimes,
  calculateSessionMetrics,
} from './timer.js';

/** Constantes de conversão de unidades de tempo (não são limiares de regra). */
const SECONDS_IN_MINUTE = 60;
const MS_IN_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

export const observatoryQuerySchema = z
  .object({
    date: z
      .string()
      .refine(isValidLocalDate, {
        message: 'A data informada é inválida. Use o formato YYYY-MM-DD com uma data real.',
      })
      .optional(),
  })
  .strict();

export type ObservatoryQueryInput = z.infer<typeof observatoryQuerySchema>;

export interface ObservatorySubjectInput extends StatisticsSubjectInput {
  created_at: Date;
}

export interface WeekPeriodMetrics {
  agendaPlannedMinutes: number;
  agendaPlannedElapsedMinutes: number;
  planningGapMinutes: number;
  executedPlannedSeconds: number;
  effectiveSeconds: number;
  effectiveMinutes: number;
  totalSessionSeconds: number;
  completedSessionsCount: number;
  activeDaysCount: number;
  comparedDaysCount: number;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number | null;
  effectiveness: number | null;
  adherence: number | null;
}

export interface WeekComparisonReport {
  selectedWeek: WeekPeriodMetrics;
  previousWeek: WeekPeriodMetrics;
  deltaEffectiveMinutes: number;
  deltaEffectiveMinutesPercent: number | null;
  deltaQuestions: number;
  deltaQuestionsPercent: number | null;
  deltaAccuracyPoints: number | null;
  deltaEffectivenessPoints: number | null;
  deltaAdherencePoints: number | null;
  deltaActiveDays: number;
}

export interface PauseAndDistractionAnalysis {
  effectiveSeconds: number;
  effectiveMinutes: number;
  pausedSeconds: number;
  pausedMinutes: number;
  distractedRealtimeSeconds: number;
  distractedDeclaredSeconds: number;
  totalDistractedSeconds: number;
  totalDistractedMinutes: number;
  totalSessionSeconds: number;
  effectiveness: number | null;
  distractionRatePercent: number | null;
  hasMinimumSample: boolean;
  highestDistractionSubject: {
    subjectId: string;
    subjectName: string;
    subjectColor: string;
    distractedSeconds: number;
    totalSessionSeconds: number;
    distractionRatePercent: number;
  } | null;
  highestDistractionDay: {
    date: string;
    distractedSeconds: number;
    totalSessionSeconds: number;
    distractionRatePercent: number;
  } | null;
}

export interface TopicObservatoryItem {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  parentId: string | null;
  archived: boolean;
  weekEffectiveSeconds: number;
  weekEffectiveMinutes: number;
  weekQuestions: number;
  weekCorrect: number;
  weekCompletedSessionsCount: number;
  classification: TopicClassification;
}

export interface SubjectObservatoryItem {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  archived: boolean;
  weekEffectiveSeconds: number;
  weekEffectiveMinutes: number;
  weekQuestions: number;
  weekCorrect: number;
  weekCompletedSessionsCount: number;
  classification: TopicClassification;
}

export interface NeglectedSubjectItem {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  daysSinceLastStudy: number | null;
  lastStudiedLocalDate: string | null;
}

export const INSIGHT_SEVERITIES = ['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

export interface InsightEvidenceItem {
  label: string;
  value: string;
  threshold: string;
}

export interface ObservatoryInsightItem {
  id: string;
  severity: InsightSeverity;
  kind:
    | 'ACCURACY_DROP'
    | 'WEAK_TOPIC'
    | 'LOW_CONSISTENCY'
    | 'LOW_ADHERENCE'
    | 'LOW_EFFECTIVENESS'
    | 'NEGLECTED_SUBJECT'
    | 'PLANNING_GAP'
    | 'REGULAR_TOPIC'
    | 'STRONG_TOPIC';
  title: string;
  description: string;
  recommendedActionLabel: string;
  finalScore: number | null;
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName?: string;
  evidence: InsightEvidenceItem[];
}

export interface WeeklyObservatoryReport {
  weekStartLocalDate: string;
  weekEndLocalDate: string;
  previousWeekStartLocalDate: string;
  previousWeekEndLocalDate: string;
  classificationWindow: ClassificationWindowInfo;
  isPartialWeek: boolean;
  elapsedDaysCount: number;
  hasAnyData: boolean;
  weekComparison: WeekComparisonReport;
  pauseAndDistractionAnalysis: PauseAndDistractionAnalysis;
  topicClassification: {
    weak: TopicObservatoryItem[];
    regular: TopicObservatoryItem[];
    strong: TopicObservatoryItem[];
    insufficient: TopicObservatoryItem[];
  };
  subjectClassification: SubjectObservatoryItem[];
  neglectedSubjects: NeglectedSubjectItem[];
  insightsAndRecommendations: ObservatoryInsightItem[];
}

function computeSliceMetrics(params: {
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  agendaCutoffUtc: Date;
  comparedDaysCount: number;
  timezone: string;
  sessions: ReadonlyArray<GoalProgressSessionInput>;
  plannedSessions: ReadonlyArray<StatisticsPlannedSessionInput>;
  referenceNow: Date;
}): WeekPeriodMetrics {
  const {
    sliceStartUtc,
    sliceEndUtc,
    agendaCutoffUtc,
    comparedDaysCount,
    timezone,
    sessions,
    plannedSessions,
    referenceNow,
  } = params;

  const startMs = sliceStartUtc.getTime();
  const endMs = sliceEndUtc.getTime();
  const cutoffMs = agendaCutoffUtc.getTime();

  let agendaPlannedMinutes = 0;
  let agendaPlannedElapsedMinutes = 0;

  for (const ps of plannedSessions) {
    if (ps.status !== 'PLANNED' && ps.status !== 'DONE') continue;
    const psMs = ps.scheduled_start.getTime();
    if (psMs >= startMs && psMs < endMs) {
      agendaPlannedMinutes += ps.planned_minutes;
      if (psMs < cutoffMs) {
        agendaPlannedElapsedMinutes += ps.planned_minutes;
      }
    }
  }

  let executedPlannedSeconds = 0;
  let effectiveSeconds = 0;
  let totalSessionSeconds = 0;
  let completedSessionsCount = 0;
  let totalQuestions = 0;
  let totalCorrect = 0;
  const activeDaysSet = new Set<string>();

  for (const s of sessions) {
    if (s.status !== 'FINISHED') continue;
    const sMs = s.started_at.getTime();
    if (sMs < startMs || sMs >= endMs) continue;

    completedSessionsCount += 1;
    const metrics = calculateSessionMetrics(s, s.blocks, s.events, referenceNow);
    if (metrics) {
      effectiveSeconds += metrics.effectiveSeconds;
      totalSessionSeconds += metrics.totalSeconds;
      executedPlannedSeconds += metrics.plannedSeconds;
      if (metrics.effectiveSeconds > 0) {
        activeDaysSet.add(utcToLocalDate(s.started_at, timezone));
      }
    }

    for (const pr of s.practice_records) {
      totalQuestions += pr.questions;
      totalCorrect += pr.correct;
    }
  }

  const effectiveMinutes = effectiveSeconds / SECONDS_IN_MINUTE;
  const planningGapMinutes = Math.max(0, agendaPlannedElapsedMinutes - effectiveMinutes);
  const accuracy = calculateAccuracy(totalCorrect, totalQuestions);
  const effectiveness =
    totalSessionSeconds > 0 ? (effectiveSeconds / totalSessionSeconds) * 100 : null;
  const adherence =
    executedPlannedSeconds > 0 ? (effectiveSeconds / executedPlannedSeconds) * 100 : null;

  return {
    agendaPlannedMinutes,
    agendaPlannedElapsedMinutes,
    planningGapMinutes,
    executedPlannedSeconds,
    effectiveSeconds,
    effectiveMinutes,
    totalSessionSeconds,
    completedSessionsCount,
    activeDaysCount: activeDaysSet.size,
    comparedDaysCount,
    totalQuestions,
    totalCorrect,
    accuracy,
    effectiveness,
    adherence,
  };
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  INFO: 3,
};

function sortInsightsDeterministically(
  items: ObservatoryInsightItem[],
  epsilon: number
): ObservatoryInsightItem[] {
  return [...items].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;

    const aHasScore = a.finalScore !== null && a.finalScore !== undefined;
    const bHasScore = b.finalScore !== null && b.finalScore !== undefined;

    if (aHasScore && !bHasScore) return -1;
    if (!aHasScore && bHasScore) return 1;

    if (aHasScore && bHasScore) {
      const scoreDiff = (a.finalScore as number) - (b.finalScore as number);
      if (Math.abs(scoreDiff) > epsilon) {
        if (a.severity === 'INFO') {
          return -scoreDiff;
        }
        return scoreDiff;
      }
    }

    return a.id.localeCompare(b.id);
  });
}

export function calculateWeeklyObservatory(
  params: {
    selectedLocalDate: string;
    referenceNow: Date;
    timezone: string;
    weekStartsOn?: string | number | null;
    sessions: ReadonlyArray<GoalProgressSessionInput>;
    plannedSessions: ReadonlyArray<StatisticsPlannedSessionInput>;
    subjects: ReadonlyArray<ObservatorySubjectInput>;
    topics: ReadonlyArray<StatisticsTopicInput>;
  },
  thresholds: StudyThresholds = DEFAULT_STUDY_THRESHOLDS
): WeeklyObservatoryReport {
  const {
    selectedLocalDate,
    referenceNow,
    timezone,
    weekStartsOn,
    sessions,
    plannedSessions,
    subjects,
    topics,
  } = params;

  const parsedWeekStartsOn = parseWeekStartsOn(weekStartsOn);
  const selectedWeek = getWeekWindowUtc(selectedLocalDate, timezone, parsedWeekStartsOn);
  const weekStartLocalDate = selectedWeek.days[0];
  const weekEndLocalDate = selectedWeek.days[selectedWeek.days.length - 1];
  const selectedWeekStartUtc = selectedWeek.startUtc;
  const selectedWeekEndUtc = selectedWeek.endUtc;

  const previousWeekStartLocalDate = addDaysToLocalDate(weekStartLocalDate, -DAYS_IN_WEEK);
  const previousWeek = getWeekWindowUtc(previousWeekStartLocalDate, timezone, parsedWeekStartsOn);
  const previousWeekEndLocalDate = previousWeek.days[previousWeek.days.length - 1];

  const evaluationInstant = new Date(
    Math.min(referenceNow.getTime(), selectedWeekEndUtc.getTime())
  );
  const isPartialWeek = referenceNow.getTime() < selectedWeekEndUtc.getTime();
  const todayLocalDate = utcToLocalDate(referenceNow, timezone);

  let elapsedDaysCount = DAYS_IN_WEEK;
  if (isPartialWeek) {
    const count = selectedWeek.days.filter((d) => d <= todayLocalDate).length;
    elapsedDaysCount = Math.min(DAYS_IN_WEEK, Math.max(1, count));
  }

  const selectedComparedEndDay = selectedWeek.days[elapsedDaysCount - 1];
  const selectedSliceEndUtc = getDayWindowUtc(selectedComparedEndDay, timezone).endUtc;

  const prevComparedEndDay = previousWeek.days[elapsedDaysCount - 1];
  const prevSliceEndUtc = getDayWindowUtc(prevComparedEndDay, timezone).endUtc;

  const selectedMetrics = computeSliceMetrics({
    sliceStartUtc: selectedWeekStartUtc,
    sliceEndUtc: selectedSliceEndUtc,
    agendaCutoffUtc: evaluationInstant,
    comparedDaysCount: elapsedDaysCount,
    timezone,
    sessions,
    plannedSessions,
    referenceNow,
  });

  const previousMetrics = computeSliceMetrics({
    sliceStartUtc: previousWeek.startUtc,
    sliceEndUtc: prevSliceEndUtc,
    agendaCutoffUtc: prevSliceEndUtc,
    comparedDaysCount: elapsedDaysCount,
    timezone,
    sessions,
    plannedSessions,
    referenceNow,
  });

  const deltaEffectiveMinutes =
    selectedMetrics.effectiveMinutes - previousMetrics.effectiveMinutes;
  const deltaEffectiveMinutesPercent =
    previousMetrics.effectiveMinutes > 0
      ? ((selectedMetrics.effectiveMinutes - previousMetrics.effectiveMinutes) /
          previousMetrics.effectiveMinutes) *
        100
      : null;

  const deltaQuestions = selectedMetrics.totalQuestions - previousMetrics.totalQuestions;
  const deltaQuestionsPercent =
    previousMetrics.totalQuestions > 0
      ? ((selectedMetrics.totalQuestions - previousMetrics.totalQuestions) /
          previousMetrics.totalQuestions) *
        100
      : null;

  const deltaAccuracyPoints =
    selectedMetrics.totalQuestions >= thresholds.MIN_QUESTIONS &&
    previousMetrics.totalQuestions >= thresholds.MIN_QUESTIONS &&
    selectedMetrics.accuracy !== null &&
    previousMetrics.accuracy !== null
      ? selectedMetrics.accuracy - previousMetrics.accuracy
      : null;

  const deltaEffectivenessPoints =
    selectedMetrics.effectiveness !== null && previousMetrics.effectiveness !== null
      ? selectedMetrics.effectiveness - previousMetrics.effectiveness
      : null;

  const deltaAdherencePoints =
    selectedMetrics.adherence !== null && previousMetrics.adherence !== null
      ? selectedMetrics.adherence - previousMetrics.adherence
      : null;

  const weekComparison: WeekComparisonReport = {
    selectedWeek: selectedMetrics,
    previousWeek: previousMetrics,
    deltaEffectiveMinutes,
    deltaEffectiveMinutesPercent,
    deltaQuestions,
    deltaQuestionsPercent,
    deltaAccuracyPoints,
    deltaEffectivenessPoints,
    deltaAdherencePoints,
    deltaActiveDays: selectedMetrics.activeDaysCount - previousMetrics.activeDaysCount,
  };

  // Análise de pausas e distrações na janela comparada da semana selecionada
  const subjectById = new Map<string, ObservatorySubjectInput>();
  for (const s of subjects) {
    subjectById.set(s.id, s);
  }
  const topicById = new Map<string, StatisticsTopicInput>();
  for (const t of topics) {
    topicById.set(t.id, t);
  }

  let pausedSeconds = 0;
  let distractedRealtimeSeconds = 0;
  let distractedDeclaredSeconds = 0;

  const subjectDistractionMap = new Map<
    string,
    { distractedSeconds: number; totalSessionSeconds: number }
  >();
  const dayDistractionMap = new Map<
    string,
    { distractedSeconds: number; totalSessionSeconds: number }
  >();

  const selectedStartMs = selectedWeekStartUtc.getTime();
  const selectedSliceEndMs = selectedSliceEndUtc.getTime();

  for (const s of sessions) {
    if (s.status !== 'FINISHED') continue;
    const sMs = s.started_at.getTime();
    if (sMs < selectedStartMs || sMs >= selectedSliceEndMs) continue;

    let sessPaused = 0;
    let sessDistRt = 0;
    let sessDistDec = 0;
    let sessTotal = 0;

    for (const block of s.blocks) {
      const blockEvents = s.events.filter((e) => e.block_id === block.id);
      const bt = calculateBlockTimes(blockEvents, referenceNow);
      sessPaused += bt.pausedSeconds;
      sessDistRt += bt.distractedRealtimeSeconds;
      sessDistDec += bt.distractedDeclaredSeconds;
      sessTotal += bt.totalSeconds;
    }

    pausedSeconds += sessPaused;
    distractedRealtimeSeconds += sessDistRt;
    distractedDeclaredSeconds += sessDistDec;

    const sessDistracted = sessDistRt + sessDistDec;
    const topic = topicById.get(s.topic_id);
    if (topic && subjectById.has(topic.subject_id)) {
      const curSub = subjectDistractionMap.get(topic.subject_id) ?? {
        distractedSeconds: 0,
        totalSessionSeconds: 0,
      };
      curSub.distractedSeconds += sessDistracted;
      curSub.totalSessionSeconds += sessTotal;
      subjectDistractionMap.set(topic.subject_id, curSub);
    }

    const localDay = utcToLocalDate(s.started_at, timezone);
    const curDay = dayDistractionMap.get(localDay) ?? {
      distractedSeconds: 0,
      totalSessionSeconds: 0,
    };
    curDay.distractedSeconds += sessDistracted;
    curDay.totalSessionSeconds += sessTotal;
    dayDistractionMap.set(localDay, curDay);
  }

  const totalDistractedSeconds = distractedRealtimeSeconds + distractedDeclaredSeconds;
  const hasMinimumSample =
    selectedMetrics.totalSessionSeconds >= thresholds.MIN_DISTRACTION_ANALYSIS_SECONDS;

  let highestDistractionSubject: PauseAndDistractionAnalysis['highestDistractionSubject'] = null;
  if (hasMinimumSample) {
    for (const [subjectId, agg] of subjectDistractionMap.entries()) {
      if (agg.totalSessionSeconds <= 0 || agg.distractedSeconds <= 0) continue;
      const sub = subjectById.get(subjectId);
      if (!sub) continue;
      const rate = (agg.distractedSeconds / agg.totalSessionSeconds) * 100;
      if (
        !highestDistractionSubject ||
        rate > highestDistractionSubject.distractionRatePercent ||
        (Math.abs(rate - highestDistractionSubject.distractionRatePercent) <=
          thresholds.CLASSIFICATION_EPSILON &&
          subjectId.localeCompare(highestDistractionSubject.subjectId) < 0)
      ) {
        highestDistractionSubject = {
          subjectId,
          subjectName: sub.name,
          subjectColor: sub.color,
          distractedSeconds: agg.distractedSeconds,
          totalSessionSeconds: agg.totalSessionSeconds,
          distractionRatePercent: rate,
        };
      }
    }
  }

  let highestDistractionDay: PauseAndDistractionAnalysis['highestDistractionDay'] = null;
  if (hasMinimumSample) {
    for (const [date, agg] of dayDistractionMap.entries()) {
      if (agg.totalSessionSeconds <= 0 || agg.distractedSeconds <= 0) continue;
      const rate = (agg.distractedSeconds / agg.totalSessionSeconds) * 100;
      if (
        !highestDistractionDay ||
        rate > highestDistractionDay.distractionRatePercent ||
        (Math.abs(rate - highestDistractionDay.distractionRatePercent) <=
          thresholds.CLASSIFICATION_EPSILON &&
          date.localeCompare(highestDistractionDay.date) < 0)
      ) {
        highestDistractionDay = {
          date,
          distractedSeconds: agg.distractedSeconds,
          totalSessionSeconds: agg.totalSessionSeconds,
          distractionRatePercent: rate,
        };
      }
    }
  }

  const pauseAndDistractionAnalysis: PauseAndDistractionAnalysis = {
    effectiveSeconds: selectedMetrics.effectiveSeconds,
    effectiveMinutes: selectedMetrics.effectiveMinutes,
    pausedSeconds,
    pausedMinutes: pausedSeconds / SECONDS_IN_MINUTE,
    distractedRealtimeSeconds,
    distractedDeclaredSeconds,
    totalDistractedSeconds,
    totalDistractedMinutes: totalDistractedSeconds / SECONDS_IN_MINUTE,
    totalSessionSeconds: selectedMetrics.totalSessionSeconds,
    effectiveness: selectedMetrics.effectiveness,
    distractionRatePercent:
      selectedMetrics.totalSessionSeconds > 0
        ? (totalDistractedSeconds / selectedMetrics.totalSessionSeconds) * 100
        : null,
    hasMinimumSample,
    highestDistractionSubject,
    highestDistractionDay,
  };

  // Janela de 30 dias para classificação
  const classWin = getClassificationWindow(
    weekEndLocalDate,
    referenceNow,
    timezone,
    thresholds
  );

  const classIndex = buildClassificationIndex({
    sessions,
    subjects,
    topics,
    window: classWin,
    thresholds,
  });

  // Métricas semanais por assunto e por matéria (na semana selecionada completa [selectedWeekStartUtc, selectedWeekEndUtc))
  const weekFullEndMs = selectedWeekEndUtc.getTime();
  const topicWeekMap = new Map<
    string,
    { effectiveSeconds: number; questions: number; correct: number; sessionsCount: number }
  >();
  const subjectWeekMap = new Map<
    string,
    { effectiveSeconds: number; questions: number; correct: number; sessionsCount: number }
  >();

  for (const s of sessions) {
    if (s.status !== 'FINISHED') continue;
    const sMs = s.started_at.getTime();
    if (sMs < selectedStartMs || sMs >= weekFullEndMs) continue;

    const metrics = calculateSessionMetrics(s, s.blocks, s.events, referenceNow);
    const effSec = metrics ? metrics.effectiveSeconds : 0;

    const sTopic = topicById.get(s.topic_id);
    if (sTopic) {
      const tw = topicWeekMap.get(sTopic.id) ?? {
        effectiveSeconds: 0,
        questions: 0,
        correct: 0,
        sessionsCount: 0,
      };
      tw.effectiveSeconds += effSec;
      tw.sessionsCount += 1;
      topicWeekMap.set(sTopic.id, tw);

      const sw = subjectWeekMap.get(sTopic.subject_id) ?? {
        effectiveSeconds: 0,
        questions: 0,
        correct: 0,
        sessionsCount: 0,
      };
      sw.effectiveSeconds += effSec;
      sw.sessionsCount += 1;
      subjectWeekMap.set(sTopic.subject_id, sw);
    }

    for (const pr of s.practice_records) {
      const prTopic = topicById.get(pr.topic_id);
      if (!prTopic) continue;
      const tw = topicWeekMap.get(prTopic.id) ?? {
        effectiveSeconds: 0,
        questions: 0,
        correct: 0,
        sessionsCount: 0,
      };
      tw.questions += pr.questions;
      tw.correct += pr.correct;
      topicWeekMap.set(prTopic.id, tw);

      const sw = subjectWeekMap.get(prTopic.subject_id) ?? {
        effectiveSeconds: 0,
        questions: 0,
        correct: 0,
        sessionsCount: 0,
      };
      sw.questions += pr.questions;
      sw.correct += pr.correct;
      subjectWeekMap.set(prTopic.subject_id, sw);
    }
  }

  const weakTopics: TopicObservatoryItem[] = [];
  const regularTopics: TopicObservatoryItem[] = [];
  const strongTopics: TopicObservatoryItem[] = [];
  const insufficientTopics: TopicObservatoryItem[] = [];

  for (const [topicId, classification] of classIndex.byTopic.entries()) {
    const t = topicById.get(topicId);
    if (!t || t.archived) continue;
    const sub = subjectById.get(t.subject_id);
    if (!sub || sub.archived) continue;

    const w = topicWeekMap.get(topicId) ?? {
      effectiveSeconds: 0,
      questions: 0,
      correct: 0,
      sessionsCount: 0,
    };

    const item: TopicObservatoryItem = {
      topicId: t.id,
      topicName: t.name,
      subjectId: sub.id,
      subjectName: sub.name,
      subjectColor: sub.color,
      parentId: t.parent_id,
      archived: false,
      weekEffectiveSeconds: w.effectiveSeconds,
      weekEffectiveMinutes: w.effectiveSeconds / SECONDS_IN_MINUTE,
      weekQuestions: w.questions,
      weekCorrect: w.correct,
      weekCompletedSessionsCount: w.sessionsCount,
      classification,
    };

    if (classification.classification === 'WEAK') weakTopics.push(item);
    else if (classification.classification === 'REGULAR') regularTopics.push(item);
    else if (classification.classification === 'STRONG') strongTopics.push(item);
    else insufficientTopics.push(item);
  }

  const sortByScoreAsc = (a: TopicObservatoryItem, b: TopicObservatoryItem) => {
    const sa = a.classification.finalScore ?? 0;
    const sb = b.classification.finalScore ?? 0;
    if (Math.abs(sa - sb) > thresholds.CLASSIFICATION_EPSILON) return sa - sb;
    return a.topicId.localeCompare(b.topicId);
  };
  const sortByScoreDesc = (a: TopicObservatoryItem, b: TopicObservatoryItem) => {
    const sa = a.classification.finalScore ?? 0;
    const sb = b.classification.finalScore ?? 0;
    if (Math.abs(sa - sb) > thresholds.CLASSIFICATION_EPSILON) return sb - sa;
    return a.topicId.localeCompare(b.topicId);
  };

  weakTopics.sort(sortByScoreAsc);
  regularTopics.sort(sortByScoreAsc);
  strongTopics.sort(sortByScoreDesc);
  insufficientTopics.sort((a, b) => a.topicId.localeCompare(b.topicId));

  const subjectClassification: SubjectObservatoryItem[] = [];
  for (const [subjectId, classification] of classIndex.bySubject.entries()) {
    const sub = subjectById.get(subjectId);
    if (!sub || sub.archived) continue;
    const w = subjectWeekMap.get(subjectId) ?? {
      effectiveSeconds: 0,
      questions: 0,
      correct: 0,
      sessionsCount: 0,
    };
    subjectClassification.push({
      subjectId: sub.id,
      subjectName: sub.name,
      subjectColor: sub.color,
      archived: false,
      weekEffectiveSeconds: w.effectiveSeconds,
      weekEffectiveMinutes: w.effectiveSeconds / SECONDS_IN_MINUTE,
      weekQuestions: w.questions,
      weekCorrect: w.correct,
      weekCompletedSessionsCount: w.sessionsCount,
      classification,
    });
  }
  subjectClassification.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  // Matérias negligenciadas: ativas (!archived), 0s efetivos nos últimos NEGLECT_DAYS até evaluationInstant
  // e criadas há pelo menos NEGLECT_DAYS dias antes do evaluationInstant
  const evalInstantMs = evaluationInstant.getTime();
  const neglectWindowStartMs = evalInstantMs - thresholds.NEGLECT_DAYS * MS_IN_DAY;
  const classStartMs = classWin.startUtc.getTime();

  const neglectedSubjects: NeglectedSubjectItem[] = [];

  for (const sub of subjects) {
    if (sub.archived) continue;
    const createdMs = sub.created_at.getTime();
    if (createdMs > neglectWindowStartMs) continue;

    let effectiveInNeglectWindow = 0;
    let lastStudyMs: number | null = null;

    for (const s of sessions) {
      if (s.status !== 'FINISHED') continue;
      const sMs = s.started_at.getTime();
      if (sMs >= evalInstantMs || sMs < classStartMs) continue;
      const st = topicById.get(s.topic_id);
      if (!st || st.subject_id !== sub.id) continue;

      const m = calculateSessionMetrics(s, s.blocks, s.events, referenceNow);
      const eff = m ? m.effectiveSeconds : 0;
      if (eff <= 0) continue;

      if (sMs >= neglectWindowStartMs) {
        effectiveInNeglectWindow += eff;
      }
      if (lastStudyMs === null || sMs > lastStudyMs) {
        lastStudyMs = sMs;
      }
    }

    if (effectiveInNeglectWindow === 0) {
      const daysSinceLastStudy =
        lastStudyMs !== null
          ? Math.max(1, Math.floor((evalInstantMs - lastStudyMs) / MS_IN_DAY))
          : null;
      neglectedSubjects.push({
        subjectId: sub.id,
        subjectName: sub.name,
        subjectColor: sub.color,
        daysSinceLastStudy,
        lastStudiedLocalDate:
          lastStudyMs !== null ? utcToLocalDate(new Date(lastStudyMs), timezone) : null,
      });
    }
  }
  neglectedSubjects.sort((a, b) => a.subjectId.localeCompare(b.subjectId));

  // Determina hasAnyData: sessões concluídas, planejadas ou questões na selectedWeek, previousWeek ou 30d
  const earliestWindowMs = Math.min(previousWeek.startUtc.getTime(), classStartMs);
  const latestWindowMs = Math.max(selectedWeekEndUtc.getTime(), classWin.endUtc.getTime());

  let hasAnyData = false;
  for (const s of sessions) {
    if (s.status !== 'FINISHED') continue;
    const ms = s.started_at.getTime();
    if (ms >= earliestWindowMs && ms < latestWindowMs) {
      hasAnyData = true;
      break;
    }
  }
  if (!hasAnyData) {
    for (const ps of plannedSessions) {
      if (ps.status !== 'PLANNED' && ps.status !== 'DONE') continue;
      const ms = ps.scheduled_start.getTime();
      if (ms >= earliestWindowMs && ms < latestWindowMs) {
        hasAnyData = true;
        break;
      }
    }
  }

  // Motor determinístico de Alertas e Recomendações
  const rawInsights: ObservatoryInsightItem[] = [];

  if (hasAnyData) {
    // 1. HIGH: Queda de desempenho (exige amostra mínima >= 1800s e deltaAccuracyPoints <= -ACCURACY_DROP_ALERT_POINTS)
    if (
      hasMinimumSample &&
      deltaAccuracyPoints !== null &&
      deltaAccuracyPoints <= -thresholds.ACCURACY_DROP_ALERT_POINTS
    ) {
      rawInsights.push({
        id: 'alert:accuracy-drop',
        severity: 'HIGH',
        kind: 'ACCURACY_DROP',
        title: 'Queda acentuada na taxa de acerto',
        description:
          'O seu aproveitamento em questões caiu de forma relevante em comparação ao mesmo período da semana anterior.',
        recommendedActionLabel: 'Revisar erros recentes',
        finalScore: null,
        evidence: [
          {
            label: 'Variação na semana',
            value: `${deltaAccuracyPoints.toFixed(1)} p.p.`,
            threshold: `<= -${thresholds.ACCURACY_DROP_ALERT_POINTS} p.p.`,
          },
          {
            label: 'Acerto atual vs anterior',
            value: `${(selectedMetrics.accuracy ?? 0).toFixed(1)}% vs ${(previousMetrics.accuracy ?? 0).toFixed(1)}%`,
            threshold: `mín. ${thresholds.MIN_QUESTIONS} questões/semana`,
          },
        ],
      });
    }

    // 2. HIGH: Assuntos pontos fracos (limitado a MAX_TOPIC_RECOMMENDATIONS = 5)
    for (const item of weakTopics.slice(0, thresholds.MAX_TOPIC_RECOMMENDATIONS)) {
      rawInsights.push({
        id: `weak-topic:${item.topicId}`,
        severity: 'HIGH',
        kind: 'WEAK_TOPIC',
        title: `Ponto fraco: ${item.topicName} (${item.subjectName})`,
        description:
          'Assunto com nota consolidada abaixo do limiar mínimo nos últimos 30 dias. Priorize revisão teórica seguida de questões.',
        recommendedActionLabel: item.classification.recommendedActionLabel,
        finalScore: item.classification.finalScore,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        topicId: item.topicId,
        topicName: item.topicName,
        evidence: [
          {
            label: 'Nota consolidada (30d)',
            value: `${item.classification.displayScore}`,
            threshold: `< ${thresholds.WEAK_THRESHOLD}`,
          },
          {
            label: 'Questões na janela',
            value: `${item.classification.correctInWindow}/${item.classification.questionsInWindow}`,
            threshold: `mín. ${thresholds.MIN_QUESTIONS} questões`,
          },
        ],
      });
    }

    // 3. MEDIUM: Baixa consistência semanal
    const minPartialElapsedDays = Math.ceil(DAYS_IN_WEEK / 2); // 4 dias
    if (!isPartialWeek) {
      if (selectedMetrics.activeDaysCount < thresholds.CONSISTENCY_ALERT_MIN_DAYS) {
        rawInsights.push({
          id: 'alert:low-consistency',
          severity: 'MEDIUM',
          kind: 'LOW_CONSISTENCY',
          title: 'Baixa consistência semanal de estudo',
          description:
            'Você estudou em poucos dias distintos nesta semana. Distribuir as sessões melhora a retenção.',
          recommendedActionLabel: 'Distribuir sessões na agenda',
          finalScore: null,
          evidence: [
            {
              label: 'Dias ativos na semana',
              value: `${selectedMetrics.activeDaysCount} de ${DAYS_IN_WEEK} dias`,
              threshold: `mín. ${thresholds.CONSISTENCY_ALERT_MIN_DAYS} dias`,
            },
          ],
        });
      }
    } else if (
      elapsedDaysCount >= minPartialElapsedDays &&
      (selectedMetrics.totalSessionSeconds > 0 ||
        selectedMetrics.agendaPlannedElapsedMinutes > 0)
    ) {
      const expectedMinDays = Math.ceil(
        (thresholds.CONSISTENCY_ALERT_MIN_DAYS * elapsedDaysCount) / DAYS_IN_WEEK
      );
      if (selectedMetrics.activeDaysCount < expectedMinDays) {
        rawInsights.push({
          id: 'alert:low-consistency',
          severity: 'MEDIUM',
          kind: 'LOW_CONSISTENCY',
          title: 'Baixa consistência proporcional na semana em andamento',
          description:
            'O número de dias ativos até agora está abaixo do ritmo proporcional esperado para a semana.',
          recommendedActionLabel: 'Retomar ritmo diário',
          finalScore: null,
          evidence: [
            {
              label: 'Dias ativos até agora',
              value: `${selectedMetrics.activeDaysCount} em ${elapsedDaysCount} dias`,
              threshold: `mín. ${expectedMinDays} dias`,
            },
          ],
        });
      }
    }

    // 4. MEDIUM: Baixa aderência nas sessões (exige >= 1800s)
    if (
      hasMinimumSample &&
      selectedMetrics.adherence !== null &&
      selectedMetrics.adherence + thresholds.CLASSIFICATION_EPSILON <
        thresholds.ADHERENCE_ALERT_THRESHOLD
    ) {
      rawInsights.push({
        id: 'alert:low-adherence',
        severity: 'MEDIUM',
        kind: 'LOW_ADHERENCE',
        title: 'Baixa aderência ao tempo planejado nas sessões',
        description:
          'O tempo efetivo executado ficou abaixo do tempo planejado nas etapas das sessões concluídas.',
        recommendedActionLabel: 'Ajustar duração dos blocos',
        finalScore: null,
        evidence: [
          {
            label: 'Aderência média',
            value: `${selectedMetrics.adherence.toFixed(1)}%`,
            threshold: `>= ${thresholds.ADHERENCE_ALERT_THRESHOLD}%`,
          },
        ],
      });
    }

    // 5. MEDIUM: Baixo foco / alto índice de distração (exige >= 1800s)
    if (
      hasMinimumSample &&
      selectedMetrics.effectiveness !== null &&
      selectedMetrics.effectiveness + thresholds.CLASSIFICATION_EPSILON <
        thresholds.EFFECTIVENESS_ALERT_THRESHOLD
    ) {
      rawInsights.push({
        id: 'alert:low-effectiveness',
        severity: 'MEDIUM',
        kind: 'LOW_EFFECTIVENESS',
        title: 'Baixo índice de foco nas sessões da semana',
        description:
          'Pausas e distrações consumiram uma parcela elevada do tempo bruto das suas sessões de estudo.',
        recommendedActionLabel: 'Reduzir interrupções no timer',
        finalScore: null,
        evidence: [
          {
            label: 'Efetividade (foco)',
            value: `${selectedMetrics.effectiveness.toFixed(1)}%`,
            threshold: `>= ${thresholds.EFFECTIVENESS_ALERT_THRESHOLD}%`,
          },
        ],
      });
    }

    // 6. MEDIUM: Matérias negligenciadas
    for (const neg of neglectedSubjects) {
      rawInsights.push({
        id: `neglected-subject:${neg.subjectId}`,
        severity: 'MEDIUM',
        kind: 'NEGLECTED_SUBJECT',
        title: `Matéria negligenciada: ${neg.subjectName}`,
        description:
          'Matéria ativa sem nenhum segundo de estudo efetivo registrado nos últimos 7 dias.',
        recommendedActionLabel: 'Agendar sessão na semana',
        finalScore: null,
        subjectId: neg.subjectId,
        subjectName: neg.subjectName,
        evidence: [
          {
            label: 'Dias sem estudo',
            value:
              neg.daysSinceLastStudy !== null
                ? `${neg.daysSinceLastStudy} dias`
                : `> ${thresholds.CLASSIFICATION_WINDOW_DAYS} dias`,
            threshold: `< ${thresholds.NEGLECT_DAYS} dias`,
          },
        ],
      });
    }

    // 7. LOW: Excesso de planejamento não executado
    if (selectedMetrics.planningGapMinutes >= thresholds.PLANNING_GAP_ALERT_MINUTES) {
      rawInsights.push({
        id: 'alert:planning-gap',
        severity: 'LOW',
        kind: 'PLANNING_GAP',
        title: 'Lacuna entre agenda planejada e tempo efetivo executado',
        description:
          'Há minutos planejados na agenda até o momento que não foram convertidos em tempo efetivo de estudo.',
        recommendedActionLabel: 'Replanejar sessões pendentes',
        finalScore: null,
        evidence: [
          {
            label: 'Planejado não executado',
            value: `${Math.round(selectedMetrics.planningGapMinutes)} min`,
            threshold: `< ${thresholds.PLANNING_GAP_ALERT_MINUTES} min`,
          },
        ],
      });
    }

    // 8. LOW: Assuntos regulares (limitado a MAX_TOPIC_RECOMMENDATIONS = 5)
    for (const item of regularTopics.slice(0, thresholds.MAX_TOPIC_RECOMMENDATIONS)) {
      rawInsights.push({
        id: `regular-topic:${item.topicId}`,
        severity: 'LOW',
        kind: 'REGULAR_TOPIC',
        title: `Assunto regular: ${item.topicName} (${item.subjectName})`,
        description:
          'Assunto em faixa intermediária de desempenho. Intensifique a resolução de questões práticas.',
        recommendedActionLabel: item.classification.recommendedActionLabel,
        finalScore: item.classification.finalScore,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        topicId: item.topicId,
        topicName: item.topicName,
        evidence: [
          {
            label: 'Nota consolidada (30d)',
            value: `${item.classification.displayScore}`,
            threshold: `${thresholds.WEAK_THRESHOLD} a < ${thresholds.STRONG_THRESHOLD}`,
          },
          {
            label: 'Questões na janela',
            value: `${item.classification.correctInWindow}/${item.classification.questionsInWindow}`,
            threshold: `mín. ${thresholds.MIN_QUESTIONS} questões`,
          },
        ],
      });
    }

    // 9. INFO: Assuntos pontos fortes (limitado a MAX_TOPIC_RECOMMENDATIONS = 5)
    for (const item of strongTopics.slice(0, thresholds.MAX_TOPIC_RECOMMENDATIONS)) {
      rawInsights.push({
        id: `strong-topic:${item.topicId}`,
        severity: 'INFO',
        kind: 'STRONG_TOPIC',
        title: `Ponto forte: ${item.topicName} (${item.subjectName})`,
        description:
          'Assunto com excelente desempenho consolidado nos últimos 30 dias. Mantenha revisões periódicas de manutenção.',
        recommendedActionLabel: item.classification.recommendedActionLabel,
        finalScore: item.classification.finalScore,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        topicId: item.topicId,
        topicName: item.topicName,
        evidence: [
          {
            label: 'Nota consolidada (30d)',
            value: `${item.classification.displayScore}`,
            threshold: `>= ${thresholds.STRONG_THRESHOLD}`,
          },
          {
            label: 'Questões na janela',
            value: `${item.classification.correctInWindow}/${item.classification.questionsInWindow}`,
            threshold: `mín. ${thresholds.MIN_QUESTIONS} questões`,
          },
        ],
      });
    }
  }

  const insightsAndRecommendations = sortInsightsDeterministically(
    rawInsights,
    thresholds.CLASSIFICATION_EPSILON
  );

  return {
    weekStartLocalDate,
    weekEndLocalDate,
    previousWeekStartLocalDate,
    previousWeekEndLocalDate,
    classificationWindow: {
      windowStartLocalDate: classWin.windowStartLocalDate,
      windowEndLocalDate: classWin.windowEndLocalDate,
    },
    isPartialWeek,
    elapsedDaysCount,
    hasAnyData,
    weekComparison,
    pauseAndDistractionAnalysis,
    topicClassification: {
      weak: weakTopics,
      regular: regularTopics,
      strong: strongTopics,
      insufficient: insufficientTopics,
    },
    subjectClassification,
    neglectedSubjects,
    insightsAndRecommendations,
  };
}
