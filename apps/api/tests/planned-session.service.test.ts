import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PlannedSessionService } from '../src/services/planned-session.service.js';

const prisma = new PrismaClient();
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

let user: { id: string; email: string };
let otherUser: { id: string; email: string };
let subject: { id: string; name: string };
let otherSubject: { id: string; name: string };
let topic: { id: string; name: string };
let archivedSubject: { id: string };
let archivedTopic: { id: string };

describe('PlannedSessionService (Testes de Unidade/Integração do Serviço)', () => {
  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: `User Service ${suffix}`,
        email: `user_service_${suffix}@estudos.test`,
        password_hash: 'hash123',
        timezone: 'America/Sao_Paulo',
      },
    });

    otherUser = await prisma.user.create({
      data: {
        name: `Other User ${suffix}`,
        email: `other_service_${suffix}@estudos.test`,
        password_hash: 'hash123',
        timezone: 'America/Sao_Paulo',
      },
    });

    subject = await prisma.subject.create({
      data: { user_id: user.id, name: 'Física', color: '#10B981' },
    });

    otherSubject = await prisma.subject.create({
      data: { user_id: otherUser.id, name: 'Química', color: '#EF4444' },
    });

    topic = await prisma.topic.create({
      data: { user_id: user.id, subject_id: subject.id, name: 'Termodinâmica' },
    });

    archivedSubject = await prisma.subject.create({
      data: { user_id: user.id, name: 'História Arquivada', color: '#6B7280', archived: true },
    });

    archivedTopic = await prisma.topic.create({
      data: { user_id: user.id, subject_id: subject.id, name: 'Tópico Arquivado', archived: true },
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [user.id, otherUser.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('cria sessão planejada com blocos normalizados e calcula local_date/time', async () => {
    const session = await PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
      subject_id: subject.id,
      topic_id: topic.id,
      scheduled_start_local: '2026-10-14T14:30',
      planned_minutes: 60,
      priority: 'HIGH',
      activity_type: 'THEORY',
      notes: 'Estudar ciclo de Carnot',
      blocks: [
        { kind: 'REVIEW', planned_minutes: 15, position: 1 },
        { kind: 'NEW_CONTENT', planned_minutes: 30, position: 2 },
        { kind: 'PRACTICE', planned_minutes: 15, position: 3 },
      ],
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('PLANNED');
    expect(session.local_date).toBe('2026-10-14');
    expect(session.local_time).toBe('14:30');
    expect(session.blocks.length).toBe(3);
  });

  it('rejeita criação com matéria ou tópico arquivado com erro 400', async () => {
    await expect(
      PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
        subject_id: archivedSubject.id,
        topic_id: topic.id,
        scheduled_start_local: '2026-10-14T15:00',
        planned_minutes: 30,
        priority: 'MEDIUM',
        activity_type: 'THEORY',
        blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 30, position: 1 }],
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
        subject_id: subject.id,
        topic_id: archivedTopic.id,
        scheduled_start_local: '2026-10-14T15:00',
        planned_minutes: 30,
        priority: 'MEDIUM',
        activity_type: 'THEORY',
        blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 30, position: 1 }],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejeita criação com matéria ou tópico de outro usuário com erro 404', async () => {
    await expect(
      PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
        subject_id: otherSubject.id,
        topic_id: topic.id,
        scheduled_start_local: '2026-10-14T15:00',
        planned_minutes: 30,
        priority: 'MEDIUM',
        activity_type: 'THEORY',
        blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 30, position: 1 }],
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lista sessões do dia e da semana com summary e overlapping_ids', async () => {
    const listDay = await PlannedSessionService.list(user.id, 'America/Sao_Paulo', 'day', '2026-10-14');
    expect(listDay.view).toBe('day');
    expect(listDay.sessions.length).toBeGreaterThanOrEqual(1);
    expect(listDay.summary.plannedCount).toBeGreaterThanOrEqual(1);

    const listWeek = await PlannedSessionService.list(user.id, 'America/Sao_Paulo', 'week', '2026-10-14');
    expect(listWeek.view).toBe('week');
    expect(listWeek.days.length).toBe(7);
  });

  it('atualiza notas e substitui blocos de uma sessão PLANNED', async () => {
    const created = await PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
      subject_id: subject.id,
      topic_id: topic.id,
      scheduled_start_local: '2026-10-14T18:00',
      planned_minutes: 45,
      priority: 'LOW',
      activity_type: 'PRACTICE',
      blocks: [{ kind: 'PRACTICE', planned_minutes: 45, position: 1 }],
    });

    const updated = await PlannedSessionService.update(user.id, 'America/Sao_Paulo', created.id, {
      notes: 'Notas atualizadas',
      priority: 'HIGH',
      planned_minutes: 60,
      blocks: [
        { kind: 'REVIEW', planned_minutes: 20, position: 1 },
        { kind: 'PRACTICE', planned_minutes: 40, position: 2 },
      ],
    });

    expect(updated.notes).toBe('Notas atualizadas');
    expect(updated.priority).toBe('HIGH');
    expect(updated.planned_minutes).toBe(60);
    expect(updated.blocks.length).toBe(2);
  });

  it('altera status para SKIPPED e rejeita nova alteração subsequente com 409', async () => {
    const created = await PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
      subject_id: subject.id,
      topic_id: topic.id,
      scheduled_start_local: '2026-10-14T20:00',
      planned_minutes: 30,
      priority: 'MEDIUM',
      activity_type: 'REVIEW',
      blocks: [{ kind: 'REVIEW', planned_minutes: 30, position: 1 }],
    });

    const skipped = await PlannedSessionService.updateStatus(user.id, 'America/Sao_Paulo', created.id, 'SKIPPED');
    expect(skipped.status).toBe('SKIPPED');

    await expect(
      PlannedSessionService.updateStatus(user.id, 'America/Sao_Paulo', created.id, 'SKIPPED')
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('remarca sessão PLANNED tornando original RESCHEDULED e criando filha', async () => {
    const original = await PlannedSessionService.create(user.id, 'America/Sao_Paulo', {
      subject_id: subject.id,
      topic_id: topic.id,
      scheduled_start_local: '2026-10-15T09:00',
      planned_minutes: 60,
      priority: 'HIGH',
      activity_type: 'THEORY',
      blocks: [
        { kind: 'REVIEW', planned_minutes: 15, position: 1 },
        { kind: 'NEW_CONTENT', planned_minutes: 45, position: 2 },
      ],
    });

    const rescheduled = await PlannedSessionService.reschedule(user.id, 'America/Sao_Paulo', original.id, {
      scheduled_start_local: '2026-10-16T10:00',
    });

    expect(rescheduled.status).toBe('PLANNED');
    expect(rescheduled.rescheduled_from_id).toBe(original.id);
    expect(rescheduled.local_date).toBe('2026-10-16');
    expect(rescheduled.local_time).toBe('10:00');

    // Checar original no banco
    const originalNoBanco = await prisma.plannedSession.findUnique({ where: { id: original.id } });
    expect(originalNoBanco?.status).toBe('RESCHEDULED');

    // Excluir original deve falhar com 409 (status RESCHEDULED e possui filha vinculada)
    await expect(
      PlannedSessionService.delete(user.id, original.id)
    ).rejects.toMatchObject({ statusCode: 409 });

    // Excluir a filha (PLANNED) deve funcionar
    await expect(PlannedSessionService.delete(user.id, rescheduled.id)).resolves.not.toThrow();
  });
});

