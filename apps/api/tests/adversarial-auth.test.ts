import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { sessionService } from '../src/services/session.service.js';

const prisma = new PrismaClient();

const uniqueRunId = `adv_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

/**
 * Utilitário para extrair o valor bruto do cookie session_id
 */
function extractSessionCookie(setCookieHeaders: string[] | string | undefined): string {
  if (!setCookieHeaders) return '';
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const sessionHeader = cookies.find((c) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Auditoria Adversarial de Segurança: Autenticação e Sessão (@estudos/api)', () => {
  afterAll(async () => {
    // Limpeza de todos os registros gerados durante os testes adversariais
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: uniqueRunId,
          },
        },
      });
    } catch (err) {
      console.warn('[Adv afterAll] Erro ao limpar usuários de teste:', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  // ============================================================================
  // 1. INVARIANTES DE REJEIÇÃO DE COOKIES DE SESSÃO MALICIOSOS / FORJADOS / EXPIRADOS
  // ============================================================================
  describe('1. Invariantes de Rejeição de Sessão em Rotas Protegidas (GET /api/auth/me)', () => {
    it('deve rejeitar requisição sem cabeçalho Cookie ou Authorization com HTTP 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Não autorizado');
    });

    it('deve rejeitar cookie session_id vazio ("session_id=") com HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'session_id=');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar cookie session_id com apenas espaços em branco com HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'session_id=    ');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar cookie com injeção SQL ("session_id=\' OR 1=1 --") com HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', "session_id=' OR 1=1 --");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar token arbitrário de 64 caracteres hex forjado com HTTP 401', async () => {
      const forgedToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `session_id=${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar payload gigante (tentativa de buffer overflow/DoS com 15.000 chars) com HTTP 401 sem falhar o servidor', async () => {
      const oversizedCookie = 'session_id=' + 'A'.repeat(15000);
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', oversizedCookie);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar Authorization Bearer com token forjado com HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token_invalido_malicioso_bearer');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar Authorization Bearer vazio ou malformado com HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('deve rejeitar sessão expirada após transcorrer o TTL de 7 dias', async () => {
      // 1. Cadastrar usuário para obter sessão legítima
      const email = `expirada_${uniqueRunId}@estudos.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuário Sessão Expirada',
          email,
          password: 'SenhaForte123!',
        });
      expect(regRes.status).toBe(201);
      const validCookie = extractSessionCookie(regRes.headers['set-cookie']);

      // 2. Verificar que a sessão funciona inicialmente
      const check1 = await request(app)
        .get('/api/auth/me')
        .set('Cookie', validCookie);
      expect(check1.status).toBe(200);

      // 3. Avançar o tempo do sistema em 8 dias (7 dias + 1 dia além do TTL)
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + eightDaysMs);

      try {
        // 4. Testar acesso com o cookie após o vencimento do prazo
        const checkExpired = await request(app)
          .get('/api/auth/me')
          .set('Cookie', validCookie);

        expect(checkExpired.status).toBe(401);
        expect(checkExpired.body.error.code).toBe('UNAUTHORIZED');
      } finally {
        vi.useRealTimers();
      }
    });

    it('deve invalidar a sessão e retornar 401 caso o usuário seja removido do banco enquanto a sessão existia em memória', async () => {
      // 1. Criar usuário temporário
      const email = `ghost_${uniqueRunId}@estudos.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuário Fantasma',
          email,
          password: 'SenhaForte123!',
        });
      expect(regRes.status).toBe(201);
      const cookie = extractSessionCookie(regRes.headers['set-cookie']);
      const userId = regRes.body.user.id;

      // 2. Deletar usuário diretamente do banco de dados (simulando remoção administrativa)
      await prisma.user.delete({ where: { id: userId } });

      // 3. Tentar acessar rota protegida com o cookie ainda presente na memória do SessionService
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ============================================================================
  // 2. INJEÇÃO SQL E PAYLOADS MALFORMADOS EM /api/auth/register E /api/auth/login
  // ============================================================================
  describe('2. Injeção SQL e Payloads Malformados em Cadastro e Login', () => {
    it('deve rejeitar injeção SQL no e-mail em /register com HTTP 400 (validação Zod)', async () => {
      const sqlInjections = [
        `' OR '1'='1' -- @estudos.test`,
        `admin' OR 1=1; --`,
        `test'; DROP TABLE users; --@estudos.test`,
        `" OR ""="`,
      ];

      for (const injection of sqlInjections) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Injetor SQL',
            email: injection,
            password: 'SenhaForte123!',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.details).toBeDefined();
      }
    });

    it('deve proteger o banco contra tentativas de injeção SQL no nome do usuário', async () => {
      const maliciousName = "Robert'); DROP TABLE subjects;--";
      const email = `safe_name_${uniqueRunId}@estudos.test`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: maliciousName,
          email,
          password: 'SenhaForte123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe(maliciousName);

      // Confirmar que o PostgreSQL e tabelas continuam íntegras
      const count = await prisma.user.count();
      expect(count).toBeGreaterThan(0);
    });

    it('deve rejeitar injeção SQL no login sem contornar autenticação com HTTP 401', async () => {
      // Cria um usuário legítimo primeiro
      const email = `alvo_login_${uniqueRunId}@estudos.test`;
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alvo Login',
          email,
          password: 'SenhaRealSegura123!',
        });

      // Tentativa de login com bypass SQL clássico na senha
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: "' OR '1'='1",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/incorret[ao]s|inválid[ao]s/i);
    });

    it('deve rejeitar tentativa de login com SQL injection no e-mail com HTTP 400 ou 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR 1=1 --",
          password: 'QualquerCoisa123',
        });

      // Zod rejeita formato inválido com 400
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve rejeitar payloads malformados e prototype pollution sem quebrar a API', async () => {
      // 1. Corpo não-objeto / vazio
      const resEmpty = await request(app).post('/api/auth/register').send({});
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

      // 2. Tipos de dados invertidos (números onde deveria ser string)
      const resWrongTypes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 12345,
          email: true,
          password: ['array'],
        });
      expect(resWrongTypes.status).toBe(400);
      expect(resWrongTypes.body.error.code).toBe('VALIDATION_ERROR');

      // 3. Objeto com campos de poluição de protótipo
      const resProto = await request(app)
        .post('/api/auth/register')
        .send({
          __proto__: { isAdmin: true },
          name: 'Teste Proto',
          email: `proto_${uniqueRunId}@estudos.test`,
          password: 'SenhaForte123!',
        });
      expect(resProto.status).toBe(201);
      expect((Object.prototype as any).isAdmin).toBeUndefined();
    });

    it('deve suportar strings longas (10.000 chars) no nome e senha sem estourar pilha ou crashar', async () => {
      const longName = 'Nome'.repeat(2500); // 10.000 chars
      const email = `long_str_${uniqueRunId}@estudos.test`;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: longName,
          email,
          password: 'SenhaForte123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe(longName);
    });
  });

  // ============================================================================
  // 3. REJEIÇÃO DE E-MAIL DUPLICADO (HTTP 409) E MENSAGEM EM PORTUGUÊS
  // ============================================================================
  describe('3. Rejeição de E-mail Duplicado (HTTP 409) e Normalização', () => {
    const baseEmail = `duplicado_${uniqueRunId}@estudos.test`;

    it('deve registrar com sucesso o primeiro usuário com o e-mail', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Usuário Original',
          email: baseEmail,
          password: 'SenhaOriginal123!',
        });

      expect(res.status).toBe(201);
    });

    it('deve rejeitar exatamente o mesmo e-mail com HTTP 409 CONFLICT e mensagem em português', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Tentativa Duplicada',
          email: baseEmail,
          password: 'OutraSenha456!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('E-mail já cadastrado no sistema.');
    });

    it('deve rejeitar e-mail em MAIÚSCULAS com HTTP 409 CONFLICT (insensibilidade a maiúsculas/minúsculas)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Tentativa Case Insensitive',
          email: baseEmail.toUpperCase(),
          password: 'OutraSenha456!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('E-mail já cadastrado no sistema.');
    });

    it('deve rejeitar e-mail com espaços no início e final com HTTP 409 CONFLICT (após trim)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Tentativa com Espaços',
          email: `   ${baseEmail}   `,
          password: 'OutraSenha456!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('E-mail já cadastrado no sistema.');
    });

    it('deve resistir a condição de corrida em cadastros simultâneos com mesmo e-mail (concorrência)', async () => {
      const raceEmail = `race_${uniqueRunId}@estudos.test`;

      // Dispara 5 requisições de cadastro simultâneas
      const promises = Array.from({ length: 5 }).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            name: `Concorrente ${index}`,
            email: raceEmail,
            password: `SenhaSegura${index}!`,
          })
      );

      const results = await Promise.all(promises);

      const statuses = results.map((r) => r.status);
      const bodies = results.map((r) => r.body);
      const successCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Diagnóstico empírico: 1 sucesso (201) e 4 conflitos (409)
      expect(successCount).toBe(1);
      // Ordena os status para comparação determinística independente da ordem de resolução assíncrona
      const sortedStatuses = [...statuses].sort((a, b) => a - b);
      expect({ statuses: sortedStatuses, conflictCount }).toEqual({
        statuses: [201, 409, 409, 409, 409],
        conflictCount: 4,
      });

      // Verificação direta no banco: apenas 1 linha deve existir para o e-mail
      const usersInDb = await prisma.user.findMany({
        where: { email: raceEmail.toLowerCase() },
      });
      expect(usersInDb.length).toBe(1);
    });
  });

  // ============================================================================
  // 4. SEGURANÇA DE HASH DE SENHA NO BANCO (POSTGRESQL + BCRYPT REAL)
  // ============================================================================
  describe('4. Auditoria Forense do Armazenamento de Senhas (PostgreSQL + Bcrypt)', () => {
    it('deve persistir a senha com hash bcrypt autêntico (custo 10, prefixo $2b$ ou $2a$, 60 chars) e nunca em texto plano', async () => {
      const plainPassword = 'MinhaSenhaUltraSecreta@2026!';
      const email = `forense_${uniqueRunId}@estudos.test`;

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Auditoria Hash',
          email,
          password: plainPassword,
        });

      expect(regRes.status).toBe(201);
      const userId = regRes.body.user.id;

      // Inspeção direta no banco de dados PostgreSQL
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      expect(dbUser).not.toBeNull();
      if (!dbUser) return;

      // 1. A senha gravada JAMAIS pode ser igual ao texto plano
      expect(dbUser.password_hash).not.toBe(plainPassword);

      // 2. Não pode conter a senha plana como substring
      expect(dbUser.password_hash.includes(plainPassword)).toBe(false);

      // 3. Deve iniciar com o padrão bcrypt ($2a$10$ ou $2b$10$)
      expect(dbUser.password_hash).toMatch(/^\$2[ab]\$10\$/);

      // 4. O comprimento padrão do hash bcrypt deve ser exatamente 60 caracteres
      expect(dbUser.password_hash.length).toBe(60);

      // 5. Verificação criptográfica real com a biblioteca bcrypt
      const isRealBcryptMatch = await bcrypt.compare(plainPassword, dbUser.password_hash);
      expect(isRealBcryptMatch).toBe(true);

      // 6. Verificação de rejeição para senha incorreta
      const isWrongMatch = await bcrypt.compare('SenhaCompletamenteDiferente123!', dbUser.password_hash);
      expect(isWrongMatch).toBe(false);
    });
  });

  // ============================================================================
  // 5. VERIFICAÇÃO DAS FLAGS DE SEGURANÇA DO COOKIE HTTPONLY (Set-Cookie)
  // ============================================================================
  describe('5. Auditoria dos Cabeçalhos Set-Cookie e Flags httpOnly', () => {
    it('deve emitir cookie com flag httpOnly, sameSite=lax e path=/ no cadastro (/register)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Cookie Register Test',
          email: `cookie_reg_${uniqueRunId}@estudos.test`,
          password: 'SenhaForte123!',
        });

      expect(res.status).toBe(201);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      expect(cookieStr).toContain('session_id=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(cookieStr.toLowerCase()).toContain('path=/');
    });

    it('deve emitir cookie com flag httpOnly, sameSite=lax e path=/ no login (/login)', async () => {
      const email = `cookie_login_${uniqueRunId}@estudos.test`;
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Cookie Login Test',
          email,
          password: 'SenhaForte123!',
        });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'SenhaForte123!',
        });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      expect(cookieStr).toContain('session_id=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(cookieStr.toLowerCase()).toContain('path=/');
    });

    it('deve limpar cookie com expiração no passado ou Max-Age=0 mantendo flags httpOnly no logout (/logout)', async () => {
      const email = `cookie_logout_${uniqueRunId}@estudos.test`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Cookie Logout Test',
          email,
          password: 'SenhaForte123!',
        });

      const cookie = extractSessionCookie(regRes.headers['set-cookie']);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(
        cookieStr.toLowerCase().includes('max-age=0') ||
        cookieStr.toLowerCase().includes('expires=thu, 01 jan 1970')
      ).toBe(true);
    });
  });

  // ============================================================================
  // 6. NORMALIZAÇÃO DE CREDENCIAIS NO LOGIN
  // ============================================================================
  describe('6. Normalização de Credenciais no Login', () => {
    const email = `login_norm_${uniqueRunId}@estudos.test`;

    it('deve permitir login mesmo com e-mail em letras maiúsculas ou espaços em branco', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Normalização Login',
          email,
          password: 'SenhaCorreta123!',
        });

      // Login com e-mail em maiúsculas e espaços laterais
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `  ${email.toUpperCase()}  `,
          password: 'SenhaCorreta123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email.toLowerCase());
    });
  });
});
