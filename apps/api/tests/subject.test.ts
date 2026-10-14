import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PrismaClient } from '@prisma/client';
import { PHASE2_ROUTES } from '@estudos/domain';

const prisma = new PrismaClient();

const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const testUser = {
  name: `User Subject Test ${uniqueSuffix}`,
  email: `subject_test_${uniqueSuffix}@estudos.test`,
  password: 'SenhaForte123!',
};

let sessionCookie = '';

function extractSessionCookie(setCookieHeaders: string[] | string | undefined): string {
  if (!setCookieHeaders) return '';
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const sessionHeader = cookies.find((c) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Testes de Integração: Matérias (Marco 3)', () => {
  beforeAll(async () => {
    // Registra e faz login para obter o cookie de sessão
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
    sessionCookie = extractSessionCookie(loginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: `subject_test_${uniqueSuffix}` } },
      });
    } catch (err) {
      console.warn('Erro ao limpar testes:', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Criação de Matéria (POST /api/subjects)', () => {
    it('deve rejeitar requisição sem cookie de sessão com HTTP 401 Unauthorized', async () => {
      const response = await request(app).post(PHASE2_ROUTES.subjects).send({ name: 'Matemática', color: '#FF0000' });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve validar o payload com o Zod e retornar HTTP 400 Bad Request se for inválido', async () => {
      const response = await request(app)
        .post(PHASE2_ROUTES.subjects)
        .set('Cookie', sessionCookie)
        .send({ name: '', color: 'corinvalida' });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toMatch(/O nome da matéria é obrigatório/i);
    });

    it('deve criar a matéria com sucesso e retornar HTTP 201', async () => {
      const response = await request(app)
        .post(PHASE2_ROUTES.subjects)
        .set('Cookie', sessionCookie)
        .send({ name: 'Física', color: '#1E90FF' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Física');
      expect(response.body.color).toBe('#1E90FF');
      expect(response.body.archived).toBe(false);
    });
  });

  describe('2. Listagem de Matérias (GET /api/subjects)', () => {
    it('deve listar matérias do usuário atual sem as arquivadas por padrão', async () => {
      // Cria uma matéria arquivada
      await request(app)
        .post(PHASE2_ROUTES.subjects)
        .set('Cookie', sessionCookie)
        .send({ name: 'Química Arquivada', color: '#00FF00' })
        .then(async (res) => {
          await request(app)
            .patch(`${PHASE2_ROUTES.subjects}/${res.body.id}`)
            .set('Cookie', sessionCookie)
            .send({ archived: true });
        });

      const response = await request(app).get(PHASE2_ROUTES.subjects).set('Cookie', sessionCookie);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const nomes = response.body.map((s: any) => s.name);
      expect(nomes).toContain('Física');
      expect(nomes).not.toContain('Química Arquivada');
    });

    it('deve incluir arquivadas se include_archived=true', async () => {
      const response = await request(app).get(`${PHASE2_ROUTES.subjects}?include_archived=true`).set('Cookie', sessionCookie);
      expect(response.status).toBe(200);
      const nomes = response.body.map((s: any) => s.name);
      expect(nomes).toContain('Física');
      expect(nomes).toContain('Química Arquivada');
    });
  });

  describe('3. Edição de Matéria (PATCH /api/subjects/:id)', () => {
    it('deve atualizar o nome e cor da matéria e retornar HTTP 200', async () => {
      // Pega a primeira matéria listada
      const listRes = await request(app).get(PHASE2_ROUTES.subjects).set('Cookie', sessionCookie);
      const subjectId = listRes.body[0].id;

      const response = await request(app)
        .patch(`${PHASE2_ROUTES.subjects}/${subjectId}`)
        .set('Cookie', sessionCookie)
        .send({ name: 'Física Avançada', color: '#000000' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Física Avançada');
      expect(response.body.color).toBe('#000000');
    });

    it('deve retornar 404 se tentar editar matéria de outro usuário ou inexistente', async () => {
      const response = await request(app)
        .patch(`${PHASE2_ROUTES.subjects}/123e4567-e89b-12d3-a456-426614174000`)
        .set('Cookie', sessionCookie)
        .send({ name: 'Hackeado' });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('4. Exclusão de Matéria (DELETE /api/subjects/:id)', () => {
    it('deve excluir a matéria se não houver vínculos e retornar HTTP 204', async () => {
      // Pega a matéria recém editada
      const listRes = await request(app).get(PHASE2_ROUTES.subjects).set('Cookie', sessionCookie);
      const subjectId = listRes.body.find((s: any) => s.name === 'Física Avançada')?.id;
      
      const response = await request(app)
        .delete(`${PHASE2_ROUTES.subjects}/${subjectId}`)
        .set('Cookie', sessionCookie);
      
      expect(response.status).toBe(204);

      // Confirma que não está mais na lista
      const getRes = await request(app).get(PHASE2_ROUTES.subjects).set('Cookie', sessionCookie);
      expect(getRes.body.map((s: any) => s.id)).not.toContain(subjectId);
    });
  });

});
