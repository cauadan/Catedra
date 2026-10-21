import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Goals } from '../src/pages/Goals';
import { Statistics } from '../src/pages/Statistics';

let mockQueryMap: Record<string, any> = {};

vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      name: 'Maria Silva',
      email: 'maria@example.com',
      timezone: 'America/Sao_Paulo',
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../src/contexts/RouterContext', () => ({
  useRouter: () => ({
    path: '/goals',
    navigate: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: any[] }) => {
    const key = opts.queryKey[0];
    return {
      data: mockQueryMap[key] ?? null,
      isLoading: false,
      error: null,
    };
  },
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe('Goals & Statistics Pages (@estudos/web)', () => {
  beforeEach(() => {
    mockQueryMap = {};
  });

  it('Goals: exibe estado vazio amigável com CTA "Criar Meta" e botão "Copiar metas do período anterior"', () => {
    mockQueryMap = {
      goals: { data: [] },
      subjects: [],
      topics: [],
    };

    const html = renderToStaticMarkup(<Goals />);

    expect(html).not.toContain('NaN');
    expect(html).toContain('Criar Meta');
    expect(html).toContain('Copiar metas do período anterior');
    expect(html).toContain('Visão de 30 Dias');
  });

  it('Goals: renderiza todos os 5 badges de status, etiqueta "Arquivada" e rótulo "Assuntos estudados"', () => {
    mockQueryMap = {
      goals: {
        data: [
          {
            id: 'g-achieved',
            kind: 'EFFORT',
            metric: 'EFFECTIVE_MINUTES',
            period: 'DAY',
            period_start_local_date: '2026-10-20',
            target_value: 60,
            subject_id: null,
            topic_id: null,
            subject_name: null,
            subject_color: null,
            topic_name: null,
            is_archived_scope: false,
            status: 'ACHIEVED',
            is_achieved: true,
            current_value: 75,
            progress_percent: 100,
            questions_count: 0,
          },
          {
            id: 'g-inprogress',
            kind: 'EFFORT',
            metric: 'TOPICS_COMPLETED',
            period: 'DAY',
            period_start_local_date: '2026-10-20',
            target_value: 3,
            subject_id: 's1',
            topic_id: null,
            subject_name: 'Direito Constitucional',
            subject_color: '#10B981',
            topic_name: null,
            is_archived_scope: true,
            status: 'IN_PROGRESS',
            is_achieved: false,
            current_value: 1,
            progress_percent: 33.33,
            questions_count: 0,
          },
          {
            id: 'g-missed',
            kind: 'EFFORT',
            metric: 'REVIEWS',
            period: 'DAY',
            period_start_local_date: '2026-10-20',
            target_value: 2,
            subject_id: null,
            topic_id: null,
            subject_name: null,
            subject_color: null,
            topic_name: null,
            is_archived_scope: false,
            status: 'MISSED',
            is_achieved: false,
            current_value: 0,
            progress_percent: 0,
            questions_count: 0,
          },
          {
            id: 'g-upcoming',
            kind: 'EFFORT',
            metric: 'QUESTIONS',
            period: 'DAY',
            period_start_local_date: '2026-10-20',
            target_value: 20,
            subject_id: null,
            topic_id: null,
            subject_name: null,
            subject_color: null,
            topic_name: null,
            is_archived_scope: false,
            status: 'UPCOMING',
            is_achieved: false,
            current_value: 0,
            progress_percent: 0,
            questions_count: 0,
          },
          {
            id: 'g-insufficient',
            kind: 'RESULT',
            metric: 'ACCURACY',
            period: 'DAY',
            period_start_local_date: '2026-10-20',
            target_value: 80,
            subject_id: null,
            topic_id: null,
            subject_name: null,
            subject_color: null,
            topic_name: null,
            is_archived_scope: false,
            status: 'INSUFFICIENT_DATA',
            is_achieved: false,
            current_value: 83.33,
            progress_percent: null,
            questions_count: 6,
          },
        ],
      },
      subjects: [],
      topics: [],
    };

    const html = renderToStaticMarkup(<Goals />);

    expect(html).not.toContain('NaN');
    expect(html).toContain('Meta atingida');
    expect(html).toContain('Em andamento');
    expect(html).toContain('Não atingida no período');
    expect(html).toContain('Período futuro');
    expect(html).toContain('Dados insuficientes (6/10 questões)');
    expect(html).toContain('Assuntos estudados');
    expect(html).toContain('Arquivada');
  });

  it('Statistics: exibe Estado Vazio amigável com CTAs "Planejar na Agenda" e "Iniciar Estudo Agora" quando não há dados', () => {
    mockQueryMap = {
      statistics: {
        data: {
          range: 'week',
          referenceDate: '2026-10-20',
          startLocalDate: '2026-10-19',
          endLocalDate: '2026-10-25',
          overview: {
            agendaPlannedMinutes: 0,
            executedPlannedSeconds: 0,
            effectiveSeconds: 0,
            effectiveMinutes: 0,
            totalSessionSeconds: 0,
            effectiveness: null,
            adherence: null,
            completedSessionsCount: 0,
            activeDaysCount: 0,
            totalDaysInPeriod: 7,
            totalQuestions: 0,
            totalCorrect: 0,
            totalErrors: 0,
            accuracy: null,
          },
          bySubject: [],
          byTopic: [],
          dailySeries: [],
          formulaMetadata: {
            effectiveness: {
              formula: '(Tempo Efetivo / Tempo Bruto Total) × 100',
              numeratorLabel: 'Efetivo',
              denominatorLabel: 'Bruto',
              numeratorValue: 0,
              denominatorValue: 0,
            },
            adherence: {
              formula: '(Tempo Efetivo / Tempo Planejado Executado) × 100',
              numeratorLabel: 'Efetivo',
              denominatorLabel: 'Planejado',
              numeratorValue: 0,
              denominatorValue: 0,
            },
            accuracy: {
              formula: '(Corretas / Questões) × 100',
              numeratorLabel: 'Corretas',
              denominatorLabel: 'Questões',
              numeratorValue: 0,
              denominatorValue: 0,
              minQuestionsRequired: 10,
            },
            consistency: {
              formula: 'Dias ativos / Dias no período',
              activeDaysCount: 0,
              totalDaysInPeriod: 7,
            },
          },
        },
      },
      subjects: [],
      topics: [],
    };

    const html = renderToStaticMarkup(<Statistics />);

    expect(html).not.toContain('NaN');
    expect(html).toContain('Planejar na Agenda');
    expect(html).toContain('Iniciar Estudo Agora');
  });

  it('Statistics: renderiza indicadores explicáveis (Aderência > 100%, Carga Planejada na Agenda) e tabelas por matéria e assunto com badges de amostra insuficiente e arquivado', () => {
    mockQueryMap = {
      statistics: {
        data: {
          range: 'week',
          referenceDate: '2026-10-20',
          startLocalDate: '2026-10-19',
          endLocalDate: '2026-10-25',
          overview: {
            agendaPlannedMinutes: 90,
            executedPlannedSeconds: 3600,
            effectiveSeconds: 4500,
            effectiveMinutes: 75,
            totalSessionSeconds: 5400,
            effectiveness: 83.33,
            adherence: 125,
            completedSessionsCount: 2,
            activeDaysCount: 2,
            totalDaysInPeriod: 7,
            totalQuestions: 6,
            totalCorrect: 5,
            totalErrors: 1,
            accuracy: 83.33,
          },
          bySubject: [
            {
              subjectId: 's1',
              subjectName: 'Matemática',
              subjectColor: '#3B82F6',
              archived: false,
              agendaPlannedMinutes: 90,
              effectiveSeconds: 4500,
              effectiveMinutes: 75,
              completedSessionsCount: 2,
              totalQuestions: 6,
              totalCorrect: 5,
              totalErrors: 1,
              accuracy: 83.33,
              hasSufficientQuestions: false,
            },
          ],
          byTopic: [
            {
              topicId: 't1',
              topicName: 'Álgebra Linear',
              subjectId: 's1',
              subjectName: 'Matemática',
              subjectColor: '#3B82F6',
              parentId: null,
              archived: true,
              effectiveSeconds: 4500,
              effectiveMinutes: 75,
              completedSessionsCount: 2,
              totalQuestions: 6,
              totalCorrect: 5,
              totalErrors: 1,
              accuracy: 83.33,
              hasSufficientQuestions: false,
            },
          ],
          dailySeries: [
            {
              date: '2026-10-19',
              agendaPlannedMinutes: 90,
              effectiveSeconds: 4500,
              effectiveMinutes: 75,
              totalSessionSeconds: 5400,
              questions: 6,
              correct: 5,
              accuracy: 83.33,
              effectiveness: 83.33,
            },
          ],
          formulaMetadata: {
            effectiveness: {
              formula: '(Tempo Efetivo / Tempo Bruto Total das Sessões Concluídas) × 100',
              numeratorLabel: 'Segundos efetivos estudados',
              denominatorLabel: 'Segundos brutos totais das sessões concluídas',
              numeratorValue: 4500,
              denominatorValue: 5400,
            },
            adherence: {
              formula: '(Tempo Efetivo das Sessões Concluídas / Tempo Planejado dos Blocos dessas Sessões) × 100',
              numeratorLabel: 'Segundos efetivos estudados',
              denominatorLabel: 'Segundos planejados nos blocos das sessões concluídas',
              numeratorValue: 4500,
              denominatorValue: 3600,
            },
            accuracy: {
              formula: '(Questões Corretas / Total de Questões Resolvidas) × 100',
              numeratorLabel: 'Questões corretas',
              denominatorLabel: 'Total de questões resolvidas',
              numeratorValue: 5,
              denominatorValue: 6,
              minQuestionsRequired: 10,
            },
            consistency: {
              formula: 'Dias com estudo efetivo (> 0s) / Total de dias no período',
              activeDaysCount: 2,
              totalDaysInPeriod: 7,
            },
          },
        },
      },
      subjects: [],
      topics: [],
    };

    const html = renderToStaticMarkup(<Statistics />);

    expect(html).not.toContain('NaN');
    expect(html).toContain('Carga Planejada na Agenda');
    expect(html).toContain('Aderência das Sessões Concluídas');
    expect(html).toContain('125');
    expect(html).toContain('Dados insuficientes (&lt; 10 questões)');
    expect(html).toContain('Arquivado');
  });
});
