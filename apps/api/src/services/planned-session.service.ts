import { PrismaClient, PlannedSessionStatus, BlockKind } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  getDayWindowUtc,
  getWeekWindowUtc,
  localDateTimeToUtc,
  utcToLocalDate,
  utcToLocalTime,
  summarizePlannedSessions,
  findOverlappingSessionIds,
  calculateSessionMetrics,
  sortSessionEvents,
  type SessionBlockDTO,
  type SessionEventDTO,
  type PlannedSessionCreateInput,
  type PlannedSessionUpdateInput,
  type PlannedSessionRescheduleInput,
  type PlannedPeriodSummary,
} from '@estudos/domain';
import { AppError } from '../utils/errors.js';

export interface PlannedSessionBlockDTO {
  id: string;
  kind: BlockKind;
  planned_minutes: number;
  position: number;
}

export interface PlannedSessionDTO {
  id: string;
  user_id: string;
  subject_id: string;
  topic_id: string;
  scheduled_start: string;
  planned_minutes: number;
  priority: string;
  activity_type: string | null;
  notes: string | null;
  status: PlannedSessionStatus;
  rescheduled_from_id: string | null;
  created_at: string;
  updated_at: string;
  local_date: string;
  local_time: string;
  actual_effective_seconds?: number | null;
  actual_total_seconds?: number | null;
  study_session_id?: string | null;
  subject: {
    id: string;
    name: string;
    color: string;
    archived: boolean;
  };
  topic: {
    id: string;
    name: string;
    archived: boolean;
  };
  blocks: PlannedSessionBlockDTO[];
}

export interface PlannedSessionListResponse {
  view: 'day' | 'week';
  date: string;
  timezone: string;
  start_utc: string;
  end_utc: string;
  days: string[];
  sessions: PlannedSessionDTO[];
  overlapping_ids: string[];
  summary: PlannedPeriodSummary;
}

function mapPlannedSessionDTO(
  session: any,
  timezone: string
): PlannedSessionDTO {
  const scheduledStartDate =
    session.scheduled_start instanceof Date
      ? session.scheduled_start
      : new Date(session.scheduled_start);

  let actualEffectiveSeconds: number | null = null;
  let actualTotalSeconds: number | null = null;

  if (session.status === 'DONE' && session.study_sessions && session.study_sessions.length > 0) {
    const studySession = session.study_sessions[0];
    const domainBlocks: SessionBlockDTO[] = (studySession.session_blocks || []).map((b: any) => ({
      id: b.id,
      kind: b.kind,
      planned_minutes: b.planned_minutes,
      position: b.position,
    }));
    const domainEvents: SessionEventDTO[] = (studySession.session_events || []).map((e: any) => ({
      type: e.type,
      block_id: e.block_id,
      occurred_at: new Date(e.occurred_at),
      declared_seconds: e.declared_seconds,
    }));
    const sortedEvents = sortSessionEvents(domainEvents);
    const refNow = studySession.ended_at ? new Date(studySession.ended_at) : new Date();
    const metrics = calculateSessionMetrics(
      {
        status: studySession.status,
        started_at: new Date(studySession.started_at),
        ended_at: studySession.ended_at ? new Date(studySession.ended_at) : null,
        planned_start: scheduledStartDate,
      },
      domainBlocks,
      sortedEvents,
      refNow
    );
    if (metrics) {
      actualEffectiveSeconds = metrics.effectiveSeconds;
      actualTotalSeconds = metrics.totalSeconds;
    }
  }

  return {
    id: session.id,
    user_id: session.user_id,
    subject_id: session.subject_id,
    topic_id: session.topic_id,
    scheduled_start: scheduledStartDate.toISOString(),
    planned_minutes: session.planned_minutes,
    priority: session.priority,
    activity_type: session.activity_type ?? null,
    notes: session.notes ?? null,
    status: session.status,
    rescheduled_from_id: session.rescheduled_from_id ?? null,
    created_at: session.created_at.toISOString(),
    updated_at: session.updated_at.toISOString(),
    local_date: utcToLocalDate(scheduledStartDate, timezone),
    local_time: utcToLocalTime(scheduledStartDate, timezone),
    actual_effective_seconds: actualEffectiveSeconds,
    actual_total_seconds: actualTotalSeconds,
    study_session_id: session.study_sessions?.[0]?.id ?? null,
    subject: {
      id: session.subject.id,
      name: session.subject.name,
      color: session.subject.color,
      archived: session.subject.archived,
    },
    topic: {
      id: session.topic.id,
      name: session.topic.name,
      archived: session.topic.archived,
    },
    blocks: (session.planned_blocks || []).map((b: any) => ({
      id: b.id,
      kind: b.kind,
      planned_minutes: b.planned_minutes,
      position: b.position,
    })),
  };
}

export class PlannedSessionService {
  /**
   * Lista sessões planejadas do usuário em uma janela temporal ('day' ou 'week')
   * calculada puramente pelo timezone do usuário.
   */
  static async list(
    userId: string,
    timezone: string,
    view: 'day' | 'week',
    dateStr: string
  ): Promise<PlannedSessionListResponse> {
    const window =
      view === 'week'
        ? getWeekWindowUtc(dateStr, timezone)
        : getDayWindowUtc(dateStr, timezone);

    const rawSessions = await prisma.plannedSession.findMany({
      where: {
        user_id: userId,
        scheduled_start: {
          gte: window.startUtc,
          lt: window.endUtc,
        },
      },
      include: {
        subject: {
          select: { id: true, name: true, color: true, archived: true },
        },
        topic: {
          select: { id: true, name: true, archived: true },
        },
        planned_blocks: {
          orderBy: { position: 'asc' },
        },
        study_sessions: {
          where: { status: 'FINISHED' },
          include: {
            session_blocks: { orderBy: { position: 'asc' } },
            session_events: { orderBy: [{ occurred_at: 'asc' }, { created_at: 'asc' }] },
          },
          take: 1,
        },
      },
      orderBy: {
        scheduled_start: 'asc',
      },
    });

    const sessions = rawSessions.map((s) => mapPlannedSessionDTO(s, timezone));
    const overlappingIds = findOverlappingSessionIds(rawSessions);
    const summary = summarizePlannedSessions(
      rawSessions.map((s) => ({
        id: s.id,
        status: s.status,
        planned_minutes: s.planned_minutes,
        blocks: s.planned_blocks.map((b) => ({
          kind: b.kind,
          planned_minutes: b.planned_minutes,
        })),
      }))
    );

    return {
      view,
      date: dateStr,
      timezone,
      start_utc: window.startUtc.toISOString(),
      end_utc: window.endUtc.toISOString(),
      days: 'days' in window ? (window as { days: string[] }).days : [dateStr],
      sessions,
      overlapping_ids: Array.from(overlappingIds),
      summary,
    };
  }

  /**
   * Cria uma nova sessão planejada e seus blocos atômicos dentro de uma transação.
   */
  static async create(
    userId: string,
    timezone: string,
    input: PlannedSessionCreateInput
  ): Promise<PlannedSessionDTO> {
    // 1. Validar existência e posse da matéria
    const subject = await prisma.subject.findUnique({
      where: { id: input.subject_id },
    });
    if (!subject || subject.user_id !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Matéria não encontrada.');
    }
    if (subject.archived) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Não é possível criar agendamento para uma matéria arquivada.'
      );
    }

    // 2. Validar existência e posse do assunto
    const topic = await prisma.topic.findUnique({
      where: { id: input.topic_id },
    });
    if (!topic || topic.user_id !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Assunto não encontrado.');
    }
    if (topic.archived) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Não é possível criar agendamento para um assunto arquivado.'
      );
    }

    // 3. Validar se o assunto pertence à matéria
    if (topic.subject_id !== input.subject_id) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'O assunto informado pertence a outra matéria.'
      );
    }

    // 4. Conversão para UTC via timezone do usuário
    const scheduledStartUtc = localDateTimeToUtc(
      input.scheduled_start_local,
      timezone
    );

    // 5. Criação transacional da sessão e seus blocos
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.plannedSession.create({
        data: {
          user_id: userId,
          subject_id: input.subject_id,
          topic_id: input.topic_id,
          scheduled_start: scheduledStartUtc,
          planned_minutes: input.planned_minutes,
          priority: input.priority,
          activity_type: input.activity_type,
          notes: input.notes ?? null,
          status: 'PLANNED',
          planned_blocks: {
            createMany: {
              data: input.blocks.map((b) => ({
                user_id: userId,
                kind: b.kind as BlockKind,
                planned_minutes: b.planned_minutes,
                position: b.position,
              })),
            },
          },
        },
        include: {
          subject: true,
          topic: true,
          planned_blocks: {
            orderBy: { position: 'asc' },
          },
        },
      });

      return created;
    });

    return mapPlannedSessionDTO(session, timezone);
  }

  /**
   * Atualização parcial de sessão planejada.
   * Permite alterar subject_id, topic_id, prioridade, activity_type, notas e blocos/duração.
   */
  static async update(
    userId: string,
    timezone: string,
    sessionId: string,
    input: PlannedSessionUpdateInput
  ): Promise<PlannedSessionDTO> {
    // 1. Buscar a sessão existente
    const session = await prisma.plannedSession.findUnique({
      where: { id: sessionId },
      include: {
        subject: true,
        topic: true,
        planned_blocks: true,
      },
    });

    if (!session || session.user_id !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Sessão planejada não encontrada.');
    }

    // 2. Verificar se o status permite edição
    if (session.status !== 'PLANNED') {
      throw new AppError(
        409,
        'CONFLICT',
        `Apenas sessões com status "PLANNED" podem ser editadas (status atual: "${session.status}").`
      );
    }

    // 3. Validar novo subject_id / topic_id se informados
    const effectiveSubjectId = input.subject_id ?? session.subject_id;
    const effectiveTopicId = input.topic_id ?? session.topic_id;

    if (input.subject_id && input.subject_id !== session.subject_id) {
      const newSubject = await prisma.subject.findUnique({
        where: { id: input.subject_id },
      });
      if (!newSubject || newSubject.user_id !== userId) {
        throw new AppError(404, 'NOT_FOUND', 'Matéria informada não encontrada.');
      }
      if (newSubject.archived) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          'Não é possível alterar a sessão para uma matéria arquivada.'
        );
      }
    }

    let effectiveTopic = session.topic;
    if (input.topic_id && input.topic_id !== session.topic_id) {
      const newTopic = await prisma.topic.findUnique({
        where: { id: input.topic_id },
      });
      if (!newTopic || newTopic.user_id !== userId) {
        throw new AppError(404, 'NOT_FOUND', 'Assunto informado não encontrado.');
      }
      if (newTopic.archived) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          'Não é possível alterar a sessão para um assunto arquivado.'
        );
      }
      effectiveTopic = newTopic;
    } else if (input.subject_id && input.subject_id !== session.subject_id) {
      const currentTopic = await prisma.topic.findUnique({
        where: { id: effectiveTopicId },
      });
      if (currentTopic) {
        effectiveTopic = currentTopic;
      }
    }

    // Validar relação matéria-assunto resultante
    if (effectiveTopic.subject_id !== effectiveSubjectId) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'O assunto não pertence à matéria informada.'
      );
    }

    // 4. Executar atualização atômica em transação com verificação de corrida
    const updated = await prisma.$transaction(async (tx) => {
      // Se blocos foram enviados, substituir integralmente (deleteMany antes de createMany)
      if (input.blocks && input.planned_minutes !== undefined) {
        await tx.plannedBlock.deleteMany({
          where: {
            planned_session_id: sessionId,
            user_id: userId,
          },
        });

        await tx.plannedBlock.createMany({
          data: input.blocks.map((b) => ({
            user_id: userId,
            planned_session_id: sessionId,
            kind: b.kind as BlockKind,
            planned_minutes: b.planned_minutes,
            position: b.position,
          })),
        });
      }

      // Mutação condicional atômica
      const updateResult = await tx.plannedSession.updateMany({
        where: {
          id: sessionId,
          user_id: userId,
          status: 'PLANNED',
        },
        data: {
          ...(input.subject_id !== undefined && { subject_id: input.subject_id }),
          ...(input.topic_id !== undefined && { topic_id: input.topic_id }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.activity_type !== undefined && { activity_type: input.activity_type }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.planned_minutes !== undefined && { planned_minutes: input.planned_minutes }),
        },
      });

      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          'CONFLICT',
          'Conflito de concorrência: a sessão foi modificada ou seu status não permite mais edição.'
        );
      }

      return tx.plannedSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          subject: true,
          topic: true,
          planned_blocks: {
            orderBy: { position: 'asc' },
          },
        },
      });
    });

    return mapPlannedSessionDTO(updated, timezone);
  }

  /**
   * Atualização de status da sessão (apenas SKIPPED na Fase 3).
   */
  static async updateStatus(
    userId: string,
    timezone: string,
    sessionId: string,
    status: 'SKIPPED'
  ): Promise<PlannedSessionDTO> {
    const session = await prisma.plannedSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.user_id !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Sessão planejada não encontrada.');
    }

    if (session.status !== 'PLANNED') {
      throw new AppError(
        409,
        'CONFLICT',
        `Apenas sessões com status "PLANNED" podem ter seu status alterado para "SKIPPED" (status atual: "${session.status}").`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.plannedSession.updateMany({
        where: {
          id: sessionId,
          user_id: userId,
          status: 'PLANNED',
        },
        data: {
          status: 'SKIPPED',
        },
      });

      if (result.count !== 1) {
        throw new AppError(
          409,
          'CONFLICT',
          'Conflito de concorrência: o status da sessão foi alterado por outra requisição.'
        );
      }

      return tx.plannedSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          subject: true,
          topic: true,
          planned_blocks: {
            orderBy: { position: 'asc' },
          },
        },
      });
    });

    return mapPlannedSessionDTO(updated, timezone);
  }

  /**
   * Remarcação de sessão planejada (POST /api/planned-sessions/:id/reschedule).
   */
  static async reschedule(
    userId: string,
    timezone: string,
    sessionId: string,
    input: PlannedSessionRescheduleInput
  ): Promise<PlannedSessionDTO> {
    const original = await prisma.plannedSession.findUnique({
      where: { id: sessionId },
      include: {
        subject: true,
        topic: true,
        planned_blocks: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!original || original.user_id !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Sessão planejada não encontrada.');
    }

    if (original.status !== 'PLANNED') {
      throw new AppError(
        409,
        'CONFLICT',
        `Apenas sessões com status "PLANNED" podem ser remarcadas (status atual: "${original.status}").`
      );
    }

    if (original.subject.archived || original.topic.archived) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Não é possível remarcar sessão com matéria ou assunto arquivado. Desarquive-os antes de remarcar.'
      );
    }

    const newStartUtc = localDateTimeToUtc(input.scheduled_start_local, timezone);

    const effectiveMinutes = input.planned_minutes ?? original.planned_minutes;
    const effectiveBlocks =
      input.blocks ??
      original.planned_blocks.map((b) => ({
        kind: b.kind,
        planned_minutes: b.planned_minutes,
        position: b.position,
      }));

    const newSession = await prisma.$transaction(async (tx) => {
      // 1. Atualizar original para RESCHEDULED atimicamente
      const updateResult = await tx.plannedSession.updateMany({
        where: {
          id: sessionId,
          user_id: userId,
          status: 'PLANNED',
        },
        data: {
          status: 'RESCHEDULED',
        },
      });

      if (updateResult.count !== 1) {
        throw new AppError(
          409,
          'CONFLICT',
          'Conflito de concorrência: a sessão original já foi modificada ou remarcada.'
        );
      }

      // 2. Criar a nova sessão filha apontando para a original
      const created = await tx.plannedSession.create({
        data: {
          user_id: userId,
          subject_id: original.subject_id,
          topic_id: original.topic_id,
          scheduled_start: newStartUtc,
          planned_minutes: effectiveMinutes,
          priority: original.priority,
          activity_type: original.activity_type,
          notes: original.notes,
          status: 'PLANNED',
          rescheduled_from_id: original.id,
          planned_blocks: {
            createMany: {
              data: effectiveBlocks.map((b) => ({
                user_id: userId,
                kind: b.kind as BlockKind,
                planned_minutes: b.planned_minutes,
                position: b.position,
              })),
            },
          },
        },
        include: {
          subject: true,
          topic: true,
          planned_blocks: {
            orderBy: { position: 'asc' },
          },
        },
      });

      return created;
    });

    return mapPlannedSessionDTO(newSession, timezone);
  }

  /**
   * Exclusão de sessão planejada (DELETE /api/planned-sessions/:id).
   */
  static async delete(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.plannedSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.user_id !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Sessão planejada não encontrada.');
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Checagem defensiva de existência na transação
        const current = await tx.plannedSession.findFirst({
          where: { id: sessionId, user_id: userId },
        });

        if (!current) {
          throw new AppError(404, 'NOT_FOUND', 'Sessão planejada não encontrada.');
        }

        // 1. Desvincular sessões filhas derivadas (remarcações)
        await tx.plannedSession.updateMany({
          where: { rescheduled_from_id: sessionId },
          data: { rescheduled_from_id: null },
        });

        // 2. Desvincular sessões de estudo executadas vinculadas
        await tx.studySession.updateMany({
          where: { planned_session_id: sessionId },
          data: { planned_session_id: null },
        });

        // 3. Apagar blocos planejados
        await tx.plannedBlock.deleteMany({
          where: {
            planned_session_id: sessionId,
            user_id: userId,
          },
        });

        // 4. Apagar sessão planejada atimicamente checando count
        const deleteResult = await tx.plannedSession.deleteMany({
          where: {
            id: sessionId,
            user_id: userId,
          },
        });

        if (deleteResult.count !== 1) {
          throw new AppError(
            409,
            'CONFLICT',
            'Conflito de concorrência ao excluir sessão planejada.'
          );
        }
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new AppError(
          409,
          'CONFLICT',
          'Não é possível excluir a sessão planejada devido a restrições de integridade referencial.'
        );
      }
      throw error;
    }
  }
}
