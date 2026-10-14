## 2026-10-06T04:10:58Z
You are spec_miner_phases_gen2.
Your Working Directory: c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_phases_gen2
Original Request: c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md before doing anything else.

Your objective:
Conduct an authoritative specification analysis of the Phase 1 (Fundação) and Phase 2 (Matérias e assuntos) requirements:
Read `c:\Users\cauad\Documents\Estudos\02-prompts-por-fase.md` (specifically Phase 1 and Phase 2 sections) and cross-reference with `ORIGINAL_REQUEST.md`.

Extract and document in concise, structured tables/markdown in your report:
1. Phase 1 (Fundação) Scope & Acceptance Criteria:
   - Auth endpoints (register, login, logout, me)
   - Session via httpOnly cookies, 401 without session
   - Migration from scratch with PostgreSQL
   - Layout with navigation placeholders for upcoming phases
2. Phase 2 (Matérias e assuntos) Scope & Acceptance Criteria:
   - Subjects CRUD (name, color, archive/unarchive)
   - Topics hierarchy (arbitrary depth, parent_id)
   - Tree invariants & algorithms:
     * Cycle prevention: topic cannot be parent of self or any descendant
     * Reparenting: moving within same subject keeps descendants
     * Cross-subject move: moving to another subject moves all descendants and updates their subject_id
     * Cascade archive/unarchive: archiving subject or topic cascades to descendants; unarchiving restores in cascade
     * Delete protection: hard delete rejected if linked study sessions exist for topic or any descendant; advises archiving
   - Multi-tenant isolation: user_id filtering on all queries; two-user API test
   - Tree UI in Portuguese with 3+ depth visualization, actions, no console errors

Deliverables:
- Write concise, comprehensive report to `c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_phases_gen2\report.md` (under 200 lines).
- Write handoff to `c:\Users\cauad\Documents\Estudos\.agents\teamwork\spec_miner_phases_gen2\handoff.md`.
- Send message via `send_message` to caller when complete with report path.
