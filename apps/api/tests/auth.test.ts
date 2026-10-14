import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sufixo único por execução para evitar colisões no banco de dados
const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const testUser = {
  name: `Estudante Teste ${uniqueSuffix}`,
  email: `teste_auth_${uniqueSuffix}@estudos.test`,
  password: 'SenhaForte123!',
  timezone: 'America/Sao_Paulo',
};

// Variáveis para encadeamento e teste de persistência de sessão
let sessionCookie = '';
let createdUserId = '';

/**
 * Utilitário para extrair o valor bruto do cookie de sessão ('session_id=...')
 * do cabeçalho Set-Cookie gerado pelo Express/cookie-parser.
 */
function extractSessionCookie(setCookieHeaders: string[] | string | undefined): string {
  if (!setCookieHeaders) return '';
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const sessionHeader = cookies.find((c) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Testes de Integração: Autenticação e Segurança (@estudos/api)', () => {
  afterAll(async () => {
    // Limpeza de usuários criados nesta suíte de testes
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: `teste_auth_${uniqueSuffix}`,
          },
        },
      });
    } catch (err) {
      console.warn('[afterAll] Aviso na limpeza de usuários de teste:', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  // ============================================================================
  // 1. CADASTRO DE USUÁRIO (POST /api/auth/register)
  // ============================================================================
  describe('1. Cadastro de Usuário (POST /api/auth/register)', () => {
    it('deve registrar um novo usuário com sucesso, retornar HTTP 201 e emitir cookie httpOnly', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');

      const user = response.body.user;
      expect(user).toHaveProperty('id');
      expect(user.email).toBe(testUser.email);
      expect(user.name).toBe(testUser.name);
      expect(user.timezone).toBe(testUser.timezone);
      expect(user.week_starts_on).toBe('MONDAY');

      // Invariante de Segurança: Hash de senha e senhas puras NUNCA devem ser expostos
      expect(user).not.toHaveProperty('password_hash');
      expect(user).not.toHaveProperty('password');

      createdUserId = user.id;

      // Validação do Cookie httpOnly no cabeçalho Set-Cookie
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      expect(cookieStr).toContain('session_id=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');

      sessionCookie = extractSessionCookie(setCookie);
      expect(sessionCookie).toBeTruthy();
    });

    it('deve rejeitar cadastro com e-mail duplicado retornando HTTP 409 Conflict em português', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'CONFLICT');
      expect(response.body.error.message).toMatch(/cadastrado|já está em uso|conflito/i);
    });

    it('deve rejeitar cadastro com senha curta retornando HTTP 400 com detalhes Zod em português', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuário Senha Fraca',
          email: `senha_curta_${uniqueSuffix}@estudos.test`,
          password: '123', // Menor que 6 caracteres
          timezone: 'America/Sao_Paulo',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error).toHaveProperty('details');
      expect(Array.isArray(response.body.error.details)).toBe(true);

      const passwordDetail = response.body.error.details.find(
        (d: { field: string; message: string }) => d.field === 'password'
      );
      expect(passwordDetail).toBeDefined();
      expect(passwordDetail.message).toMatch(/ao menos 6 caracteres/i);
    });

    it('deve rejeitar cadastro com e-mail malformado retornando HTTP 400 e erro no campo email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuário Email Ruim',
          email: 'email-invalido-sem-formato-correto',
          password: 'SenhaForte123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      const emailDetail = response.body.error.details.find(
        (d: { field: string; message: string }) => d.field === 'email'
      );
      expect(emailDetail).toBeDefined();
      expect(emailDetail.message).toMatch(/inválido/i);
    });

    it('deve rejeitar cadastro com nome menor que 2 caracteres retornando HTTP 400', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: `nome_curto_${uniqueSuffix}@estudos.test`,
          password: 'SenhaForte123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      const nameDetail = response.body.error.details.find(
        (d: { field: string; message: string }) => d.field === 'name'
      );
      expect(nameDetail).toBeDefined();
      expect(nameDetail.message).toMatch(/ao menos 2 caracteres/i);
    });
  });

  // ============================================================================
  // 2. LOGIN E SESSÃO (POST /api/auth/login)
  // ============================================================================
  describe('2. Login e Emissão de Sessão (POST /api/auth/login)', () => {
    it('deve realizar login com sucesso com credenciais válidas e definir novo cookie httpOnly', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(createdUserId);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password_hash');

      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      expect(cookieStr).toContain('session_id=');
      expect(cookieStr.toLowerCase()).toContain('httponly');

      // Atualiza cookie para os próximos testes
      sessionCookie = extractSessionCookie(setCookie);
    });

    it('deve rejeitar login com senha incorreta com HTTP 401 Unauthorized e mensagem em português', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SenhaIncorreta999!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toMatch(/incorret[ao]s|inválid[ao]s/i);
    });

    it('deve rejeitar login com e-mail inexistente com HTTP 401 Unauthorized (sem vazar enumeração)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `usuario_nao_existe_${uniqueSuffix}@estudos.test`,
          password: 'QualquerSenha123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toMatch(/incorret[ao]s|inválid[ao]s/i);
    });
  });

  // ============================================================================
  // 3. ROTA PROTEGIDA E MIDDLEWARE (GET /api/auth/me)
  // ============================================================================
  describe('3. Rota Protegida de Perfil (GET /api/auth/me)', () => {
    it('deve rejeitar acesso à rota protegida com HTTP 401 quando requisição não possui cookie de sessão', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBeDefined();
    });

    it('deve rejeitar acesso com cookie forjado ou inválido retornando HTTP 401 Unauthorized', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'session_id=token_falso_malicioso_123456789');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve permitir acesso com cookie de sessão válido e retornar dados do perfil', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');

      const user = response.body.user;
      expect(user.id).toBe(createdUserId);
      expect(user.email).toBe(testUser.email);
      expect(user.name).toBe(testUser.name);
      expect(user.timezone).toBe(testUser.timezone);
      expect(user.week_starts_on).toBe('MONDAY');
      expect(user).not.toHaveProperty('password_hash');
    });
  });

  // ============================================================================
  // 4. LOGOUT E DESTRUIÇÃO DE SESSÃO (POST /api/auth/logout)
  // ============================================================================
  describe('4. Logout e Invalidação de Sessão (POST /api/auth/logout)', () => {
    it('deve realizar logout com sucesso, responder HTTP 200 e limpar cookie no cliente', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Validação de que o cookie foi expirado/limpo
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      expect(
        cookieStr.includes('session_id=;') ||
        cookieStr.toLowerCase().includes('expires=thu, 01 jan 1970') ||
        cookieStr.toLowerCase().includes('max-age=0')
      ).toBe(true);
    });

    it('deve rejeitar acesso a rota protegida com HTTP 401 após a sessão ter sido invalidada', async () => {
      // Reenvia exatamente o mesmo cookie que foi invalidado no logout
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
