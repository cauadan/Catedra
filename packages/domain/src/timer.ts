/**
 * Máquina de estados do timer por etapa, cálculos de tempo e métricas de sessão (Fase 4).
 * Funções puras — sem banco, sem I/O.
 */

import { BlockKindDTO } from './planning.js';

export const MAX_EVENT_GAP_MINUTES = 120;

export const SESSION_EVENT_TYPES = [
  'BLOCK_START',
  'PAUSE',
  'RESUME',
  'DISTRACTION_START',
  'DISTRACTION_END',
  'DISTRACTION_DECLARED',
  'BLOCK_FINISH',
  'SESSION_FINISH',
  'SESSION_CANCEL',
] as const;

export type SessionEventTypeDTO = (typeof SESSION_EVENT_TYPES)[number];
export type StudySessionStatusDTO = 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type BlockExecutionState = 'NOT_STARTED' | 'STUDYING' | 'PAUSED' | 'DISTRACTED' | 'FINISHED';

export interface SessionEventDTO {
  type: SessionEventTypeDTO;
  block_id: string | null;
  occurred_at: Date;
  declared_seconds?: number | null;
}

export interface SessionBlockDTO {
  id: string;
  kind: BlockKindDTO;
  planned_minutes: number;
  position: number;
}

export type TransitionResult = { ok: true } | { ok: false; error: string };
export type ManualEventType = 'PAUSE' | 'RESUME' | 'DISTRACTION_START' | 'DISTRACTION_END';

export interface BlockTimes {
  totalSeconds: number;
  pausedSeconds: number;
  distractedRealtimeSeconds: number;
  distractedDeclaredSeconds: number;
  effectiveSeconds: number;
}

export interface BlockMetrics extends BlockTimes {
  blockId: string;
  kind: BlockKindDTO;
  plannedSeconds: number;
  state: BlockExecutionState;
  isIncomplete: boolean;
}

export interface SessionMetrics {
  effectiveSeconds: number;
  totalSeconds: number;
  plannedSeconds: number;
  effectiveness: number;
  adherence: number | null;
  delaySeconds: number | null;
  blocks: BlockMetrics[];
  activeBlockId: string | null;
}

export interface SessionMetricsInput {
  status: StudySessionStatusDTO;
  started_at: Date;
  ended_at: Date | null;
  planned_start: Date | null;
}

/** Trunca milissegundos para segundos inteiros sem drift de ponto flutuante. */
export function dateToSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

const EVENT_ORDER_WEIGHT: Record<SessionEventTypeDTO, number> = {
  BLOCK_START: 1,
  PAUSE: 2,
  RESUME: 2,
  DISTRACTION_START: 2,
  DISTRACTION_END: 2,
  DISTRACTION_DECLARED: 3,
  BLOCK_FINISH: 4,
  SESSION_FINISH: 5,
  SESSION_CANCEL: 5,
};

/** Ordena eventos por occurred_at e aplica desempate determinístico (D3). */
export function sortSessionEvents(events: ReadonlyArray<SessionEventDTO>): SessionEventDTO[] {
  return [...events].sort((a, b) => {
    const diff = a.occurred_at.getTime() - b.occurred_at.getTime();
    if (diff !== 0) return diff;
    return (EVENT_ORDER_WEIGHT[a.type] ?? 99) - (EVENT_ORDER_WEIGHT[b.type] ?? 99);
  });
}

/**
 * Deriva o estado de execução de um bloco a partir dos seus eventos.
 */
export function deriveBlockState(events: ReadonlyArray<SessionEventDTO>): BlockExecutionState {
  const sorted = sortSessionEvents(events);
  let state: BlockExecutionState = 'NOT_STARTED';

  for (const ev of sorted) {
    switch (ev.type) {
      case 'BLOCK_START':
        if (state === 'NOT_STARTED') state = 'STUDYING';
        break;
      case 'PAUSE':
        if (state === 'STUDYING') state = 'PAUSED';
        break;
      case 'RESUME':
        if (state === 'PAUSED' || state === 'DISTRACTED') state = 'STUDYING';
        break;
      case 'DISTRACTION_START':
        if (state === 'STUDYING') state = 'DISTRACTED';
        break;
      case 'DISTRACTION_END':
        if (state === 'DISTRACTED') state = 'STUDYING';
        break;
      case 'BLOCK_FINISH':
        if (state === 'STUDYING' || state === 'PAUSED' || state === 'DISTRACTED') {
          state = 'FINISHED';
        }
        break;
      case 'DISTRACTION_DECLARED':
      case 'SESSION_FINISH':
      case 'SESSION_CANCEL':
        // Não alteram a máquina de estados do bloco diretamente
        break;
    }
  }

  return state;
}

/**
 * Valida se uma transição manual ou finalização de bloco é válida a partir do estado atual.
 */
export function validateBlockTransition(
  events: ReadonlyArray<SessionEventDTO>,
  type: ManualEventType | 'BLOCK_FINISH'
): TransitionResult {
  const currentState = deriveBlockState(events);

  switch (type) {
    case 'PAUSE':
      if (currentState !== 'STUDYING') {
        return { ok: false, error: 'Só é possível pausar enquanto você está estudando.' };
      }
      return { ok: true };

    case 'RESUME':
      if (currentState !== 'PAUSED' && currentState !== 'DISTRACTED') {
        return { ok: false, error: 'Só é possível retomar se a etapa estiver pausada ou distraída.' };
      }
      return { ok: true };

    case 'DISTRACTION_START':
      if (currentState !== 'STUDYING') {
        return { ok: false, error: 'Só é possível registrar distração enquanto você está estudando.' };
      }
      return { ok: true };

    case 'DISTRACTION_END':
      if (currentState !== 'DISTRACTED') {
        return { ok: false, error: 'Só é possível encerrar distração se você estiver no estado distraído.' };
      }
      return { ok: true };

    case 'BLOCK_FINISH':
      if (currentState === 'NOT_STARTED' || currentState === 'FINISHED') {
        return { ok: false, error: 'Não é possível finalizar uma etapa que não está em andamento.' };
      }
      return { ok: true };
  }
}

/**
 * Calcula tempos totais, pausados, distraídos e efetivos em segundos para um bloco.
 */
export function calculateBlockTimes(
  events: ReadonlyArray<SessionEventDTO>,
  referenceNow: Date
): BlockTimes {
  const sorted = sortSessionEvents(events);
  const startEvent = sorted.find((e) => e.type === 'BLOCK_START');

  if (!startEvent) {
    return {
      totalSeconds: 0,
      pausedSeconds: 0,
      distractedRealtimeSeconds: 0,
      distractedDeclaredSeconds: 0,
      effectiveSeconds: 0,
    };
  }

  const startSec = dateToSeconds(startEvent.occurred_at);
  const finishEvent = sorted.find((e) => e.type === 'BLOCK_FINISH');
  const endSec = finishEvent ? dateToSeconds(finishEvent.occurred_at) : dateToSeconds(referenceNow);
  const totalSeconds = Math.max(0, endSec - startSec);

  let currentState: 'STUDYING' | 'PAUSED' | 'DISTRACTED' = 'STUDYING';
  let stateEnteredSec = startSec;
  let pausedSeconds = 0;
  let distractedRealtimeSeconds = 0;
  let distractedDeclaredSeconds = 0;

  for (const ev of sorted) {
    const evSec = Math.min(endSec, dateToSeconds(ev.occurred_at));
    if (evSec < startSec) continue;

    const delta = Math.max(0, evSec - stateEnteredSec);

    switch (ev.type) {
      case 'PAUSE':
        if (currentState === 'STUDYING') {
          stateEnteredSec = evSec;
          currentState = 'PAUSED';
        }
        break;

      case 'RESUME':
        if (currentState === 'PAUSED') {
          pausedSeconds += delta;
          stateEnteredSec = evSec;
          currentState = 'STUDYING';
        } else if (currentState === 'DISTRACTED') {
          distractedRealtimeSeconds += delta;
          stateEnteredSec = evSec;
          currentState = 'STUDYING';
        }
        break;

      case 'DISTRACTION_START':
        if (currentState === 'STUDYING') {
          stateEnteredSec = evSec;
          currentState = 'DISTRACTED';
        }
        break;

      case 'DISTRACTION_END':
        if (currentState === 'DISTRACTED') {
          distractedRealtimeSeconds += delta;
          stateEnteredSec = evSec;
          currentState = 'STUDYING';
        }
        break;

      case 'DISTRACTION_DECLARED':
        distractedDeclaredSeconds += Math.max(0, Math.floor(ev.declared_seconds ?? 0));
        break;

      case 'BLOCK_FINISH':
        if (currentState === 'PAUSED') {
          pausedSeconds += delta;
        } else if (currentState === 'DISTRACTED') {
          distractedRealtimeSeconds += delta;
        }
        currentState = 'STUDYING';
        stateEnteredSec = evSec;
        break;
    }

    if (ev.type === 'BLOCK_FINISH') {
      break;
    }
  }

  // Se o bloco ainda não foi encerrado com BLOCK_FINISH, fecha o intervalo aberto até endSec
  if (!finishEvent) {
    const remainingDelta = Math.max(0, endSec - stateEnteredSec);
    if (currentState === 'PAUSED') {
      pausedSeconds += remainingDelta;
    } else if (currentState === 'DISTRACTED') {
      distractedRealtimeSeconds += remainingDelta;
    }
  }

  const effectiveSeconds = Math.max(
    0,
    totalSeconds - pausedSeconds - distractedRealtimeSeconds - distractedDeclaredSeconds
  );

  return {
    totalSeconds,
    pausedSeconds,
    distractedRealtimeSeconds,
    distractedDeclaredSeconds,
    effectiveSeconds,
  };
}

/**
 * Valida a declaração de distração de uma etapa.
 */
export function validateDeclaredDistraction(
  events: ReadonlyArray<SessionEventDTO>,
  declaredSeconds: number,
  referenceNow: Date
): TransitionResult {
  if (!Number.isInteger(declaredSeconds) || declaredSeconds < 1) {
    return {
      ok: false,
      error: 'O tempo de distração deve ser um número inteiro de minutos maior ou igual a 1.',
    };
  }

  if (events.some((e) => e.type === 'DISTRACTION_DECLARED')) {
    return { ok: false, error: 'Esta etapa já possui uma distração declarada.' };
  }

  const times = calculateBlockTimes(events, referenceNow);
  const availableSeconds = times.totalSeconds - times.pausedSeconds - times.distractedRealtimeSeconds;

  if (declaredSeconds > availableSeconds) {
    return { ok: false, error: 'A distração declarada excede o tempo disponível da etapa.' };
  }

  return { ok: true };
}

/**
 * Detecta se uma etapa está incompleta (aviso visual).
 */
export function isBlockIncomplete(
  block: SessionBlockDTO,
  events: ReadonlyArray<SessionEventDTO>,
  sessionStatus: StudySessionStatusDTO,
  referenceNow: Date
): boolean {
  if (sessionStatus === 'CANCELLED') return false;

  const blockEvents = events.filter((e) => e.block_id === block.id);
  const state = deriveBlockState(blockEvents);
  if (state === 'NOT_STARTED') return false;

  const hasFinish = blockEvents.some((e) => e.type === 'BLOCK_FINISH');

  // Critério 1: sessão concluída, bloco iniciado mas sem término
  if (sessionStatus === 'FINISHED' && !hasFinish) {
    return true;
  }

  // Se já possui distração declarada, o critério 2 é obrigatoriamente false
  if (blockEvents.some((e) => e.type === 'DISTRACTION_DECLARED')) {
    return false;
  }

  // Critério 2: intervalo contínuo em STUDYING excede o limite configurado
  const threshold = Math.max(MAX_EVENT_GAP_MINUTES * 60, 2 * block.planned_minutes * 60);
  const sorted = sortSessionEvents(blockEvents);
  const finishEv = sorted.find((e) => e.type === 'BLOCK_FINISH');
  const endSec = finishEv ? dateToSeconds(finishEv.occurred_at) : dateToSeconds(referenceNow);

  let currentInStudy = false;
  let studyStartSec = 0;

  for (const ev of sorted) {
    const evSec = Math.min(endSec, dateToSeconds(ev.occurred_at));

    if (ev.type === 'BLOCK_START' || ev.type === 'RESUME' || ev.type === 'DISTRACTION_END') {
      currentInStudy = true;
      studyStartSec = evSec;
    } else if (ev.type === 'PAUSE' || ev.type === 'DISTRACTION_START' || ev.type === 'BLOCK_FINISH') {
      if (currentInStudy) {
        if (evSec - studyStartSec > threshold) {
          return true;
        }
        currentInStudy = false;
      }
    }
  }

  if (currentInStudy && endSec - studyStartSec > threshold) {
    return true;
  }

  return false;
}

/**
 * Encontra o bloco atualmente ativo da sessão (iniciado e ainda não finalizado).
 */
export function findActiveBlock(
  blocks: ReadonlyArray<SessionBlockDTO>,
  events: ReadonlyArray<SessionEventDTO>
): SessionBlockDTO | null {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);
  for (const b of sortedBlocks) {
    const bEvents = events.filter((e) => e.block_id === b.id);
    const state = deriveBlockState(bEvents);
    if (state !== 'NOT_STARTED' && state !== 'FINISHED') {
      return b;
    }
  }
  return null;
}

/**
 * Encontra o próximo bloco que ainda não foi iniciado.
 */
export function findNextBlock(
  blocks: ReadonlyArray<SessionBlockDTO>,
  events: ReadonlyArray<SessionEventDTO>
): SessionBlockDTO | null {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);
  for (const b of sortedBlocks) {
    const bEvents = events.filter((e) => e.block_id === b.id);
    const state = deriveBlockState(bEvents);
    if (state === 'NOT_STARTED') {
      return b;
    }
  }
  return null;
}

/**
 * Deriva o estado geral da sessão a partir dos seus eventos.
 */
export function deriveSessionState(
  sessionEvents: ReadonlyArray<SessionEventDTO>,
  _blocks?: ReadonlyArray<SessionBlockDTO>
): StudySessionStatusDTO {
  if (sessionEvents.some((e) => e.type === 'SESSION_CANCEL')) {
    return 'CANCELLED';
  }
  if (sessionEvents.some((e) => e.type === 'SESSION_FINISH')) {
    return 'FINISHED';
  }
  return 'IN_PROGRESS';
}

/**
 * Calcula o progresso percentual de uma etapa contra o planejado (0 a 100).
 */
export function calculateBlockProgress(effectiveSeconds: number, plannedMinutes: number): number {
  if (plannedMinutes <= 0) return 0;
  const plannedSeconds = plannedMinutes * 60;
  const progress = (effectiveSeconds / plannedSeconds) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Calcula todas as métricas consolidadas da sessão de estudo.
 */
export function calculateSessionMetrics(
  session: SessionMetricsInput,
  blocks: ReadonlyArray<SessionBlockDTO>,
  events: ReadonlyArray<SessionEventDTO>,
  referenceNow: Date
): SessionMetrics | null {
  if (session.status === 'CANCELLED') {
    return null;
  }

  // D4: para sessões finalizadas, não crescer métricas após ended_at
  const refNow = session.status === 'FINISHED' && session.ended_at ? session.ended_at : referenceNow;

  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position);
  const blockMetrics: BlockMetrics[] = [];

  let effectiveSum = 0;
  let totalSum = 0;
  let plannedSum = 0;

  for (const b of sortedBlocks) {
    const bEvents = events.filter((e) => e.block_id === b.id);
    const times = calculateBlockTimes(bEvents, refNow);
    const state = deriveBlockState(bEvents);
    const isIncomplete = isBlockIncomplete(b, bEvents, session.status, refNow);
    const plannedSec = b.planned_minutes * 60;

    effectiveSum += times.effectiveSeconds;
    totalSum += times.totalSeconds;
    plannedSum += plannedSec;

    blockMetrics.push({
      ...times,
      blockId: b.id,
      kind: b.kind,
      plannedSeconds: plannedSec,
      state,
      isIncomplete,
    });
  }

  const effectiveness = totalSum > 0 ? (effectiveSum / totalSum) * 100 : 0;
  const adherence = plannedSum > 0 ? (effectiveSum / plannedSum) * 100 : null;
  const delaySeconds = session.planned_start
    ? Math.round((session.started_at.getTime() - session.planned_start.getTime()) / 1000)
    : null;

  const activeBlock = findActiveBlock(blocks, events);

  return {
    effectiveSeconds: effectiveSum,
    totalSeconds: totalSum,
    plannedSeconds: plannedSum,
    effectiveness,
    adherence,
    delaySeconds,
    blocks: blockMetrics,
    activeBlockId: activeBlock ? activeBlock.id : null,
  };
}
