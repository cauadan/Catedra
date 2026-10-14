import { describe, it, expect } from 'vitest';
import {
  summarizePlannedSessions,
  findOverlappingSessionIds,
  type PlannedSessionSummaryItem,
  type PlannedSessionIntervalItem,
} from '../src/summary';

describe('summarizePlannedSessions', () => {
  it('retorna zeros e contagens vazias para lista vazia', () => {
    const summary = summarizePlannedSessions([]);
    expect(summary).toEqual({
      totalPlannedMinutes: 0,
      plannedCount: 0,
      doneCount: 0,
      activeAndDoneCount: 0,
      minutesByKind: {
        REVIEW: 0,
        NEW_CONTENT: 0,
        PRACTICE: 0,
      },
    });
  });

  it('soma apenas sessões PLANNED e DONE, ignorando SKIPPED e RESCHEDULED', () => {
    const sessions: PlannedSessionSummaryItem[] = [
      {
        id: '1',
        status: 'PLANNED',
        planned_minutes: 60,
        blocks: [
          { kind: 'REVIEW', planned_minutes: 15 },
          { kind: 'NEW_CONTENT', planned_minutes: 30 },
          { kind: 'PRACTICE', planned_minutes: 15 },
        ],
      },
      {
        id: '2',
        status: 'DONE',
        planned_minutes: 45,
        blocks: [
          { kind: 'REVIEW', planned_minutes: 10 },
          { kind: 'PRACTICE', planned_minutes: 35 },
        ],
      },
      {
        id: '3',
        status: 'SKIPPED',
        planned_minutes: 90,
        blocks: [
          { kind: 'NEW_CONTENT', planned_minutes: 90 },
        ],
      },
      {
        id: '4',
        status: 'RESCHEDULED',
        planned_minutes: 30,
        blocks: [
          { kind: 'REVIEW', planned_minutes: 30 },
        ],
      },
    ];

    const summary = summarizePlannedSessions(sessions);
    expect(summary.totalPlannedMinutes).toBe(105); // 60 + 45
    expect(summary.plannedCount).toBe(1);
    expect(summary.doneCount).toBe(1);
    expect(summary.activeAndDoneCount).toBe(2);
    expect(summary.minutesByKind).toEqual({
      REVIEW: 25, // 15 + 10
      NEW_CONTENT: 30, // 30
      PRACTICE: 50, // 15 + 35
    });
  });

  it('lida com sessões sem blocos ou blocos vazios sem erro', () => {
    const sessions: PlannedSessionSummaryItem[] = [
      {
        id: '1',
        status: 'PLANNED',
        planned_minutes: 30,
        blocks: [],
      },
    ];
    const summary = summarizePlannedSessions(sessions);
    expect(summary.totalPlannedMinutes).toBe(30);
    expect(summary.plannedCount).toBe(1);
    expect(summary.doneCount).toBe(0);
    expect(summary.activeAndDoneCount).toBe(1);
    expect(summary.minutesByKind).toEqual({
      REVIEW: 0,
      NEW_CONTENT: 0,
      PRACTICE: 0,
    });
  });
});

describe('findOverlappingSessionIds', () => {
  it('retorna Set vazio quando não há sessões ou apenas 1 sessão', () => {
    expect(findOverlappingSessionIds([])).toEqual(new Set());
    expect(
      findOverlappingSessionIds([
        {
          id: '1',
          status: 'PLANNED',
          scheduled_start: new Date('2026-10-14T10:00:00.000Z'),
          planned_minutes: 60,
        },
      ])
    ).toEqual(new Set());
  });

  it('sessões adjacentes (fim de A === início de B) NÃO conflitam', () => {
    const sessions: PlannedSessionIntervalItem[] = [
      {
        id: '1',
        status: 'PLANNED',
        scheduled_start: new Date('2026-10-14T10:00:00.000Z'),
        planned_minutes: 60, // 10:00 até 11:00
      },
      {
        id: '2',
        status: 'PLANNED',
        scheduled_start: new Date('2026-10-14T11:00:00.000Z'),
        planned_minutes: 60, // 11:00 até 12:00
      },
    ];
    expect(findOverlappingSessionIds(sessions)).toEqual(new Set());
  });

  it('detecta sobreposição com intervalo semiaberto [inicio, inicio + duracao)', () => {
    const sessions: PlannedSessionIntervalItem[] = [
      {
        id: '1',
        status: 'PLANNED',
        scheduled_start: new Date('2026-10-14T10:00:00.000Z'),
        planned_minutes: 60, // 10:00 até 11:00
      },
      {
        id: '2',
        status: 'PLANNED',
        scheduled_start: new Date('2026-10-14T10:30:00.000Z'),
        planned_minutes: 60, // 10:30 até 11:30 -> Conflito com 1
      },
      {
        id: '3',
        status: 'PLANNED',
        scheduled_start: new Date('2026-10-14T12:00:00.000Z'),
        planned_minutes: 60, // 12:00 até 13:00 -> Sem conflito
      },
    ];
    const overlapping = findOverlappingSessionIds(sessions);
    expect(overlapping).toEqual(new Set(['1', '2']));
  });

  it('avalia APENAS sessões com status === PLANNED (ignora DONE, SKIPPED, RESCHEDULED)', () => {
    const sessions: PlannedSessionIntervalItem[] = [
      {
        id: '1',
        status: 'PLANNED',
        scheduled_start: new Date('2026-10-14T10:00:00.000Z'),
        planned_minutes: 60,
      },
      {
        id: '2',
        status: 'SKIPPED',
        scheduled_start: new Date('2026-10-14T10:15:00.000Z'),
        planned_minutes: 60, // Sobrepõe no tempo, mas está SKIPPED
      },
      {
        id: '3',
        status: 'RESCHEDULED',
        scheduled_start: new Date('2026-10-14T10:30:00.000Z'),
        planned_minutes: 60, // Sobrepõe no tempo, mas está RESCHEDULED
      },
      {
        id: '4',
        status: 'DONE',
        scheduled_start: new Date('2026-10-14T10:45:00.000Z'),
        planned_minutes: 60, // Sobrepõe no tempo, mas está DONE
      },
    ];
    expect(findOverlappingSessionIds(sessions)).toEqual(new Set());
  });

  it('aceita scheduled_start tanto como Date quanto como string ISO', () => {
    const sessions: PlannedSessionIntervalItem[] = [
      {
        id: 'a',
        status: 'PLANNED',
        scheduled_start: '2026-10-14T14:00:00.000Z',
        planned_minutes: 90, // 14:00 às 15:30
      },
      {
        id: 'b',
        status: 'PLANNED',
        scheduled_start: '2026-10-14T15:00:00.000Z',
        planned_minutes: 60, // 15:00 às 16:00 -> conflito com a
      },
    ];
    expect(findOverlappingSessionIds(sessions)).toEqual(new Set(['a', 'b']));
  });
});
