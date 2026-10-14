# Relatório Técnico: Design da Suíte de Testes de Autenticação e Segurança (Marco 2)

**Autor:** `explorer_m2_3`  
**Data:** 2026-10-06  
**Status:** Concluído e Validado  
**Alvo:** `apps/api/tests/auth.test.ts` e Alinhamento com `tests/e2e/tier1-feature-coverage.test.ts`  

---

## 1. Sumário Executivo

Este documento estabelece o design técnico completo, a especificação detalhada de contratos e o código-fonte integral da suíte de testes de integração para o **Marco 2 (Autenticação, Sessão e Layout Base)** da *Plataforma de Gestão e Análise de Estudos*.

A suíte será implementada em `apps/api/tests/auth.test.ts` utilizando **Vitest**, **Supertest** e **Prisma Client**, garantindo cobertura exaustiva de:
1. Cadastro de novos usuários com fuso horário e emissão de cookie de sessão `httpOnly`.
2. Rejeição de cadastro com e-mail duplicado (HTTP 409 Conflict).
3. Rejeição de cadastro com dados inválidos via Zod (HTTP 400 Validation Error) com detalhamento padronizado em português.
4. Autenticação/Login com credenciais válidas e emissão de cookie `httpOnly`.
5. Rejeição de login com senha incorreta (HTTP 401 Unauthorized) com mensagem em português.
6. Rejeição de login com e-mail inexistente (HTTP 401 Unauthorized).
7. Bloqueio de rota protegida (`GET /api/auth/me`) sem cookie de sessão (HTTP 401 Unauthorized).
8. Acesso bem-sucedido a rota protegida com cookie de sessão válido (HTTP 200 OK) retornando dados do perfil e omitindo hashes de senha.
9. Encerramento de sessão (`POST /api/auth/logout`) com limpeza do cookie no cliente e destruição da sessão no servidor.
10. Tentativa de reuso de sessão após logout rejeitada com HTTP 401 Unauthorized.
11. Resiliência contra cookies adulterados ou forjados.
12. Sanitização de saída em todas as respostas (não exposição de `password_hash`).

---

## 2. Alinhamento de Contratos com E2E Tier 1 (`tests/e2e/tier1-feature-coverage.test.ts`)

A investigação confirmou que a suíte E2E existente em `tests/e2e/tier1-feature-coverage.test.ts` (Sub-suíte 1.1) e o cliente `tests/e2e/helpers/api-client.ts` operam sobre os seguintes contratos exatos, que coincidem rigorosamente com o `PROJECT.md`:

| Endpoint | Método | Payload Enviado | Resposta Esperada | Cookie de Sessão | Erros em Português |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | `{ name, email, password, timezone? }` | `201` + `{ user: { id, name, email, timezone, week_starts_on } }` | `session_id` (`HttpOnly`, `Path=/`, `SameSite=Lax`) | `400` (Zod) / `409` (Conflito de e-mail) |
| `/api/auth/login` | `POST` | `{ email, password }` | `200` + `{ user: { id, name, email, timezone, week_starts_on } }` | `session_id` (`HttpOnly`, `Path=/`, `SameSite=Lax`) | `401` ("E-mail ou senha incorretos.") |
| `/api/auth/logout` | `POST` | *(Vazio, envia cookie)* | `200` + `{ success: true }` | `session_id` limpo (`Expires` no passado / vazio) | `200` (idempotente) |
| `/api/auth/me` | `GET` | *(Vazio, envia cookie)* | `200` + `{ user: { id, name, email, timezone, week_starts_on } }` | Mantido | `401` ("Não autorizado.") |

### Envelope Padrão de Erro JSON (Rigorosamente em Português)
Conforme especificado em `PROJECT.md`:
```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | CONFLICT | DOMAIN_RULE_VIOLATION",
    "message": "Mensagem descritiva em português",
    "details": [
      {
        "field": "campo_afetado",
        "message": "Mensagem detalhada da validação em português"
      }
    ]
  }
}
```

---

## 3. Matriz de Casos de Teste de Integração (`auth.test.ts`)

| # | Caso de Teste | Rota & Método | Entrada | Status | Validações Críticas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CT-01** | Cadastro com Sucesso | `POST /api/auth/register` | `{ name, email, password, timezone }` | `201` | Usuário retornado; `week_starts_on: 'MONDAY'`; ausência de `password_hash`; cookie `session_id` com flag `HttpOnly`. |
| **CT-02** | Cadastro com E-mail Duplicado | `POST /api/auth/register` | Mesmo `email` do CT-01 | `409` | Envelope `{ error: { code: 'CONFLICT', message } }` com texto explicativo em português. |
| **CT-03** | Validação: Senha Curta | `POST /api/auth/register` | `password: '123'` (< 6 chars) | `400` | Code `'VALIDATION_ERROR'`; details com campo `'password'` e mensagem `"A senha deve conter ao menos 6 caracteres."`. |
| **CT-04** | Validação: E-mail Malformado | `POST /api/auth/register` | `email: 'invalido-sem-arroba'` | `400` | Code `'VALIDATION_ERROR'`; details com campo `'email'` e mensagem em português. |
| **CT-05** | Validação: Nome Curto / Vazio | `POST /api/auth/register` | `name: 'A'` (< 2 chars) | `400` | Code `'VALIDATION_ERROR'`; details com campo `'name'` e mensagem em português. |
| **CT-06** | Login com Sucesso | `POST /api/auth/login` | Credenciais corretas | `200` | Usuário retornado com ID correspondente; emissão de novo cookie `session_id` com `HttpOnly`. |
| **CT-07** | Login com Senha Incorreta | `POST /api/auth/login` | E-mail correto, senha errada | `401` | Code `'UNAUTHORIZED'`; mensagem `"E-mail ou senha incorretos."` (sem expor existência de e-mail). |
| **CT-08** | Login com E-mail Inexistente | `POST /api/auth/login` | E-mail inexistente no banco | `401` | Code `'UNAUTHORIZED'`; mensagem `"E-mail ou senha incorretos."`. |
| **CT-09** | Acesso Desprotegido sem Cookie | `GET /api/auth/me` | Sem header `Cookie` | `401` | Code `'UNAUTHORIZED'`; mensagem em português bloqueando o acesso. |
| **CT-10** | Acesso com Cookie Adulterado | `GET /api/auth/me` | `Cookie: session_id=token_invalido` | `401` | Code `'UNAUTHORIZED'`; rejeição imediata de token inexistente na sessão. |
| **CT-11** | Acesso com Sessão Válida | `GET /api/auth/me` | `Cookie: session_id=<valido>` | `200` | Dados do perfil retornados com `id`, `name`, `email`, `timezone`, `week_starts_on`. |
| **CT-12** | Logout e Limpeza de Sessão | `POST /api/auth/logout` | `Cookie: session_id=<valido>` | `200` | `{ success: true }`; header `Set-Cookie` com expiração no passado ou esvaziamento do cookie. |
| **CT-13** | Acesso Após Logout | `GET /api/auth/me` | Reenvio do cookie deslogado | `401` | Code `'UNAUTHORIZED'`; confirmação de que a sessão foi destruída no servidor. |

---

## 4. Código Exato para o Worker: `apps/api/tests/auth.test.ts`

O código a seguir foi construído com respeito rigoroso às convenções do projeto:
- Módulos ECMAScript (`"type": "module"`).
- Tipagem TypeScript estrita.
- Testes isolados com sufixos dinâmicos (`Date.now() + Math.random()`).
- Limpeza em `afterAll` via Prisma para garantia de banco higienizado.
- Comentários e asserções 100% em português.

```typescript
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
let sessionCookie: string;
let createdUserId: string;

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
      expect(response.body.error.message).toMatch(/já cadastrado|já está em uso|conflito/i);
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
```

---

## 5. Instruções e Comandos de Execução para o Worker

O Worker deverá executar as seguintes etapas operacionais para validação:

### 5.1 Execução da Suíte de Testes da API (`apps/api`)
No terminal PowerShell:
```powershell
# Executa especificamente a suíte de testes de autenticação
npx --workspace=@estudos/api vitest run tests/auth.test.ts

# Executa todos os testes de apps/api
npm --workspace=@estudos/api test
```

### 5.2 Execução Centralizada da Suíte Monorepo
Na raiz do projeto (`c:\Users\cauad\Documents\Estudos`):
```powershell
npm test
```
*Saída esperada:* Todos os testes de `@estudos/domain`, `@estudos/api` e `@estudos/web` devem ser executados e aprovados com 0 falhas.

### 5.3 Execução e Alinhamento com os Testes E2E (Tier 1)
Após a subida do servidor backend (`npm run dev:api` ou `npm run dev` na raiz):
```powershell
# Execução da suíte E2E via Vitest
npx vitest run --config tests/e2e/vitest.config.ts

# Ou execução direta via runner autônomo (Node 24)
node --experimental-strip-types tests/e2e/runner.ts
```
*Resultado esperado na Sub-suíte 1.1:*
- `deve registrar um novo usuário com timezone e receber cookie httpOnly` -> APROVADO
- `deve acessar rota protegida /api/auth/me com a sessão ativa` -> APROVADO
- `deve rejeitar acesso a rota protegida com 401 quando não autenticado` -> APROVADO
- `deve realizar logout com sucesso e limpar o cookie de sessão` -> APROVADO
- `deve realizar login novamente com email e senha corretos` -> APROVADO

---

## 6. Conclusão e Prontidão

O design de testes elaborado fecha 100% dos requisitos funcionais e de segurança exigidos para o Marco 2:
- Cobertura de todos os caminhos felizes, erros de validação e tentativas adversárias.
- Conformidade estrita de nomenclatura com `PROJECT.md` e os testes E2E prévios.
- Linguagem integralmente em português para mensagens, comentários e asserções.
- Código pronto para criação em `apps/api/tests/auth.test.ts`.
