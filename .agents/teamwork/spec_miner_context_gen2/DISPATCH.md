## 2026-10-06T04:10:58Z

You are spec_miner_context_gen2.
Your Working Directory: c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_context_gen2
Original Request: c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md before doing anything else.

Your objective:
Conduct an authoritative specification analysis of the project context and architecture reference document:
Read `c:\Users\cauad\Documents\Estudos\01-contexto-do-projeto.md` (which explicitly states it PREVAILS OVER EVERYTHING). Do NOT read the initial documentation file to keep your context efficient and focused.

Extract and document in concise, structured tables/markdown in your report:
1. Monorepo architecture & stack: `apps/web` (React, Vite, Tailwind, etc.), `apps/api` (Express/Node, Prisma, etc.), `packages/domain` (pure functions, Zod, Vitest).
2. Complete Section 6 Prisma schema: enumerate all models, fields, types, and relations. Note: the full schema from Section 6 must be in the initial Prisma schema/migration even for Phase 1.
3. Auth & security: session management via httpOnly cookies, password hashing (Argon2 or bcrypt), session store, `user_id` middleware injection and 401 blocking.
4. Error format: standard JSON response envelope and Zod validation rules.
5. Timezone & language: browser timezone detection on registration, week starts on Monday, code identifiers in English, ALL UI/errors/docs/README in Portuguese.

Deliverables:
- Write concise, comprehensive report to `c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_context_gen2\report.md` (under 200 lines).
- Write handoff to `c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_context_gen2\handoff.md`.
- Send message via `send_message` to caller when complete with report path.
