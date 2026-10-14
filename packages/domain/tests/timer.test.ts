import { describe, it, expect } from 'vitest';
import {
  deriveBlockState,
  validateBlockTransition,
  calculateBlockTimes,
  validateDeclaredDistraction,
  isBlockIncomplete,
  findActiveBlock,
  findNextBlock,
  calculateSessionMetrics,
  calculateBlockProgress,
  SessionEventDTO,
  SessionBlockDTO,
  SessionMetricsInput,
  MAX_EVENT_GAP_MINUTES,
} from '../src/timer.js';

function ev(
  type: SessionEventDTO['type'],
  timeStr: string,
  extra?: { block_id?: string | null; declared_seconds?: number }
): SessionEventDTO {
  return {
    type,
    block_id: extra?.block_id ?? 'b1',
    occurred_at: new Date(`2026-10-14T${timeStr}.000Z`),
    declared_seconds: extra?.declared_seconds,
  };
}

describe('Timer Domain Functions (@estudos/domain/timer)', () => {
  describe('deriveBlockState', () => {
    it('deve derivar NOT_STARTED para lista vazia de eventos', () => {
      expect(deriveBlockState([])).toBe('NOT_STARTED');
    });

    it('deve transitar para STUDYING após BLOCK_START', () => {
      expect(deriveBlockState([ev('BLOCK_START', '10:00:00')])).toBe('STUDYING');
    });

    it('deve transitar para PAUSED após PAUSE a partir de STUDYING', () => {
      expect(deriveBlockState([ev('BLOCK_START', '10:00:00'), ev('PAUSE', '10:05:00')])).toBe('PAUSED');
    });

    it('deve transitar para STUDYING após RESUME a partir de DISTRACTED', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('DISTRACTION_START', '10:05:00'),
        ev('RESUME', '10:10:00'),
      ];
      expect(deriveBlockState(events)).toBe('STUDYING');
    });

    it('deve transitar para FINISHED após BLOCK_FINISH a partir de PAUSED', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('PAUSE', '10:05:00'),
        ev('BLOCK_FINISH', '10:10:00'),
      ];
      expect(deriveBlockState(events)).toBe('FINISHED');
    });
  });

  describe('validateBlockTransition', () => {
    it('deve rejeitar PAUSE se a etapa já estiver PAUSED', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('PAUSE', '10:05:00')];
      const res = validateBlockTransition(events, 'PAUSE');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('Só é possível pausar enquanto você está estudando.');
    });

    it('deve rejeitar DISTRACTION_START se a etapa estiver PAUSED', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('PAUSE', '10:05:00')];
      const res = validateBlockTransition(events, 'DISTRACTION_START');
      expect(res.ok).toBe(false);
    });

    it('deve rejeitar DISTRACTION_END se a etapa estiver STUDYING', () => {
      const events = [ev('BLOCK_START', '10:00:00')];
      const res = validateBlockTransition(events, 'DISTRACTION_END');
      expect(res.ok).toBe(false);
    });

    it('deve permitir RESUME a partir de DISTRACTED', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('DISTRACTION_START', '10:05:00')];
      const res = validateBlockTransition(events, 'RESUME');
      expect(res.ok).toBe(true);
    });

    it('deve rejeitar BLOCK_FINISH se a etapa for NOT_STARTED', () => {
      const res = validateBlockTransition([], 'BLOCK_FINISH');
      expect(res.ok).toBe(false);
    });
  });

  describe('calculateBlockTimes', () => {
    it('deve calcular caso normal com BLOCK_FINISH (30 min)', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('BLOCK_FINISH', '10:30:00')];
      const times = calculateBlockTimes(events, new Date('2026-10-14T10:35:00.000Z'));
      expect(times.totalSeconds).toBe(1800);
      expect(times.pausedSeconds).toBe(0);
      expect(times.distractedRealtimeSeconds).toBe(0);
      expect(times.distractedDeclaredSeconds).toBe(0);
      expect(times.effectiveSeconds).toBe(1800);
    });

    it('deve calcular pausas múltiplas corretamente', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('PAUSE', '10:05:00'), // 5 min
        ev('RESUME', '10:07:00'), // +2 min paused
        ev('PAUSE', '10:10:00'), // 3 min
        ev('RESUME', '10:15:00'), // +5 min paused = 7 min = 420s
        ev('BLOCK_FINISH', '10:30:00'), // total 30 min = 1800s
      ];
      const times = calculateBlockTimes(events, new Date('2026-10-14T10:30:00.000Z'));
      expect(times.totalSeconds).toBe(1800);
      expect(times.pausedSeconds).toBe(420);
      expect(times.effectiveSeconds).toBe(1380);
    });

    it('deve calcular distração em tempo real encerrada por RESUME', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('DISTRACTION_START', '10:05:00'),
        ev('RESUME', '10:08:00'), // 3 min = 180s
        ev('BLOCK_FINISH', '10:30:00'),
      ];
      const times = calculateBlockTimes(events, new Date('2026-10-14T10:30:00.000Z'));
      expect(times.distractedRealtimeSeconds).toBe(180);
      expect(times.effectiveSeconds).toBe(1620);
    });

    it('deve calcular intervalo aberto baseado em referenceNow', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('PAUSE', '10:20:00')];
      const ref = new Date('2026-10-14T10:25:00.000Z');
      const times = calculateBlockTimes(events, ref);
      expect(times.totalSeconds).toBe(1500); // 25 min
      expect(times.pausedSeconds).toBe(300); // 5 min
      expect(times.effectiveSeconds).toBe(1200); // 20 min
    });

    it('deve subtrair distração declarada', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('DISTRACTION_DECLARED', '10:29:59', { declared_seconds: 600 }),
        ev('BLOCK_FINISH', '10:30:00'),
      ];
      const times = calculateBlockTimes(events, new Date('2026-10-14T10:30:00.000Z'));
      expect(times.totalSeconds).toBe(1800);
      expect(times.distractedDeclaredSeconds).toBe(600);
      expect(times.effectiveSeconds).toBe(1200);
    });

    it('deve retornar effectiveSeconds = 0 se distração for igual ao tempo total', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('DISTRACTION_DECLARED', '10:10:00', { declared_seconds: 600 }),
        ev('BLOCK_FINISH', '10:10:00'),
      ];
      const times = calculateBlockTimes(events, new Date('2026-10-14T10:10:00.000Z'));
      expect(times.effectiveSeconds).toBe(0);
    });

    it('deve truncar milissegundos inteiros sem drift', () => {
      const events = [
        {
          type: 'BLOCK_START' as const,
          block_id: 'b1',
          occurred_at: new Date('2026-10-14T10:00:00.900Z'),
        },
      ];
      const ref = new Date('2026-10-14T10:00:01.100Z');
      const times = calculateBlockTimes(events, ref);
      expect(times.totalSeconds).toBe(1);
    });
  });

  describe('validateDeclaredDistraction', () => {
    it('deve validar com sucesso distração menor ou igual ao tempo líquido', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('BLOCK_FINISH', '10:20:00')]; // 1200s
      const res = validateDeclaredDistraction(events, 1200, new Date('2026-10-14T10:20:00.000Z'));
      expect(res.ok).toBe(true);
    });

    it('deve rejeitar se a distração declarada exceder o tempo disponível', () => {
      const events = [ev('BLOCK_START', '10:00:00'), ev('BLOCK_FINISH', '10:20:00')]; // 1200s
      const res = validateDeclaredDistraction(events, 1260, new Date('2026-10-14T10:20:00.000Z'));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('A distração declarada excede o tempo disponível da etapa.');
      }
    });

    it('deve rejeitar mais de uma declaração por bloco', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('DISTRACTION_DECLARED', '10:15:00', { declared_seconds: 300 }),
      ];
      const res = validateDeclaredDistraction(events, 60, new Date('2026-10-14T10:20:00.000Z'));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('Esta etapa já possui uma distração declarada.');
      }
    });

    it('deve rejeitar segundos menores que 1 ou não inteiros', () => {
      const events = [ev('BLOCK_START', '10:00:00')];
      expect(validateDeclaredDistraction(events, 0, new Date()).ok).toBe(false);
      expect(validateDeclaredDistraction(events, -10, new Date()).ok).toBe(false);
      expect(validateDeclaredDistraction(events, 10.5, new Date()).ok).toBe(false);
    });
  });

  describe('isBlockIncomplete', () => {
    const block: SessionBlockDTO = {
      id: 'b1',
      kind: 'REVIEW',
      planned_minutes: 30,
      position: 1,
    };

    it('deve retornar false se sessionStatus for CANCELLED', () => {
      const events = [ev('BLOCK_START', '10:00:00')];
      expect(isBlockIncomplete(block, events, 'CANCELLED', new Date('2026-10-14T15:00:00Z'))).toBe(false);
    });

    it('deve retornar false se bloco for NOT_STARTED', () => {
      expect(isBlockIncomplete(block, [], 'IN_PROGRESS', new Date())).toBe(false);
    });

    it('deve retornar true se sessão FINISHED e bloco iniciado sem BLOCK_FINISH', () => {
      const events = [ev('BLOCK_START', '10:00:00')];
      expect(isBlockIncomplete(block, events, 'FINISHED', new Date('2026-10-14T10:30:00Z'))).toBe(true);
    });

    it('deve respeitar threshold max(120, 2*planned): planned 30 min -> threshold 120 min (7200s)', () => {
      const events = [ev('BLOCK_START', '10:00:00')];
      // 7200s = 2h exatamente (12:00:00) -> false
      const refExact = new Date('2026-10-14T12:00:00.000Z');
      expect(isBlockIncomplete(block, events, 'IN_PROGRESS', refExact)).toBe(false);

      // 7201s (12:00:01) -> true
      const refExceeded = new Date('2026-10-14T12:00:01.000Z');
      expect(isBlockIncomplete(block, events, 'IN_PROGRESS', refExceeded)).toBe(true);
    });

    it('deve respeitar threshold max(120, 2*planned): planned 90 min -> threshold 180 min (10800s)', () => {
      const longBlock: SessionBlockDTO = { ...block, planned_minutes: 90 };
      const events = [ev('BLOCK_START', '10:00:00')];
      // 12:01:00 (7260s) é menor que 10800s -> false
      const ref = new Date('2026-10-14T12:01:00.000Z');
      expect(isBlockIncomplete(longBlock, events, 'IN_PROGRESS', ref)).toBe(false);
    });

    it('deve retornar false para critério 2 se o bloco já possui DISTRACTION_DECLARED', () => {
      const events = [
        ev('BLOCK_START', '10:00:00'),
        ev('DISTRACTION_DECLARED', '13:00:00', { declared_seconds: 3600 }),
        ev('BLOCK_FINISH', '13:00:00'),
      ];
      // Mesmo com gap de 3h, já possui distração declarada
      const ref = new Date('2026-10-14T13:00:00.000Z');
      expect(isBlockIncomplete(block, events, 'FINISHED', ref)).toBe(false);
    });
  });

  describe('findActiveBlock e findNextBlock', () => {
    const blocks: SessionBlockDTO[] = [
      { id: 'b1', kind: 'REVIEW', planned_minutes: 15, position: 1 },
      { id: 'b2', kind: 'NEW_CONTENT', planned_minutes: 30, position: 2 },
      { id: 'b3', kind: 'PRACTICE', planned_minutes: 15, position: 3 },
    ];

    it('deve encontrar o bloco ativo e o próximo bloco corretamente', () => {
      // b1 finalizado, b2 iniciado e em andamento, b3 não iniciado
      const events = [
        ev('BLOCK_START', '10:00:00', { block_id: 'b1' }),
        ev('BLOCK_FINISH', '10:15:00', { block_id: 'b1' }),
        ev('BLOCK_START', '10:15:00', { block_id: 'b2' }),
      ];
      expect(findActiveBlock(blocks, events)?.id).toBe('b2');
      expect(findNextBlock(blocks, events)?.id).toBe('b3');
    });

    it('deve retornar null se todos os blocos estiverem finalizados', () => {
      const events = [
        ev('BLOCK_START', '10:00:00', { block_id: 'b1' }),
        ev('BLOCK_FINISH', '10:15:00', { block_id: 'b1' }),
      ];
      const singleBlockList = [blocks[0]];
      expect(findActiveBlock(singleBlockList, events)).toBeNull();
      expect(findNextBlock(singleBlockList, events)).toBeNull();
    });
  });

  describe('calculateSessionMetrics', () => {
    const blocks: SessionBlockDTO[] = [
      { id: 'b1', kind: 'REVIEW', planned_minutes: 30, position: 1 },
      { id: 'b2', kind: 'PRACTICE', planned_minutes: 30, position: 2 },
    ];

    it('deve retornar null se status for CANCELLED', () => {
      const session: SessionMetricsInput = {
        status: 'CANCELLED',
        started_at: new Date('2026-10-14T10:00:00Z'),
        ended_at: new Date('2026-10-14T10:20:00Z'),
        planned_start: null,
      };
      expect(calculateSessionMetrics(session, blocks, [], new Date())).toBeNull();
    });

    it('deve calcular métricas consolidadas com efetividade e aderência exatas', () => {
      const session: SessionMetricsInput = {
        status: 'IN_PROGRESS',
        started_at: new Date('2026-10-14T10:00:00Z'),
        ended_at: null,
        planned_start: new Date('2026-10-14T09:56:40Z'), // 200 segundos de atraso
      };
      const events = [
        ev('BLOCK_START', '10:00:00', { block_id: 'b1' }),
        ev('PAUSE', '10:20:00', { block_id: 'b1' }), // 20 min estudando
        ev('BLOCK_FINISH', '10:25:00', { block_id: 'b1' }), // 5 min pausa, 25 min total (1500s total, 1200s efetivo)
        ev('BLOCK_START', '10:25:00', { block_id: 'b2' }),
        ev('BLOCK_FINISH', '10:50:00', { block_id: 'b2' }), // 25 min total (1500s total, 1500s efetivo)
      ];
      const metrics = calculateSessionMetrics(session, blocks, events, new Date('2026-10-14T10:50:00Z'));
      expect(metrics).not.toBeNull();
      expect(metrics!.totalSeconds).toBe(3000); // 50 min
      expect(metrics!.effectiveSeconds).toBe(2700); // 45 min
      expect(metrics!.plannedSeconds).toBe(3600); // 60 min
      expect(metrics!.effectiveness).toBe(90); // 2700 / 3000 * 100
      expect(metrics!.adherence).toBe(75); // 2700 / 3600 * 100
      expect(metrics!.delaySeconds).toBe(200);
    });

    it('deve não crescer métricas em sessão FINISHED se referenceNow for posterior (D4)', () => {
      const session: SessionMetricsInput = {
        status: 'FINISHED',
        started_at: new Date('2026-10-14T10:00:00Z'),
        ended_at: new Date('2026-10-14T10:30:00Z'),
        planned_start: null,
      };
      const events = [ev('BLOCK_START', '10:00:00', { block_id: 'b1' }), ev('BLOCK_FINISH', '10:30:00', { block_id: 'b1' })];
      const metricsPast = calculateSessionMetrics(session, [blocks[0]], events, new Date('2026-10-14T10:30:00Z'));
      const metricsFuture = calculateSessionMetrics(session, [blocks[0]], events, new Date('2026-10-14T15:00:00Z'));
      expect(metricsFuture!.totalSeconds).toBe(metricsPast!.totalSeconds);
      expect(metricsFuture!.effectiveSeconds).toBe(metricsPast!.effectiveSeconds);
    });
  });

  describe('calculateBlockProgress', () => {
    it('deve calcular progresso de 0 a 100', () => {
      expect(calculateBlockProgress(900, 30)).toBe(50);
      expect(calculateBlockProgress(1800, 30)).toBe(100);
      expect(calculateBlockProgress(2000, 30)).toBe(100);
      expect(calculateBlockProgress(0, 30)).toBe(0);
      expect(calculateBlockProgress(100, 0)).toBe(0);
    });
  });
});
