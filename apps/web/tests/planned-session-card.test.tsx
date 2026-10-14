import { describe, it, expect } from 'vitest';
import React from 'react';
import { PlannedSessionCard } from '../src/components/agenda/PlannedSessionCard';

describe('PlannedSessionCard Component (@estudos/web)', () => {
  const baseSession = {
    id: 'session-123',
    user_id: 'user-1',
    subject_id: 'sub-1',
    topic_id: 'top-1',
    scheduled_start: '2026-10-14T14:30:00.000Z',
    planned_minutes: 60,
    priority: 'HIGH',
    activity_type: 'THEORY',
    notes: 'Anotações da sessão',
    status: 'PLANNED' as const,
    rescheduled_from_id: null,
    created_at: '2026-10-14T00:00:00.000Z',
    updated_at: '2026-10-14T00:00:00.000Z',
    local_date: '2026-10-14',
    local_time: '11:30',
    subject: {
      id: 'sub-1',
      name: 'Física Clássica',
      color: '#3B82F6',
      archived: false,
    },
    topic: {
      id: 'top-1',
      name: 'Gravitação Universal',
      archived: false,
    },
    blocks: [
      { id: 'b-1', kind: 'REVIEW' as const, planned_minutes: 15, position: 1 },
      { id: 'b-2', kind: 'NEW_CONTENT' as const, planned_minutes: 45, position: 2 },
    ],
  };

  it('deve exportar o componente como função React válida', () => {
    expect(typeof PlannedSessionCard).toBe('function');
  });

  it('deve instanciar o componente com props válidas sem disparar exceção', () => {
    const element = React.createElement(PlannedSessionCard, {
      session: baseSession,
      isOverlapping: false,
    });
    expect(element).toBeDefined();
    expect(element.props.session.id).toBe('session-123');
  });

  it('deve receber a prop isOverlapping e repassar para a renderização', () => {
    const element = React.createElement(PlannedSessionCard, {
      session: baseSession,
      isOverlapping: true,
    });
    expect(element.props.isOverlapping).toBe(true);
  });
});
