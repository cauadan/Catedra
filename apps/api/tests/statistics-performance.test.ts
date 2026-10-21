import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { sessionService, SESSION_COOKIE_NAME } from '../src/services/session.service.js';
import { seedDemoData, DEMO_USER_EMAIL } from '../scripts/seed-sample-6m.js';

describe('Performance & Anti-N+1 (/api/dashboard e /api/statistics): Invariância de Escala 10d vs 180d', () => {
  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: DEMO_USER_EMAIL } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('executa exatamente a mesma quantidade de queries SQL com 10 dias e com 180 dias de dados (<= 25 queries e < 2000ms)', async () => {
    const anchorDate = '2026-10-20';

    // 1. Seed de 10 dias
    const seed10 = await seedDemoData({ days: 10, anchorDate });
    const token10 = sessionService.createSession(seed10.userId);
    const cookie10 = `${SESSION_COOKIE_NAME}=${token10}`;

    let queriesDash10 = 0;
    let queriesStats10 = 0;
    let currentCounter: 'dash10' | 'stats10' | 'dash180' | 'stats180' | null = null;

    const onQuery = () => {
      if (currentCounter === 'dash10') queriesDash10++;
      else if (currentCounter === 'stats10') queriesStats10++;
      else if (currentCounter === 'dash180') queriesDash180++;
      else if (currentCounter === 'stats180') queriesStats180++;
    };

    let queriesDash180 = 0;
    let queriesStats180 = 0;

    (prisma as any).$on('query', onQuery);

    currentCounter = 'dash10';
    const t0Dash10 = performance.now();
    const resDash10 = await request(app)
      .get(`/api/dashboard?date=${anchorDate}`)
      .set('Cookie', cookie10);
    const elapsedDash10 = performance.now() - t0Dash10;

    currentCounter = 'stats10';
    const t0Stats10 = performance.now();
    const resStats10 = await request(app)
      .get(`/api/statistics?range=30d&date=${anchorDate}`)
      .set('Cookie', cookie10);
    const elapsedStats10 = performance.now() - t0Stats10;
    currentCounter = null;

    expect(resDash10.status).toBe(200);
    expect(resStats10.status).toBe(200);

    // 2. Seed de 180 dias (6 meses) na mesma condição de estado
    const seed180 = await seedDemoData({ days: 180, anchorDate });
    const token180 = sessionService.createSession(seed180.userId);
    const cookie180 = `${SESSION_COOKIE_NAME}=${token180}`;

    currentCounter = 'dash180';
    const t0Dash180 = performance.now();
    const resDash180 = await request(app)
      .get(`/api/dashboard?date=${anchorDate}`)
      .set('Cookie', cookie180);
    const elapsedDash180 = performance.now() - t0Dash180;

    currentCounter = 'stats180';
    const t0Stats180 = performance.now();
    const resStats180 = await request(app)
      .get(`/api/statistics?range=30d&date=${anchorDate}`)
      .set('Cookie', cookie180);
    const elapsedStats180 = performance.now() - t0Stats180;
    currentCounter = null;

    expect(resDash180.status).toBe(200);
    expect(resStats180.status).toBe(200);
    expect(seed180.sessionsCount).toBeGreaterThan(seed10.sessionsCount);

    // Prova Anti-N+1: número constante de queries SQL entre 10d e 180d
    expect(queriesDash180).toBeGreaterThan(0);
    expect(queriesDash180).toBe(queriesDash10);
    expect(queriesDash180).toBeLessThanOrEqual(25);

    expect(queriesStats180).toBeGreaterThan(0);
    expect(queriesStats180).toBe(queriesStats10);
    expect(queriesStats180).toBeLessThanOrEqual(25);

    expect(elapsedDash10).toBeLessThan(2000);
    expect(elapsedDash180).toBeLessThan(2000);
    expect(elapsedStats10).toBeLessThan(2000);
    expect(elapsedStats180).toBeLessThan(2000);
  });
});
