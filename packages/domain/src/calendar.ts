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
 *
 * Política determinística em transições de horário de verão (equivale ao
 * `disambiguation: 'compatible'` da proposta Temporal; coberta por testes com America/New_York):
 * - Horário INEXISTENTE (salto, ex.: 2026-03-08T02:30): aplica o offset ANTERIOR à transição,
 *   resultando em 07:30Z — exibido de volta como 03:30 EDT (avança 1h).
 * - Horário AMBÍGUO (recuo, ex.: 2026-11-01T01:30): escolhe a PRIMEIRA ocorrência (05:30Z, EDT).
 * A API aceita esse resultado como está.
 *
 * Por que não `fromZonedTime` (date-fns-tz): nos casos de DST o resultado dele variava conforme o
 * fuso do processo (detectado pelo `npm run test:tz` em Asia/Tokyo), violando a regra de ouro.
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
    // Um candidato: horário normal. Dois distintos: ambíguo → primeira ocorrência.
    return new Date(Math.min(...candidates));
  }
  // Nenhum candidato: horário inexistente → offset anterior à transição.
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
 * Janela semiaberta `[startUtc, endUtc)` da semana local (segunda 00:00 até a segunda seguinte
 * 00:00) que contém `localDate`, e os 7 dias `YYYY-MM-DD` de segunda a domingo.
 * `weekStartsOn` só aceita `1` (segunda-feira), conforme decisão do projeto.
 */
export function getWeekWindowUtc(
  localDate: string,
  timezone: string,
  weekStartsOn: 1 = 1
): { startUtc: Date; endUtc: Date; days: string[] } {
  assertLocalDate(localDate);
  if (weekStartsOn !== 1) {
    throw new RangeError('Apenas semanas iniciando na segunda-feira são suportadas.');
  }
  const offsetToMonday = (localDateWeekday(localDate) + 6) % 7;
  const monday = addDaysToLocalDate(localDate, -offsetToMonday);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToLocalDate(monday, i));
  return {
    startUtc: localDateTimeToUtc(`${monday}T00:00`, timezone),
    endUtc: localDateTimeToUtc(`${addDaysToLocalDate(monday, 7)}T00:00`, timezone),
    days,
  };
}
