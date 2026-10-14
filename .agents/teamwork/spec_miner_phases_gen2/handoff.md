# Handoff Report — spec_miner_phases_gen2

## 1. Observation
- Inspected `ORIGINAL_REQUEST.md`:
  - Lines 19–20: "Monorepo com `apps/web`, `apps/api` e `packages/domain`, usando a stack definida na seção 3 do contexto. Schema Prisma **completo** (seção 6) com migração inicial. Cadastro, login, logout e "quem sou eu" com senha em hash e sessão por cookie httpOnly; middleware que injeta `user_id` e bloqueia rotas sem sessão (401)..."
  - Lines 22–23: "CRUD de matérias (nome, cor, arquivar) e de assuntos com hierarquia por `parent_id` de profundidade livre. Tela em árvore para visualizar, criar, renomear, mover e arquivar. Arquivar em vez de excluir quando houver sessões vinculadas. Impedir ciclos na hierarquia; mover preserva os filhos."
  - Lines 25–35: Constraints defining Docker PostgreSQL, language constraints (identifiers in English, all user-facing/error strings in Portuguese), reparenting with cross-subject moves updating descendants' `subject_id`, cascade archive/unarchive, hard delete rejection when sessions are linked.
  - Lines 38–51: Acceptance criteria for Phase 1 and Phase 2.
- Inspected `01-contexto-do-projeto.md`:
  - Section 3 (lines 38–49): Stack definition: React 19 + TypeScript + Vite + Tailwind + shadcn/ui, TanStack Query, Node + Express + TypeScript, Prisma + PostgreSQL, Zod, date-fns-tz / Luxon, Vitest, auth with argon2/bcrypt and httpOnly session cookies.
  - Section 6 (lines 91–117): Comprehensive data model for all phases (`User`, `Subject`, `Topic`, `PlannedSession`, `PlannedBlock`, `StudySession`, `SessionBlock`, `SessionEvent`, `PracticeRecord`, `SessionEvaluation`, `Goal`).
- Inspected `02-prompts-por-fase.md`:
  - Lines 16–35: Phase 1 (Fundação) scope & acceptance criteria.
  - Lines 38–56: Phase 2 (Matérias e assuntos) scope & acceptance criteria.
- Directory listing `c:\Users\cauad\Documents\Estudos`:
  - Only documentation and `.agents` directory exist; workspace is greenfield, no source code or package manifests created yet.

## 2. Logic Chain
1. *Observation 1 (ORIGINAL_REQUEST.md lines 19-20 & 01-contexto-do-projeto.md lines 91-117)* establishes that Phase 1 requires setting up the entire monorepo (`apps/web`, `apps/api`, `packages/domain`) and executing an initial database migration for the complete schema across all 8 phases. This prevents destructive schema migrations in later phases.
2. *Observation 2 (ORIGINAL_REQUEST.md lines 20, 27, 40 & 01-contexto-do-projeto.md line 48)* dictates that authentication must not use simple JWT tokens stored in localStorage; rather, it mandates httpOnly session cookies, an authentication middleware that rejects unauthorized requests with HTTP 401, and strict user_id tenancy on all subsequent queries.
3. *Observation 3 (ORIGINAL_REQUEST.md lines 22-23, 30-33 & 02-prompts-por-fase.md lines 42-46)* establishes the 5 core tree invariants:
   - Cycle prevention (`parent_id` cannot be self or any descendant).
   - Same-subject move (preserves descendants).
   - Cross-subject move (updates `subject_id` for the topic and all descendants recursively).
   - Cascade archive/unarchive (propagates status to all descendants).
   - Deletion protection (rejects DELETE with 400/409 advising archiving if planned or executed study sessions exist for the topic or descendants).
4. *Observation 4 (ORIGINAL_REQUEST.md lines 45, 50)* requires multi-tenancy testing across two distinct users via API tests, and UI testing confirming that a 3+ level tree works seamlessly in Portuguese without browser console errors.

## 3. Caveats
- No existing source code is present in the workspace; implementation teams must bootstrap the project from scratch (npm workspaces, tsconfig, Docker compose, Prisma schema, etc.).
- While Phase 1 and 2 only implement User, Subject, and Topic CRUD, the Prisma schema must declare all entities from Section 6 to satisfy the initial migration requirement.
- Foreign key relations from PlannedSession/StudySession to Topic must exist in the schema to support testing the deletion protection rule (which requires checking for linked sessions).

## 4. Conclusion
The specification for Phase 1 (Fundação) and Phase 2 (Matérias e assuntos) is fully analyzed, structured, and documented in `c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_phases_gen2\report.md`. All acceptance criteria, endpoints, tree invariants, multi-tenant isolation rules, edge cases, and verification checkpoints are explicitly specified.

## 5. Verification Method
- Inspect the generated specification report:
  `c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_phases_gen2\report.md`
- Validate that all features, invariant algorithms, and edge cases match the requirements in `ORIGINAL_REQUEST.md` and `02-prompts-por-fase.md`.
- Invalidation condition: If any Phase 1 or Phase 2 requirement in `report.md` deviates from `01-contexto-do-projeto.md` or `ORIGINAL_REQUEST.md`, this handoff is invalidated.
