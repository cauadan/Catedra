/**
 * Utilitários para detecção e exibição do fuso horário do usuário.
 */

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Detecta o fuso horário configurado no navegador do usuário.
 * Em caso de falha ou incompatibilidade, retorna 'America/Sao_Paulo'.
 */
export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === 'string' && tz.trim().length > 0 ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Retorna uma descrição amigável para exibição do fuso horário na interface.
 */
export function formatTimezoneLabel(timezone: string): string {
  if (timezone === 'America/Sao_Paulo') {
    return 'Horário de Brasília (America/Sao_Paulo)';
  }
  return timezone;
}
