import { describe, it, expect } from 'vitest';
import { formatDuration, formatPercent } from '../src/lib/format';
import { computeClockOffsetMs } from '../src/lib/study-session-api';

describe('Formatters and Time Utilities (@estudos/web)', () => {
  it('formatPercent: null ou undefined retorna "–" e valores numéricos retornam com 1 casa decimal', () => {
    expect(formatPercent(null)).toBe('–');
    expect(formatPercent(undefined as any)).toBe('–');
    expect(formatPercent(100 / 3)).toBe('33.3%');
    expect(formatPercent(100)).toBe('100.0%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(50)).toBe('50.0%');
    expect(formatPercent(75.56)).toBe('75.6%');
  });

  it('formatDuration: formata segundos para MM:SS ou H:MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(5)).toBe('00:05');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3599)).toBe('59:59');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(7325)).toBe('2:02:05');
  });

  it('computeClockOffsetMs: calcula a diferença entre o relógio do servidor e o do cliente', () => {
    const serverIso = '2026-10-14T10:00:05.000Z';
    const clientNow = Date.parse('2026-10-14T10:00:00.000Z');
    expect(computeClockOffsetMs(serverIso, clientNow)).toBe(5000);

    const clientAhead = Date.parse('2026-10-14T10:00:08.000Z');
    expect(computeClockOffsetMs(serverIso, clientAhead)).toBe(-3000);
  });
});
