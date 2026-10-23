import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dashboard } from '../src/pages/Dashboard';

let mockDashboardData: any = null;

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
    path: '/dashboard',
    navigate: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockDashboardData,
    isLoading: false,
    error: null,
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe('Dashboard Analítico (@estudos/web)', () => {
  beforeEach(() => {
    mockDashboardData = null;
  });

  it('renderiza Estado Vazio orientativo para usuário novo sem dados (sem NaN, com CTAs, indicadores, seções e 6 cards de Módulos da Plataforma com badge Disponível)', () => {
    mockDashboardData = {
      data: {
        referenceDate: '2026-10-20',
        hasAnyStudyData: false,
        today: {
          date: '2026-10-20',
          agendaPlannedMinutes: 0,
          effectiveSeconds: 0,
          effectiveMinutes: 0,
          effectiveness: null,
          adherence: null,
          questions: 0,
          correct: 0,
          accuracy: null,
          todaySessions: [],
          nextSession: null,
        },
        todaySessions: [],
        activeSession: null,
        pendingEvaluation: null,
        goals: [],
        weekSummary: {
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
        },
        rolling30Days: {
          startLocalDate: '2026-09-21',
          endLocalDate: '2026-10-20',
          agendaPlannedMinutes: 0,
          executedPlannedSeconds: 0,
          effectiveSeconds: 0,
          effectiveMinutes: 0,
          totalSessionSeconds: 0,
          effectiveness: null,
          adherence: null,
          completedSessionsCount: 0,
          activeDaysCount: 0,
          totalDaysInPeriod: 30,
          totalQuestions: 0,
          totalCorrect: 0,
          totalErrors: 0,
          accuracy: null,
          dailySeries: [],
        },
        subjectProgress: [],
        classificationSummary: {
          strongCount: 0,
          regularCount: 0,
          weakCount: 0,
          insufficientCount: 0,
        },
        classificationWindow: {
          windowStartLocalDate: '2026-09-21',
          windowEndLocalDate: '2026-10-20',
        },
      },
    };

    const html = renderToStaticMarkup(<Dashboard />);

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).toContain('Cadastrar Matérias');
    expect(html).toContain('Planejar Agenda');
    expect(html).toContain('Iniciar Estudo Avulso');
    expect(html).toContain('Planejado na Agenda Hoje');
    expect(html).toContain('Tempo Efetivo Estudado Hoje');
    expect(html).toContain('Metas Ativas');
    expect(html).toContain('Progresso por Matéria');
    expect(html).toContain('Módulos da Plataforma');
    expect(html).toContain('Matérias e Assuntos');
    expect(html).toContain('Agenda e Planejamento');
    expect(html).toContain('Cronômetro de Estudo');
    expect(html).toContain('Metas de Estudo');
    expect(html).toContain('Desempenho e Estatísticas');
    expect(html).toContain('Observatório Semanal');
    expect(html).not.toContain('Disponível');
  });

  it('renderiza card "O que estudar agora?", comparativo de hoje, metas ativas, progresso por matéria com classificação e módulos da plataforma', () => {
    mockDashboardData = {
      data: {
        referenceDate: '2026-10-20',
        hasAnyStudyData: true,
        today: {
          date: '2026-10-20',
          agendaPlannedMinutes: 120,
          effectiveSeconds: 5400,
          effectiveMinutes: 90,
          effectiveness: 90,
          adherence: 75,
          questions: 20,
          correct: 16,
          accuracy: 80,
          todaySessions: [
            {
              id: 'ps-1',
              subject_id: 's1',
              subject_name: 'Matemática',
              subject_color: '#3B82F6',
              topic_id: 't1',
              topic_name: 'Álgebra Linear',
              scheduled_start: '2026-10-20T12:00:00.000Z',
              localDate: '2026-10-20',
              localTime: '09:00',
              planned_minutes: 60,
              priority: 'HIGH',
              activity_type: 'PRACTICE',
              status: 'PLANNED',
              isLate: true,
              isFutureDay: false,
            },
          ],
          nextSession: {
            id: 'ps-1',
            subject_id: 's1',
            subject_name: 'Matemática',
            subject_color: '#3B82F6',
            topic_id: 't1',
            topic_name: 'Álgebra Linear',
            scheduled_start: '2026-10-20T12:00:00.000Z',
            localDate: '2026-10-20',
            localTime: '09:00',
            planned_minutes: 60,
            priority: 'HIGH',
            activity_type: 'PRACTICE',
            status: 'PLANNED',
            isLate: true,
            isFutureDay: false,
          },
        },
        todaySessions: [],
        activeSession: null,
        pendingEvaluation: null,
        goals: [
          {
            id: 'g1',
            kind: 'EFFORT',
            metric: 'EFFECTIVE_MINUTES',
            period: 'WEEK',
            period_start_local_date: '2026-10-19',
            target_value: 300,
            subject_id: null,
            topic_id: null,
            subject_name: null,
            subject_color: null,
            topic_name: null,
            is_archived_scope: false,
            status: 'IN_PROGRESS',
            is_achieved: false,
            current_value: 150,
            progress_percent: 50,
            questions_count: 20,
          },
        ],
        weekSummary: {
          startLocalDate: '2026-10-19',
          endLocalDate: '2026-10-25',
          overview: {
            agendaPlannedMinutes: 240,
            executedPlannedSeconds: 10800,
            effectiveSeconds: 9000,
            effectiveMinutes: 150,
            totalSessionSeconds: 10000,
            effectiveness: 90,
            adherence: 83.33,
            completedSessionsCount: 3,
            activeDaysCount: 2,
            totalDaysInPeriod: 7,
            totalQuestions: 20,
            totalCorrect: 16,
            totalErrors: 4,
            accuracy: 80,
          },
          bySubject: [],
          byTopic: [],
          dailySeries: [],
        },
        rolling30Days: {
          startLocalDate: '2026-09-21',
          endLocalDate: '2026-10-20',
          agendaPlannedMinutes: 600,
          executedPlannedSeconds: 36000,
          effectiveSeconds: 30000,
          effectiveMinutes: 500,
          totalSessionSeconds: 33000,
          effectiveness: 90.9,
          adherence: 83.33,
          completedSessionsCount: 10,
          activeDaysCount: 12,
          totalDaysInPeriod: 30,
          totalQuestions: 100,
          totalCorrect: 82,
          totalErrors: 18,
          accuracy: 82,
          dailySeries: [],
        },
        subjectProgress: [
          {
            subjectId: 's1',
            subjectName: 'Matemática',
            subjectColor: '#3B82F6',
            archived: false,
            agendaPlannedMinutes: 300,
            effectiveSeconds: 18000,
            effectiveMinutes: 300,
            completedSessionsCount: 5,
            totalQuestions: 50,
            totalCorrect: 40,
            totalErrors: 10,
            accuracy: 80,
            hasSufficientQuestions: true,
            classification: {
              windowStartLocalDate: '2026-09-21',
              windowEndLocalDate: '2026-10-20',
              questionsInWindow: 50,
              correctInWindow: 40,
              evaluationsCount: 2,
              accuracyScore: 80,
              understandingScore: 83.5,
              finalScore: 81.05,
              displayScore: 81,
              level: 'STRONG',
              label: 'Ponto forte',
              recommendedAction: 'MAINTAIN',
              recommendedActionLabel: 'Manter ritmo',
              weightsUsed: { accuracy: 0.7, understanding: 0.3 },
              usedFallback: false,
              lowUnderstandingSignal: false,
              hasActivityInWindow: true,
            },
          },
        ],
        classificationSummary: {
          strongCount: 1,
          regularCount: 0,
          weakCount: 0,
          insufficientCount: 0,
        },
        classificationWindow: {
          windowStartLocalDate: '2026-09-21',
          windowEndLocalDate: '2026-10-20',
        },
      },
    };

    const html = renderToStaticMarkup(<Dashboard />);

    expect(html).not.toContain('NaN');
    expect(html).toContain('O que estudar agora?');
    expect(html).toContain('Em atraso');
    expect(html).toContain('Iniciar Estudo');
    expect(html).toContain('Planejado na Agenda Hoje');
    expect(html).toContain('Tempo Efetivo Estudado Hoje');
    expect(html).toContain('Álgebra Linear');
    expect(html).toContain('Matemática');
    expect(html).toContain('Ponto forte');
    expect(html).toContain('81');
    expect(html).toContain('Módulos da Plataforma');
    expect(html).toContain('Observatório Semanal');
  });
});
