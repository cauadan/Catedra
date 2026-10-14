# Master Plan — Plataforma de Gestão e Análise de Estudos (Fases 1 & 2)

## Goal
Build and thoroughly verify Phase 1 (Fundação) and Phase 2 (Matérias e assuntos) as a production-grade monorepo web application adhering to all technical, functional, and language requirements.

## Architecture & Tracks
- **Dual Track Orchestration**:
  1. **E2E Testing Track**: Derives opaque-box test suites from requirements (Tiers 1-4).
  2. **Implementation Track**: Executes sequential/parallel milestones to build the application and pass all unit, integration, and E2E tests.

## Phase 0: Survey & Requirements Mining
- Spawn 3 Explorers / Spec Miners:
  - `spec_miner_1`: Analyze `01-contexto-do-projeto.md` (stack, monorepo architecture, Section 6 Prisma schema, session/auth rules, error format, Portuguese requirements).
  - `spec_miner_2`: Analyze `02-prompts-por-fase.md` (Phase 1 & 2 specific prompts, deliverables, acceptance criteria, tree rules, cascade, cycle prevention, delete protection).
  - `explorer_3`: Inspect current workspace files, Docker setup, Node environment, and any existing templates or code.
- Synthesize findings into `PROJECT.md` (Architecture, Feature Inventory, Milestones, Interface Contracts, Code Layout).

## Implementation Milestones
- **M1: Monorepo Foundation & Database (Phase 1)**
  - Setup monorepo (`apps/web`, `apps/api`, `packages/domain`, root scripts, tsconfig, package.json).
  - Setup PostgreSQL Docker Compose + `.env.example`.
  - Implement full Prisma schema (Seção 6) with initial migration running cleanly from scratch.
  - Setup Vitest and Zod across packages.
- **M2: Authentication, Security & Base UI Layout (Phase 1)**
  - Auth backend: Register, login, logout, me endpoints.
  - Password hashing (Argon2 or bcrypt), httpOnly session cookies.
  - Middleware injecting `user_id` and enforcing 401 on unauthenticated protected routes.
  - Timezone detection on registration; week starts on Monday.
  - Web UI: Login & registration forms, responsive shell layout with navigation items for upcoming modules.
- **M3: Subjects & Topics Domain, Hierarchy & API (Phase 2)**
  - Domain models & validation schemas in `packages/domain`.
  - Subjects CRUD: name, color, archive/unarchive.
  - Topics CRUD: tree hierarchy with arbitrary depth, reparenting, moving between subjects.
  - Tree invariants: cycle prevention, reparenting preserves children, cascading archive/unarchive.
  - Delete protection: disallow hard deletion if linked study sessions exist; suggest archiving.
  - User isolation: every query scoped to `user_id`.
- **M4: Tree Management Web UI (Phase 2)**
  - Tree UI in Portuguese with intuitive hierarchy visualization (depth >= 3 supported).
  - Actions: create subject, create topic, rename, move (change parent / change subject), archive/unarchive, delete with modal guidance.
  - Responsive layout, error handling, Portuguese UI feedback.
- **M5: Final Verification & Test Hardening**
  - Execute 100% of E2E test suite (Tiers 1-4).
  - Adversarial hardening (Tier 5) with Challengers & Forensic Auditor.
  - README.md validation (clean setup instructions) and Final Report in Portuguese.
