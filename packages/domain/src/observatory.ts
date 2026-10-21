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
