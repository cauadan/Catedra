## 2026-10-06T05:10:41Z
You are explorer_m2_2_repl.
Your Working Directory: c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_2_repl
Original Request: c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md
Project Specification: c:\Users\cauad\Documents\Estudos\PROJECT.md
Backend Auth Contracts: c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_1\report.md

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md before doing anything else. Then read PROJECT.md.

DIRETRIZ MANDATÓRIA DE IDIOMA:
Todos os textos, interfaces, relatórios e comentários devem estar RIGOROSAMENTE EM PORTUGUÊS.

DIRETRIZ DE DESEMPENHO E CONCISÃO:
Escreva arquivos CONCISOS e DIRECIONADOS (cada arquivo com menos de 250 linhas). Não tente gerar blocos de texto gigantescos de uma só vez para evitar estouro de timeout.

Objective:
Investigate and formulate the technical design for Milestone 2 Frontend Web Auth & Base Layout in `apps/web`:
1. Authentication state & API client integration:
   - Auth context / provider or TanStack Query hook (`useAuth`) handling login, register, logout, and checking `/api/auth/me` on load.
   - Auto-detection of browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` sent during registration.
2. Pages & Components:
   - Login page (`apps/web/src/pages/Login.tsx`): clean, modern form with email and password inputs, validation feedback in Portuguese, link to register.
   - Register page (`apps/web/src/pages/Register.tsx`): name, email, password, password confirmation, timezone display, feedback in Portuguese, link to login.
   - Base Shell Layout (`apps/web/src/components/layout/Shell.tsx`): responsive sidebar and header with user profile display, logout button, and navigation placeholders for future modules:
     * Painel (Dashboard)
     * Matérias e Assuntos (Subjects & Topics) - link ready for Phase 2
     * Agenda e Planejamento
     * Cronômetro de Estudo
     * Metas de Estudo
     * Desempenho e Estatísticas
     * Observatório Semanal
   - Protected route wrapper (`ProtectedRoute.tsx`): redirects to `/login` if not authenticated.
3. Lightweight client router or tab/view switcher in `apps/web` compatible with React 19 and zero dependencies.
4. Verify zero console errors, full Portuguese texts, and responsive design with Tailwind CSS.
5. Provide exact file code and recommendations for the Worker.

Deliverables:
- Concise report at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_2_repl\report.md`
- Concise handoff at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_2_repl\handoff.md`
- Send message via `send_message` when complete.
