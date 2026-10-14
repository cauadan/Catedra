## 2026-10-06T21:39:00Z
You are explorer_m3_2.
Your Working Directory: c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m3_2
Original Request: c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md
Project Specification: c:\Users\cauad\Documents\Estudos\PROJECT.md
Prisma Schema: c:\Users\cauad\Documents\Estudos\apps\api\prisma\schema.prisma

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at c:\Users\cauad\Documents\Estudos\ORIGINAL_REQUEST.md before doing anything else. Then read PROJECT.md and prisma schema.

DIRETRIZ MANDATÓRIA DE IDIOMA:
Todos os relatórios, comentários de código e mensagens devem estar RIGOROSAMENTE EM PORTUGUÊS.

DIRETRIZ DE CONCISÃO:
Escreva relatórios concisos e objetivos (<250 linhas por arquivo).

Objective:
Investigate and design the backend API architecture, Prisma services, and atomic transactions in `apps/api`:
1. Design Subjects CRUD (`SubjectService`, `SubjectController`, `subject.routes.ts`):
   - `GET /api/subjects`: list subjects for authenticated `req.userId`, support query param `?include_archived=true/false` (default false).
   - `POST /api/subjects`: create subject `{ name, color }` for `req.userId`.
   - `GET /api/subjects/:id`: fetch subject with user_id verification.
   - `PUT /api/subjects/:id` or `PATCH /api/subjects/:id`: update name, color.
   - `PATCH /api/subjects/:id/archive`: archive subject and in an atomic Prisma transaction archive ALL its topics (`Topic.updateMany({ where: { subject_id: id }, data: { is_archived: true } })`).
   - `PATCH /api/subjects/:id/unarchive`: unarchive subject and unarchive its topics.
   - `DELETE /api/subjects/:id`: check if any topic in this subject has linked sessions (`PlannedSession`, `StudySession`, `PracticeRecord`). If yes, reject with HTTP 400 (`DOMAIN_RULE_VIOLATION`) with clear Portuguese message advising to archive. If no, delete subject and its topics.
2. Design Topics CRUD and Tree Operations (`TopicService`, `TopicController`, `topic.routes.ts`):
   - `GET /api/topics`: query by `?subject_id=...&include_archived=...`. Return list with parent/children references or tree structure.
   - `POST /api/topics`: create topic with `subject_id`, `name`, `parent_id?`. Verify subject belongs to `req.userId`. If `parent_id` given, verify parent belongs to same `req.userId` and `subject_id`.
   - `PATCH /api/topics/:id`:
     * Rename or update color/order.
     * Move topic (same subject or cross-subject):
       - If `new_parent_id`: check for cycles using domain logic. Rejection with HTTP 400 if cycle.
       - If `new_subject_id`: atomic Prisma transaction updating target topic AND all descendant topics to `new_subject_id`!
     * Archive/Unarchive: cascade to all descendants in an atomic transaction.
   - `DELETE /api/topics/:id`:
     * Physical deletion check: query `PlannedSession`, `StudySession`, `PracticeRecord` for target topic AND all its descendants. If any exist, reject with HTTP 400 advising to archive. If none, physically delete topic and descendants.
3. Multi-tenant security: Ensure every database query strictly includes `where: { user_id: req.userId }`.
4. Provide precise file contents and code proposals for the Worker.

Deliverables:
- Concise report at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m3_2\report.md`
- Concise handoff at `c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m3_2\handoff.md`
- Send message via `send_message` when complete.
