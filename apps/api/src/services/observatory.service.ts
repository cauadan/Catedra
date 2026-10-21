import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  addDaysToLocalDate,
  calculateWeeklyObservatory,
  getClassificationWindow,
  getWeekWindowUtc,
  parseWeekStartsOn,
  utcToLocalDate,
  type GoalProgressSessionInput,
  type ObservatoryQueryInput,
  type ObservatorySubjectInput,
  type StatisticsPlannedSessionInput,
  type StatisticsTopicInput,
  type UnderstandingLevelDTO,
  type WeeklyObservatoryReport,
} from '@estudos/domain';

export class ObservatoryService {
  /**
   * GET /api/observatory?date=YYYY-MM-DD
   */
  public static async getObservatory(
    userId: string,
    query: ObservatoryQueryInput
  ): Promise<WeeklyObservatoryReport> {
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
    const todayLocalDate = utcToLocalDate(referenceNow, timezone);
    const selectedLocalDate = query.date ?? todayLocalDate;

    const currentWeekWindow = getWeekWindowUtc(todayLocalDate, timezone, weekStartsOn);
    const selectedWeekWindow = getWeekWindowUtc(selectedLocalDate, timezone, weekStartsOn);

    const currentWeekStartLocalDate = currentWeekWindow.days[0];
    const selectedWeekStartLocalDate = selectedWeekWindow.days[0];
    const selectedWeekEndLocalDate =
      selectedWeekWindow.days[selectedWeekWindow.days.length - 1];

    if (selectedWeekStartLocalDate > currentWeekStartLocalDate) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Não é possível consultar o Observatório para semanas futuras.'
      );
    }

    const prevWeekStartLocalDate = addDaysToLocalDate(selectedWeekStartLocalDate, -7);
    const prevWeekWindow = getWeekWindowUtc(prevWeekStartLocalDate, timezone, weekStartsOn);

    const classificationWindow = getClassificationWindow(
      selectedWeekEndLocalDate,
      referenceNow,
      timezone
    );

    const broadStartUtc = new Date(
      Math.min(
        prevWeekWindow.startUtc.getTime(),
        classificationWindow.startUtc.getTime()
      )
    );
    const broadEndUtc = selectedWeekWindow.endUtc;

    const [rawSubjects, rawTopics, rawPlanned, rawSessions] = await Promise.all([
      prisma.subject.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          name: true,
          color: true,
          archived: true,
          created_at: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.topic.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          name: true,
          subject_id: true,
          parent_id: true,
          archived: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.plannedSession.findMany({
        where: {
          user_id: userId,
          status: { in: ['PLANNED', 'DONE'] },
          scheduled_start: {
            gte: prevWeekWindow.startUtc,
            lt: broadEndUtc,
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
          evaluation: {
            select: {
              understanding: true,
            },
          },
        },
      }),
    ]);

    const subjects: ObservatorySubjectInput[] = rawSubjects;
    const topics: StatisticsTopicInput[] = rawTopics;

    const plannedSessions: StatisticsPlannedSessionInput[] = rawPlanned.map((ps) => ({
      id: ps.id,
      subject_id: ps.subject_id,
      topic_id: ps.topic_id,
      scheduled_start: ps.scheduled_start,
      planned_minutes: ps.planned_minutes,
      status: ps.status as any,
    }));

    const sessions: GoalProgressSessionInput[] = rawSessions.map((ss) => ({
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
      evaluation: ss.evaluation
        ? { understanding: ss.evaluation.understanding as UnderstandingLevelDTO }
        : null,
    }));

    return calculateWeeklyObservatory({
      selectedLocalDate,
      referenceNow,
      timezone,
      weekStartsOn: user.week_starts_on,
      sessions,
      plannedSessions,
      subjects,
      topics,
    });
  }
}
