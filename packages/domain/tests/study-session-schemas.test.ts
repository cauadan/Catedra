import { describe, it, expect } from 'vitest';
import {
  studySessionCreateSchema,
  studySessionEventSchema,
  declaredDistractionSchema,
  sessionEvaluationSchema,
} from '../src/study-session.js';

describe('Study Session Zod Schemas (@estudos/domain/study-session)', () => {
  describe('studySessionCreateSchema', () => {
    it('deve aceitar payload válido para Modo 1 (a partir de planejada)', () => {
      const parsed = studySessionCreateSchema.parse({
        planned_session_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(parsed).toEqual({
        mode: 'FROM_PLANNED',
        planned_session_id: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    it('deve rejeitar campo extra no Modo 1 (.strict())', () => {
      expect(() =>
        studySessionCreateSchema.parse({
          planned_session_id: '123e4567-e89b-12d3-a456-426614174000',
          campo_extra: true,
        })
      ).toThrow('Campo não permitido na requisição.');
    });

    it('deve aceitar payload válido para Modo 2 (sessão avulsa) e normalizar blocos com position', () => {
      const parsed = studySessionCreateSchema.parse({
        topic_id: 'topic-123',
        blocks: [
          { kind: 'PRACTICE', planned_minutes: 20 },
          { kind: 'REVIEW', planned_minutes: 10 },
        ],
      });
      expect(parsed.mode).toBe('ADHOC');
      if (parsed.mode === 'ADHOC') {
        expect(parsed.topic_id).toBe('topic-123');
        expect(parsed.total_planned_minutes).toBe(30);
        expect(parsed.blocks).toEqual([
          { kind: 'REVIEW', planned_minutes: 10, position: 1 },
          { kind: 'PRACTICE', planned_minutes: 20, position: 2 },
        ]);
      }
    });

    it('deve rejeitar Modo 2 se planned_minutes for 0 ou menor que 1', () => {
      expect(() =>
        studySessionCreateSchema.parse({
          topic_id: 'topic-123',
          blocks: [{ kind: 'REVIEW', planned_minutes: 0 }],
        })
      ).toThrow();
    });

    it('deve rejeitar Modo 2 se a soma for menor que 5 minutos', () => {
      expect(() =>
        studySessionCreateSchema.parse({
          topic_id: 'topic-123',
          blocks: [{ kind: 'REVIEW', planned_minutes: 4 }],
        })
      ).toThrow('A duração da sessão deve ser um número inteiro entre 5 e 480 minutos.');
    });

    it('deve rejeitar Modo 2 se houver etapa duplicada', () => {
      expect(() =>
        studySessionCreateSchema.parse({
          topic_id: 'topic-123',
          blocks: [
            { kind: 'REVIEW', planned_minutes: 10 },
            { kind: 'REVIEW', planned_minutes: 15 },
          ],
        })
      ).toThrow(/A etapa .*Revisão.* aparece mais de uma vez/);
    });
  });

  describe('studySessionEventSchema', () => {
    it('deve aceitar tipos manuais válidos', () => {
      expect(studySessionEventSchema.parse({ type: 'PAUSE' })).toEqual({ type: 'PAUSE' });
      expect(studySessionEventSchema.parse({ type: 'RESUME' })).toEqual({ type: 'RESUME' });
      expect(studySessionEventSchema.parse({ type: 'DISTRACTION_START' })).toEqual({ type: 'DISTRACTION_START' });
      expect(studySessionEventSchema.parse({ type: 'DISTRACTION_END' })).toEqual({ type: 'DISTRACTION_END' });
    });

    it('deve rejeitar tipos inválidos ou campos extras', () => {
      expect(() => studySessionEventSchema.parse({ type: 'BLOCK_START' })).toThrow();
      expect(() => studySessionEventSchema.parse({ type: 'PAUSE', extra: 123 })).toThrow(
        'Campo não permitido na requisição.'
      );
    });
  });

  describe('declaredDistractionSchema', () => {
    it('deve aceitar objeto vazio ou omitido', () => {
      expect(declaredDistractionSchema.parse({})).toEqual({});
    });

    it('deve aceitar declared_minutes inteiro >= 1', () => {
      expect(declaredDistractionSchema.parse({ declared_minutes: 5 })).toEqual({ declared_minutes: 5 });
    });

    it('deve rejeitar declared_minutes menor que 1 ou não inteiro', () => {
      expect(() => declaredDistractionSchema.parse({ declared_minutes: 0 })).toThrow();
      expect(() => declaredDistractionSchema.parse({ declared_minutes: 2.5 })).toThrow();
    });

    it('deve rejeitar campos extras', () => {
      expect(() => declaredDistractionSchema.parse({ declared_minutes: 5, extra: 'foo' })).toThrow(
        'Campo não permitido na requisição.'
      );
    });
  });

  describe('sessionEvaluationSchema', () => {
    it('deve aceitar avaliação completa válida', () => {
      const parsed = sessionEvaluationSchema.parse({
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
        notes: 'Estudo muito produtivo.',
        practice_records: [
          { topic_id: 't1', questions: 10, correct: 9 },
          { block_id: 'b1', topic_id: 't2', questions: 5, correct: 5 },
        ],
      });
      expect(parsed.understanding).toBe('GOOD');
      expect(parsed.notes).toBe('Estudo muito produtivo.');
      expect(parsed.practice_records).toHaveLength(2);
    });

    it('deve rejeitar notes com mais de 1000 caracteres', () => {
      expect(() =>
        sessionEvaluationSchema.parse({
          understanding: 'GOOD',
          focus: 'HIGH',
          difficulty: 'NORMAL',
          notes: 'a'.repeat(1001),
        })
      ).toThrow('As observações devem ter no máximo 1000 caracteres.');
    });

    it('deve rejeitar campos extras (.strict())', () => {
      expect(() =>
        sessionEvaluationSchema.parse({
          understanding: 'GOOD',
          focus: 'HIGH',
          difficulty: 'NORMAL',
          extra_field: 'bar',
        })
      ).toThrow('Campo não permitido na requisição.');
    });
  });
});
