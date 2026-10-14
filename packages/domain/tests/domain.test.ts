import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  subjectCreateSchema,
  topicCreateSchema,
  wouldCreateHierarchyCycle,
  TopicTreeNode,
  calculateAccuracy,
  calculateSubjectGrade,
  classifyPerformance,
  mapUnderstandingToScore,
  calculateFocusEfficiency,
  calculatePlanAdherence,
} from '../src/index.js';

describe('Validações do Pacote Domain (@estudos/domain)', () => {
  describe('Esquemas de Autenticação (Zod)', () => {
    it('deve validar com sucesso dados corretos de cadastro', () => {
      const validData = {
        name: 'Maria Silva',
        email: 'maria@estudos.com',
        password: 'senhaSegura123',
        timezone: 'America/Sao_Paulo',
      };
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Maria Silva');
        expect(result.data.timezone).toBe('America/Sao_Paulo');
      }
    });

    it('deve rejeitar e-mail inválido com mensagem de erro em português', () => {
      const invalidData = {
        name: 'Carlos',
        email: 'email-invalido',
        password: '123456',
      };
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMsg = result.error.errors[0]?.message;
        expect(errorMsg).toBe('Formato de e-mail inválido.');
      }
    });

    it('deve rejeitar senha com menos de 6 caracteres', () => {
      const invalidData = {
        name: 'Carlos',
        email: 'carlos@estudos.com',
        password: '123',
      };
      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMsg = result.error.errors[0]?.message;
        expect(errorMsg).toBe('A senha deve conter ao menos 6 caracteres.');
      }
    });

    it('deve validar login com sucesso', () => {
      const result = loginSchema.safeParse({
        email: 'teste@dominio.com',
        password: 'qualquer_senha',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Esquemas de Matéria e Tópico', () => {
    it('deve aceitar cor hexadecimal válida na matéria', () => {
      const result = subjectCreateSchema.safeParse({
        name: 'História',
        color: '#10B981',
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar cor fora do formato hexadecimal', () => {
      const result = subjectCreateSchema.safeParse({
        name: 'História',
        color: 'verde',
      });
      expect(result.success).toBe(false);
    });

    it('deve validar criação de tópico com sucesso', () => {
      const result = topicCreateSchema.safeParse({
        subject_id: 'sub-123',
        name: 'Segunda Guerra Mundial',
        parent_id: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Prevenção de Ciclos na Árvore de Tópicos', () => {
    const nodes: Record<string, TopicTreeNode> = {
      raiz: { id: 'raiz', parent_id: null, subject_id: 'sub-1' },
      filho_1: { id: 'filho_1', parent_id: 'raiz', subject_id: 'sub-1' },
      neto_1: { id: 'neto_1', parent_id: 'filho_1', subject_id: 'sub-1' },
      bisneto_1: { id: 'bisneto_1', parent_id: 'neto_1', subject_id: 'sub-1' },
      outro_ramo: { id: 'outro_ramo', parent_id: null, subject_id: 'sub-1' },
    };

    const getNode = (id: string) => nodes[id];

    it('deve permitir mover nó para a raiz (parent_id nulo)', () => {
      expect(wouldCreateHierarchyCycle('neto_1', null, getNode)).toBe(false);
    });

    it('deve permitir mover para outro ramo sem ciclo', () => {
      expect(wouldCreateHierarchyCycle('neto_1', 'outro_ramo', getNode)).toBe(false);
    });

    it('deve impedir nó de ser pai de si mesmo', () => {
      expect(wouldCreateHierarchyCycle('filho_1', 'filho_1', getNode)).toBe(true);
    });

    it('deve impedir nó de se tornar filho de seu próprio descendente (ciclo indireto)', () => {
      // Tentar colocar 'filho_1' como filho de 'bisneto_1' criaria um ciclo
      expect(wouldCreateHierarchyCycle('filho_1', 'bisneto_1', getNode)).toBe(true);
      expect(wouldCreateHierarchyCycle('raiz', 'neto_1', getNode)).toBe(true);
    });
  });

  describe('Fórmulas Puras de Desempenho e Estudo', () => {
    it('deve calcular taxa de acerto corretamente', () => {
      expect(calculateAccuracy(18, 20)).toBe(90);
      expect(calculateAccuracy(0, 10)).toBe(0);
      expect(calculateAccuracy(0, 0)).toBe(0);
    });

    it('deve mapear autoavaliação qualitativa', () => {
      expect(mapUnderstandingToScore('NONE')).toBe(0);
      expect(mapUnderstandingToScore('PARTIAL')).toBe(33);
      expect(mapUnderstandingToScore('GOOD')).toBe(67);
      expect(mapUnderstandingToScore('MASTERED')).toBe(100);
    });

    it('deve calcular nota do assunto ponderada (70% questões + 30% autoavaliação)', () => {
      // 80% acertos * 0.7 = 56 + 100 * 0.3 = 30 => nota 86
      const grade = calculateSubjectGrade(80, 100);
      expect(grade).toBe(86);
    });

    it('deve classificar desempenho com base em nota e quantidade mínima de questões', () => {
      // Menos de 10 questões deve retornar DADOS_INSUFICIENTES
      expect(classifyPerformance(90, 8, 10)).toBe('DADOS_INSUFICIENTES');

      // Com 10 ou mais questões:
      expect(classifyPerformance(85, 15, 10)).toBe('FORTE');
      expect(classifyPerformance(70, 10, 10)).toBe('REGULAR');
      expect(classifyPerformance(55, 12, 10)).toBe('FRACO');
    });

    it('deve calcular eficiência de foco e aderência ao plano', () => {
      expect(calculateFocusEfficiency(45, 60)).toBe(0.75);
      expect(calculatePlanAdherence(50, 50)).toBe(1);
      expect(calculatePlanAdherence(60, 50)).toBe(1.2);
    });
  });
});
