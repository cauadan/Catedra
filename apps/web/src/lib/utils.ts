import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utilitário padrão para combinação e mesclagem condicional de classes Tailwind CSS.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
