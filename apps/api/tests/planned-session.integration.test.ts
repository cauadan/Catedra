import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

let cookieUserA = '';
let cookieUserB = '';
let userA: { id: string };
let userB: { id: string };
let subjectA: { id: string };
let otherSubjectA: { id: string };
let topicA: { id: string };
let topicOtherSubjectA: { id: string };
let archivedSubjectA: { id: string };
let archivedTopicA: { id: string };

function extractCookie(headers: any): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const sessionHeader = cookies.find((c: string) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Testes de Integração: Agenda e Sessões Planejadas (Fase 3)', () => {
  beforeAll(async () => {
    // 1. Cadastrar e autenticar Usuário A
    const resRegA = await request(app).post('/api/auth/register').send({
      name: `User A ${suffix}`,
      email: `usera_${suffix}@estudos.test`,
      password: 'SenhaForte123!',
      timezone: 'America/Sao_Paulo',
    });
    cookieUserA = extractCookie(resRegA.headers);

    // Obter dados de A
    const meA = await request(app).get('/api/auth/me').set('Cookie', cookieUserA);
    userA = meA.body.user;

    // 2. Cadastrar e autenticar Usuário B
    const resRegB = await request(app).post('/api/auth/register').send({
      name: `User B ${suffix}`,
      email: `userb_${suffix}@estudos.test`,
      password: 'SenhaForte123!',
      timezone: 'America/Sao_Paulo',
    });
    cookieUserB = extractCookie(resRegB.headers);

    const meB = await request(app).get('/api/auth/me').set('Cookie', cookieUserB);
    userB = meB.body.user;

    // 3. Criar entidades de A
    subjectA = await prisma.subject.create({
      data: { user_id: userA.id, name: 'Matemática', color: '#3B82F6' },
    });
    otherSubjectA = await prisma.subject.create({
      data: { user_id: userA.id, name: 'História', color: '#EF4444' },
    });
    topicA = await prisma.topic.create({
      data: { user_id: userA.id, subject_id: subjectA.id, name: 'Álgebra Linear' },
    });
    topicOtherSubjectA = await prisma.topic.create({
      data: { user_id: userA.id, subject_id: otherSubjectA.id, name: 'Idade Média' },
    });

    archivedSubjectA = await prisma.subject.create({
      data: { user_id: userA.id, name: 'Matéria Arquivada', color: '#9CA3AF', archived: true },
    });
    archivedTopicA = await prisma.topic.create({
      data: { user_id: userA.id, subject_id: subjectA.id, name: 'Assunto Arquivado', archived: true },
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, userB.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Segurança e Isolamento Multi-inquilino', () => {
    it('rejeita qualquer rota sem cookie de sessão com 401 Unauthorized', async () => {
      const getRes = await request(app).get('/api/planned-sessions?view=day&date=2026-10-14');
      expect(getRes.status).toBe(401);

      const postRes = await request(app).post('/api/planned-sessions').send({});
      expect(postRes.status).toBe(401);
    });

    it('Usuário B não acessa, edita nem exclui sessão criada por Usuário A (retorna 404 Not Found)', async () => {
      // Usuário A cria sessão
      const resCreate = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: topicA.id,
          scheduled_start_local: '2026-10-14T10:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      expect(resCreate.status).toBe(201);
      const sessionA = resCreate.body;

      // Usuário B tenta atualizar -> 404
      const resPatch = await request(app)
        .patch(`/api/planned-sessions/${sessionA.id}`)
        .set('Cookie', cookieUserB)
        .send({ notes: 'Tentativa hacker' });
      expect(resPatch.status).toBe(404);

      // Usuário B tenta remarcar -> 404
      const resReschedule = await request(app)
        .post(`/api/planned-sessions/${sessionA.id}/reschedule`)
        .set('Cookie', cookieUserB)
        .send({ scheduled_start_local: '2026-10-15T10:00' });
      expect(resReschedule.status).toBe(404);

      // Usuário B tenta excluir -> 404
      const resDelete = await request(app)
        .delete(`/api/planned-sessions/${sessionA.id}`)
        .set('Cookie', cookieUserB);
      expect(resDelete.status).toBe(404);
    });
  });

  describe('2. Validação Zod Estrita e Regras de Domínio', () => {
    it('rejeita payload com campo extra desconhecido com 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: topicA.id,
          scheduled_start_local: '2026-10-14T11:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          campo_invalido: 'hack',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejeita scheduled_start_local no PATCH orientando a usar remarcação com 400', async () => {
      // Cria sessão válida
      const resCreate = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: topicA.id,
          scheduled_start_local: '2026-10-14T12:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      const sessionId = resCreate.body.id;

      const resPatch = await request(app)
        .patch(`/api/planned-sessions/${sessionId}`)
        .set('Cookie', cookieUserA)
        .send({ scheduled_start_local: '2026-10-14T13:00' });
      expect(resPatch.status).toBe(400);
      expect(resPatch.body.error.message).toMatch(/remarca/i);
    });

    it('rejeita criação quando topic pertence a outra matéria com 400', async () => {
      const res = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: topicOtherSubjectA.id, // Idade Média pertence a História, não Matemática
          scheduled_start_local: '2026-10-14T14:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/outra matéria/i);
    });

    it('rejeita criação ou remarcação com matéria ou assunto arquivado com 400', async () => {
      // Criar com matéria arquivada
      const resMatArq = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: archivedSubjectA.id,
          topic_id: topicA.id,
          scheduled_start_local: '2026-10-14T15:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      expect(resMatArq.status).toBe(400);

      // Criar com tópico arquivado
      const resTopArq = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: archivedTopicA.id,
          scheduled_start_local: '2026-10-14T15:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      expect(resTopArq.status).toBe(400);
    });

    it('permite editar notas de sessão cujo assunto foi arquivado após o agendamento', async () => {
      // 1. Criar assunto ativo temporário
      const tempTopic = await prisma.topic.create({
        data: { user_id: userA.id, subject_id: subjectA.id, name: 'Assunto a Arquivar' },
      });

      // 2. Agendar sessão com ele
      const resCreate = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: tempTopic.id,
          scheduled_start_local: '2026-10-14T16:00',
          planned_minutes: 60,
          priority: 'MEDIUM',
          activity_type: 'THEORY',
          blocks: [{ kind: 'NEW_CONTENT', planned_minutes: 60 }],
        });
      expect(resCreate.status).toBe(201);
      const sessionId = resCreate.body.id;

      // 3. Arquivar o assunto depois do agendamento
      await prisma.topic.update({
        where: { id: tempTopic.id },
        data: { archived: true },
      });

      // 4. Editar apenas notas da sessão deve continuar permitido (200 OK)
      const resUpdate = await request(app)
        .patch(`/api/planned-sessions/${sessionId}`)
        .set('Cookie', cookieUserA)
        .send({ notes: 'Editando notas mesmo após assunto ter sido arquivado' });
      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.notes).toContain('mesmo após assunto');

      // 5. Remarcar esta sessão deve ser recusado com 400 (orientando a desarquivar)
      const resReschedule = await request(app)
        .post(`/api/planned-sessions/${sessionId}/reschedule`)
        .set('Cookie', cookieUserA)
        .send({ scheduled_start_local: '2026-10-15T16:00' });
      expect(resReschedule.status).toBe(400);
      expect(resReschedule.body.error.message).toMatch(/desarquive/i);
    });
  });

  describe('3. Máquina de Estados e Exclusão', () => {
    it('pular sessão (status SKIPPED) e verificar que ela é excluível', async () => {
      const resCreate = await request(app)
        .post('/api/planned-sessions')
        .set('Cookie', cookieUserA)
        .send({
          subject_id: subjectA.id,
          topic_id: topicA.id,
          scheduled_start_local: '2026-10-14T17:00',
          planned_minutes: 30,
          priority: 'LOW',
          activity_type: 'PRACTICE',
          blocks: [{ kind: 'PRACTICE', planned_minutes: 30 }],
        });
      const sessionId = resCreate.body.id;

      // Pular sessão
      const resSkip = await request(app)
        .patch(`/api/planned-sessions/${sessionId}/status`)
        .set('Cookie', cookieUserA)
        .send({ status: 'SKIPPED' });
      expect(resSkip.status).toBe(200);
      expect(resSkip.body.status).toBe('SKIPPED');

      // Excluir sessão SKIPPED sem dependentes -> 204
      const resDel = await request(app)
        .delete(`/api/planned-sessions/${sessionId}`)
        .set('Cookie', cookieUserA);
      expect(resDel.status).toBe(204);
    });
  });
});
