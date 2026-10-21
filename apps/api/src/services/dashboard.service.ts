import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  calculateGoalProgress,
  calculatePeriodStatistics,
  getDayWindowUtc,
  getGoalPeriodWindowUtc,
  getMonthWindowUtc,
  getRolling30DaysWindowUtc,
  getWeekWindowUtc,
  normalizeGoalPeriodStart,
  parseWeekStartsOn,
  utcToLocalDate,
  utcToLocalTime,
  type DashboardQueryInput,
  type GoalKindDTO,
  type GoalMetricDTO,
  type GoalPeriodDTO,
  type GoalProgressSessionInput,
  type StatisticsPlannedSessionInput,
  type StatisticsSubjectInput,
  type StatisticsTopicInput,
} from '@estudos/domain';
import { type GoalWithProgressView } from './goal.service.js';
import { toSessionView, type StudySessionView } from './study-session.service.js';

export interface DashboardPlannedSessionCard {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  topic_id: string;
  topic_name: string;
  scheduled_start: string;
  localDate: string;
  localTime: string;
  planned_minutes: number;
  priority: string;
  activity_type: string | null;
  status: string;
  isLate: boolean;
  isFutureDay: boolean;
}

export class DashboardService {
  /**
   * GET /api/dashboard?date=YYYY-MM-DD
   * Carrega todos os dados necessários em lote único sobre a janela unificada
   * `[min(monthStartUtc, weekStartUtc, rolling30StartUtc), max(monthEndUtc, weekEndUtc, rolling30EndUtc))`
   * e fatia em memória sem qualquer query adicional por dia, sessão ou meta (zero N+1).
   */
  public static async getDashboard(userId: string, query: DashboardQueryInput) {
    const referenceNow = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true, week_starts_on: true },
    });

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Usuário não encontrado.');
    }

    const timezone = user.timezone || 'America/Sao_Paulo';
    const weekStartsOn = parseWeekStartsOn(user.week_starts_on);
    const referenceDate = query.date ?? utcToLocalDate(referenceNow, timezone);

    const dayWindow = getDayWindowUtc(referenceDate, timezone);
    const weekWindow = getWeekWindowUtc(referenceDate, timezone, weekStartsOn);
    const monthWindow = getMonthWindowUtc(referenceDate, timezone);
    const rolling30Window = getRolling30DaysWindowUtc(referenceDate, timezone);

    const minStartMs = Math.min(
      dayWindow.startUtc.getTime(),
      weekWindow.startUtc.getTime(),
      monthWindow.startUtc.getTime(),
      rolling30Window.startUtc.getTime()
    );
    const maxEndMs = Math.max(
      dayWindow.endUtc.getTime(),
      weekWindow.endUtc.getTime(),
      monthWindow.endUtc.getTime(),
      rolling30Window.endUtc.getTime()
    );

    const broadStartUtc = new Date(minStartMs);
    const broadEndUtc = new Date(maxEndMs);

    const dayPeriodStart = normalizeGoalPeriodStart(referenceDate, 'DAY', weekStartsOn);
    const weekPeriodStart = normalizeGoalPeriodStart(referenceDate, 'WEEK', weekStartsOn);
    const monthPeriodStart = normalizeGoalPeriodStart(referenceDate, 'MONTH', weekStartsOn);

    // Lote único de consultas independentes do volume de dados (número fixo de queries SQL)
    const [
      rawSubjects,
      rawTopics,
      rawPlannedInWindow,
      nextFuturePlannedRaw,
      rawFinishedSessions,
      activeSessionRaw,
      pendingEvalSessionRaw,
      rawGoals,
    ] = await Promise.all([
      prisma.subject.findMany({
        where: { user_id: userId },
        select: { id: true, name: true, color: true, archived: true },
        orderBy: { name: 'asc' },
      }),
      prisma.topic.findMany({
        where: { user_id: userId },
        select: { id: true, name: true, subject_id: true, parent_id: true, archived: true },
        orderBy: { name: 'asc' },
      }),
      prisma.plannedSession.findMany({
        where: {
          user_id: userId,
          scheduled_start: {
            gte: broadStartUtc,
            lt: broadEndUtc,
          },
        },
        select: {
          id: true,
          subject_id: true,
          topic_id: true,
          scheduled_start: true,
          planned_minutes: true,
          priority: true,
          activity_type: true,
          status: true,
        },
        orderBy: { scheduled_start: 'asc' },
      }),
      // Busca em índice 1 única sessão PLANNED futura a partir do fim do dia atual (constante O(1))
      prisma.plannedSession.findFirst({
        where: {
          user_id: userId,
          status: 'PLANNED',
          scheduled_start: {
            gte: dayWindow.endUtc,
          },
        },
        select: {
          id: true,
          subject_id: true,
          topic_id: true,
          scheduled_start: true,
          planned_minutes: true,
          priority: true,
          activity_type: true,
          status: true,
        },
        orderBy: { scheduled_start: 'asc' },
      }),
      prisma.studySession.findMany({
        where: {
          user_id: userId,
          status: 'FINISHED',
          started_at: {
            gte: broadStartUtc,
            lt: broadEndUtc,
          },
        },
        select: {
          id: true,
          topic_id: true,
          status: true,
          started_at: true,
          ended_at: true,
          session_blocks: {
            select: {
              id: true,
              kind: true,
              planned_minutes: true,
              position: true,
            },
          },
          session_events: {
            select: {
              type: true,
              block_id: true,
              occurred_at: true,
              declared_seconds: true,
            },
          },
          practice_records: {
            select: {
              topic_id: true,
              questions: true,
              correct: true,
            },
          },
        },
      }),
      prisma.studySession.findFirst({
        where: { user_id: userId, status: 'IN_PROGRESS' },
        include: {
          topic: { include: { subject: true } },
          session_blocks: { orderBy: { position: 'asc' } },
          session_events: { orderBy: { occurred_at: 'asc' } },
          practice_records: true,
          evaluation: true,
        },
      }),
      prisma.studySession.findFirst({
        where: {
          user_id: userId,
          status: 'FINISHED',
          evaluation: null,
        },
        include: {
          topic: { include: { subject: true } },
          session_blocks: { orderBy: { position: 'asc' } },
          session_events: { orderBy: { occurred_at: 'asc' } },
          practice_records: true,
          evaluation: true,
        },
        orderBy: { ended_at: 'desc' },
      }),
      prisma.goal.findMany({
        where: {
          user_id: userId,
          OR: [
            { period: 'DAY', period_start_local_date: dayPeriodStart },
            { period: 'WEEK', period_start_local_date: weekPeriodStart },
            { period: 'MONTH', period_start_local_date: monthPeriodStart },
          ],
        },
        orderBy: [{ created_at: 'asc' }],
      }),
    ]);

    const subjectById = new Map<string, StatisticsSubjectInput>();
    for (const s of rawSubjects) {
      subjectById.set(s.id, s);
    }

    const topicById = new Map<string, StatisticsTopicInput>();
    for (const t of rawTopics) {
      topicById.set(t.id, t);
    }

    const plannedSessions: StatisticsPlannedSessionInput[] = rawPlannedInWindow.map((ps) => ({
      id: ps.id,
      subject_id: ps.subject_id,
      topic_id: ps.topic_id,
      scheduled_start: ps.scheduled_start,
      planned_minutes: ps.planned_minutes,
      status: ps.status as any,
    }));

    const studySessions: GoalProgressSessionInput[] = rawFinishedSessions.map((ss) => ({
      id: ss.id,
      topic_id: ss.topic_id,
      status: ss.status as 'FINISHED',
      started_at: ss.started_at,
      ended_at: ss.ended_at,
      planned_start: null,
      blocks: ss.session_blocks.map((b) => ({
        id: b.id,
        kind: b.kind as 'REVIEW' | 'NEW_CONTENT' | 'PRACTICE',
        planned_minutes: b.planned_minutes,
        position: b.position,
      })),
      events: ss.session_events.map((e) => ({
        type: e.type as any,
        block_id: e.block_id,
        occurred_at: e.occurred_at,
        declared_seconds: e.declared_seconds,
      })),
      practice_records: ss.practice_records.map((pr) => ({
        topic_id: pr.topic_id,
        questions: pr.questions,
        correct: pr.correct,
      })),
    }));

    // 1. Estatísticas de Hoje, Semana Atual, Mês Atual e Últimos 30 Dias (fatiadas em memória)
    const todayStats = calculatePeriodStatistics({
      windowUtc: dayWindow,
      days: [referenceDate],
      timezone,
      plannedSessions,
      studySessions,
      subjects: rawSubjects,
      topics: rawTopics,
      referenceNow,
    });

    const weekSummary = calculatePeriodStatistics({
      windowUtc: { startUtc: weekWindow.startUtc, endUtc: weekWindow.endUtc },
      days: weekWindow.days,
      timezone,
      plannedSessions,
      studySessions,
      subjects: rawSubjects,
      topics: rawTopics,
      referenceNow,
    });

    const monthSummary = calculatePeriodStatistics({
      windowUtc: { startUtc: monthWindow.startUtc, endUtc: monthWindow.endUtc },
      days: monthWindow.days,
      timezone,
      plannedSessions,
      studySessions,
      subjects: rawSubjects,
      topics: rawTopics,
      referenceNow,
    });

    const rolling30Stats = calculatePeriodStatistics({
      windowUtc: { startUtc: rolling30Window.startUtc, endUtc: rolling30Window.endUtc },
      days: rolling30Window.days,
      timezone,
      plannedSessions,
      studySessions,
      subjects: rawSubjects,
      topics: rawTopics,
      referenceNow,
    });

    // 2. Sessões planejadas de hoje e próxima sessão (nextSession)
    const mapPlannedCard = (
      ps: {
        id: string;
        subject_id: string;
        topic_id: string;
        scheduled_start: Date;
        planned_minutes: number;
        priority: string;
        activity_type: string | null;
        status: string;
      },
      isFutureDay: boolean
    ): DashboardPlannedSessionCard => {
      const subj = subjectById.get(ps.subject_id);
      const top = topicById.get(ps.topic_id);
      const localDate = utcToLocalDate(ps.scheduled_start, timezone);
      const localTime = utcToLocalTime(ps.scheduled_start, timezone);
      const isLate =
        !isFutureDay &&
        ps.status === 'PLANNED' &&
        ps.scheduled_start.getTime() < referenceNow.getTime();

      return {
        id: ps.id,
        subject_id: ps.subject_id,
        subject_name: subj?.name ?? 'Matéria',
        subject_color: subj?.color ?? '#3B82F6',
        topic_id: ps.topic_id,
        topic_name: top?.name ?? 'Assunto',
        scheduled_start: ps.scheduled_start.toISOString(),
        localDate,
        localTime,
        planned_minutes: ps.planned_minutes,
        priority: ps.priority,
        activity_type: ps.activity_type,
        status: ps.status,
        isLate,
        isFutureDay,
      };
    };

    const todaySessions: DashboardPlannedSessionCard[] = rawPlannedInWindow
      .filter(
        (ps) =>
          ps.scheduled_start >= dayWindow.startUtc &&
          ps.scheduled_start < dayWindow.endUtc &&
          ps.status !== 'RESCHEDULED'
      )
      .map((ps) => mapPlannedCard(ps, false));

    const nextTodayPlanned = todaySessions.find((ps) => ps.status === 'PLANNED') ?? null;
    const nextSession: DashboardPlannedSessionCard | null =
      nextTodayPlanned ?? (nextFuturePlannedRaw ? mapPlannedCard(nextFuturePlannedRaw, true) : null);

    // 3. Metas do dia, semana e mês atuais calculadas em memória sobre os mesmos dados
    const goals: GoalWithProgressView[] = rawGoals.map((g) => {
      const w = getGoalPeriodWindowUtc(
        g.period_start_local_date,
        g.period as GoalPeriodDTO,
        timezone,
        weekStartsOn
      );
      const progress = calculateGoalProgress({
        goal: {
          kind: g.kind as GoalKindDTO,
          metric: g.metric as GoalMetricDTO,
          period: g.period as GoalPeriodDTO,
          period_start_local_date: g.period_start_local_date,
          target_value: g.target_value,
          subject_id: g.subject_id,
          topic_id: g.topic_id,
        },
        windowUtc: w,
        sessions: studySessions,
        topics: rawTopics,
        referenceNow,
      });

      const subj = g.subject_id ? subjectById.get(g.subject_id) : undefined;
      const top = g.topic_id ? topicById.get(g.topic_id) : undefined;

      return {
        id: g.id,
        user_id: g.user_id,
        kind: g.kind as GoalKindDTO,
        metric: g.metric as GoalMetricDTO,
        period: g.period as GoalPeriodDTO,
        period_start_local_date: g.period_start_local_date,
        target_value: g.target_value,
        subject_id: g.subject_id,
        topic_id: g.topic_id,
        subject_name: subj?.name ?? null,
        subject_color: subj?.color ?? null,
        topic_name: top?.name ?? null,
        is_archived_scope: Boolean(subj?.archived || top?.archived),
        status: progress.status,
        is_achieved: progress.isAchieved,
        current_value: progress.currentValue,
        progress_percent: progress.progressPercent,
        questions_count: progress.questionsCount,
        created_at: g.created_at.toISOString(),
        updated_at: g.updated_at.toISOString(),
      };
    });

    const activeSession: StudySessionView | null = activeSessionRaw
      ? toSessionView(activeSessionRaw, referenceNow)
      : null;

    const pendingEvaluation: StudySessionView | null = pendingEvalSessionRaw
      ? toSessionView(pendingEvalSessionRaw, referenceNow)
      : null;

    const hasAnyStudyData =
      rawSubjects.length > 0 ||
      rawPlannedInWindow.length > 0 ||
      rawFinishedSessions.length > 0 ||
      Boolean(activeSession) ||
      Boolean(pendingEvaluation);

    return {
      referenceDate,
      hasAnyStudyData,
      today: {
        date: referenceDate,
        agendaPlannedMinutes: todayStats.overview.agendaPlannedMinutes,
        effectiveSeconds: todayStats.overview.effectiveSeconds,
        effectiveMinutes: todayStats.overview.effectiveMinutes,
        effectiveness: todayStats.overview.effectiveness,
        adherence: todayStats.overview.adherence,
        questions: todayStats.overview.totalQuestions,
        correct: todayStats.overview.totalCorrect,
        accuracy: todayStats.overview.accuracy,
        todaySessions,
        nextSession,
      },
      todaySessions,
      activeSession,
      pendingEvaluation,
      goals,
      weekSummary: {
        startLocalDate: weekWindow.days[0],
        endLocalDate: weekWindow.days[6],
        ...weekSummary,
      },
      monthSummary: {
        startLocalDate: monthWindow.startLocalDate,
        endLocalDate: monthWindow.endLocalDate,
        ...monthSummary,
      },
      rolling30Days: {
        startLocalDate: rolling30Window.startLocalDate,
        endLocalDate: rolling30Window.endLocalDate,
        ...rolling30Stats.overview,
        dailySeries: rolling30Stats.dailySeries,
      },
      subjectProgress: rolling30Stats.bySubject,
    };
  }
}
