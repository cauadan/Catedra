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
  parseWeekStartsOn,
  getMonthWindowUtc,
  getRolling30DaysWindowUtc,
  normalizeGoalPeriodStart,
  getPreviousGoalPeriodStart,
  getGoalPeriodWindowUtc,
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

  it('suporta weekStartsOn = 0 (domingo)', () => {
    const semanaDom = getWeekWindowUtc('2026-10-14', tz, 0);
    expect(semanaDom.days).toEqual([
      '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
      '2026-10-15', '2026-10-16', '2026-10-17',
    ]);
    expect(semanaDom.startUtc.toISOString()).toBe('2026-10-11T05:00:00.000Z');
    expect(semanaDom.endUtc.toISOString()).toBe('2026-10-18T05:00:00.000Z');
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

  it('horário inexistente 2026-03-08T02:30 avança para 07:30Z (03:30 EDT)', () => {
    const r = localDateTimeToUtc('2026-03-08T02:30', tz);
    expect(r.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(utcToLocalTime(r, tz)).toBe('03:30');
  });

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

describe('parseWeekStartsOn', () => {
  it('converte SUNDAY ou 0 para 0 e MONDAY ou 1 (ou vazio) para 1', () => {
    expect(parseWeekStartsOn('SUNDAY')).toBe(0);
    expect(parseWeekStartsOn(0)).toBe(0);
    expect(parseWeekStartsOn('0')).toBe(0);
    expect(parseWeekStartsOn('MONDAY')).toBe(1);
    expect(parseWeekStartsOn(1)).toBe(1);
    expect(parseWeekStartsOn('1')).toBe(1);
    expect(parseWeekStartsOn(null)).toBe(1);
    expect(parseWeekStartsOn(undefined)).toBe(1);
  });
});

describe('getMonthWindowUtc', () => {
  const tz = 'America/Rio_Branco';

  it('calcula janela de mês civil normal e ano bissexto (fevereiro 2026 vs 2028)', () => {
    const fev2026 = getMonthWindowUtc('2026-02-15', tz);
    expect(fev2026.periodStartLocalDate).toBe('2026-02-01');
    expect(fev2026.startLocalDate).toBe('2026-02-01');
    expect(fev2026.endLocalDate).toBe('2026-02-28');
    expect(fev2026.days).toHaveLength(28);
    expect(fev2026.startUtc.toISOString()).toBe('2026-02-01T05:00:00.000Z');
    expect(fev2026.endUtc.toISOString()).toBe('2026-03-01T05:00:00.000Z');

    const fev2028 = getMonthWindowUtc('2028-02-15', tz);
    expect(fev2028.periodStartLocalDate).toBe('2028-02-01');
    expect(fev2028.startLocalDate).toBe('2028-02-01');
    expect(fev2028.endLocalDate).toBe('2028-02-29');
    expect(fev2028.days).toHaveLength(29);
    expect(fev2028.endUtc.toISOString()).toBe('2028-03-01T05:00:00.000Z');
  });

  it('sessão iniciada às 23:50 de 2026-10-31 em America/Rio_Branco (2026-11-01T04:50Z) pertence a outubro de 2026', () => {
    const out2026 = getMonthWindowUtc('2026-10-15', tz);
    const nov2026 = getMonthWindowUtc('2026-11-15', tz);
    const sessaoUtc = localDateTimeToUtc('2026-10-31T23:50', tz);
    expect(sessaoUtc.toISOString()).toBe('2026-11-01T04:50:00.000Z');
    expect(sessaoUtc >= out2026.startUtc && sessaoUtc < out2026.endUtc).toBe(true);
    expect(sessaoUtc >= nov2026.startUtc && sessaoUtc < nov2026.endUtc).toBe(false);
  });
});

describe('getRolling30DaysWindowUtc', () => {
  it('retorna janela de 30 dias corridos cruzando virada de ano [anchorDate - 29 dias, anchorDate]', () => {
    const w = getRolling30DaysWindowUtc('2027-01-10', 'America/Rio_Branco');
    expect(w.startLocalDate).toBe('2026-12-12');
    expect(w.endLocalDate).toBe('2027-01-10');
    expect(w.days).toHaveLength(30);
    expect(w.days[0]).toBe('2026-12-12');
    expect(w.days[29]).toBe('2027-01-10');
    expect(w.startUtc.toISOString()).toBe('2026-12-12T05:00:00.000Z');
    expect(w.endUtc.toISOString()).toBe('2027-01-11T05:00:00.000Z');
  });

  it('atravessa transição de DST em America/New_York mantendo exatamente 30 datas locais', () => {
    const w = getRolling30DaysWindowUtc('2026-11-10', 'America/New_York');
    expect(w.startLocalDate).toBe('2026-10-12');
    expect(w.endLocalDate).toBe('2026-11-10');
    expect(w.days).toHaveLength(30);
    expect(w.startUtc.toISOString()).toBe('2026-10-12T04:00:00.000Z'); // EDT (UTC-4)
    expect(w.endUtc.toISOString()).toBe('2026-11-11T05:00:00.000Z');   // EST (UTC-5)
  });
});

describe('normalizeGoalPeriodStart, getPreviousGoalPeriodStart e getGoalPeriodWindowUtc', () => {
  const tz = 'America/Rio_Branco';

  it('normaliza início do período para DAY, WEEK e MONTH', () => {
    expect(normalizeGoalPeriodStart('2026-10-30', 'DAY', 1)).toBe('2026-10-30');
    expect(normalizeGoalPeriodStart('2026-10-30', 'WEEK', 1)).toBe('2026-10-26');
    expect(normalizeGoalPeriodStart('2026-10-30', 'WEEK', 0)).toBe('2026-10-25');
    expect(normalizeGoalPeriodStart('2026-10-30', 'MONTH', 1)).toBe('2026-10-01');
  });

  it('calcula período imediatamente anterior para DAY (-1d), WEEK (-7d) e MONTH (mês civil anterior)', () => {
    expect(getPreviousGoalPeriodStart('2026-10-15', 'DAY', 1)).toBe('2026-10-14');
    expect(getPreviousGoalPeriodStart('2026-10-15', 'WEEK', 1)).toBe('2026-10-05');
    expect(getPreviousGoalPeriodStart('2026-10-15', 'MONTH', 1)).toBe('2026-09-01');
    expect(getPreviousGoalPeriodStart('2026-01-20', 'MONTH', 1)).toBe('2025-12-01');
  });

  it('retorna janela completa para WEEK cruzando virada de mês (2026-10-26 a 2026-11-01)', () => {
    const w = getGoalPeriodWindowUtc('2026-10-30', 'WEEK', tz, 1);
    expect(w.startLocalDate).toBe('2026-10-26');
    expect(w.endLocalDate).toBe('2026-11-01');
    expect(w.days).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
      '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
    expect(w.startUtc.toISOString()).toBe('2026-10-26T05:00:00.000Z');
    expect(w.endUtc.toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('retorna janela para DAY e MONTH', () => {
    const dayW = getGoalPeriodWindowUtc('2026-10-30', 'DAY', tz, 1);
    expect(dayW.startLocalDate).toBe('2026-10-30');
    expect(dayW.endLocalDate).toBe('2026-10-30');
    expect(dayW.days).toEqual(['2026-10-30']);

    const monthW = getGoalPeriodWindowUtc('2026-10-30', 'MONTH', tz, 1);
    expect(monthW.startLocalDate).toBe('2026-10-01');
    expect(monthW.endLocalDate).toBe('2026-10-31');
    expect(monthW.days).toHaveLength(31);
  });
});
