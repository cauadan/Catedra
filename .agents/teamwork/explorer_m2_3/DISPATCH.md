## 2026-10-06T04:48:02Z
You are explorer_m2_3.
Your Working Directory: c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_3
Original Request: c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md
Project Specification: c:\Users\cauad\Documents\Estudos\PROJECT.md

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md before doing anything else. Then read PROJECT.md.

DIRETRIZ MANDATÓRIA DE IDIOMA:
Todos os relatórios, comentários e testes devem estar RIGOROSAMENTE EM PORTUGUÊS.

Objective:
Investigate and formulate the technical test design for Milestone 2 Authentication & Security:
1. Integration test suite in `apps/api/tests/auth.test.ts` (using Supertest & Vitest):
   - Register new user -> returns 201 and sets httpOnly session cookie.
   - Register with duplicate email -> returns 409 Conflict.
   - Register with invalid data (e.g. short password) -> returns 400 Validation Error with Portuguese details.
   - Login with correct credentials -> returns 200 and sets httpOnly session cookie.
   - Login with incorrect password -> returns 401 Unauthorized.
   - Login with non-existent email -> returns 401 Unauthorized.
   - Access protected route without session cookie -> returns 401 Unauthorized.
   - Access protected route with valid session cookie -> returns 200 and user data.
   - Logout with session cookie -> clears cookie and invalidates session.
   - Access protected route after logout -> returns 401 Unauthorized.
2. Alignment with E2E Tier 1 tests:
   - Check `tests/e2e/tier1-feature-coverage.test.ts` (Sub-suite 1.1) to ensure the API contracts match the E2E expectations exactly.
3. Provide exact test code and execution commands for the Worker.

Deliverables:
- Report at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_3\report.md`
- Handoff at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m2_3\handoff.md`
- Send message via `send_message` when complete.
