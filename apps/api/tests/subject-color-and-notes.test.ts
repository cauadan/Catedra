import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';

describe('Subject Colors & Study Session Notes API (@estudos/api)', () => {
  let user: Awaited<ReturnType<typeof createStudyUser>>;
  let otherUser: Awaited<ReturnType<typeof createStudyUser>>;

  beforeAll(async () => {
    user = await createStudyUser('ColorNotesUser');
    otherUser = await createStudyUser('ColorNotesOther');
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [user.user.id, otherUser.user.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. deve atualizar a cor da matéria via PATCH /api/subjects/:id', async () => {
    const newColor = '#10B981';
    const res = await request(app)
      .patch(`/api/subjects/${user.subject.id}`)
      .set('Cookie', user.cookie)
      .send({ color: newColor });

    expect(res.status).toBe(200);
    expect(res.body.color).toBe(newColor);

    // Confirma persistência no banco
    const subjectInDb = await prisma.subject.findUnique({
      where: { id: user.subject.id },
    });
    expect(subjectInDb?.color).toBe(newColor);
  });

  it('2. deve rejeitar alteração de cor de matéria pertencente a outro usuário', async () => {
    const res = await request(app)
      .patch(`/api/subjects/${user.subject.id}`)
      .set('Cookie', otherUser.cookie)
      .send({ color: '#EF4444' });

    expect(res.status).toBe(404);
  });

  it('3. deve criar uma sessão, concluir, e atualizar anotações via PATCH /api/study-sessions/:id/notes', async () => {
    // 3.1 Criar sessão avulsa
    const resCreate = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user.cookie)
      .send({
        topic_id: user.topic.id,
        blocks: [{ kind: 'REVIEW', planned_minutes: 10 }],
      });
    expect(resCreate.status).toBe(201);
    const sessionId = resCreate.body.data.id;

    // 3.2 Concluir sessão
    const resFinish = await request(app)
      .post(`/api/study-sessions/${sessionId}/finish`)
      .set('Cookie', user.cookie)
      .send({});
    expect(resFinish.status).toBe(200);

    // 3.3 Atualizar anotações via PATCH /api/study-sessions/:id
    const noteContent = 'Revisão profunda dos conceitos fundamentais de controle de constitucionalidade.';
    const resNotes = await request(app)
      .patch(`/api/study-sessions/${sessionId}`)
      .set('Cookie', user.cookie)
      .send({ notes: noteContent });

    expect(resNotes.status).toBe(200);
    expect(resNotes.body.data.evaluation?.notes).toBe(noteContent);

    // 3.4 Verificar se GET /api/study-sessions/:id retorna as anotações
    const resGet = await request(app)
      .get(`/api/study-sessions/${sessionId}`)
      .set('Cookie', user.cookie);

    expect(resGet.status).toBe(200);
    expect(resGet.body.data.evaluation?.notes).toBe(noteContent);
    expect(resGet.body.data.topic.subject.color).toBeDefined();

    // 3.5 Atualizar via PATCH /api/study-sessions/:id/notes
    const updatedNote = 'Nota atualizada com novas observações.';
    const resPatchNotes = await request(app)
      .patch(`/api/study-sessions/${sessionId}/notes`)
      .set('Cookie', user.cookie)
      .send({ notes: updatedNote });

    expect(resPatchNotes.status).toBe(200);
    expect(resPatchNotes.body.data.evaluation?.notes).toBe(updatedNote);
  }, 45000);

  it('4. deve listar as sessões recentes via GET /api/study-sessions', async () => {
    const res = await request(app)
      .get('/api/study-sessions?limit=5')
      .set('Cookie', user.cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].status).toBe('FINISHED');
  });

  it('5. deve retornar recentSessions no GET /api/dashboard', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', user.cookie);

    expect(res.status).toBe(200);
    const dashData = res.body.data ?? res.body;
    expect(dashData.recentSessions).toBeDefined();
    expect(Array.isArray(dashData.recentSessions)).toBe(true);
    expect(dashData.recentSessions.length).toBeGreaterThan(0);
  });
});
