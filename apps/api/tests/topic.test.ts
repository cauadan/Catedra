import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PrismaClient } from '@prisma/client';
import { PHASE2_ROUTES } from '@estudos/domain';

const prisma = new PrismaClient();
const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const testUser = {
  name: `Topic Test User ${uniqueSuffix}`,
  email: `topic_test_${uniqueSuffix}@estudos.test`,
  password: 'SenhaForte123!',
};

let sessionCookie = '';
let subjectAId = '';
let subjectBId = '';

function extractSessionCookie(setCookieHeaders: string[] | string | undefined): string {
  if (!setCookieHeaders) return '';
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const sessionHeader = cookies.find((c) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Testes de Integração: Assuntos (Marco 3)', () => {
  beforeAll(async () => {
    // Cria usuário e faz login
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
    sessionCookie = extractSessionCookie(loginRes.headers['set-cookie']);

    // Cria duas matérias para os testes
    const subA = await request(app).post(PHASE2_ROUTES.subjects).set('Cookie', sessionCookie).send({ name: 'Matemática', color: '#111111' });
    const subB = await request(app).post(PHASE2_ROUTES.subjects).set('Cookie', sessionCookie).send({ name: 'História', color: '#222222' });
    subjectAId = subA.body.id;
    subjectBId = subB.body.id;
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: { contains: `topic_test_${uniqueSuffix}` } } });
    } catch (err) {
      console.warn('Erro limpar testes topic:', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Criação e Hierarquia Base', () => {
    let parentTopicId = '';

    it('deve criar um assunto raiz em Matemática', async () => {
      const res = await request(app)
        .post(PHASE2_ROUTES.topics)
        .set('Cookie', sessionCookie)
        .send({ subject_id: subjectAId, name: 'Álgebra' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Álgebra');
      expect(res.body.parent_id).toBeNull();
      parentTopicId = res.body.id;
    });

    it('deve criar um sub-assunto em Álgebra', async () => {
      const res = await request(app)
        .post(PHASE2_ROUTES.topics)
        .set('Cookie', sessionCookie)
        .send({ subject_id: subjectAId, parent_id: parentTopicId, name: 'Equações' });
      expect(res.status).toBe(201);
      expect(res.body.parent_id).toBe(parentTopicId);
    });

    it('deve rejeitar se a matéria informada for diferente da matéria do pai', async () => {
      // Tentar criar um sub-assunto de Álgebra (Matemática) dizendo que a matéria é História (subjectBId)
      const res = await request(app)
        .post(PHASE2_ROUTES.topics)
        .set('Cookie', sessionCookie)
        .send({ subject_id: subjectBId, parent_id: parentTopicId, name: 'Inválido' });
      expect(res.status).toBe(400); // Bad Request por inconsistência de domínio
      expect(res.body.error.message).toMatch(/pertence a outra matéria/i);
    });
  });

  describe('2. Movimentação e Prevenção de Ciclos', () => {
    let t1 = '', t2 = '', t3 = '';

    beforeAll(async () => {
      // Monta t1 -> t2 -> t3
      const rt1 = await request(app).post(PHASE2_ROUTES.topics).set('Cookie', sessionCookie).send({ subject_id: subjectAId, name: 'T1' });
      t1 = rt1.body.id;
      const rt2 = await request(app).post(PHASE2_ROUTES.topics).set('Cookie', sessionCookie).send({ subject_id: subjectAId, parent_id: t1, name: 'T2' });
      t2 = rt2.body.id;
      const rt3 = await request(app).post(PHASE2_ROUTES.topics).set('Cookie', sessionCookie).send({ subject_id: subjectAId, parent_id: t2, name: 'T3' });
      t3 = rt3.body.id;
    });

    it('deve impedir que T1 se torne filho de T3 (ciclo)', async () => {
      const res = await request(app)
        .patch(`${PHASE2_ROUTES.topics}/${t1}`)
        .set('Cookie', sessionCookie)
        .send({ parent_id: t3 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/ciclo/i);
    });

    it('deve impedir que T2 se torne filho de si mesmo (auto-ciclo)', async () => {
      const res = await request(app)
        .patch(`${PHASE2_ROUTES.topics}/${t2}`)
        .set('Cookie', sessionCookie)
        .send({ parent_id: t2 });
      expect(res.status).toBe(400);
    });

    it('deve mover T1 (e descendentes) para outra matéria (História)', async () => {
      const res = await request(app)
        .patch(`${PHASE2_ROUTES.topics}/${t1}`)
        .set('Cookie', sessionCookie)
        .send({ subject_id: subjectBId });
      
      expect(res.status).toBe(200);
      expect(res.body.subject_id).toBe(subjectBId);

      // Verifica se os descendentes (T2 e T3) também foram para História
      const getT3 = await request(app).get(`${PHASE2_ROUTES.topics}?subject_id=${subjectBId}`).set('Cookie', sessionCookie);
      const t3Data = getT3.body.find((t: any) => t.id === t3);
      expect(t3Data).toBeDefined();
      expect(t3Data.subject_id).toBe(subjectBId);
    });
  });

  describe('3. Arquivamento em Cascata', () => {
    it('deve arquivar uma matéria e arquivar os assuntos em cascata', async () => {
      // subjectBId agora contém T1, T2 e T3
      await request(app)
        .patch(`${PHASE2_ROUTES.subjects}/${subjectBId}`)
        .set('Cookie', sessionCookie)
        .send({ archived: true });

      // Ao buscar os assuntos de História sem include_archived=true, deve estar vazio
      const listSemArq = await request(app).get(`${PHASE2_ROUTES.topics}?subject_id=${subjectBId}`).set('Cookie', sessionCookie);
      expect(listSemArq.body.length).toBe(0);

      // Com include_archived=true, devem aparecer arquivados
      const listComArq = await request(app).get(`${PHASE2_ROUTES.topics}?subject_id=${subjectBId}&include_archived=true`).set('Cookie', sessionCookie);
      expect(listComArq.body.length).toBeGreaterThan(0);
      expect(listComArq.body[0].archived).toBe(true);
    });
    
    it('deve arquivar um assunto específico e arquivar seus descendentes em cascata', async () => {
      // Criar nova cadeia T4 -> T5 na Matemática (subjectAId)
      const rt4 = await request(app).post(PHASE2_ROUTES.topics).set('Cookie', sessionCookie).send({ subject_id: subjectAId, name: 'T4' });
      const rt5 = await request(app).post(PHASE2_ROUTES.topics).set('Cookie', sessionCookie).send({ subject_id: subjectAId, parent_id: rt4.body.id, name: 'T5' });

      // Arquiva T4
      await request(app)
        .patch(`${PHASE2_ROUTES.topics}/${rt4.body.id}`)
        .set('Cookie', sessionCookie)
        .send({ archived: true });

      // T5 deve ter sido arquivado em cascata
      const listComArq = await request(app).get(`${PHASE2_ROUTES.topics}?subject_id=${subjectAId}&include_archived=true`).set('Cookie', sessionCookie);
      const t5Data = listComArq.body.find((t: any) => t.id === rt5.body.id);
      expect(t5Data.archived).toBe(true);
    });
  });
});
