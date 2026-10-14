import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

export function extractCookie(headers: any): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const sessionHeader = cookies.find((c: string) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

export async function createStudyUser(label: string) {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const email = `${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${suffix}@estudos.test`;

  const resReg = await request(app).post('/api/auth/register').send({
    name: `User ${label} ${suffix}`,
    email,
    password: 'SenhaForte123!',
    timezone: 'America/Sao_Paulo',
  });

  const cookie = extractCookie(resReg.headers);

  const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
  const user = me.body.user;

  const subject = await prisma.subject.create({
    data: {
      user_id: user.id,
      name: `Matéria ${label} ${suffix}`,
      color: '#3B82F6',
    },
  });

  const topic = await prisma.topic.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      name: `Assunto ${label} ${suffix}`,
    },
  });

  return {
    cookie,
    user,
    subject,
    topic,
  };
}

export async function backdateSession(sessionId: string, seconds: number) {
  const deltaMs = seconds * 1000;

  const session = await prisma.studySession.findUnique({
    where: { id: sessionId },
    include: { session_events: true },
  });

  if (!session) return;

  const newStartedAt = new Date(session.started_at.getTime() - deltaMs);
  await prisma.studySession.update({
    where: { id: sessionId },
    data: { started_at: newStartedAt },
  });

  for (const ev of session.session_events) {
    const newOccurred = new Date(ev.occurred_at.getTime() - deltaMs);
    await prisma.sessionEvent.update({
      where: { id: ev.id },
      data: { occurred_at: newOccurred },
    });
  }
}
