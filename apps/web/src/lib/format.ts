/**
 * Formata duração em segundos para string legível:
 * - MM:SS para durações menores que 1 hora (ex: 65s -> '01:05')
 * - H:MM:SS para durações de 1 hora ou mais (ex: 3725s -> '1:02:05')
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }
  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

/**
 * Formata percentual na escala de 0 a 100 com 1 casa decimal.
 * Valores nulos ou indefinidos retornam travessão '–'.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '–';
  }
  return `${value.toFixed(1)}%`;
}
