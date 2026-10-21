import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  calculateGoalProgress,
  getGoalPeriodWindowUtc,
  getPreviousGoalPeriodStart,
  normalizeGoalPeriodStart,
  parseWeekStartsOn,
  utcToLocalDate,
  validateGoalTargetValue,
  type GoalCopyInput,
  type GoalCreateInput,
  type GoalKindDTO,
  type GoalListQueryInput,
  type GoalMetricDTO,
  type GoalPeriodDTO,
  type GoalProgressSessionInput,
  type GoalStatus,
  type GoalUpdateInput,
  type TopicTreeNode,
} from '@estudos/domain';

export interface GoalWithProgressView {
  id: string;
  user_id: string;
  kind: GoalKindDTO;
  metric: GoalMetricDTO;
  period: GoalPeriodDTO;
  period_start_local_date: string;
  target_value: number;
  subject_id: string | null;
  topic_id: string | null;
  subject_name: string | null;
  subject_color: string | null;
  topic_name: string | null;
  is_archived_scope: boolean;
  status: GoalStatus;
  is_achieved: boolean;
  current_value: number | null;
  progress_percent: number | null;
  questions_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Adquire lock transacional exclusivo para operações de criação/cópia de metas do usuário,
 * usando namespace próprio `goals:${userId}` (sem competir com o lock de criação de sessões).
 */
export async function lockUserGoals(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const lockKey = `goals:${userId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

export class GoalService {
  /**
   * Busca configurações de fuso e início de semana do usuário.
   */
  private static async getUserContext(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true, week_starts_on: true },
    });
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Usuário não encontrado.');
    }
    return {
      userId: user.id,
      timezone: user.timezone || 'America/Sao_Paulo',
      weekStartsOn: parseWeekStartsOn(user.week_starts_on),
    };
  }

  /**
   * Carrega em lote único os tópicos e as sessões concluídas na janela `[minStartUtc, maxEndUtc)`
   * e calcula o progresso em memória para a lista de metas informada.
   */
  public static async enrichGoalsWithProgress(
    userId: string,
    timezone: string,
    weekStartsOn: 0 | 1,
    goals: Array<{
      id: string;
      user_id: string;
      kind: string;
      metric: string;
      period: string;
      period_start_local_date: string;
      target_value: number;
      subject_id: string | null;
      topic_id: string | null;
      created_at: Date;
      updated_at: Date;
      subject?: { id: string; name: string; color: string; archived: boolean } | null;
      topic?: { id: string; name: string; subject_id: string; archived: boolean } | null;
    }>,
    referenceNow: Date = new Date()
  ): Promise<GoalWithProgressView[]> {
    if (goals.length === 0) {
      return [];
    }

    const goalWindows = goals.map((g) =>
      getGoalPeriodWindowUtc(
        g.period_start_local_date,
        g.period as GoalPeriodDTO,
        timezone,
        weekStartsOn
      )
    );

    let minStartMs = goalWindows[0].startUtc.getTime();
    let maxEndMs = goalWindows[0].endUtc.getTime();

    for (const w of goalWindows) {
      if (w.startUtc.getTime() < minStartMs) minStartMs = w.startUtc.getTime();
      if (w.endUtc.getTime() > maxEndMs) maxEndMs = w.endUtc.getTime();
    }

    const [allTopics, rawSessions] = await Promise.all([
      prisma.topic.findMany({
        where: { user_id: userId },
        select: { id: true, parent_id: true, subject_id: true },
      }),
      prisma.studySession.findMany({
        where: {
          user_id: userId,
          status: 'FINISHED',
          started_at: {
            gte: new Date(minStartMs),
            lt: new Date(maxEndMs),
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

    const domainTopics: TopicTreeNode[] = allTopics.map((t) => ({
      id: t.id,
      parent_id: t.parent_id,
      subject_id: t.subject_id,
    }));

    const domainSessions: GoalProgressSessionInput[] = rawSessions.map((s) => ({
      id: s.id,
      topic_id: s.topic_id,
      status: s.status as 'FINISHED',
      started_at: s.started_at,
      ended_at: s.ended_at,
      planned_start: null,
      blocks: s.session_blocks.map((b) => ({
        id: b.id,
        kind: b.kind as 'REVIEW' | 'NEW_CONTENT' | 'PRACTICE',
        planned_minutes: b.planned_minutes,
        position: b.position,
      })),
      events: s.session_events.map((e) => ({
        type: e.type as any,
        block_id: e.block_id,
        occurred_at: e.occurred_at,
        declared_seconds: e.declared_seconds,
      })),
      practice_records: s.practice_records.map((pr) => ({
        topic_id: pr.topic_id,
        questions: pr.questions,
        correct: pr.correct,
      })),
    }));

    return goals.map((g, idx) => {
      const windowUtc = goalWindows[idx];
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
        windowUtc,
        sessions: domainSessions,
        topics: domainTopics,
        referenceNow,
      });

      const isArchivedScope = Boolean(g.subject?.archived || g.topic?.archived);

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
        subject_name: g.subject?.name ?? null,
        subject_color: g.subject?.color ?? null,
        topic_name: g.topic?.name ?? null,
        is_archived_scope: isArchivedScope,
        status: progress.status,
        is_achieved: progress.isAchieved,
        current_value: progress.currentValue,
        progress_percent: progress.progressPercent,
        questions_count: progress.questionsCount,
        created_at: g.created_at.toISOString(),
        updated_at: g.updated_at.toISOString(),
      };
    });
  }

  /**
   * GET /api/goals?period=DAY|WEEK|MONTH&date=YYYY-MM-DD
   */
  public static async list(userId: string, query: GoalListQueryInput): Promise<GoalWithProgressView[]> {
    const referenceNow = new Date();
    const { timezone, weekStartsOn } = await this.getUserContext(userId);
    const referenceLocalDate = query.date ?? utcToLocalDate(referenceNow, timezone);

    let whereClause: Prisma.GoalWhereInput;

    if (query.period) {
      const normalizedStart = normalizeGoalPeriodStart(
        referenceLocalDate,
        query.period,
        weekStartsOn
      );
      whereClause = {
        user_id: userId,
        period: query.period,
        period_start_local_date: normalizedStart,
      };
    } else {
      const dayStart = normalizeGoalPeriodStart(referenceLocalDate, 'DAY', weekStartsOn);
      const weekStart = normalizeGoalPeriodStart(referenceLocalDate, 'WEEK', weekStartsOn);
      const monthStart = normalizeGoalPeriodStart(referenceLocalDate, 'MONTH', weekStartsOn);

      whereClause = {
        user_id: userId,
        OR: [
          { period: 'DAY', period_start_local_date: dayStart },
          { period: 'WEEK', period_start_local_date: weekStart },
          { period: 'MONTH', period_start_local_date: monthStart },
        ],
      };
    }

    const goals = await prisma.goal.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true, color: true, archived: true } },
        topic: { select: { id: true, name: true, subject_id: true, archived: true } },
      },
      orderBy: [{ created_at: 'asc' }],
    });

    return this.enrichGoalsWithProgress(userId, timezone, weekStartsOn, goals, referenceNow);
  }

  /**
   * POST /api/goals
   */
  public static async create(userId: string, input: GoalCreateInput): Promise<GoalWithProgressView> {
    const referenceNow = new Date();
    const { timezone, weekStartsOn } = await this.getUserContext(userId);

    const normalizedPeriodStart = normalizeGoalPeriodStart(
      input.period_start_local_date,
      input.period,
      weekStartsOn
    );

    let resolvedSubjectId: string | null = input.subject_id ?? null;
    const resolvedTopicId: string | null = input.topic_id ?? null;

    if (resolvedTopicId) {
      const topic = await prisma.topic.findFirst({
        where: { id: resolvedTopicId, user_id: userId },
        include: { subject: { select: { id: true, archived: true } } },
      });

      if (!topic) {
        throw new AppError(404, 'NOT_FOUND', 'Assunto não encontrado.');
      }

      if (resolvedSubjectId && resolvedSubjectId !== topic.subject_id) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          'O assunto informado não pertence à matéria selecionada.'
        );
      }

      if (topic.archived || topic.subject.archived) {
        throw new AppError(
          400,
          'ARCHIVED_SCOPE',
          'Não é permitido criar uma nova meta para um assunto ou matéria arquivada.'
        );
      }

      resolvedSubjectId = topic.subject_id;
    } else if (resolvedSubjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: resolvedSubjectId, user_id: userId },
      });

      if (!subject) {
        throw new AppError(404, 'NOT_FOUND', 'Matéria não encontrada.');
      }

      if (subject.archived) {
        throw new AppError(
          400,
          'ARCHIVED_SCOPE',
          'Não é permitido criar uma nova meta para uma matéria arquivada.'
        );
      }
    }

    const createdGoal = await prisma.$transaction(async (tx) => {
      await lockUserGoals(tx, userId);

      const existing = await tx.goal.findFirst({
        where: {
          user_id: userId,
          kind: input.kind,
          metric: input.metric,
          period: input.period,
          period_start_local_date: normalizedPeriodStart,
          subject_id: resolvedSubjectId,
          topic_id: resolvedTopicId,
        },
      });

      if (existing) {
        throw new AppError(
          409,
          'GOAL_ALREADY_EXISTS',
          'Já existe uma meta idêntica cadastrada para este período e escopo.'
        );
      }

      return tx.goal.create({
        data: {
          user_id: userId,
          kind: input.kind,
          metric: input.metric,
          period: input.period,
          period_start_local_date: normalizedPeriodStart,
          target_value: input.target_value,
          subject_id: resolvedSubjectId,
          topic_id: resolvedTopicId,
        },
        include: {
          subject: { select: { id: true, name: true, color: true, archived: true } },
          topic: { select: { id: true, name: true, subject_id: true, archived: true } },
        },
      });
    });

    const [enriched] = await this.enrichGoalsWithProgress(
      userId,
      timezone,
      weekStartsOn,
      [createdGoal],
      referenceNow
    );
    return enriched;
  }

  /**
   * POST /api/goals/copy
   */
  public static async copyFromPreviousPeriod(
    userId: string,
    input: GoalCopyInput
  ): Promise<{ copiedCount: number; data: GoalWithProgressView[] }> {
    const referenceNow = new Date();
    const { timezone, weekStartsOn } = await this.getUserContext(userId);

    const targetPeriodStart = normalizeGoalPeriodStart(
      input.target_date,
      input.period,
      weekStartsOn
    );
    const previousPeriodStart = getPreviousGoalPeriodStart(
      targetPeriodStart,
      input.period,
      weekStartsOn
    );

    const { copiedCount, targetGoals } = await prisma.$transaction(async (tx) => {
      await lockUserGoals(tx, userId);

      const [previousGoals, existingTargetGoals] = await Promise.all([
        tx.goal.findMany({
          where: {
            user_id: userId,
            period: input.period,
            period_start_local_date: previousPeriodStart,
          },
          include: {
            subject: { select: { id: true, archived: true } },
            topic: { select: { id: true, archived: true } },
          },
          orderBy: [{ created_at: 'asc' }],
        }),
        tx.goal.findMany({
          where: {
            user_id: userId,
            period: input.period,
            period_start_local_date: targetPeriodStart,
          },
        }),
      ]);

      const signatureOf = (g: {
        kind: string;
        metric: string;
        period: string;
        subject_id: string | null;
        topic_id: string | null;
      }) => `${g.kind}|${g.metric}|${g.period}|${g.subject_id ?? ''}|${g.topic_id ?? ''}`;

      const existingSignatures = new Set(existingTargetGoals.map(signatureOf));

      const toInsert: Prisma.GoalCreateManyInput[] = [];
      for (const prev of previousGoals) {
        // Ignora metas cujo escopo esteja arquivado atualmente
        if (prev.subject?.archived || prev.topic?.archived) {
          continue;
        }
        const sig = signatureOf(prev);
        if (existingSignatures.has(sig)) {
          continue;
        }
        existingSignatures.add(sig);
        toInsert.push({
          user_id: userId,
          kind: prev.kind,
          metric: prev.metric,
          period: prev.period,
          period_start_local_date: targetPeriodStart,
          target_value: prev.target_value,
          subject_id: prev.subject_id,
          topic_id: prev.topic_id,
        });
      }

      if (toInsert.length > 0) {
        await tx.goal.createMany({ data: toInsert });
      }

      const finalGoals = await tx.goal.findMany({
        where: {
          user_id: userId,
          period: input.period,
          period_start_local_date: targetPeriodStart,
        },
        include: {
          subject: { select: { id: true, name: true, color: true, archived: true } },
          topic: { select: { id: true, name: true, subject_id: true, archived: true } },
        },
        orderBy: [{ created_at: 'asc' }],
      });

      return {
        copiedCount: toInsert.length,
        targetGoals: finalGoals,
      };
    });

    const enriched = await this.enrichGoalsWithProgress(
      userId,
      timezone,
      weekStartsOn,
      targetGoals,
      referenceNow
    );

    return {
      copiedCount,
      data: enriched,
    };
  }

  /**
   * PATCH /api/goals/:id
   */
  public static async update(
    userId: string,
    goalId: string,
    input: GoalUpdateInput
  ): Promise<GoalWithProgressView> {
    const referenceNow = new Date();
    const { timezone, weekStartsOn } = await this.getUserContext(userId);

    const existing = await prisma.goal.findFirst({
      where: { id: goalId, user_id: userId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Meta não encontrada.');
    }

    const validation = validateGoalTargetValue(
      existing.metric as GoalMetricDTO,
      input.target_value
    );
    if (!validation.ok) {
      throw new AppError(400, 'BAD_REQUEST', validation.message, [
        { field: 'target_value', message: validation.message },
      ]);
    }

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data: { target_value: input.target_value },
      include: {
        subject: { select: { id: true, name: true, color: true, archived: true } },
        topic: { select: { id: true, name: true, subject_id: true, archived: true } },
      },
    });

    const [enriched] = await this.enrichGoalsWithProgress(
      userId,
      timezone,
      weekStartsOn,
      [updated],
      referenceNow
    );
    return enriched;
  }

  /**
   * DELETE /api/goals/:id
   */
  public static async delete(userId: string, goalId: string): Promise<void> {
    const existing = await prisma.goal.findFirst({
      where: { id: goalId, user_id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Meta não encontrada.');
    }

    await prisma.goal.delete({
      where: { id: goalId },
    });
  }
}
