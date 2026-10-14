import { describe, it, expect } from 'vitest';
import {
  calculateAccuracy,
  calculateAggregateAccuracy,
  validatePracticeRecord,
  normalizeUnderstandingScore,
  mapUnderstandingToScore,
} from '../src/practice.js';

describe('Practice and Evaluation Calculations (@estudos/domain/practice)', () => {
  describe('calculateAccuracy', () => {
    it('deve retornar null se questions === 0', () => {
      expect(calculateAccuracy(0, 0)).toBeNull();
      expect(calculateAccuracy(5, 0)).toBeNull();
    });

    it('deve retornar ponto flutuante exato sem arredondamento precoce', () => {
      expect(calculateAccuracy(1, 3)).toBe((1 / 3) * 100);
      expect(calculateAccuracy(18, 20)).toBe(90);
      expect(calculateAccuracy(0, 10)).toBe(0);
    });
  });

  describe('calculateAggregateAccuracy', () => {
    it('deve somar todas as questões e acertos e retornar precisão agregada', () => {
      const records = [
        { questions: 10, correct: 7 },
        { questions: 5, correct: 5 },
        { questions: 0, correct: 0 },
      ];
      const res = calculateAggregateAccuracy(records);
      expect(res.totalQuestions).toBe(15);
      expect(res.totalCorrect).toBe(12);
      expect(res.accuracy).toBe(80);
    });

    it('deve retornar accuracy null se totalQuestions for 0', () => {
      const res = calculateAggregateAccuracy([{ questions: 0, correct: 0 }]);
      expect(res.totalQuestions).toBe(0);
      expect(res.totalCorrect).toBe(0);
      expect(res.accuracy).toBeNull();
    });

    it('deve retornar accuracy null para lista vazia de registros', () => {
      const res = calculateAggregateAccuracy([]);
      expect(res.totalQuestions).toBe(0);
      expect(res.totalCorrect).toBe(0);
      expect(res.accuracy).toBeNull();
    });
  });

  describe('validatePracticeRecord', () => {
    it('deve aceitar registros válidos', () => {
      expect(validatePracticeRecord({ questions: 10, correct: 8 }).ok).toBe(true);
      expect(validatePracticeRecord({ questions: 0, correct: 0 }).ok).toBe(true);
    });

    it('deve rejeitar se correct for maior que questions', () => {
      const res = validatePracticeRecord({ questions: 5, correct: 6 });
      expect(res.ok).toBe(false);
      expect(res.error).toBe('O número de acertos não pode ser maior que o número total de questões.');
    });

    it('deve rejeitar valores negativos ou não inteiros', () => {
      expect(validatePracticeRecord({ questions: -1, correct: 0 }).ok).toBe(false);
      expect(validatePracticeRecord({ questions: 10, correct: -2 }).ok).toBe(false);
      expect(validatePracticeRecord({ questions: 10.5, correct: 5 }).ok).toBe(false);
      expect(validatePracticeRecord({ questions: 10, correct: 4.2 }).ok).toBe(false);
    });
  });

  describe('normalizeUnderstandingScore e alias', () => {
    it('deve normalizar os 4 níveis para 0, 33, 67 e 100', () => {
      expect(normalizeUnderstandingScore('NONE')).toBe(0);
      expect(normalizeUnderstandingScore('PARTIAL')).toBe(33);
      expect(normalizeUnderstandingScore('GOOD')).toBe(67);
      expect(normalizeUnderstandingScore('MASTERED')).toBe(100);
    });

    it('o alias mapUnderstandingToScore deve se comportar de forma idêntica', () => {
      expect(mapUnderstandingToScore('NONE')).toBe(0);
      expect(mapUnderstandingToScore('PARTIAL')).toBe(33);
      expect(mapUnderstandingToScore('GOOD')).toBe(67);
      expect(mapUnderstandingToScore('MASTERED')).toBe(100);
    });
  });
});
