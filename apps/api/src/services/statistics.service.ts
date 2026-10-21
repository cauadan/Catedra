import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  calculatePeriodStatistics,
  getDayWindowUtc,
  getMonthWindowUtc,
  getRolling30DaysWindowUtc,
  getWeekWindowUtc,
  parseWeekStartsOn,
  utcToLocalDate,
  type GoalProgressSessionInput,
  type PeriodStatisticsResult,
  type StatisticsPlannedSessionInput,
  type StatisticsQueryInput,
  type StatisticsSubjectInput,
  type StatisticsTopicInput,
} from '@estudos/domain';

export interface StatisticsResponseView extends PeriodStatisticsResult {
  range: 'day' | 'week' | 'month' | '30d';
  referenceDate: string;
  startLocalDate: string;
  endLocalDate: string;
}

export class StatisticsService {
  /**
   * GET /api/statistics?range=day|week|month|30d&date=YYYY-MM-DD&subject_id=...&topic_id=...
   */
  public static async getStatistics(
    userId: string,
    query: StatisticsQueryInput
  ): Promise<StatisticsResponseView> {
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
    const range = query.range ?? 'week';

    // Carrega matérias e assuntos do usuário em lote (inclusive arquivados para consulta histórica)
    const [rawSubjects, rawTopics] = await Promise.all([
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
    ]);

    if (query.subject_id) {
      const exists = rawSubjects.some((s) => s.id === query.subject_id);
      if (!exists) {
        throw new AppError(404, 'NOT_FOUND', 'Matéria filtrada não encontrada.');
      }
    }

    if (query.topic_id) {
      const topic = rawTopics.find((t) => t.id === query.topic_id);
      if (!topic) {
        throw new AppError(404, 'NOT_FOUND', 'Assunto filtrado não encontrado.');
      }
      if (query.subject_id && topic.subject_id !== query.subject_id) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          'O assunto filtrado não pertence à matéria informada.'
        );
      }
    }

    let startUtc: Date;
    let endUtc: Date;
    let days: string[];

    if (range === 'day') {
      const w = getDayWindowUtc(referenceDate, timezone);
      startUtc = w.startUtc;
      endUtc = w.endUtc;
      days = [referenceDate];
    } else if (range === 'week') {
      const w = getWeekWindowUtc(referenceDate, timezone, weekStartsOn);
      startUtc = w.startUtc;
      endUtc = w.endUtc;
      days = w.days;
    } else if (range === 'month') {
      const w = getMonthWindowUtc(referenceDate, timezone);
      startUtc = w.startUtc;
      endUtc = w.endUtc;
      days = w.days;
    } else {
      const w = getRolling30DaysWindowUtc(referenceDate, timezone);
      startUtc = w.startUtc;
      endUtc = w.endUtc;
      days = w.days;
    }

    const [rawPlanned, rawStudy] = await Promise.all([
      prisma.plannedSession.findMany({
        where: {
          user_id: userId,
          status: { in: ['PLANNED', 'DONE'] },
          scheduled_start: {
            gte: startUtc,
            lt: endUtc,
          },
        },
        select: {
          id: true,
          subject_id: true,
          topic_id: true,
          scheduled_start: true,
          planned_minutes: true,
          status: true,
        },
      }),
      prisma.studySession.findMany({
        where: {
          user_id: userId,
          status: 'FINISHED',
          started_at: {
            gte: startUtc,
            lt: endUtc,
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
    ]);

    const subjects: StatisticsSubjectInput[] = rawSubjects;
    const topics: StatisticsTopicInput[] = rawTopics;

    const plannedSessions: StatisticsPlannedSessionInput[] = rawPlanned.map((ps) => ({
      id: ps.id,
      subject_id: ps.subject_id,
      topic_id: ps.topic_id,
      scheduled_start: ps.scheduled_start,
      planned_minutes: ps.planned_minutes,
      status: ps.status as any,
    }));

    const studySessions: GoalProgressSessionInput[] = rawStudy.map((ss) => ({
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

    const result = calculatePeriodStatistics({
      windowUtc: { startUtc, endUtc },
      days,
      timezone,
      plannedSessions,
      studySessions,
      subjects,
      topics,
      filterSubjectId: query.subject_id,
      filterTopicId: query.topic_id,
      referenceNow,
    });

    return {
      range,
      referenceDate,
      startLocalDate: days[0],
      endLocalDate: days[days.length - 1],
      ...result,
    };
  }
}
