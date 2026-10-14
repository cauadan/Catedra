import { describe, it, expect } from 'vitest';
import {
  isValidLocalDate,
  isValidLocalDateTime,
  addDaysToLocalDate,
  localDateTimeToUtc,
  utcToLocalDate,
  utcToLocalTime,
  getDayWindowUtc,
  getWeekWindowUtc,
} from '../src/calendar';

const HORA = 60 * 60 * 1000;
const duracaoHoras = (w: { startUtc: Date; endUtc: Date }) =>
  (w.endUtc.getTime() - w.startUtc.getTime()) / HORA;

describe('isValidLocalDate', () => {
  it('aceita datas reais no formato YYYY-MM-DD', () => {
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
  });

  it('rejeita datas inexistentes no calendário', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-04-31')).toBe(false);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-00-10')).toBe(false);
  });

  it('rejeita formatos não estritos', () => {
    expect(isValidLocalDate('2026-2-3')).toBe(false);
    expect(isValidLocalDate('2026-02-03T10:00')).toBe(false);
    expect(isValidLocalDate(' 2026-02-03')).toBe(false);
    expect(isValidLocalDate('')).toBe(false);
  });
});

describe('isValidLocalDateTime', () => {
  it('aceita YYYY-MM-DDTHH:mm reais', () => {
    expect(isValidLocalDateTime('2026-02-28T23:59')).toBe(true);
    expect(isValidLocalDateTime('2026-01-01T00:00')).toBe(true);
  });

  it('rejeita datas e horas inexistentes', () => {
    expect(isValidLocalDateTime('2026-02-30T10:00')).toBe(false);
    expect(isValidLocalDateTime('2026-04-31T10:00')).toBe(false);
    expect(isValidLocalDateTime('2026-01-01T24:00')).toBe(false);
    expect(isValidLocalDateTime('2026-01-01T10:60')).toBe(false);
  });

  it('rejeita formatos não estritos (segundos, fuso, espaço)', () => {
    expect(isValidLocalDateTime('2026-01-01T10:00:00')).toBe(false);
    expect(isValidLocalDateTime('2026-01-01T10:00Z')).toBe(false);
    expect(isValidLocalDateTime('2026-01-01 10:00')).toBe(false);
    expect(isValidLocalDateTime('2026-01-01')).toBe(false);
  });
});

describe('addDaysToLocalDate', () => {
  it('vira o mês', () => {
    expect(addDaysToLocalDate('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('vira o ano para frente e para trás', () => {
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToLocalDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('respeita anos bissextos', () => {
    expect(addDaysToLocalDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToLocalDate('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('salta ±7 dias', () => {
    expect(addDaysToLocalDate('2026-03-02', 7)).toBe('2026-03-09');
    expect(addDaysToLocalDate('2026-03-02', -7)).toBe('2026-02-23');
  });

  it('não é afetado pelo DST de nenhum fuso (aritmética pura)', () => {
    expect(addDaysToLocalDate('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysToLocalDate('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysToLocalDate('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('lança erro para data inválida', () => {
    expect(() => addDaysToLocalDate('2026-02-30', 1)).toThrow();
  });
});

describe('America/Rio_Branco (UTC-5)', () => {
  const tz = 'America/Rio_Branco';

  it('23:30 local vira 04:30Z do dia seguinte', () => {
    expect(localDateTimeToUtc('2026-05-10T23:30', tz).toISOString()).toBe('2026-05-11T04:30:00.000Z');
  });

  it('sessão às 23:30 local cai na janela do dia local correto e fora do dia seguinte', () => {
    const inicio = localDateTimeToUtc('2026-05-10T23:30', tz);
    const dia = getDayWindowUtc('2026-05-10', tz);
    const seguinte = getDayWindowUtc('2026-05-11', tz);
    expect(inicio >= dia.startUtc && inicio < dia.endUtc).toBe(true);
    expect(inicio >= seguinte.startUtc && inicio < seguinte.endUtc).toBe(false);
    expect(utcToLocalDate(inicio, tz)).toBe('2026-05-10');
    expect(utcToLocalTime(inicio, tz)).toBe('23:30');
  });

  it('janela do dia é [05:00Z, 05:00Z do dia seguinte)', () => {
    const dia = getDayWindowUtc('2026-05-10', tz);
    expect(dia.startUtc.toISOString()).toBe('2026-05-10T05:00:00.000Z');
    expect(dia.endUtc.toISOString()).toBe('2026-05-11T05:00:00.000Z');
  });
});

describe('getWeekWindowUtc — virada de semana', () => {
  const tz = 'America/Rio_Branco';

  it('semana começa na segunda e lista 7 dias de seg a dom', () => {
    const semana = getWeekWindowUtc('2026-10-14', tz); // quarta-feira
    expect(semana.days).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
      '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    expect(semana.startUtc.toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(semana.endUtc.toISOString()).toBe('2026-10-19T05:00:00.000Z');
  });

  it('domingo 23:59 pertence à semana corrente; segunda 00:00 pertence à próxima', () => {
    const semana = getWeekWindowUtc('2026-10-18', tz); // domingo
    const domingo = localDateTimeToUtc('2026-10-18T23:59', tz);
    const segunda = localDateTimeToUtc('2026-10-19T00:00', tz);
    expect(domingo >= semana.startUtc && domingo < semana.endUtc).toBe(true);
    expect(segunda < semana.endUtc).toBe(false);
    expect(getWeekWindowUtc('2026-10-19', tz).startUtc.getTime()).toBe(segunda.getTime());
  });

  it('a partir de uma segunda-feira, a semana começa nela mesma', () => {
    expect(getWeekWindowUtc('2026-10-12', tz).days[0]).toBe('2026-10-12');
  });
});

describe('America/New_York — horário de verão (DST) 2026', () => {
  const tz = 'America/New_York';

  it('2026-03-08 (início do DST) tem 23 horas', () => {
    expect(duracaoHoras(getDayWindowUtc('2026-03-08', tz))).toBe(23);
  });

  it('semana de 2026-03-02 tem 167 horas', () => {
    expect(duracaoHoras(getWeekWindowUtc('2026-03-02', tz))).toBe(167);
  });

  it('2026-11-01 (fim do DST) tem 25 horas', () => {
    expect(duracaoHoras(getDayWindowUtc('2026-11-01', tz))).toBe(25);
  });

  it('semana de 2026-10-26 tem 169 horas', () => {
    expect(duracaoHoras(getWeekWindowUtc('2026-10-26', tz))).toBe(169);
  });

  it.each(['2026-03-02', '2026-10-26'])('dias da semana de %s são contíguos e cobrem exatamente a semana', (inicio) => {
    const semana = getWeekWindowUtc(inicio, tz);
    const dias = semana.days.map((d) => getDayWindowUtc(d, tz));
    expect(dias[0].startUtc.getTime()).toBe(semana.startUtc.getTime());
    expect(dias[6].endUtc.getTime()).toBe(semana.endUtc.getTime());
    for (let i = 0; i < 6; i++) {
      expect(dias[i].endUtc.getTime()).toBe(dias[i + 1].startUtc.getTime());
    }
  });

  /**
   * Horário inexistente: 02:30 de 2026-03-08 não existe em Nova York (02:00 → 03:00).
   * Política determinística (equivalente ao `disambiguation: 'compatible'` do Temporal):
   * aplica o offset ANTERIOR à transição (EST, UTC-5) → 07:30Z, exibido como 03:30 EDT.
   * Obs.: o `fromZonedTime` do date-fns-tz NÃO foi usado aqui porque seu resultado em DST
   * variava conforme o fuso do processo (detectado pelo `test:tz`).
   */
  it('horário inexistente 2026-03-08T02:30 avança para 07:30Z (03:30 EDT)', () => {
    const r = localDateTimeToUtc('2026-03-08T02:30', tz);
    expect(r.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(utcToLocalTime(r, tz)).toBe('03:30');
  });

  /**
   * Horário ambíguo: 01:30 de 2026-11-01 ocorre duas vezes (EDT e depois EST).
   * Política determinística: escolhe a PRIMEIRA ocorrência (EDT, UTC-4) → 05:30Z.
   */
  it('horário ambíguo 2026-11-01T01:30 resolve para a primeira ocorrência (05:30Z)', () => {
    const r = localDateTimeToUtc('2026-11-01T01:30', tz);
    expect(r.toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(utcToLocalDate(r, tz)).toBe('2026-11-01');
    expect(utcToLocalTime(r, tz)).toBe('01:30');
  });

  it('horários normais vizinhos à transição não são afetados', () => {
    expect(localDateTimeToUtc('2026-03-08T01:59', tz).toISOString()).toBe('2026-03-08T06:59:00.000Z');
    expect(localDateTimeToUtc('2026-03-08T03:00', tz).toISOString()).toBe('2026-03-08T07:00:00.000Z');
    expect(localDateTimeToUtc('2026-11-01T00:59', tz).toISOString()).toBe('2026-11-01T04:59:00.000Z');
    expect(localDateTimeToUtc('2026-11-01T02:00', tz).toISOString()).toBe('2026-11-01T07:00:00.000Z');
  });
});

describe('Fusos com offset fracionário e hemisfério sul', () => {
  it('Asia/Kolkata (UTC+5:30)', () => {
    expect(localDateTimeToUtc('2026-06-01T00:00', 'Asia/Kolkata').toISOString()).toBe('2026-05-31T18:30:00.000Z');
  });

  it('America/Sao_Paulo (UTC-3, sem horário de verão desde 2019)', () => {
    expect(localDateTimeToUtc('2026-12-15T10:00', 'America/Sao_Paulo').toISOString()).toBe('2026-12-15T13:00:00.000Z');
  });
});

describe('Validação de entrada das conversões', () => {
  it('localDateTimeToUtc lança erro para data/hora inválida', () => {
    expect(() => localDateTimeToUtc('2026-02-30T10:00', 'America/New_York')).toThrow();
  });

  it('getDayWindowUtc lança erro para data inválida', () => {
    expect(() => getDayWindowUtc('2026-04-31', 'America/New_York')).toThrow();
  });
});
