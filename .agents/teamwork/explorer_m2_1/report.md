# Relatório Técnico de Design: Arquitetura de Autenticação e Sessões (Milestone 2 - Backend)

**Data:** 2026-10-06  
**Autor:** Agente `explorer_m2_1`  
**Escopo:** `apps/api` (Autenticação, Hashing, Gestão de Sessão, Middleware, Tratamento de Erros)  
**Destinatário:** Orquestrador Geral e Worker de Implementação do Milestone 2  

---

## 1. Resumo Executivo e Arquitetura Geral

Este documento define o design técnico detalhado para a implementação da **Autenticação e Gestão de Sessões** do backend (`apps/api`) no Milestone 2, atendendo integralmente aos requisitos de `ORIGINAL_REQUEST.md` (R1 e R3), `PROJECT.md` (Features 5, 6, 7, 8 e 9), ao arquivo `01-contexto-do-projeto.md` e aos testes E2E já estabelecidos em `tests/e2e/tier1-feature-coverage.test.ts`.

### 1.1 Premissas Arquiteturais
1. **Zero Novas Dependências Externas**: Todas as bibliotecas necessárias (`bcrypt`, `@types/bcrypt`, `cookie-parser`, `@types/cookie-parser`, `zod`, `@prisma/client`, `supertest`, `vitest`) já se encontram devidamente instaladas e operacionais no monorepo (`apps/api/package.json`).
2. **Conformidade Estrita com ESM e NodeNext**: O pacote `apps/api` opera sob `"type": "module"` com resolução `NodeNext`. Todos os imports de arquivos locais em TypeScript devem incluir a extensão `.js` (ex.: `import { authRouter } from './routes/auth.routes.js'`).
3. **Preservação do Schema do Banco de Dados**: Conforme a regra 4 de `01-contexto-do-projeto.md` ("Não altere o schema do banco sem avisar e explicar o motivo"), o armazenamento de sessões é implementado via **Session Store em Memória** de alta performance com TTL e expiração automática, não exigindo migrações adicionais no PostgreSQL nem alteração dos 11 modelos prescritos.
4. **Isolamento Multilocatário e Injeção de Contexto**: O middleware de autenticação valida a integridade da sessão, localiza o usuário no PostgreSQL e injeta `req.userId` (string) e `req.user` (objeto seguro sem `password_hash`), servindo de base de segurança para todas as rotas privadas dos Marcos 2, 3 e seguintes.
5. **Comunicação 100% em Português**: Todas as mensagens de erro, descrições e comentários de código seguem rigorosamente a língua portuguesa, mantendo apenas identificadores técnicos do schema em inglês.

---

## 2. Estratégia de Criptografia de Senha (bcrypt)

### 2.1 Decisão Técnica
Optou-se pelo algoritmo **bcrypt** versão `^5.1.1` (já presente nas dependências).

- **Custo Computacional (Salt Rounds)**: `10` rounds.
  - Oferece proteção contra ataques de força bruta e dicionário.
  - Tempo de execução em CPU moderna entre 60ms e 80ms, ideal para manter baixa latência nas requisições interativas e agilidade na execução da suíte de testes.
- **Funções Exportadas** (`apps/api/src/utils/password.ts`):
  - `hashPassword(password: string): Promise<string>`: Gera hash seguro com salt de 10 rounds.
  - `verifyPassword(password: string, hash: string): Promise<boolean>`: Compara senha em texto plano com o hash armazenado em tempo constante para evitar ataques de temporização (*timing attacks*).

---

## 3. Arquitetura de Sessão e Cookies httpOnly

### 3.1 Identificador e Token de Sessão
- **Geração Criptográfica**: Cada sessão é identificada por uma string hexadecimal de 256 bits gerada via `crypto.randomBytes(32).toString('hex')`. Isso garante entropia imprevisível e resistência absoluta contra ataques de adivinhação de sessão.
- **Duração da Sessão**: 7 dias (`7 * 24 * 60 * 60 * 1000` milissegundos).
- **Nome do Cookie**: `session_id` (compatível com `PROJECT.md` e o cliente `tests/e2e/helpers/api-client.ts`).

### 3.2 Configurações de Cookie (`CookieOptions`)
```typescript
{
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
}
```
- `httpOnly: true`: Impede leitura via scripts maliciosos no cliente (proteção contra XSS).
- `sameSite: 'lax'`: Garante proteção contra CSRF em requisições de navegação e mutações cross-origin.
- `path: '/'`: Cookie acessível em todos os caminhos da API.
- `secure`: Ativado exclusivamente em ambiente de produção (`HTTPS`), permitindo desenvolvimento local e testes em `HTTP`.

### 3.3 Gerenciamento de Sessão (`SessionService`)
O serviço em `apps/api/src/services/session.service.ts` gerencia um mapa (`Map<string, SessionData>`) com:
- `createSession(userId: string): string`
- `getSession(sessionId: string | undefined): SessionData | null` (valida existência e expiração por timestamp)
- `deleteSession(sessionId: string | undefined): void`
- `deleteUserSessions(userId: string): void`
- `cleanupExpiredSessions(): void` (varredura periódica a cada 1 hora com timer desassociado `timer.unref()` para não travar o desligamento dos processos de teste)

---

## 4. Especificação dos Endpoints de Autenticação (`/api/auth`)

### 4.1 `POST /api/auth/register` (Cadastro de Usuário)
- **Entrada (JSON)**:
  ```json
  {
    "name": "Nome Completo",
    "email": "usuario@estudos.test",
    "password": "SenhaForte123!",
    "timezone": "America/Sao_Paulo"
  }
  ```
- **Validação com Zod**:
  - `name`: string não vazia, mínimo de 2 caracteres.
  - `email`: formato de e-mail válido (normalizado para minúsculas).
  - `password`: mínimo de 6 caracteres.
  - `timezone`: string opcional; caso não informada ou vazia, assume `'America/Sao_Paulo'`.
- **Regras de Negócio**:
  1. Valida entrada; se inválida, responde **HTTP 400** com código `VALIDATION_ERROR` e lista detalhada de campos.
  2. Verifica duplicidade de e-mail no PostgreSQL (`prisma.user.findUnique`); se já existir, responde **HTTP 409** com código `CONFLICT` e mensagem `"Já existe um usuário cadastrado com este e-mail."`.
  3. Gera hash da senha via `hashPassword`.
  4. Salva usuário no banco com `week_starts_on: "MONDAY"` (regra do contexto §5).
  5. Cria sessão no `sessionService` e define cookie `session_id` com flags seguras.
- **Resposta de Sucesso**: **HTTP 201 Created**
  ```json
  {
    "user": {
      "id": "uuid-v4",
      "name": "Nome Completo",
      "email": "usuario@estudos.test",
      "timezone": "America/Sao_Paulo",
      "week_starts_on": "MONDAY"
    }
  }
  ```

---

### 4.2 `POST /api/auth/login` (Autenticação)
- **Entrada (JSON)**:
  ```json
  {
    "email": "usuario@estudos.test",
    "password": "SenhaForte123!"
  }
  ```
- **Regras de Negócio**:
  1. Valida entrada com `loginSchema`; se inválida, retorna **HTTP 400** (`VALIDATION_ERROR`).
  2. Busca usuário por e-mail (normalizado para minúsculas). Se não encontrado, responde **HTTP 401** com código `UNAUTHORIZED` e mensagem `"Credenciais inválidas. Verifique seu e-mail e senha."`.
  3. Verifica hash com `verifyPassword`. Se divergente, responde **HTTP 401** com a mesma mensagem neutra (evitando enumeração de contas).
  4. Cria sessão no `sessionService` e define cookie `session_id`.
- **Resposta de Sucesso**: **HTTP 200 OK**
  ```json
  {
    "user": {
      "id": "uuid-v4",
      "name": "Nome Completo",
      "email": "usuario@estudos.test",
      "timezone": "America/Sao_Paulo",
      "week_starts_on": "MONDAY"
    }
  }
  ```

---

### 4.3 `POST /api/auth/logout` (Encerramento de Sessão)
- **Regras de Negócio**:
  1. Lê o cookie `session_id` presente na requisição.
  2. Caso exista, remove a sessão ativa do `sessionService`.
  3. Invoca `res.clearCookie('session_id', { httpOnly: true, sameSite: 'lax', path: '/' })`.
- **Resposta de Sucesso**: **HTTP 200 OK**
  ```json
  {
    "success": true
  }
  ```

---

### 4.4 `GET /api/auth/me` (Consulta de Perfil Autenticado)
- **Protegido por**: `authMiddleware`.
- **Regras de Negócio**:
  - Se a sessão for ausente, vazia ou inválida, o middleware rejeita imediatamente com **HTTP 401**.
  - Se válida, o middleware injeta `req.user`.
- **Resposta de Sucesso**: **HTTP 200 OK**
  ```json
  {
    "user": {
      "id": "uuid-v4",
      "name": "Nome Completo",
      "email": "usuario@estudos.test",
      "timezone": "America/Sao_Paulo",
      "week_starts_on": "MONDAY"
    }
  }
  ```

---

## 5. Especificação do Middleware de Autenticação (`auth.middleware.ts`)

O middleware `authMiddleware` é o guardião de todas as rotas privadas da plataforma:
1. **Extração do Identificador de Sessão**:
   - Lê primariamente `req.cookies?.session_id`.
   - Adicionalmente, oferece suporte retroativo para cabeçalho `Authorization: Bearer <sessionId>`.
2. **Validação de Token Não Vazio**:
   - Se ausente ou vazio (`!sessionId || sessionId.trim() === ''`), rejeita com **HTTP 401**:
     ```json
     {
       "error": {
         "code": "UNAUTHORIZED",
         "message": "Não autorizado"
       }
     }
     ```
3. **Validação no Session Store**:
   - Consulta `sessionService.getSession(sessionId)`.
   - Se retornar `null` (expirada ou inexistente), responde **HTTP 401** com a mesma estrutura.
4. **Resolução de Usuário no Banco de Dados**:
   - Consulta `prisma.user.findUnique({ where: { id: session.userId } })` omitindo `password_hash`.
   - Caso o usuário tenha sido removido do banco, remove a sessão órfã do store e responde **HTTP 401**.
5. **Injeção no Objeto de Requisição Express**:
   - Atribui `req.userId = user.id`.
   - Atribui `req.user = user`.
   - Executa `next()` para prosseguir ao controlador de destino.

---

## 6. Envelope Padronizado de Respostas e Erros em Português

Conforme especificado em `PROJECT.md` (§ Contratos de Interface):

```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | CONFLICT | DOMAIN_RULE_VIOLATION | INTERNAL_ERROR",
    "message": "Mensagem descritiva em português",
    "details": [
      {
        "field": "campo",
        "message": "Mensagem detalhada da validação em português"
      }
    ]
  }
}
```

### 6.1 Matriz de Erros de Autenticação
| Cenário | Status HTTP | `error.code` | `error.message` |
|---|---|---|---|
| Dados de cadastro inválidos | 400 | `VALIDATION_ERROR` | `"Dados de cadastro inválidos."` (+ details) |
| E-mail duplicado | 409 | `CONFLICT` | `"Já existe um usuário cadastrado com este e-mail."` |
| Dados de login inválidos | 400 | `VALIDATION_ERROR` | `"Dados de login inválidos."` (+ details) |
| Credenciais incorretas (senha ou e-mail) | 401 | `UNAUTHORIZED` | `"Credenciais inválidas. Verifique seu e-mail e senha."` |
| Requisição a rota protegida sem sessão | 401 | `UNAUTHORIZED` | `"Não autorizado"` |
| Sessão expirada ou revogada | 401 | `UNAUTHORIZED` | `"Não autorizado"` |
| Rota inexistente | 404 | `NOT_FOUND` | `"Rota '{METODO} {CAMINHO}' não encontrada."` |
| Erro interno inesperado | 500 | `INTERNAL_ERROR` | `"Ocorreu um erro interno no servidor. Tente novamente mais tarde."` |

---

## 7. Código Completo dos Arquivos para o Worker

Abaixo constam as implementações completas, prontas para gravação direta pelo Worker.

### 7.1 Tipagem Express (`apps/api/src/types/express.d.ts`)
```typescript
import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'password_hash'>;

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: SafeUser;
    }
  }
}
```

### 7.2 Instância do Prisma (`apps/api/src/lib/prisma.ts`)
```typescript
import { PrismaClient } from '@prisma/client';

/**
 * Instância singleton do Prisma Client para acesso ao banco PostgreSQL.
 * Centraliza logs e conexões reutilizáveis no ciclo de vida da API.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
```

### 7.3 Utilitário de Erros (`apps/api/src/utils/errors.ts`)
```typescript
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DOMAIN_RULE_VIOLATION'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/**
 * Formata um envelope de erro padronizado em português conforme PROJECT.md.
 */
export function formatErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorDetail[]
): ApiErrorEnvelope {
  const envelope: ApiErrorEnvelope = {
    error: {
      code,
      message,
    },
  };

  if (details && details.length > 0) {
    envelope.error.details = details;
  }

  return envelope;
}
```

### 7.4 Utilitário de Criptografia (`apps/api/src/utils/password.ts`)
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Gera o hash criptográfico seguro de uma senha utilizando bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara uma senha em texto plano com um hash seguro bcrypt.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 7.5 Serviço de Sessão (`apps/api/src/services/session.service.ts`)
```typescript
import crypto from 'node:crypto';
import { CookieOptions } from 'express';

export interface SessionData {
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export const SESSION_COOKIE_NAME = 'session_id';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms

/**
 * Retorna as opções padrão para o cookie de sessão httpOnly.
 */
export function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_MS,
  };
}

/**
 * Gerenciador de Sessões em Memória com controle de expiração.
 * Não exige alterações no schema do banco de dados e fornece lookup O(1).
 */
export class SessionService {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpeza periódica de sessões expiradas a cada 1 hora
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    // Desassocia o timer do loop de eventos para não prender o processo em testes
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Cria uma nova sessão criptograficamente segura para o usuário.
   */
  public createSession(userId: string): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    this.sessions.set(sessionId, {
      userId,
      createdAt: now,
      expiresAt,
    });

    return sessionId;
  }

  /**
   * Recupera a sessão ativa caso válida e não expirada.
   */
  public getSession(sessionId: string | undefined): SessionData | null {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Remove uma sessão ativa (logout).
   */
  public deleteSession(sessionId: string | undefined): void {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Remove todas as sessões de um usuário específico.
   */
  public deleteUserSessions(userId: string): void {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sid);
      }
    }
  }

  /**
   * Varre e expurga todas as sessões cujo prazo de validade expirou.
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sid, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(sid);
      }
    }
  }

  /**
   * Limpa todas as sessões (útil para suítes de teste).
   */
  public clearAll(): void {
    this.sessions.clear();
  }
}

export const sessionService = new SessionService();
```

### 7.6 Middleware de Autenticação (`apps/api/src/middlewares/auth.middleware.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { sessionService, SESSION_COOKIE_NAME } from '../services/session.service.js';
import { formatErrorResponse } from '../utils/errors.js';

/**
 * Middleware de Autenticação Obrigatória.
 * Lê o cookie session_id (ou Authorization Bearer), valida a sessão e garante que o usuário existe no banco.
 * Injeta req.userId e req.user ou retorna HTTP 401 em português.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;

  const sessionId = cookieToken || bearerToken;

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
    return;
  }

  const session = sessionService.getSession(sessionId);
  if (!session) {
    res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        week_starts_on: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      sessionService.deleteSession(sessionId);
      res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error('[ERRO AUTH MIDDLEWARE]:', error);
    res.status(500).json(
      formatErrorResponse(
        'INTERNAL_ERROR',
        'Ocorreu um erro interno ao validar a autenticação.'
      )
    );
  }
}
```

### 7.7 Serviço de Autenticação (`apps/api/src/services/auth.service.ts`)
```typescript
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sessionService } from './session.service.js';
import { SafeUser } from '../types/express.d.js';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export type AuthResult =
  | { success: true; user: SafeUser; sessionId: string }
  | { success: false; reason: 'conflict' | 'invalid_credentials' };

export class AuthService {
  /**
   * Registra um novo usuário no sistema com fuso horário e senha criptografada.
   */
  public async register(dto: RegisterDTO): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return { success: false, reason: 'conflict' };
    }

    const passwordHash = await hashPassword(dto.password);
    const timezone = dto.timezone?.trim() || 'America/Sao_Paulo';

    const user = await prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        timezone,
        week_starts_on: 'MONDAY',
      },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        week_starts_on: true,
        created_at: true,
        updated_at: true,
      },
    });

    const sessionId = sessionService.createSession(user.id);
    return { success: true, user, sessionId };
  }

  /**
   * Autentica um usuário existente validando e-mail e senha.
   */
  public async login(dto: LoginDTO): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, reason: 'invalid_credentials' };
    }

    const isMatch = await verifyPassword(dto.password, user.password_hash);
    if (!isMatch) {
      return { success: false, reason: 'invalid_credentials' };
    }

    const sessionId = sessionService.createSession(user.id);

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      week_starts_on: user.week_starts_on,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return { success: true, user: safeUser, sessionId };
  }

  /**
   * Realiza o logout revogando a sessão ativa.
   */
  public logout(sessionId: string | undefined): void {
    if (sessionId) {
      sessionService.deleteSession(sessionId);
    }
  }
}

export const authService = new AuthService();
```

### 7.8 Controlador de Autenticação (`apps/api/src/controllers/auth.controller.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '@estudos/domain';
import { authService } from '../services/auth.service.js';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '../services/session.service.js';
import { formatErrorResponse } from '../utils/errors.js';

export class AuthController {
  /**
   * POST /api/auth/register
   */
  public static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parseResult = registerSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : undefined,
          message: issue.message,
        }));

        res
          .status(400)
          .json(formatErrorResponse('VALIDATION_ERROR', 'Dados de cadastro inválidos.', details));
        return;
      }

      const result = await authService.register(parseResult.data);

      if (!result.success) {
        if (result.reason === 'conflict') {
          res
            .status(409)
            .json(
              formatErrorResponse(
                'CONFLICT',
                'Já existe um usuário cadastrado com este e-mail.'
              )
            );
          return;
        }
      }

      if (result.success) {
        res.cookie(SESSION_COOKIE_NAME, result.sessionId, getSessionCookieOptions());
        res.status(201).json({
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            timezone: result.user.timezone,
            week_starts_on: result.user.week_starts_on,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  public static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parseResult = loginSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : undefined,
          message: issue.message,
        }));

        res
          .status(400)
          .json(formatErrorResponse('VALIDATION_ERROR', 'Dados de login inválidos.', details));
        return;
      }

      const result = await authService.login(parseResult.data);

      if (!result.success) {
        res
          .status(401)
          .json(
            formatErrorResponse(
              'UNAUTHORIZED',
              'Credenciais inválidas. Verifique seu e-mail e senha.'
            )
          );
        return;
      }

      res.cookie(SESSION_COOKIE_NAME, result.sessionId, getSessionCookieOptions());
      res.status(200).json({
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          timezone: result.user.timezone,
          week_starts_on: result.user.week_starts_on,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  public static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
      authService.logout(sessionId);

      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  public static async me(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
        return;
      }

      res.status(200).json({
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          timezone: req.user.timezone,
          week_starts_on: req.user.week_starts_on,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 7.9 Rotas de Autenticação (`apps/api/src/routes/auth.routes.ts`)
```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/logout', AuthController.logout);
authRouter.get('/me', authMiddleware, AuthController.me);
```

### 7.10 Atualização de `apps/api/src/app.ts`
```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes.js';

/**
 * Instância da aplicação Express (apps/api)
 * Configura middlewares globais, rotas de base e tratamento centralizado de erros em português.
 */
export const app = express();

// Middlewares globais
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Rota de verificação de integridade e saúde do serviço
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Serviço da API operacional e em execução.',
    timestamp: new Date().toISOString(),
  });
});

// Rotas de Autenticação e Sessão (Marco 2)
app.use('/api/auth', authRouter);

// Middleware de tratamento de rotas não encontradas (404)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Rota '${req.method} ${req.path}' não encontrada.`,
    },
  });
});

// Middleware global de tratamento de erros em português
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERRO INTERNO DO SERVIDOR]:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
    },
  });
});
```

---

## 8. Roteiro de Verificação e Validação Independente

### 8.1 Verificação de Tipos TypeScript
```powershell
npm run typecheck --prefix apps/api
```
- Critério de aceitação: 0 erros de compilação ou resolução de módulos.

### 8.2 Testes Automatizados Unitários e de Integração
```powershell
npm run test --prefix apps/api
```
- Critério de aceitação: todos os testes de `health.test.ts` e do novo arquivo `auth.test.ts` passam com 100% de sucesso.

### 8.3 Testes E2E Opaque-Box (Sub-suite 1.1)
Com a API executando em `http://localhost:3001`:
```powershell
npx vitest run tests/e2e/tier1-feature-coverage.test.ts -t "1.1 Autenticação e Sessão"
```
- Critério de aceitação:
  - Registro cria usuário e injeta cookie `session_id`.
  - Acesso a `/api/auth/me` com sessão retorna dados do usuário.
  - Acesso sem sessão retorna HTTP 401.
  - Logout invalida a sessão e limpa o cookie.
  - Login restabelece a sessão.
