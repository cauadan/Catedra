import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Observatory } from '../src/pages/Observatory';

let mockObservatoryData: any = null;

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
    path: '/observatory',
    navigate: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockObservatoryData,
    isLoading: false,
    error: null,
  }),
}));

describe('Observatory Page (@estudos/web)', () => {
  beforeEach(() => {
    mockObservatoryData = null;
  });

  it('renderiza Estado Vazio amigável (hasAnyData = false) sem NaN, mantendo cabeçalho, seletor de semana (Avançar Semana disabled) e CTAs Planejar na Agenda e Iniciar Estudo Agora', () => {
    mockObservatoryData = {
      data: {
        referenceDate: '2026-10-21',
        evaluationInstant: '2026-10-21T15:00:00.000Z',
        timezone: 'America/Sao_Paulo',
        weekStartsOn: 1,
        isCurrentWeek: true,
        isPartialWeek: true,
        elapsedDaysCount: 3,
        hasAnyData: false,
        classificationWindow: {
          windowStartLocalDate: '2026-09-22',
          windowEndLocalDate: '2026-10-21',
        },
        selectedWeek: {
          startLocalDate: '2026-10-19',
          endLocalDate: '2026-10-25',
          cutoffEndLocalDate: '2026-10-21',
          daysCount: 3,
          agendaPlannedMinutes: 0,
          agendaPlannedElapsedMinutes: 0,
          planningGapMinutes: 0,
          executedPlannedSeconds: 0,
          effectiveSeconds: 0,
          effectiveMinutes: 0,
          totalSessionSeconds: 0,
          effectiveness: null,
          adherence: null,
          completedSessionsCount: 0,
          activeDaysCount: 0,
          totalQuestions: 0,
          totalCorrect: 0,
          totalErrors: 0,
          accuracy: null,
        },
        previousWeek: {
          startLocalDate: '2026-10-12',
          endLocalDate: '2026-10-18',
          cutoffEndLocalDate: '2026-10-14',
          daysCount: 3,
          agendaPlannedMinutes: 0,
          agendaPlannedElapsedMinutes: 0,
          planningGapMinutes: 0,
          executedPlannedSeconds: 0,
          effectiveSeconds: 0,
          effectiveMinutes: 0,
          totalSessionSeconds: 0,
          effectiveness: null,
          adherence: null,
          completedSessionsCount: 0,
          activeDaysCount: 0,
          totalQuestions: 0,
          totalCorrect: 0,
          totalErrors: 0,
          accuracy: null,
        },
        comparison: {
          effectiveMinutesDelta: 0,
          effectiveMinutesDeltaPercent: null,
          effectivenessDelta: null,
          adherenceDelta: null,
          accuracyDelta: null,
          activeDaysDelta: 0,
        },
        pauseAndDistractionAnalysis: {
          totalSessionSeconds: 0,
          effectiveSeconds: 0,
          pausedSeconds: 0,
          distractedRealtimeSeconds: 0,
          distractedDeclaredSeconds: 0,
          totalDistractedSeconds: 0,
          pausedSharePercent: null,
          distractedSharePercent: null,
          effectiveness: null,
        },
        topicClassification: {
          weak: [],
          regular: [],
          strong: [],
          insufficient: [],
        },
        subjectClassification: [],
        neglectedSubjects: [],
        insightsAndRecommendations: [],
      },
    };

    const html = renderToStaticMarkup(<Observatory />);

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).toContain('Observatório Semanal');
    expect(html).toContain('Semana Anterior');
    expect(html).toContain('Semana Atual');
    expect(html).toContain('Avançar Semana');
    expect(html).toContain('Comparando os 3 primeiros dias desta semana com os mesmos 3 dias da semana anterior');
    expect(html).toContain('Planejar na Agenda');
    expect(html).toContain('Iniciar Estudo Agora');
  });

  it('renderiza todas as 5 seções quando hasAnyData = true, incluindo Revisões e Práticas Recomendadas, sinal de baixo entendimento, matérias negligenciadas e chips de evidence', () => {
    mockObservatoryData = {
      data: {
        referenceDate: '2026-10-21',
        evaluationInstant: '2026-10-21T15:00:00.000Z',
        timezone: 'America/Sao_Paulo',
        weekStartsOn: 1,
        isCurrentWeek: true,
        isPartialWeek: true,
        elapsedDaysCount: 3,
        hasAnyData: true,
        classificationWindow: {
          windowStartLocalDate: '2026-09-22',
          windowEndLocalDate: '2026-10-21',
        },
        selectedWeek: {
          startLocalDate: '2026-10-19',
          endLocalDate: '2026-10-25',
          cutoffEndLocalDate: '2026-10-21',
          daysCount: 3,
          agendaPlannedMinutes: 240,
          agendaPlannedElapsedMinutes: 180,
          planningGapMinutes: 90,
          executedPlannedSeconds: 7200,
          effectiveSeconds: 5400,
          effectiveMinutes: 90,
          totalSessionSeconds: 7200,
          effectiveness: 75,
          adherence: 75,
          completedSessionsCount: 2,
          activeDaysCount: 2,
          totalQuestions: 25,
          totalCorrect: 15,
          totalErrors: 10,
          accuracy: 60,
        },
        previousWeek: {
          startLocalDate: '2026-10-12',
          endLocalDate: '2026-10-18',
          cutoffEndLocalDate: '2026-10-14',
          daysCount: 3,
          agendaPlannedMinutes: 180,
          agendaPlannedElapsedMinutes: 120,
          planningGapMinutes: 0,
          executedPlannedSeconds: 7200,
          effectiveSeconds: 7200,
          effectiveMinutes: 120,
          totalSessionSeconds: 8000,
          effectiveness: 90,
          adherence: 100,
          completedSessionsCount: 2,
          activeDaysCount: 3,
          totalQuestions: 20,
          totalCorrect: 16,
          totalErrors: 4,
          accuracy: 80,
        },
        comparison: {
          effectiveMinutesDelta: -30,
          effectiveMinutesDeltaPercent: -25,
          effectivenessDelta: -15,
          adherenceDelta: -25,
          accuracyDelta: -20,
          activeDaysDelta: -1,
        },
        pauseAndDistractionAnalysis: {
          totalSessionSeconds: 7200,
          effectiveSeconds: 5400,
          pausedSeconds: 600,
          distractedRealtimeSeconds: 900,
          distractedDeclaredSeconds: 300,
          totalDistractedSeconds: 1200,
          pausedSharePercent: 8.33,
          distractedSharePercent: 16.67,
          effectiveness: 75,
        },
        topicClassification: {
          weak: [
            {
              topicId: 't-weak',
              topicName: 'Cálculo Integral',
              subjectId: 's1',
              subjectName: 'Matemática',
              subjectColor: '#3B82F6',
              archived: false,
              classification: {
                windowStartLocalDate: '2026-09-22',
                windowEndLocalDate: '2026-10-21',
                questionsInWindow: 20,
                correctInWindow: 10,
                evaluationsCount: 2,
                accuracyScore: 50,
                understandingScore: 33,
                finalScore: 44.9,
                displayScore: 44.9,
                level: 'WEAK',
                label: 'Ponto fraco',
                recommendedAction: 'REVIEW_AND_PRACTICE',
                recommendedActionLabel: 'Revisão + prática',
                weightsUsed: { accuracy: 0.7, understanding: 0.3 },
                usedFallback: false,
                lowUnderstandingSignal: true,
                hasActivityInWindow: true,
              },
            },
          ],
          regular: [
            {
              topicId: 't-reg',
              topicName: 'Cinemática',
              subjectId: 's2',
              subjectName: 'Física',
              subjectColor: '#10B981',
              archived: false,
              classification: {
                windowStartLocalDate: '2026-09-22',
                windowEndLocalDate: '2026-10-21',
                questionsInWindow: 15,
                correctInWindow: 10,
                evaluationsCount: 0,
                accuracyScore: 66.67,
                understandingScore: null,
                finalScore: 66.67,
                displayScore: 66.6,
                level: 'REGULAR',
                label: 'Regular',
                recommendedAction: 'MORE_PRACTICE',
                recommendedActionLabel: 'Mais prática',
                weightsUsed: { accuracy: 1, understanding: 0 },
                usedFallback: true,
                lowUnderstandingSignal: false,
                hasActivityInWindow: true,
              },
            },
          ],
          strong: [],
          insufficient: [],
        },
        subjectClassification: [],
        neglectedSubjects: [
          {
            subjectId: 's-neg',
            subjectName: 'Química Orgânica',
            subjectColor: '#F59E0B',
            lastStudiedAt: null,
            daysSinceLastStudy: null,
          },
        ],
        insightsAndRecommendations: [
          {
            id: 'WEAK_TOPIC:t-weak',
            kind: 'WEAK_TOPIC',
            severity: 'HIGH',
            title: 'Ponto fraco identificado: Cálculo Integral',
            message: 'Este assunto exige revisão teórica combinada com prática dirigida.',
            actionLabel: 'Agendar Revisão',
            actionPath: '/agenda',
            subjectId: 's1',
            topicId: 't-weak',
            finalScore: 44.9,
            evidence: [
              { label: 'Nota 30d', value: '44.9', threshold: '< 60' },
              { label: 'Questões', value: '10/20', threshold: '>= 10' },
            ],
          },
        ],
      },
    };

    const html = renderToStaticMarkup(<Observatory />);

    expect(html).not.toContain('NaN');
    expect(html).toContain('Comparativo Semana Selecionada vs. Semana Anterior');
    expect(html).toContain('Análise de Foco, Pausas e Distrações');
    expect(html).toContain('Classificação de Assuntos (30 dias até 21/10)');
    expect(html).toContain('Revisões e Práticas Recomendadas');
    expect(html).toContain('Cálculo Integral');
    expect(html).toContain('Cinemática');
    expect(html).toContain('Baixo entendimento');
    expect(html).toContain('Agendar Revisão');
    expect(html).toContain('Agendar Prática');
    expect(html).toContain('Matérias Negligenciadas');
    expect(html).toContain('Química Orgânica');
    expect(html).toContain('Nota 30d: 44.9 (limite: &lt; 60)');
  });
});
