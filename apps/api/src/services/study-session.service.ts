import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  calculateSessionMetrics,
  sortSessionEvents,
  StudySessionCreateInput,
  SessionEventDTO,
  SessionBlockDTO,
  SessionMetrics,
} from '@estudos/domain';

export interface StudySessionView {
  id: string;
  user_id: string;
  planned_session_id: string | null;
  topic_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  topic: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
      color: string;
    };
  };
  session_blocks: Array<{
    id: string;
    kind: string;
    planned_minutes: number;
    position: number;
  }>;
  session_events: Array<{
    id: string;
    block_id: string | null;
    type: string;
    occurred_at: string;
    declared_seconds: number | null;
  }>;
  practice_records: Array<{
    id: string;
    block_id: string | null;
    topic_id: string;
    questions: number;
    correct: number;
  }>;
  evaluation: {
    id: string;
    understanding: string;
    focus: string;
    difficulty: string;
    notes: string | null;
  } | null;
  metrics: SessionMetrics | null;
}

export function lockUserForCreation(tx: Prisma.TransactionClient, userId: string): Promise<any> {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

export async function lockSessionForUpdate(
  tx: Prisma.TransactionClient,
  userId: string,
  sessionId: string
): Promise<{ id: string; status: string }> {
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status FROM "study_sessions"
    WHERE id = ${sessionId} AND user_id = ${userId}
    FOR UPDATE
  `;
  if (!rows || rows.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Sessão de estudo não encontrada.');
  }
  return rows[0];
}

export function toSessionView(session: any, referenceNow: Date): StudySessionView {
  const domainBlocks: SessionBlockDTO[] = session.session_blocks.map((b: any) => ({
    id: b.id,
    kind: b.kind,
    planned_minutes: b.planned_minutes,
    position: b.position,
  }));

  const domainEvents: SessionEventDTO[] = session.session_events.map((e: any) => ({
    type: e.type,
    block_id: e.block_id,
    occurred_at: new Date(e.occurred_at),
    declared_seconds: e.declared_seconds,
  }));

  const sortedEvents = sortSessionEvents(domainEvents);

  const metrics = calculateSessionMetrics(
    {
      status: session.status,
      started_at: new Date(session.started_at),
      ended_at: session.ended_at ? new Date(session.ended_at) : null,
      planned_start: session.planned_session?.scheduled_start
        ? new Date(session.planned_session.scheduled_start)
        : null,
    },
    domainBlocks,
    sortedEvents,
    referenceNow
  );

  return {
    id: session.id,
    user_id: session.user_id,
    planned_session_id: session.planned_session_id,
    topic_id: session.topic_id,
    started_at: session.started_at.toISOString(),
    ended_at: session.ended_at ? session.ended_at.toISOString() : null,
    status: session.status,
    created_at: session.created_at.toISOString(),
    updated_at: session.updated_at.toISOString(),
    topic: {
      id: session.topic.id,
      name: session.topic.name,
      subject: {
        id: session.topic.subject.id,
        name: session.topic.subject.name,
        color: session.topic.subject.color,
      },
    },
    session_blocks: domainBlocks.sort((a, b) => a.position - b.position),
    session_events: session.session_events.map((e: any) => ({
      id: e.id,
      block_id: e.block_id,
      type: e.type,
      occurred_at: e.occurred_at.toISOString(),
      declared_seconds: e.declared_seconds,
    })),
    practice_records: (session.practice_records || []).map((pr: any) => ({
      id: pr.id,
      block_id: pr.block_id,
      topic_id: pr.topic_id,
      questions: pr.questions,
      correct: pr.correct,
    })),
    evaluation: session.evaluation
      ? {
          id: session.evaluation.id,
          understanding: session.evaluation.understanding,
          focus: session.evaluation.focus,
          difficulty: session.evaluation.difficulty,
          notes: session.evaluation.notes,
        }
      : null,
    metrics,
  };
}

export class StudySessionService {
  /**
   * POST /api/study-sessions — Cria uma nova sessão com lock consultivo por usuário.
   */
  static async create(userId: string, input: StudySessionCreateInput): Promise<StudySessionView> {
    return prisma.$transaction(async (tx) => {
      await lockUserForCreation(tx, userId);

      // Checar se já existe sessão ativa
      const active = await tx.studySession.findFirst({
        where: { user_id: userId, status: 'IN_PROGRESS' },
      });
      if (active) {
        throw new AppError(
          409,
          'ACTIVE_SESSION_EXISTS',
          'Você já tem uma sessão de estudo em andamento.'
        );
      }

      // Checar se existe sessão concluída sem avaliação
      const pending = await tx.studySession.findFirst({
        where: { user_id: userId, status: 'FINISHED', evaluation: null },
      });
      if (pending) {
        throw new AppError(
          409,
          'PENDING_EVALUATION_EXISTS',
          'Você tem uma sessão concluída aguardando avaliação.'
        );
      }

      const now = new Date();
      let sessionId = '';

      if (input.mode === 'FROM_PLANNED') {
        const planned = await tx.plannedSession.findFirst({
          where: { id: input.planned_session_id, user_id: userId },
          include: { planned_blocks: { orderBy: { position: 'asc' } } },
        });

        if (!planned) {
          throw new AppError(404, 'NOT_FOUND', 'Sessão planejada não encontrada.');
        }

        if (planned.status !== 'PLANNED') {
          throw new AppError(
            409,
            'PLANNED_SESSION_NOT_AVAILABLE',
            'Esta sessão planejada não está disponível para estudo.'
          );
        }

        const updateCount = await tx.plannedSession.updateMany({
          where: { id: planned.id, user_id: userId, status: 'PLANNED' },
          data: { status: 'DONE' },
        });

        if (updateCount.count !== 1) {
          throw new AppError(
            409,
            'PLANNED_SESSION_NOT_AVAILABLE',
            'Esta sessão planejada já foi iniciada ou alterada.'
          );
        }

        const session = await tx.studySession.create({
          data: {
            user_id: userId,
            planned_session_id: planned.id,
            topic_id: planned.topic_id,
            started_at: now,
            status: 'IN_PROGRESS',
          },
        });
        sessionId = session.id;

        const blocksToCreate =
          planned.planned_blocks.length > 0
            ? planned.planned_blocks
            : [
                {
                  kind: 'NEW_CONTENT' as const,
                  planned_minutes: planned.planned_minutes,
                  position: 1,
                },
              ];

        const createdBlocks = [];
        for (const b of blocksToCreate) {
          const block = await tx.sessionBlock.create({
            data: {
              user_id: userId,
              study_session_id: session.id,
              kind: b.kind,
              planned_minutes: b.planned_minutes,
              position: b.position,
            },
          });
          createdBlocks.push(block);
        }

        await tx.sessionEvent.create({
          data: {
            user_id: userId,
            study_session_id: session.id,
            block_id: createdBlocks[0].id,
            type: 'BLOCK_START',
            occurred_at: now,
          },
        });
      } else {
        const topic = await tx.topic.findFirst({
          where: { id: input.topic_id, user_id: userId },
          include: { subject: true },
        });

        if (!topic) {
          throw new AppError(404, 'NOT_FOUND', 'Assunto não encontrado.');
        }

        if (topic.archived || topic.subject.archived) {
          throw new AppError(
            400,
            'TOPIC_ARCHIVED',
            'Não é possível estudar um assunto ou matéria arquivada.'
          );
        }

        const session = await tx.studySession.create({
          data: {
            user_id: userId,
            planned_session_id: null,
            topic_id: topic.id,
            started_at: now,
            status: 'IN_PROGRESS',
          },
        });
        sessionId = session.id;

        const createdBlocks = [];
        for (const b of input.blocks) {
          const block = await tx.sessionBlock.create({
            data: {
              user_id: userId,
              study_session_id: session.id,
              kind: b.kind,
              planned_minutes: b.planned_minutes,
              position: b.position,
            },
          });
          createdBlocks.push(block);
        }

        await tx.sessionEvent.create({
          data: {
            user_id: userId,
            study_session_id: session.id,
            block_id: createdBlocks[0].id,
            type: 'BLOCK_START',
            occurred_at: now,
          },
        });
      }

      const fullSession = await tx.studySession.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          topic: { include: { subject: true } },
          session_blocks: { orderBy: { position: 'asc' } },
          session_events: { orderBy: [{ occurred_at: 'asc' }, { created_at: 'asc' }] },
          practice_records: true,
          evaluation: true,
          planned_session: true,
        },
      });

      return toSessionView(fullSession, now);
    });
  }

  /**
   * GET /api/study-sessions/active
   */
  static async getActive(userId: string): Promise<StudySessionView | null> {
    const session = await prisma.studySession.findFirst({
      where: { user_id: userId, status: 'IN_PROGRESS' },
      include: {
        topic: { include: { subject: true } },
        session_blocks: { orderBy: { position: 'asc' } },
        session_events: { orderBy: [{ occurred_at: 'asc' }, { created_at: 'asc' }] },
        practice_records: true,
        evaluation: true,
        planned_session: true,
      },
    });

    if (!session) return null;
    return toSessionView(session, new Date());
  }

  /**
   * GET /api/study-sessions/pending-evaluation
   */
  static async getPendingEvaluation(userId: string): Promise<StudySessionView | null> {
    const session = await prisma.studySession.findFirst({
      where: { user_id: userId, status: 'FINISHED', evaluation: null },
      include: {
        topic: { include: { subject: true } },
        session_blocks: { orderBy: { position: 'asc' } },
        session_events: { orderBy: [{ occurred_at: 'asc' }, { created_at: 'asc' }] },
        practice_records: true,
        evaluation: true,
        planned_session: true,
      },
    });

    if (!session) return null;
    return toSessionView(session, new Date());
  }

  /**
   * GET /api/study-sessions/:id
   */
  static async getById(userId: string, id: string): Promise<StudySessionView> {
    const session = await prisma.studySession.findFirst({
      where: { id, user_id: userId },
      include: {
        topic: { include: { subject: true } },
        session_blocks: { orderBy: { position: 'asc' } },
        session_events: { orderBy: [{ occurred_at: 'asc' }, { created_at: 'asc' }] },
        practice_records: true,
        evaluation: true,
        planned_session: true,
      },
    });

    if (!session) {
      throw new AppError(404, 'NOT_FOUND', 'Sessão de estudo não encontrada.');
    }

    return toSessionView(session, new Date());
  }
}
