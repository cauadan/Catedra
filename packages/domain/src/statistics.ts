/**
 * Agregações analíticas, séries temporais diárias e transparência de fórmulas (Fase 7).
 * Funções puras — sem banco de dados, sem I/O.
 */

import { z } from 'zod';
import { isValidLocalDate, utcToLocalDate } from './calendar.js';
import { getTopicSubtreeIds, MIN_QUESTIONS, type GoalProgressSessionInput } from './goals.js';
import { type TopicTreeNode } from './index.js';
import { type PlannedSessionStatusDTO } from './planning.js';
import { calculateAccuracy } from './practice.js';
import { calculateSessionMetrics } from './timer.js';

export const STATISTICS_RANGES = ['day', 'week', 'month', '30d'] as const;
export type StatisticsRangeDTO = (typeof STATISTICS_RANGES)[number];

export const statisticsQuerySchema = z
  .object({
    range: z
      .enum(STATISTICS_RANGES, {
        errorMap: () => ({ message: 'O período de consulta deve ser day, week, month ou 30d.' }),
      })
      .optional()
      .default('week'),
    date: z
      .string()
      .refine(isValidLocalDate, {
        message: 'A data informada é inválida. Use o formato YYYY-MM-DD com uma data real.',
      })
      .optional(),
    subject_id: z.string().min(1, { message: 'ID de matéria inválido.' }).optional(),
    topic_id: z.string().min(1, { message: 'ID de assunto inválido.' }).optional(),
  })
  .strict();

export type StatisticsQueryInput = z.infer<typeof statisticsQuerySchema>;

export const dashboardQuerySchema = z
  .object({
    date: z
      .string()
      .refine(isValidLocalDate, {
        message: 'A data informada é inválida. Use o formato YYYY-MM-DD com uma data real.',
      })
      .optional(),
  })
  .strict();

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

export interface StatisticsPlannedSessionInput {
  id: string;
  subject_id: string;
  topic_id: string;
  scheduled_start: Date;
  planned_minutes: number;
  status: PlannedSessionStatusDTO;
}

export interface StatisticsSubjectInput {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}

export interface StatisticsTopicInput extends TopicTreeNode {
  name: string;
  archived: boolean;
}

export interface PeriodOverviewStats {
  agendaPlannedMinutes: number;
  executedPlannedSeconds: number;
  effectiveSeconds: number;
  effectiveMinutes: number;
  totalSessionSeconds: number;
  effectiveness: number | null;
  adherence: number | null;
  completedSessionsCount: number;
  activeDaysCount: number;
  totalDaysInPeriod: number;
  totalQuestions: number;
  totalCorrect: number;
  totalErrors: number;
  accuracy: number | null;
}

export interface SubjectStatsRow {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  archived: boolean;
  agendaPlannedMinutes: number;
  effectiveSeconds: number;
  effectiveMinutes: number;
  completedSessionsCount: number;
  totalQuestions: number;
  totalCorrect: number;
  totalErrors: number;
  accuracy: number | null;
  hasSufficientQuestions: boolean;
}

export interface TopicStatsRow {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  parentId: string | null;
  archived: boolean;
  effectiveSeconds: number;
  effectiveMinutes: number;
  completedSessionsCount: number;
  totalQuestions: number;
  totalCorrect: number;
  totalErrors: number;
  accuracy: number | null;
  hasSufficientQuestions: boolean;
}

export interface DailySeriesPoint {
  date: string;
  agendaPlannedMinutes: number;
  effectiveSeconds: number;
  effectiveMinutes: number;
  totalSessionSeconds: number;
  questions: number;
  correct: number;
  accuracy: number | null;
  effectiveness: number | null;
}

export interface FormulaMetadata {
  effectiveness: {
    formula: string;
    numeratorLabel: string;
    denominatorLabel: string;
    numeratorValue: number;
    denominatorValue: number;
  };
  adherence: {
    formula: string;
    numeratorLabel: string;
    denominatorLabel: string;
    numeratorValue: number;
    denominatorValue: number;
  };
  accuracy: {
    formula: string;
    numeratorLabel: string;
    denominatorLabel: string;
    numeratorValue: number;
    denominatorValue: number;
    minQuestionsRequired: number;
  };
  consistency: {
    formula: string;
    activeDaysCount: number;
    totalDaysInPeriod: number;
  };
}

export interface PeriodStatisticsResult {
  overview: PeriodOverviewStats;
  bySubject: SubjectStatsRow[];
  byTopic: TopicStatsRow[];
  dailySeries: DailySeriesPoint[];
  formulaMetadata: FormulaMetadata;
}

function isTopicAllowed(
  topicId: string,
  filterSubjectId: string | undefined,
  topicSubtreeIds: Set<string> | null,
  topicById: Map<string, StatisticsTopicInput>
): boolean {
  if (topicSubtreeIds && !topicSubtreeIds.has(topicId)) {
    return false;
  }
  if (filterSubjectId) {
    const t = topicById.get(topicId);
    if (!t || t.subject_id !== filterSubjectId) {
      return false;
    }
  }
  return true;
}

/**
 * Calcula todas as agregações estatísticas de um período `[startUtc, endUtc)` e lista `days` (`YYYY-MM-DD`).
 * Devolve valores exatos em ponto flutuante (sem `Math.floor` em `effectiveMinutes` e sem `Math.round` em percentuais).
 */
export function calculatePeriodStatistics(params: {
  windowUtc: { startUtc: Date; endUtc: Date };
  days: ReadonlyArray<string>;
  timezone: string;
  plannedSessions: ReadonlyArray<StatisticsPlannedSessionInput>;
  studySessions: ReadonlyArray<GoalProgressSessionInput>;
  subjects: ReadonlyArray<StatisticsSubjectInput>;
  topics: ReadonlyArray<StatisticsTopicInput>;
  filterSubjectId?: string;
  filterTopicId?: string;
  referenceNow: Date;
}): PeriodStatisticsResult {
  const {
    windowUtc,
    days,
    timezone,
    plannedSessions,
    studySessions,
    subjects,
    topics,
    filterSubjectId,
    filterTopicId,
    referenceNow,
  } = params;
  const { startUtc, endUtc } = windowUtc;

  const subjectById = new Map<string, StatisticsSubjectInput>();
  for (const s of subjects) {
    subjectById.set(s.id, s);
  }

  const topicById = new Map<string, StatisticsTopicInput>();
  for (const t of topics) {
    topicById.set(t.id, t);
  }

  const topicSubtreeIds = filterTopicId ? getTopicSubtreeIds(filterTopicId, topics) : null;

  // Mapas para dailySeries
  const dailyMap = new Map<
    string,
    {
      agendaPlannedMinutes: number;
      effectiveSeconds: number;
      totalSessionSeconds: number;
      questions: number;
      correct: number;
    }
  >();

  for (const d of days) {
    dailyMap.set(d, {
      agendaPlannedMinutes: 0,
      effectiveSeconds: 0,
      totalSessionSeconds: 0,
      questions: 0,
      correct: 0,
    });
  }

  // Mapas para agrupamento por matéria e por tópico (direto, sem dupla contagem hierárquica)
  const subjectAgg = new Map<
    string,
    {
      agendaPlannedMinutes: number;
      effectiveSeconds: number;
      completedSessionsCount: number;
      totalQuestions: number;
      totalCorrect: number;
    }
  >();

  const topicAgg = new Map<
    string,
    {
      effectiveSeconds: number;
      completedSessionsCount: number;
      totalQuestions: number;
      totalCorrect: number;
    }
  >();

  const ensureSubjectAgg = (subjectId: string) => {
    let agg = subjectAgg.get(subjectId);
    if (!agg) {
      agg = {
        agendaPlannedMinutes: 0,
        effectiveSeconds: 0,
        completedSessionsCount: 0,
        totalQuestions: 0,
        totalCorrect: 0,
      };
      subjectAgg.set(subjectId, agg);
    }
    return agg;
  };

  const ensureTopicAgg = (topicId: string) => {
    let agg = topicAgg.get(topicId);
    if (!agg) {
      agg = {
        effectiveSeconds: 0,
        completedSessionsCount: 0,
        totalQuestions: 0,
        totalCorrect: 0,
      };
      topicAgg.set(topicId, agg);
    }
    return agg;
  };

  // 1. Processa PlannedSessions (status PLANNED ou DONE dentro da janela)
  let agendaPlannedMinutes = 0;

  for (const ps of plannedSessions) {
    if (ps.status !== 'PLANNED' && ps.status !== 'DONE') continue;
    if (ps.scheduled_start < startUtc || ps.scheduled_start >= endUtc) continue;
    if (!isTopicAllowed(ps.topic_id, filterSubjectId, topicSubtreeIds, topicById)) continue;

    agendaPlannedMinutes += ps.planned_minutes;

    const localDay = utcToLocalDate(ps.scheduled_start, timezone);
    const dayEntry = dailyMap.get(localDay);
    if (dayEntry) {
      dayEntry.agendaPlannedMinutes += ps.planned_minutes;
    }

    const subjAgg = ensureSubjectAgg(ps.subject_id);
    subjAgg.agendaPlannedMinutes += ps.planned_minutes;
  }

  // 2. Processa StudySessions FINISHED dentro da janela
  let executedPlannedSeconds = 0;
  let effectiveSeconds = 0;
  let totalSessionSeconds = 0;
  let completedSessionsCount = 0;
  let totalQuestions = 0;
  let totalCorrect = 0;

  for (const ss of studySessions) {
    if (ss.status !== 'FINISHED') continue;
    if (ss.started_at < startUtc || ss.started_at >= endUtc) continue;

    const localDay = utcToLocalDate(ss.started_at, timezone);
    const dayEntry = dailyMap.get(localDay);

    // Tempo e blocos: filtrados pelo StudySession.topic_id
    if (isTopicAllowed(ss.topic_id, filterSubjectId, topicSubtreeIds, topicById)) {
      const metrics = calculateSessionMetrics(ss, ss.blocks, ss.events, referenceNow);
      if (metrics) {
        executedPlannedSeconds += metrics.plannedSeconds;
        effectiveSeconds += metrics.effectiveSeconds;
        totalSessionSeconds += metrics.totalSeconds;
        completedSessionsCount += 1;

        if (dayEntry) {
          dayEntry.effectiveSeconds += metrics.effectiveSeconds;
          dayEntry.totalSessionSeconds += metrics.totalSeconds;
        }

        const tInfo = topicById.get(ss.topic_id);
        if (tInfo) {
          const sAgg = ensureSubjectAgg(tInfo.subject_id);
          sAgg.effectiveSeconds += metrics.effectiveSeconds;
          sAgg.completedSessionsCount += 1;
        }

        const tAgg = ensureTopicAgg(ss.topic_id);
        tAgg.effectiveSeconds += metrics.effectiveSeconds;
        tAgg.completedSessionsCount += 1;
      }
    }

    // Questões e acertos: filtrados pelo PracticeRecord.topic_id, herdando started_at da sessão
    for (const pr of ss.practice_records) {
      if (!isTopicAllowed(pr.topic_id, filterSubjectId, topicSubtreeIds, topicById)) continue;

      totalQuestions += pr.questions;
      totalCorrect += pr.correct;

      if (dayEntry) {
        dayEntry.questions += pr.questions;
        dayEntry.correct += pr.correct;
      }

      const prTopicInfo = topicById.get(pr.topic_id);
      if (prTopicInfo) {
        const sAgg = ensureSubjectAgg(prTopicInfo.subject_id);
        sAgg.totalQuestions += pr.questions;
        sAgg.totalCorrect += pr.correct;
      }

      const tAgg = ensureTopicAgg(pr.topic_id);
      tAgg.totalQuestions += pr.questions;
      tAgg.totalCorrect += pr.correct;
    }
  }

  // 3. Monta dailySeries e activeDaysCount (dias com effectiveSeconds > 0)
  let activeDaysCount = 0;
  const dailySeries: DailySeriesPoint[] = [];

  for (const d of days) {
    const entry = dailyMap.get(d)!;
    if (entry.effectiveSeconds > 0) {
      activeDaysCount += 1;
    }

    dailySeries.push({
      date: d,
      agendaPlannedMinutes: entry.agendaPlannedMinutes,
      effectiveSeconds: entry.effectiveSeconds,
      effectiveMinutes: entry.effectiveSeconds / 60,
      totalSessionSeconds: entry.totalSessionSeconds,
      questions: entry.questions,
      correct: entry.correct,
      accuracy: calculateAccuracy(entry.correct, entry.questions),
      effectiveness:
        entry.totalSessionSeconds > 0
          ? (entry.effectiveSeconds / entry.totalSessionSeconds) * 100
          : null,
    });
  }

  const effectiveMinutes = effectiveSeconds / 60;
  const effectiveness =
    totalSessionSeconds > 0 ? (effectiveSeconds / totalSessionSeconds) * 100 : null;
  const adherence =
    executedPlannedSeconds > 0 ? (effectiveSeconds / executedPlannedSeconds) * 100 : null;
  const totalErrors = totalQuestions - totalCorrect;
  const accuracy = calculateAccuracy(totalCorrect, totalQuestions);
  const totalDaysInPeriod = days.length;

  // 4. Monta bySubject (apenas matérias com atividade/planejamento ou filtradas)
  const bySubject: SubjectStatsRow[] = [];
  for (const [subjectId, agg] of subjectAgg.entries()) {
    if (
      agg.effectiveSeconds === 0 &&
      agg.totalQuestions === 0 &&
      agg.agendaPlannedMinutes === 0 &&
      agg.completedSessionsCount === 0
    ) {
      continue;
    }
    const subj = subjectById.get(subjectId);
    if (!subj) continue;

    bySubject.push({
      subjectId: subj.id,
      subjectName: subj.name,
      subjectColor: subj.color,
      archived: subj.archived,
      agendaPlannedMinutes: agg.agendaPlannedMinutes,
      effectiveSeconds: agg.effectiveSeconds,
      effectiveMinutes: agg.effectiveSeconds / 60,
      completedSessionsCount: agg.completedSessionsCount,
      totalQuestions: agg.totalQuestions,
      totalCorrect: agg.totalCorrect,
      totalErrors: agg.totalQuestions - agg.totalCorrect,
      accuracy: calculateAccuracy(agg.totalCorrect, agg.totalQuestions),
      hasSufficientQuestions: agg.totalQuestions >= MIN_QUESTIONS,
    });
  }

  bySubject.sort((a, b) => {
    if (b.effectiveSeconds !== a.effectiveSeconds) return b.effectiveSeconds - a.effectiveSeconds;
    return b.totalQuestions - a.totalQuestions;
  });

  // 5. Monta byTopic (agrupamento direto sem dupla contagem nos pais)
  const byTopic: TopicStatsRow[] = [];
  for (const [topicId, agg] of topicAgg.entries()) {
    if (agg.effectiveSeconds === 0 && agg.totalQuestions === 0 && agg.completedSessionsCount === 0) {
      continue;
    }
    const top = topicById.get(topicId);
    if (!top) continue;
    const subj = subjectById.get(top.subject_id);

    byTopic.push({
      topicId: top.id,
      topicName: top.name,
      subjectId: top.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      subjectColor: subj?.color ?? '#64748B',
      parentId: top.parent_id,
      archived: top.archived,
      effectiveSeconds: agg.effectiveSeconds,
      effectiveMinutes: agg.effectiveSeconds / 60,
      completedSessionsCount: agg.completedSessionsCount,
      totalQuestions: agg.totalQuestions,
      totalCorrect: agg.totalCorrect,
      totalErrors: agg.totalQuestions - agg.totalCorrect,
      accuracy: calculateAccuracy(agg.totalCorrect, agg.totalQuestions),
      hasSufficientQuestions: agg.totalQuestions >= MIN_QUESTIONS,
    });
  }

  byTopic.sort((a, b) => {
    if (b.effectiveSeconds !== a.effectiveSeconds) return b.effectiveSeconds - a.effectiveSeconds;
    return b.totalQuestions - a.totalQuestions;
  });

  const formulaMetadata: FormulaMetadata = {
    effectiveness: {
      formula: '(Tempo Efetivo / Tempo Bruto Total das Sessões Concluídas) × 100',
      numeratorLabel: 'Segundos efetivos estudados',
      denominatorLabel: 'Segundos brutos totais das sessões concluídas',
      numeratorValue: effectiveSeconds,
      denominatorValue: totalSessionSeconds,
    },
    adherence: {
      formula: '(Tempo Efetivo das Sessões Concluídas / Tempo Planejado dos Blocos dessas Sessões) × 100',
      numeratorLabel: 'Segundos efetivos estudados',
      denominatorLabel: 'Segundos planejados nos blocos das sessões concluídas',
      numeratorValue: effectiveSeconds,
      denominatorValue: executedPlannedSeconds,
    },
    accuracy: {
      formula: '(Questões Corretas / Total de Questões Resolvidas) × 100',
      numeratorLabel: 'Questões corretas',
      denominatorLabel: 'Total de questões resolvidas',
      numeratorValue: totalCorrect,
      denominatorValue: totalQuestions,
      minQuestionsRequired: MIN_QUESTIONS,
    },
    consistency: {
      formula: 'Dias com estudo efetivo (> 0s) / Total de dias no período',
      activeDaysCount,
      totalDaysInPeriod,
    },
  };

  return {
    overview: {
      agendaPlannedMinutes,
      executedPlannedSeconds,
      effectiveSeconds,
      effectiveMinutes,
      totalSessionSeconds,
      effectiveness,
      adherence,
      completedSessionsCount,
      activeDaysCount,
      totalDaysInPeriod,
      totalQuestions,
      totalCorrect,
      totalErrors,
      accuracy,
    },
    bySubject,
    byTopic,
    dailySeries,
    formulaMetadata,
  };
}
