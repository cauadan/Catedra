/**
 * Aritmética de calendário e conversões de fuso horário — funções puras.
 *
 * REGRA DE OURO: nenhuma função aqui depende do fuso do processo/servidor ou do navegador.
 * - Datas locais (`YYYY-MM-DD`) são manipuladas com aritmética pura via `Date.UTC`.
 * - Conversões local ↔ UTC recebem SEMPRE o `timezone` IANA explícito e usam `date-fns-tz`
 *   com entrada em string (nunca com `Date` construído no fuso local da máquina).
 */

import { formatInTimeZone } from 'date-fns-tz';

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DIA_MS = 24 * 60 * 60 * 1000;

export type GoalPeriod = 'DAY' | 'WEEK' | 'MONTH';

function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Valida formato estrito `YYYY-MM-DD` e existência real no calendário. */
export function isValidLocalDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(dateStr);
  if (!m) return false;
  return isRealCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Valida formato estrito `YYYY-MM-DDTHH:mm` (sem segundos e sem fuso) e existência real. */
export function isValidLocalDateTime(dateTimeStr: string): boolean {
  if (typeof dateTimeStr !== 'string') return false;
  const m = LOCAL_DATE_TIME_RE.exec(dateTimeStr);
  if (!m) return false;
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  if (hh > 23 || mm > 59) return false;
  return isRealCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

function assertLocalDate(localDate: string): void {
  if (!isValidLocalDate(localDate)) {
    throw new RangeError(`Data local inválida: "${localDate}". Use o formato YYYY-MM-DD com uma data real.`);
  }
}

/** Soma (ou subtrai) dias de uma data `YYYY-MM-DD` com aritmética pura de calendário. */
export function addDaysToLocalDate(localDate: string, days: number): string {
  assertLocalDate(localDate);
  if (!Number.isInteger(days)) {
    throw new RangeError('A quantidade de dias deve ser um número inteiro.');
  }
  const [y, m, d] = localDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * DIA_MS);
  return dt.toISOString().slice(0, 10);
}

/** Dia da semana de uma data local (0 = domingo … 6 = sábado), independente de fuso. */
function localDateWeekday(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Converte a configuração de início de semana do usuário (`'MONDAY'`, `'SUNDAY'`, `1`, `0`)
 * para o formato numérico (`1` = segunda-feira, `0` = domingo). Padrão: `1` (segunda-feira).
 */
export function parseWeekStartsOn(value?: string | number | null): 0 | 1 {
  if (value === 0 || value === '0' || value === 'SUNDAY') {
    return 0;
  }
  return 1;
}

/**
 * Offset (ms) do `timezone` no instante `instantMs`: (horário de parede como se fosse UTC) − instante.
 * Usa apenas `Intl.DateTimeFormat` com `timeZone` explícito — não depende do fuso do processo.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getTimezoneOffsetMs(timezone: string, instantMs: number): number {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timezone, fmt);
  }
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Converte `YYYY-MM-DDTHH:mm` (horário de parede no `timezone`) para um instante UTC.
 */
export function localDateTimeToUtc(localIsoWithoutTz: string, timezone: string): Date {
  if (!isValidLocalDateTime(localIsoWithoutTz)) {
    throw new RangeError(
      `Data/hora local inválida: "${localIsoWithoutTz}". Use o formato YYYY-MM-DDTHH:mm com uma data real.`
    );
  }
  const [datePart, timePart] = localIsoWithoutTz.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [hh, mi] = timePart.split(':').map(Number);
  const wallMs = Date.UTC(y, mo - 1, d, hh, mi);

  let offsetBefore: number;
  let offsetAfter: number;
  try {
    offsetBefore = getTimezoneOffsetMs(timezone, wallMs - DIA_MS);
    offsetAfter = getTimezoneOffsetMs(timezone, wallMs + DIA_MS);
  } catch {
    throw new RangeError(`Fuso horário inválido: "${timezone}".`);
  }

  const candidates = [wallMs - offsetBefore, wallMs - offsetAfter].filter(
    (t) => t + getTimezoneOffsetMs(timezone, t) === wallMs
  );
  if (candidates.length > 0) {
    return new Date(Math.min(...candidates));
  }
  return new Date(wallMs - offsetBefore);
}

/** Converte um instante UTC para a data local `YYYY-MM-DD` no `timezone`. */
export function utcToLocalDate(utcDate: Date, timezone: string): string {
  return formatInTimeZone(utcDate, timezone, 'yyyy-MM-dd');
}

/** Converte um instante UTC para o horário local `HH:mm` no `timezone`. */
export function utcToLocalTime(utcDate: Date, timezone: string): string {
  return formatInTimeZone(utcDate, timezone, 'HH:mm');
}

/** Janela semiaberta `[startUtc, endUtc)` do dia local `localDate` no `timezone`. */
export function getDayWindowUtc(localDate: string, timezone: string): { startUtc: Date; endUtc: Date } {
  assertLocalDate(localDate);
  return {
    startUtc: localDateTimeToUtc(`${localDate}T00:00`, timezone),
    endUtc: localDateTimeToUtc(`${addDaysToLocalDate(localDate, 1)}T00:00`, timezone),
  };
}

/**
 * Janela semiaberta `[startUtc, endUtc)` da semana local que contém `localDate`,
 * e os 7 dias `YYYY-MM-DD`.
 * `weekStartsOn` aceita `1` (segunda-feira, padrão) ou `0` (domingo).
 */
export function getWeekWindowUtc(
  localDate: string,
  timezone: string,
  weekStartsOn: number = 1
): { startUtc: Date; endUtc: Date; days: string[] } {
  assertLocalDate(localDate);
  if (weekStartsOn !== 1 && weekStartsOn !== 0) {
    throw new RangeError('Apenas semanas iniciando na segunda-feira (1) ou no domingo (0) são suportadas.');
  }
  const weekday = localDateWeekday(localDate);
  const offsetToStart = weekStartsOn === 1 ? (weekday + 6) % 7 : weekday;
  const startDay = addDaysToLocalDate(localDate, -offsetToStart);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToLocalDate(startDay, i));
  return {
    startUtc: localDateTimeToUtc(`${startDay}T00:00`, timezone),
    endUtc: localDateTimeToUtc(`${addDaysToLocalDate(startDay, 7)}T00:00`, timezone),
    days,
  };
}

/**
 * Janela semiaberta `[startUtc, endUtc)` do mês civil local que contém `localDate`.
 */
export function getMonthWindowUtc(
  localDate: string,
  timezone: string
): {
  startUtc: Date;
  endUtc: Date;
  periodStartLocalDate: string;
  startLocalDate: string;
  endLocalDate: string;
  daysCount: number;
  days: string[];
} {
  assertLocalDate(localDate);
  const [y, m] = localDate.split('-').map(Number);
  const startLocalDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const lastDayDate = new Date(Date.UTC(y, m, 0));
  const daysCount = lastDayDate.getUTCDate();
  const endLocalDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(daysCount).padStart(2, '0')}`;
  const days = Array.from({ length: daysCount }, (_, i) => addDaysToLocalDate(startLocalDate, i));
  const nextMonthStartLocalDate = addDaysToLocalDate(endLocalDate, 1);

  return {
    startUtc: localDateTimeToUtc(`${startLocalDate}T00:00`, timezone),
    endUtc: localDateTimeToUtc(`${nextMonthStartLocalDate}T00:00`, timezone),
    periodStartLocalDate: startLocalDate,
    startLocalDate,
    endLocalDate,
    daysCount,
    days,
  };
}

/**
 * Janela semiaberta `[startUtc, endUtc)` dos últimos 30 dias corridos ancorados em `referenceLocalDate`:
 * de `[referenceLocalDate - 29 dias, referenceLocalDate]` (inclusive, totalizando 30 dias).
 */
export function getRolling30DaysWindowUtc(
  referenceLocalDate: string,
  timezone: string
): {
  startUtc: Date;
  endUtc: Date;
  startLocalDate: string;
  endLocalDate: string;
  daysCount: 30;
  days: string[];
} {
  assertLocalDate(referenceLocalDate);
  const startLocalDate = addDaysToLocalDate(referenceLocalDate, -29);
  const endLocalDate = referenceLocalDate;
  const days = Array.from({ length: 30 }, (_, i) => addDaysToLocalDate(startLocalDate, i));
  const dayAfterEnd = addDaysToLocalDate(endLocalDate, 1);

  return {
    startUtc: localDateTimeToUtc(`${startLocalDate}T00:00`, timezone),
    endUtc: localDateTimeToUtc(`${dayAfterEnd}T00:00`, timezone),
    startLocalDate,
    endLocalDate,
    daysCount: 30,
    days,
  };
}

/**
 * Normaliza qualquer data local `YYYY-MM-DD` para a data de início oficial do período da meta:
 * - `DAY`: a própria `localDate`;
 * - `WEEK`: o primeiro dia da semana (segunda-feira se `weekStartsOn === 1`, domingo se `0`) que contém `localDate`;
 * - `MONTH`: o dia `YYYY-MM-01` do mês de `localDate`.
 */
export function normalizeGoalPeriodStart(
  localDate: string,
  period: GoalPeriod,
  weekStartsOn: number = 1
): string {
  assertLocalDate(localDate);
  if (period === 'DAY') {
    return localDate;
  }
  if (period === 'WEEK') {
    if (weekStartsOn !== 1 && weekStartsOn !== 0) {
      throw new RangeError('Apenas semanas iniciando na segunda-feira (1) ou no domingo (0) são suportadas.');
    }
    const weekday = localDateWeekday(localDate);
    const offsetToStart = weekStartsOn === 1 ? (weekday + 6) % 7 : weekday;
    return addDaysToLocalDate(localDate, -offsetToStart);
  }
  if (period === 'MONTH') {
    return `${localDate.slice(0, 7)}-01`;
  }
  throw new RangeError(`Período de meta inválido: "${String(period)}".`);
}

/**
 * Retorna o `period_start_local_date` normalizado do período imediatamente anterior:
 * - `DAY`: `-1` dia;
 * - `WEEK`: `-7` dias a partir do início normalizado da semana;
 * - `MONTH`: dia `01` do mês civil anterior.
 */
export function getPreviousGoalPeriodStart(
  periodStartLocalDate: string,
  period: GoalPeriod,
  weekStartsOn: number = 1
): string {
  const normalized = normalizeGoalPeriodStart(periodStartLocalDate, period, weekStartsOn);
  if (period === 'DAY') {
    return addDaysToLocalDate(normalized, -1);
  }
  if (period === 'WEEK') {
    return addDaysToLocalDate(normalized, -7);
  }
  const lastDayPrevMonth = addDaysToLocalDate(normalized, -1);
  return `${lastDayPrevMonth.slice(0, 7)}-01`;
}

/**
 * Calcula a janela semiaberta `[startUtc, endUtc)` e os dias locais para um período de meta (`DAY`, `WEEK`, `MONTH`).
 */
export function getGoalPeriodWindowUtc(
  periodStartLocalDate: string,
  period: GoalPeriod,
  timezone: string,
  weekStartsOn: number = 1
): {
  startUtc: Date;
  endUtc: Date;
  startLocalDate: string;
  endLocalDate: string;
  daysCount: number;
  days: string[];
} {
  const normalizedStart = normalizeGoalPeriodStart(periodStartLocalDate, period, weekStartsOn);
  if (period === 'DAY') {
    const w = getDayWindowUtc(normalizedStart, timezone);
    return {
      startUtc: w.startUtc,
      endUtc: w.endUtc,
      startLocalDate: normalizedStart,
      endLocalDate: normalizedStart,
      daysCount: 1,
      days: [normalizedStart],
    };
  }
  if (period === 'WEEK') {
    const w = getWeekWindowUtc(normalizedStart, timezone, weekStartsOn);
    return {
      startUtc: w.startUtc,
      endUtc: w.endUtc,
      startLocalDate: w.days[0],
      endLocalDate: w.days[6],
      daysCount: 7,
      days: w.days,
    };
  }
  return getMonthWindowUtc(normalizedStart, timezone);
}
