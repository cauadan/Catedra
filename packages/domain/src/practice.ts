/**
 * Funções puras de cálculo de acurácia, agregação de questões e autoavaliação (Fases 4 e 5).
 * Escala 0 a 100 em ponto flutuante exato.
 */

export const UNDERSTANDING_LEVELS = ['NONE', 'PARTIAL', 'GOOD', 'MASTERED'] as const;
export type UnderstandingLevelDTO = (typeof UNDERSTANDING_LEVELS)[number];

export const FOCUS_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type FocusLevelDTO = (typeof FOCUS_LEVELS)[number];

export const DIFFICULTY_LEVELS = ['EASY', 'NORMAL', 'HARD'] as const;
export type DifficultyLevelDTO = (typeof DIFFICULTY_LEVELS)[number];

export const UNDERSTANDING_LEVEL_LABELS: Record<UnderstandingLevelDTO, string> = {
  NONE: 'Não entendi',
  PARTIAL: 'Parcialmente',
  GOOD: 'Entendi',
  MASTERED: 'Dominei',
};

export const FOCUS_LEVEL_LABELS: Record<FocusLevelDTO, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

export const DIFFICULTY_LEVEL_LABELS: Record<DifficultyLevelDTO, string> = {
  EASY: 'Fácil',
  NORMAL: 'Normal',
  HARD: 'Difícil',
};

/**
 * Calcula a taxa de acerto em questões como número em ponto flutuante exato (0 a 100).
 * Se questions === 0, retorna obrigatoriamente null.
 */
export function calculateAccuracy(correct: number, questions: number): number | null {
  if (questions === 0) return null;
  return (correct / questions) * 100;
}

/**
 * Agrega questões e acertos de múltiplos registros e calcula o aproveitamento consolidado.
 */
export function calculateAggregateAccuracy(
  records: ReadonlyArray<{ questions: number; correct: number }>
): { totalQuestions: number; totalCorrect: number; accuracy: number | null } {
  let totalQuestions = 0;
  let totalCorrect = 0;

  for (const r of records) {
    totalQuestions += r.questions;
    totalCorrect += r.correct;
  }

  return {
    totalQuestions,
    totalCorrect,
    accuracy: calculateAccuracy(totalCorrect, totalQuestions),
  };
}

/**
 * Validação pura de linha de registro de prática:
 * inteiros >= 0 e 0 <= correct <= questions.
 */
export function validatePracticeRecord(record: {
  questions: number;
  correct: number;
}): { ok: boolean; error?: string } {
  if (
    !Number.isInteger(record.questions) ||
    !Number.isInteger(record.correct) ||
    record.questions < 0 ||
    record.correct < 0
  ) {
    return {
      ok: false,
      error: 'O número de questões e acertos devem ser números inteiros maiores ou iguais a zero.',
    };
  }

  if (record.correct > record.questions) {
    return {
      ok: false,
      error: 'O número de acertos não pode ser maior que o número total de questões.',
    };
  }

  return { ok: true };
}

/**
 * Normaliza o nível de compreensão qualitativa para pontuação numérica (0 a 100).
 * NONE = 0, PARTIAL = 33, GOOD = 67, MASTERED = 100.
 */
export function normalizeUnderstandingScore(level: UnderstandingLevelDTO): number {
  switch (level) {
    case 'NONE':
      return 0;
    case 'PARTIAL':
      return 33;
    case 'GOOD':
      return 67;
    case 'MASTERED':
      return 100;
  }
}

/** Alias para compatibilidade retroativa com código existente. */
export const mapUnderstandingToScore = normalizeUnderstandingScore;
