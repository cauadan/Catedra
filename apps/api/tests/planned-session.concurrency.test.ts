import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

let cookie = '';
let user: { id: string };
let subject: { id: string };
let topic: { id: string };

function extractCookie(headers: any): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const sessionHeader = cookies.find((c: string) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Testes de Concorrência da API: PlannedSession (Promise.all)', () => {
  beforeAll(async () => {
    const resReg = await request(app).post('/api/auth/register').send({
      name: `User Concurrency ${suffix}`,
      email: `concurrency_${suffix}@estudos.test`,
      password: 'SenhaForte123!',
      timezone: 'America/Sao_Paulo',
    });
    cookie = extractCookie(resReg.headers);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    user = me.body.user;

    subject = await prisma.subject.create({
      data: { user_id: user.id, name: 'Biologia Concorrência', color: '#10B981' },
    });

    topic = await prisma.topic.create({
      data: { user_id: user.id, subject_id: subject.id, name: 'Genética' },
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: user.id },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('duas chamadas concorrentes de reschedule resultam em exatamente 1 sucesso (201) e 1 conflito (409)', async () => {
    // 1. Criar sessão inicial PLANNED
    const resCreate = await request(app)
      .post('/api/planned-sessions')
      .set('Cookie', cookie)
      .send({
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start_local: '2026-10-14T08:00',
        planned_minutes: 60,
        priority: 'MEDIUM',
        activity_type: 'THEORY',
        blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
      });
    expect(resCreate.status).toBe(201);
    const sessionId = resCreate.body.id;

    // 2. Disparar dois reschedules simultâneos via Promise.all
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/planned-sessions/${sessionId}/reschedule`)
        .set('Cookie', cookie)
        .send({ scheduled_start_local: '2026-10-15T08:00' }),
      request(app)
        .post(`/api/planned-sessions/${sessionId}/reschedule`)
        .set('Cookie', cookie)
        .send({ scheduled_start_local: '2026-10-16T08:00' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Verificar no banco que foi criada exatamente UMA nova sessão filha
    const children = await prisma.plannedSession.findMany({
      where: { rescheduled_from_id: sessionId },
    });
    expect(children.length).toBe(1);
  });

  it('duas chamadas concorrentes de status (SKIPPED) resultam em exatamente 1 sucesso (200) e 1 conflito (409)', async () => {
    const resCreate = await request(app)
      .post('/api/planned-sessions')
      .set('Cookie', cookie)
      .send({
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start_local: '2026-10-14T09:00',
        planned_minutes: 30,
        priority: 'MEDIUM',
        activity_type: 'PRACTICE',
        blocks: [{ kind: 'PRACTICE', planned_minutes: 30 }],
      });
    expect(resCreate.status).toBe(201);
    const sessionId = resCreate.body.id;

    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/planned-sessions/${sessionId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'SKIPPED' }),
      request(app)
        .patch(`/api/planned-sessions/${sessionId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'SKIPPED' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('duas chamadas concorrentes de DELETE resultam em exatamente 1 sucesso (204) e a outra com 404 ou 409', async () => {
    const resCreate = await request(app)
      .post('/api/planned-sessions')
      .set('Cookie', cookie)
      .send({
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start_local: '2026-10-14T10:00',
        planned_minutes: 30,
        priority: 'LOW',
        activity_type: 'REVIEW',
        blocks: [{ kind: 'REVIEW', planned_minutes: 30 }],
      });
    expect(resCreate.status).toBe(201);
    const sessionId = resCreate.body.id;

    const [res1, res2] = await Promise.all([
      request(app).delete(`/api/planned-sessions/${sessionId}`).set('Cookie', cookie),
      request(app).delete(`/api/planned-sessions/${sessionId}`).set('Cookie', cookie),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(204);
    const otherStatus = statuses.find((s) => s !== 204);
    expect([404, 409]).toContain(otherStatus);
  });
});
