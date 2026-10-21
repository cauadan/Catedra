/**
 * Regras puras, schemas Zod e cálculo em tempo de execução para Metas de Estudo (Fase 6).
 * Não persiste progresso no banco de dados — sempre calculado a partir das sessões e práticas.
 */

import { z } from 'zod';
import { isValidLocalDate, type GoalPeriod } from './calendar.js';
import { collectDescendantIds, type TopicTreeNode } from './index.js';
import { calculateAccuracy, type UnderstandingLevelDTO } from './practice.js';
import { MIN_QUESTIONS } from './thresholds.js';
import {
  calculateSessionMetrics,
  type SessionBlockDTO,
  type SessionEventDTO,
  type StudySessionStatusDTO,
} from './timer.js';

export { MIN_QUESTIONS };

export const GOAL_KINDS = ['EFFORT', 'RESULT'] as const;
export type GoalKindDTO = (typeof GOAL_KINDS)[number];

export const GOAL_METRICS = [
  'EFFECTIVE_MINUTES',
  'QUESTIONS',
  'TOPICS_COMPLETED',
  'REVIEWS',
  'ACCURACY',
] as const;
export type GoalMetricDTO = (typeof GOAL_METRICS)[number];

export const EFFORT_METRICS: ReadonlyArray<GoalMetricDTO> = [
  'EFFECTIVE_MINUTES',
  'QUESTIONS',
  'TOPICS_COMPLETED',
  'REVIEWS',
];

export const GOAL_PERIODS = ['DAY', 'WEEK', 'MONTH'] as const;
export type GoalPeriodDTO = GoalPeriod;

export const GOAL_STATUSES = [
  'ACHIEVED',
  'IN_PROGRESS',
  'MISSED',
  'UPCOMING',
  'INSUFFICIENT_DATA',
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Rótulos em português para exibição na interface. */
export const GOAL_METRIC_LABELS: Record<GoalMetricDTO, string> = {
  EFFECTIVE_MINUTES: 'Minutos efetivos',
  QUESTIONS: 'Questões resolvidas',
  TOPICS_COMPLETED: 'Assuntos estudados',
  REVIEWS: 'Revisões concluídas',
  ACCURACY: 'Taxa de acerto (%)',
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriodDTO, string> = {
  DAY: 'Diária',
  WEEK: 'Semanal',
  MONTH: 'Mensal',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  ACHIEVED: 'Meta atingida',
  IN_PROGRESS: 'Em andamento',
  MISSED: 'Não atingida no período',
  UPCOMING: 'Período futuro',
  INSUFFICIENT_DATA: 'Dados insuficientes',
};

/**
 * Valida se o `target_value` informado é compatível com a métrica da meta:
 * - Métricas de esforço (`EFFECTIVE_MINUTES`, `QUESTIONS`, `TOPICS_COMPLETED`, `REVIEWS`): inteiro `>= 1`;
 * - `ACCURACY`: número entre `1` e `100` (inclusive).
 */
export function validateGoalTargetValue(
  metric: GoalMetricDTO,
  targetValue: number
): { ok: true } | { ok: false; message: string } {
  if (typeof targetValue !== 'number' || Number.isNaN(targetValue) || !Number.isFinite(targetValue)) {
    return { ok: false, message: 'O valor da meta deve ser um número válido.' };
  }

  if (metric === 'ACCURACY') {
    if (targetValue < 1 || targetValue > 100) {
      return {
        ok: false,
        message: 'Para metas de taxa de acerto (ACCURACY), o valor alvo deve estar entre 1 e 100.',
      };
    }
    return { ok: true };
  }

  if (!Number.isInteger(targetValue) || targetValue < 1) {
    return {
      ok: false,
      message: 'Para metas de esforço, o valor alvo deve ser um número inteiro maior ou igual a 1.',
    };
  }

  return { ok: true };
}

export const goalCreateSchema = z
  .object({
    kind: z.enum(GOAL_KINDS, {
      errorMap: () => ({ message: 'O tipo da meta deve ser EFFORT ou RESULT.' }),
    }),
    metric: z.enum(GOAL_METRICS, {
      errorMap: () => ({ message: 'Métrica de meta inválida.' }),
    }),
    period: z.enum(GOAL_PERIODS, {
      errorMap: () => ({ message: 'O período da meta deve ser DAY, WEEK ou MONTH.' }),
    }),
    period_start_local_date: z
      .string({ required_error: 'A data de início do período é obrigatória.' })
      .refine(isValidLocalDate, {
        message: 'A data do período é inválida. Use o formato YYYY-MM-DD com uma data real.',
      }),
    target_value: z.number({
      required_error: 'O valor alvo da meta é obrigatório.',
      invalid_type_error: 'O valor alvo da meta deve ser numérico.',
    }),
    subject_id: z.string().min(1, { message: 'ID de matéria inválido.' }).nullable().optional(),
    topic_id: z.string().min(1, { message: 'ID de assunto inválido.' }).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === 'EFFORT' && data.metric === 'ACCURACY') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metric'],
        message: 'Metas de esforço (EFFORT) não podem utilizar a métrica de taxa de acerto (ACCURACY).',
      });
      return;
    }

    if (data.kind === 'RESULT' && data.metric !== 'ACCURACY') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metric'],
        message: 'Metas de resultado (RESULT) devem utilizar exclusivamente a métrica ACCURACY.',
      });
      return;
    }

    const targetCheck = validateGoalTargetValue(data.metric, data.target_value);
    if (!targetCheck.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_value'],
        message: targetCheck.message,
      });
    }
  });

export type GoalCreateInput = z.infer<typeof goalCreateSchema>;

export const goalUpdateSchema = z
  .object({
    target_value: z.number({
      required_error: 'O valor alvo da meta é obrigatório.',
      invalid_type_error: 'O valor alvo da meta deve ser numérico.',
    }),
  })
  .strict();

export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;

export const goalCopySchema = z
  .object({
    period: z.enum(GOAL_PERIODS, {
      errorMap: () => ({ message: 'O período para cópia deve ser DAY, WEEK ou MONTH.' }),
    }),
    target_date: z
      .string({ required_error: 'A data de destino é obrigatória.' })
      .refine(isValidLocalDate, {
        message: 'A data de destino é inválida. Use o formato YYYY-MM-DD com uma data real.',
      }),
  })
  .strict();

export type GoalCopyInput = z.infer<typeof goalCopySchema>;

export const goalListQuerySchema = z
  .object({
    period: z
      .enum(GOAL_PERIODS, {
        errorMap: () => ({ message: 'O período filtrado deve ser DAY, WEEK ou MONTH.' }),
      })
      .optional(),
    date: z
      .string()
      .refine(isValidLocalDate, {
        message: 'A data informada é inválida. Use o formato YYYY-MM-DD com uma data real.',
      })
      .optional(),
  })
  .strict();

export type GoalListQueryInput = z.infer<typeof goalListQuerySchema>;

/**
 * Retorna o conjunto de IDs contendo o próprio `rootTopicId` e todos os seus descendentes
 * na árvore de assuntos (inclusive descendentes arquivados).
 */
export function getTopicSubtreeIds(
  rootTopicId: string,
  allTopics: ReadonlyArray<Pick<TopicTreeNode, 'id' | 'parent_id'>>
): Set<string> {
  const descendants = collectDescendantIds(rootTopicId, allTopics);
  return new Set<string>([rootTopicId, ...descendants]);
}

export interface GoalPracticeRecordInput {
  topic_id: string;
  questions: number;
  correct: number;
}

export interface GoalProgressSessionInput {
  id: string;
  topic_id: string;
  status: StudySessionStatusDTO;
  started_at: Date;
  ended_at: Date | null;
  planned_start: Date | null;
  blocks: ReadonlyArray<SessionBlockDTO>;
  events: ReadonlyArray<SessionEventDTO>;
  practice_records: ReadonlyArray<GoalPracticeRecordInput>;
  evaluation?: {
    understanding: UnderstandingLevelDTO;
  } | null;
}

export interface GoalDefinitionInput {
  kind: GoalKindDTO;
  metric: GoalMetricDTO;
  period: GoalPeriodDTO;
  period_start_local_date: string;
  target_value: number;
  subject_id?: string | null;
  topic_id?: string | null;
}

export interface GoalProgressResult {
  status: GoalStatus;
  isAchieved: boolean;
  currentValue: number | null;
  targetValue: number;
  progressPercent: number | null;
  questionsCount: number;
}

/**
 * Verifica se um `topicId` pertence ao escopo configurado na meta:
 * - Sem `subject_id` e sem `topic_id`: qualquer tópico pertence ao escopo;
 * - Com `topic_id`: pertence se estiver em `topicSubtreeIds`;
 * - Com `subject_id` (e sem `topic_id`): pertence se o tópico for daquela matéria.
 */
function isTopicInScope(
  topicId: string,
  goal: { subject_id?: string | null; topic_id?: string | null },
  topicById: Map<string, TopicTreeNode>,
  topicSubtreeIds: Set<string> | null
): boolean {
  if (topicSubtreeIds) {
    return topicSubtreeIds.has(topicId);
  }
  if (goal.subject_id) {
    const topic = topicById.get(topicId);
    return topic?.subject_id === goal.subject_id;
  }
  return true;
}

/**
 * Calcula de forma pura e determinística o progresso e o status de uma meta de estudo
 * em uma janela `[startUtc, endUtc)` em relação ao instante `referenceNow`.
 */
export function calculateGoalProgress(params: {
  goal: GoalDefinitionInput;
  windowUtc: { startUtc: Date; endUtc: Date };
  sessions: ReadonlyArray<GoalProgressSessionInput>;
  topics: ReadonlyArray<TopicTreeNode>;
  referenceNow: Date;
}): GoalProgressResult {
  const { goal, windowUtc, sessions, topics, referenceNow } = params;
  const { startUtc, endUtc } = windowUtc;

  const topicById = new Map<string, TopicTreeNode>();
  for (const t of topics) {
    topicById.set(t.id, t);
  }

  const topicSubtreeIds = goal.topic_id ? getTopicSubtreeIds(goal.topic_id, topics) : null;

  // Filtra apenas sessões FINISHED cujo started_at cai estritamente em [startUtc, endUtc)
  const finishedSessionsInWindow = sessions.filter(
    (s) => s.status === 'FINISHED' && s.started_at >= startUtc && s.started_at < endUtc
  );

  // Acumuladores de prática (filtrados por PracticeRecord.topic_id)
  let totalQuestions = 0;
  let totalCorrect = 0;

  for (const s of finishedSessionsInWindow) {
    for (const pr of s.practice_records) {
      if (isTopicInScope(pr.topic_id, goal, topicById, topicSubtreeIds)) {
        totalQuestions += pr.questions;
        totalCorrect += pr.correct;
      }
    }
  }

  // Regra estrita para ACCURACY: UPCOMING -> INSUFFICIENT_DATA -> ACHIEVED -> MISSED -> IN_PROGRESS
  if (goal.metric === 'ACCURACY') {
    const accuracy = calculateAccuracy(totalCorrect, totalQuestions);

    if (referenceNow < startUtc) {
      return {
        status: 'UPCOMING',
        isAchieved: false,
        currentValue: accuracy,
        targetValue: goal.target_value,
        progressPercent: null,
        questionsCount: totalQuestions,
      };
    }

    if (totalQuestions < MIN_QUESTIONS || accuracy === null) {
      return {
        status: 'INSUFFICIENT_DATA',
        isAchieved: false,
        currentValue: accuracy,
        targetValue: goal.target_value,
        progressPercent: null,
        questionsCount: totalQuestions,
      };
    }

    const progressPercent = Math.min(100, Math.max(0, (accuracy / goal.target_value) * 100));

    if (accuracy >= goal.target_value) {
      return {
        status: 'ACHIEVED',
        isAchieved: true,
        currentValue: accuracy,
        targetValue: goal.target_value,
        progressPercent,
        questionsCount: totalQuestions,
      };
    }

    if (referenceNow >= endUtc) {
      return {
        status: 'MISSED',
        isAchieved: false,
        currentValue: accuracy,
        targetValue: goal.target_value,
        progressPercent,
        questionsCount: totalQuestions,
      };
    }

    return {
      status: 'IN_PROGRESS',
      isAchieved: false,
      currentValue: accuracy,
      targetValue: goal.target_value,
      progressPercent,
      questionsCount: totalQuestions,
    };
  }

  // Métricas de ESFORÇO (EFFORT)
  let currentValue = 0;

  if (goal.metric === 'QUESTIONS') {
    currentValue = totalQuestions;
  } else {
    // EFFECTIVE_MINUTES, REVIEWS e TOPICS_COMPLETED filtram por StudySession.topic_id
    const scopedSessions = finishedSessionsInWindow.filter((s) =>
      isTopicInScope(s.topic_id, goal, topicById, topicSubtreeIds)
    );

    if (goal.metric === 'EFFECTIVE_MINUTES') {
      let totalEffectiveSeconds = 0;
      for (const s of scopedSessions) {
        const metrics = calculateSessionMetrics(s, s.blocks, s.events, referenceNow);
        if (metrics) {
          totalEffectiveSeconds += metrics.effectiveSeconds;
        }
      }
      currentValue = totalEffectiveSeconds / 60;
    } else if (goal.metric === 'TOPICS_COMPLETED') {
      const completedTopics = new Set<string>();
      for (const s of scopedSessions) {
        const metrics = calculateSessionMetrics(s, s.blocks, s.events, referenceNow);
        if (metrics && metrics.effectiveSeconds > 0) {
          completedTopics.add(s.topic_id);
        }
      }
      currentValue = completedTopics.size;
    } else if (goal.metric === 'REVIEWS') {
      let completedReviewBlocks = 0;
      for (const s of scopedSessions) {
        const metrics = calculateSessionMetrics(s, s.blocks, s.events, referenceNow);
        if (!metrics) continue;
        for (const b of metrics.blocks) {
          if (b.kind === 'REVIEW' && b.state === 'FINISHED' && b.effectiveSeconds > 0) {
            completedReviewBlocks += 1;
          }
        }
      }
      currentValue = completedReviewBlocks;
    }
  }

  const progressPercent =
    goal.target_value > 0
      ? Math.min(100, Math.max(0, (currentValue / goal.target_value) * 100))
      : 0;

  if (currentValue >= goal.target_value) {
    return {
      status: 'ACHIEVED',
      isAchieved: true,
      currentValue,
      targetValue: goal.target_value,
      progressPercent,
      questionsCount: totalQuestions,
    };
  }

  if (referenceNow < startUtc) {
    return {
      status: 'UPCOMING',
      isAchieved: false,
      currentValue,
      targetValue: goal.target_value,
      progressPercent,
      questionsCount: totalQuestions,
    };
  }

  if (referenceNow >= endUtc) {
    return {
      status: 'MISSED',
      isAchieved: false,
      currentValue,
      targetValue: goal.target_value,
      progressPercent,
      questionsCount: totalQuestions,
    };
  }

  return {
    status: 'IN_PROGRESS',
    isAchieved: false,
    currentValue,
    targetValue: goal.target_value,
    progressPercent,
    questionsCount: totalQuestions,
  };
}
