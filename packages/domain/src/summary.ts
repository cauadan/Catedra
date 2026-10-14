/**
 * Resumo do período e detecção de sobreposição de sessões planejadas (Fase 3).
 * Funções puras — sem dependências de I/O ou banco de dados.
 */

import { type BlockKindDTO, type PlannedSessionStatusDTO } from './planning.js';

export interface PlannedSessionSummaryBlock {
  kind: BlockKindDTO;
  planned_minutes: number;
}

export interface PlannedSessionSummaryItem {
  id: string;
  status: PlannedSessionStatusDTO;
  planned_minutes: number;
  blocks?: PlannedSessionSummaryBlock[];
}

export interface PlannedPeriodSummary {
  totalPlannedMinutes: number;
  plannedCount: number;
  doneCount: number;
  activeAndDoneCount: number;
  minutesByKind: Record<BlockKindDTO, number>;
}

export interface PlannedSessionIntervalItem {
  id: string;
  status: PlannedSessionStatusDTO;
  scheduled_start: Date | string;
  planned_minutes: number;
}

/**
 * Consolida o resumo quantitativo de um conjunto de sessões planejadas para o período exibido.
 * Considera apenas sessões com status `PLANNED` e `DONE` (`SKIPPED` e `RESCHEDULED` são ignoradas).
 */
export function summarizePlannedSessions(
  sessions: ReadonlyArray<PlannedSessionSummaryItem>
): PlannedPeriodSummary {
  let totalPlannedMinutes = 0;
  let plannedCount = 0;
  let doneCount = 0;
  const minutesByKind: Record<BlockKindDTO, number> = {
    REVIEW: 0,
    NEW_CONTENT: 0,
    PRACTICE: 0,
  };

  for (const session of sessions) {
    if (session.status !== 'PLANNED' && session.status !== 'DONE') {
      continue;
    }

    totalPlannedMinutes += session.planned_minutes;

    if (session.status === 'PLANNED') {
      plannedCount++;
    } else if (session.status === 'DONE') {
      doneCount++;
    }

    if (session.blocks && Array.isArray(session.blocks)) {
      for (const block of session.blocks) {
        if (block.kind in minutesByKind) {
          minutesByKind[block.kind] += block.planned_minutes;
        }
      }
    }
  }

  return {
    totalPlannedMinutes,
    plannedCount,
    doneCount,
    activeAndDoneCount: plannedCount + doneCount,
    minutesByKind,
  };
}

/**
 * Identifica conflitos de horários em uma lista de sessões planejadas.
 * - Avalia exclusivamente sessões com `status === 'PLANNED'`.
 * - Cada sessão ocupa o intervalo semiaberto `[scheduled_start, scheduled_start + planned_minutes)`.
 * - Sessões adjacentes (onde o fim de A é exatamente igual ao início de B) NÃO conflitam.
 *
 * @returns Set com os IDs de todas as sessões que possuem ao menos uma sobreposição.
 */
export function findOverlappingSessionIds(
  sessions: ReadonlyArray<PlannedSessionIntervalItem>
): Set<string> {
  const plannedSessions = sessions
    .filter((s) => s.status === 'PLANNED' && s.planned_minutes > 0)
    .map((s) => {
      const startMs =
        typeof s.scheduled_start === 'string'
          ? new Date(s.scheduled_start).getTime()
          : s.scheduled_start.getTime();
      const endMs = startMs + s.planned_minutes * 60 * 1000;
      return { id: s.id, startMs, endMs };
    });

  const overlappingIds = new Set<string>();

  for (let i = 0; i < plannedSessions.length; i++) {
    const a = plannedSessions[i];
    for (let j = i + 1; j < plannedSessions.length; j++) {
      const b = plannedSessions[j];
      // Intervalos semiabertos [startA, endA) e [startB, endB) se sobrepõem se e somente se:
      // startA < endB && startB < endA
      if (a.startMs < b.endMs && b.startMs < a.endMs) {
        overlappingIds.add(a.id);
        overlappingIds.add(b.id);
      }
    }
  }

  return overlappingIds;
}
