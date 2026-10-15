import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionEvaluationModal } from '../src/components/evaluation/SessionEvaluationModal';
import type { StudySessionView } from '../src/lib/study-session-api';

describe('SessionEvaluationModal Component (@estudos/web)', () => {
  const sessionFixture: StudySessionView = {
    id: 'session-eval-1',
    user_id: 'u-1',
    topic_id: 'top-1',
    planned_session_id: null,
    started_at: '2026-10-14T10:00:00.000Z',
    finished_at: '2026-10-14T10:45:00.000Z',
    status: 'FINISHED',
    created_at: '2026-10-14T10:00:00.000Z',
    updated_at: '2026-10-14T10:45:00.000Z',
    topic: {
      id: 'top-1',
      name: 'Termodinâmica',
      subject: {
        id: 'sub-1',
        name: 'Física',
        color: '#2563EB',
      },
    },
    session_blocks: [
      {
        id: 'b-1',
        study_session_id: 'session-eval-1',
        kind: 'REVIEW',
        planned_minutes: 15,
        position: 1,
        created_at: '2026-10-14T10:00:00.000Z',
      },
      {
        id: 'b-2',
        study_session_id: 'session-eval-1',
        kind: 'PRACTICE',
        planned_minutes: 30,
        position: 2,
        created_at: '2026-10-14T10:00:00.000Z',
      },
    ],
    session_events: [
      {
        id: 'ev-1',
        study_session_id: 'session-eval-1',
        block_id: 'b-1',
        type: 'BLOCK_START',
        payload: null,
        created_at: '2026-10-14T10:00:00.000Z',
      },
      {
        id: 'ev-2',
        study_session_id: 'session-eval-1',
        block_id: 'b-1',
        type: 'BLOCK_FINISH',
        payload: null,
        created_at: '2026-10-14T10:15:00.000Z',
      },
      {
        id: 'ev-3',
        study_session_id: 'session-eval-1',
        block_id: 'b-2',
        type: 'BLOCK_START',
        payload: null,
        created_at: '2026-10-14T10:15:00.000Z',
      },
      {
        id: 'ev-4',
        study_session_id: 'session-eval-1',
        block_id: 'b-2',
        type: 'BLOCK_FINISH',
        payload: null,
        created_at: '2026-10-14T10:45:00.000Z',
      },
      {
        id: 'ev-5',
        study_session_id: 'session-eval-1',
        block_id: null,
        type: 'SESSION_FINISH',
        payload: null,
        created_at: '2026-10-14T10:45:00.000Z',
      },
    ],
  };

  const topicsFixture = [
    { id: 'top-1', name: 'Termodinâmica', subject_id: 'sub-1', archived: false },
    { id: 'top-2', name: 'Calorimetria', subject_id: 'sub-1', archived: false },
  ];

  it('SessionEvaluationModal inicial: contém "Não entendi", "Dominei", "+ Adicionar outro assunto" e rodapé "–"', () => {
    const html = renderToStaticMarkup(
      <SessionEvaluationModal
        isOpen={true}
        session={sessionFixture}
        topics={topicsFixture}
        isPending={false}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onFinishedSuccess={vi.fn()}
      />
    );

    // Avaliação qualitativa de entendimento
    expect(html).toContain('Não entendi');
    expect(html).toContain('Dominei');

    // Botão de adicionar assunto na prática
    expect(html).toContain('Adicionar outro assunto');

    // Rodapé de aproveitamento com 0 questões começa com '–'
    expect(html).toContain('–');

    // Termodinâmica presente
    expect(html).toContain('Termodinâmica');
  });
});
