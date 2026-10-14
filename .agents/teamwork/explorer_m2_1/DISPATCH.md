## 2026-10-06T04:48:02Z

You are explorer_m2_1.
Your Working Directory: c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_1
Original Request: c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md
Project Specification: c:\Users\cauad\Documents\Estudos\PROJECT.md

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md before doing anything else. Then read PROJECT.md.

DIRETRIZ MANDATÓRIA DE IDIOMA:
Todos os relatórios, comentários no código e mensagens devem estar RIGOROSAMENTE EM PORTUGUÊS. Apenas identificadores técnicos (User, password_hash, user_id, rotas como /api/auth) em inglês.

Objective:
Investigate and formulate the technical design for Milestone 2 Backend Authentication & Session Architecture in `apps/api`:
1. Password hashing strategy: bcrypt or argon2 (verifying bcrypt is already installed in `apps/api`).
2. Session management with httpOnly cookies:
   - Generate secure session tokens / IDs.
   - Session store: in-memory or PostgreSQL table/map with expiration, tied to user.
   - Set cookie options: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `maxAge: 7 * 24 * 60 * 60 * 1000`.
3. Auth Endpoints:
   - `POST /api/auth/register`: body `{ name, email, password, timezone? }`. Validates input with Zod, checks duplicate email (409), hashes password, creates user with timezone (defaulting to browser or UTC), sets session cookie, returns 201 `{ user: { id, name, email, timezone, week_starts_on } }`.
   - `POST /api/auth/login`: body `{ email, password }`. Validates credentials, returns 401 on mismatch, sets session cookie, returns 200 `{ user: ... }`.
   - `POST /api/auth/logout`: clears session cookie, removes session from store, returns 200 `{ success: true }`.
   - `GET /api/auth/me`: reads session cookie, validates session, returns 200 `{ user: ... }` or 401 if not authenticated.
4. Auth Middleware (`apps/api/src/middlewares/auth.middleware.ts`):
   - Reads session cookie, validates user exists in database, injects `req.userId` and `req.user`, or returns 401 with standard error envelope: `{ error: { code: "UNAUTHORIZED", message: "Não autorizado" } }`.
5. Error formatting: verify standard error envelope in Portuguese for all responses.
6. Provide exact file code and recommendations for the Worker.

Deliverables:
- Report at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_1\report.md`
- Handoff at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_1\handoff.md`
- Send message via `send_message` when complete.
