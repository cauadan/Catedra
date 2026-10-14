import { describe, it, expect } from 'vitest';

/**
 * Teste de sanidade do script `npm run test:tz`.
 * No `npm test` padrão ele apenas confirma que o relógio funciona; sob `test:tz`
 * (TZ_TEST=1) ele exige que o processo esteja de fato em Asia/Tokyo (UTC+9).
 */
describe('Sanidade de configuração de fuso horário (test:tz)', () => {
  it('confirma Asia/Tokyo (offset -540) quando executado via test:tz', () => {
    if (process.env.TZ_TEST === '1') {
      expect(new Date().getTimezoneOffset()).toBe(-540);
    } else {
      expect(Number.isInteger(new Date().getTimezoneOffset())).toBe(true);
    }
  });
});
