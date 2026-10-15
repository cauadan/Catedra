import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TimerDisplay } from '../src/components/timer/TimerDisplay';
import { FinishStepDialog } from '../src/components/timer/FinishStepDialog';
import type { StudySessionView } from '../src/lib/study-session-api';

describe('Timer Components (@estudos/web)', () => {
  const baseSession: StudySessionView = {
    id: 'session-t1',
    user_id: 'u-1',
    topic_id: 'top-1',
    planned_session_id: null,
    started_at: '2026-10-14T10:00:00.000Z',
    finished_at: null,
    status: 'IN_PROGRESS',
    created_at: '2026-10-14T10:00:00.000Z',
    updated_at: '2026-10-14T10:00:00.000Z',
    topic: {
      id: 'top-1',
      name: 'Eletromagnetismo',
      subject: {
        id: 'sub-1',
        name: 'Física',
        color: '#2563EB',
      },
    },
    session_blocks: [
      {
        id: 'b-1',
        study_session_id: 'session-t1',
        kind: 'REVIEW',
        planned_minutes: 10,
        position: 1,
        created_at: '2026-10-14T10:00:00.000Z',
      },
      {
        id: 'b-2',
        study_session_id: 'session-t1',
        kind: 'NEW_CONTENT',
        planned_minutes: 20,
        position: 2,
        created_at: '2026-10-14T10:00:00.000Z',
      },
      {
        id: 'b-3',
        study_session_id: 'session-t1',
        kind: 'PRACTICE',
        planned_minutes: 30,
        position: 3,
        created_at: '2026-10-14T10:00:00.000Z',
      },
    ],
    session_events: [
      {
        id: 'ev-1',
        study_session_id: 'session-t1',
        block_id: 'b-1',
        type: 'BLOCK_START',
        payload: null,
        created_at: '2026-10-14T10:00:00.000Z',
      },
    ],
  };

  it('3 blocos, ativo o 1º: exibe "Avançar Etapa" e "Concluir Estudo"', () => {
    const html = renderToStaticMarkup(
      <TimerDisplay
        session={baseSession}
        referenceNow={new Date('2026-10-14T10:05:00.000Z')}
        isPending={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(html).toContain('Avançar Etapa');
    expect(html).toContain('Concluir Estudo');
    expect(html).toContain('Eletromagnetismo');
    expect(html).toContain('Física');
  });

  it('ativo o último bloco: NÃO deve conter "Avançar Etapa", mantendo "Concluir Estudo"', () => {
    // Simular que os blocos 1 e 2 foram concluídos e o bloco 3 foi iniciado
    const sessionLastBlock: StudySessionView = {
      ...baseSession,
      session_events: [
        ...baseSession.session_events,
        {
          id: 'ev-2',
          study_session_id: 'session-t1',
          block_id: 'b-1',
          type: 'BLOCK_FINISH',
          payload: null,
          created_at: '2026-10-14T10:10:00.000Z',
        },
        {
          id: 'ev-3',
          study_session_id: 'session-t1',
          block_id: 'b-2',
          type: 'BLOCK_START',
          payload: null,
          created_at: '2026-10-14T10:10:00.000Z',
        },
        {
          id: 'ev-4',
          study_session_id: 'session-t1',
          block_id: 'b-2',
          type: 'BLOCK_FINISH',
          payload: null,
          created_at: '2026-10-14T10:30:00.000Z',
        },
        {
          id: 'ev-5',
          study_session_id: 'session-t1',
          block_id: 'b-3',
          type: 'BLOCK_START',
          payload: null,
          created_at: '2026-10-14T10:30:00.000Z',
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TimerDisplay
        session={sessionLastBlock}
        referenceNow={new Date('2026-10-14T10:35:00.000Z')}
        isPending={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(html).not.toContain('Avançar Etapa');
    expect(html).toContain('Concluir Estudo');
  });

  it('eventos START + PAUSE: exibe "Pausado" e calcula tempo fixo com precisão', () => {
    const pausedSession: StudySessionView = {
      ...baseSession,
      session_events: [
        {
          id: 'ev-1',
          study_session_id: 'session-t1',
          block_id: 'b-1',
          type: 'BLOCK_START',
          payload: null,
          created_at: '2026-10-14T10:00:00.000Z',
        },
        {
          id: 'ev-2',
          study_session_id: 'session-t1',
          block_id: 'b-1',
          type: 'PAUSE',
          payload: null,
          created_at: '2026-10-14T10:01:05.000Z',
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TimerDisplay
        session={pausedSession}
        referenceNow={new Date('2026-10-14T10:10:00.000Z')}
        isPending={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(html).toContain('Pausado');
    // Tempo efetivo do bloco antes da pausa foi de 65s = 01:05
    expect(html).toContain('01:05');
  });

  it('gap de 3 horas sem distração declarada exibe aviso literal; com distração declarada não exibe', () => {
    // Planned 30 min (b-3), gap de 3 horas após START sem outro evento
    const gapSession: StudySessionView = {
      ...baseSession,
      session_events: [
        {
          id: 'ev-1',
          study_session_id: 'session-t1',
          block_id: 'b-1',
          type: 'BLOCK_START',
          payload: null,
          created_at: '2026-10-14T10:00:00.000Z',
        },
      ],
    };

    const ref3Hours = new Date('2026-10-14T13:00:00.000Z');

    const htmlWithGap = renderToStaticMarkup(
      <TimerDisplay
        session={gapSession}
        referenceNow={ref3Hours}
        isPending={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(htmlWithGap).toContain('Esta etapa possui um longo intervalo sem registro');

    // Com DISTRACTION_DECLARED, o aviso desaparece
    const compensatedSession: StudySessionView = {
      ...gapSession,
      session_events: [
        ...gapSession.session_events,
        {
          id: 'ev-dec',
          study_session_id: 'session-t1',
          block_id: 'b-1',
          type: 'DISTRACTION_DECLARED',
          payload: { declared_seconds: 60 * 60 },
          created_at: '2026-10-14T12:00:00.000Z',
        },
      ],
    };

    const htmlCompensated = renderToStaticMarkup(
      <TimerDisplay
        session={compensatedSession}
        referenceNow={ref3Hours}
        isPending={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(htmlCompensated).not.toContain('Esta etapa possui um longo intervalo sem registro');
  });

  it('quando isPending for true, botões de ação devem possuir o atributo disabled', () => {
    const html = renderToStaticMarkup(
      <TimerDisplay
        session={baseSession}
        referenceNow={new Date('2026-10-14T10:05:00.000Z')}
        isPending={true}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(html).toContain('disabled=""');
  });

  it('FinishStepDialog com errorMessage: deve renderizar a mensagem de erro no diálogo', () => {
    const html = renderToStaticMarkup(
      <FinishStepDialog
        isOpen={true}
        mode="advance"
        isPending={false}
        errorMessage="A distração declarada excede o tempo disponível da etapa."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('A distração declarada excede o tempo disponível da etapa.');
    expect(html).toContain('Avançar Etapa');
  });

  it('eventos START + DISTRACTION_START: exibe "Distraído", "Retomar Foco" e não exibe NaN%', () => {
    const distractedSession: StudySessionView = {
      ...baseSession,
      session_events: [
        {
          id: 'ev-1',
          block_id: 'b-1',
          type: 'BLOCK_START',
          occurred_at: '2026-10-14T10:00:00.000Z',
        },
        {
          id: 'ev-2',
          block_id: 'b-1',
          type: 'DISTRACTION_START',
          occurred_at: '2026-10-14T10:02:00.000Z',
        },
      ],
    };

    const html = renderToStaticMarkup(
      <TimerDisplay
        session={distractedSession}
        referenceNow={new Date('2026-10-14T10:05:00.000Z')}
        isPending={false}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onDistractionStart={vi.fn()}
        onDistractionEnd={vi.fn()}
        onAdvanceStep={vi.fn()}
        onFinishSession={vi.fn()}
        onCancelSession={vi.fn()}
      />
    );

    expect(html).toContain('Distraído');
    expect(html).toContain('Retomar Foco');
    expect(html).not.toContain('NaN%');
  });
});
