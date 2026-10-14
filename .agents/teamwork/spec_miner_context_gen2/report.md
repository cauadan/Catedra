# Relatório de Especificação: Arquitetura, Schema e Governança

Fonte de Autoridade: `01-contexto-do-projeto.md` (prevalece sobre tudo) e `ORIGINAL_REQUEST.md`.

## 1. Arquitetura Monorepo e Stack Tecnológica
- **Workspace Monorepo (npm workspaces):**
  - `apps/web`: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui. Gerenciamento de estado de servidor com TanStack Query; gráficos com Recharts.
  - `apps/api`: Node.js, Express, TypeScript. ORM Prisma com PostgreSQL. Manipulação de fusos com `date-fns-tz` (ou Luxon).
  - `packages/domain`: Regras de negócio e cálculos puros (tempo efetivo, aproveitamento, validações). Esquemas Zod compartilhados. Testes com Vitest. Isolado de banco e UI.
- **Banco de Dados & Infra:** PostgreSQL executado via Docker Compose local (`docker-compose.yml`), `.env.example` obrigatório.

## 2. Schema Prisma Completo (Seção 6)
Todas as tabelas contêm `id` (String/UUID), `created_at` (DateTime UTC), `updated_at` (DateTime UTC) e `user_id` (exceto `User`). Todo o schema deve estar presente na migração inicial (Fase 1).

| Modelo | Campos Específicos | Tipos & Modificadores | Relações Chave |
|---|---|---|---|
| `User` | `email`, `name`, `password_hash`, `timezone`, `week_starts_on` | String (unique), String, String, String (IANA), String/Int (def: Monday) | 1:N com Subject, Topic, PlannedSession, StudySession, Goal, etc. |
| `Subject` | `user_id`, `name`, `color`, `archived` | String (FK), String, String, Boolean (def: false) | User, 1:N Topics, 1:N PlannedSessions, 1:N Goals |
| `Topic` | `user_id`, `subject_id`, `parent_id`, `name`, `archived` | String (FK), String (FK), String? (FK auto-relacionada), String, Boolean | User, Subject, Parent Topic?, Child Topics[], Sessions, Goals |
| `PlannedSession` | `user_id`, `subject_id`, `topic_id`, `scheduled_start`, `planned_minutes`, `priority`, `activity_type`, `notes`, `status`, `rescheduled_from_id` | FKs, DateTime, Int, String/Enum, String/Enum, String?, Enum `PlannedSessionStatus`, String? (FK) | User, Subject, Topic, RescheduledFrom?, 1:N PlannedBlocks, StudySessions |
| `PlannedBlock` | `user_id`, `planned_session_id`, `kind`, `planned_minutes`, `position` | FKs, Enum `BlockKind`, Int, Int | User, PlannedSession |
| `StudySession` | `user_id`, `planned_session_id`, `topic_id`, `started_at`, `ended_at`, `status` | String (FK), String? (FK), String (FK), DateTime, DateTime?, Enum `StudySessionStatus` | User, PlannedSession?, Topic, 1:N SessionBlocks, 1:N SessionEvents, 1:1 SessionEvaluation? |
| `SessionBlock` | `user_id`, `study_session_id`, `kind`, `planned_minutes`, `position` | FKs, Enum `BlockKind`, Int, Int | User, StudySession, 1:N SessionEvents, 1:N PracticeRecords |
| `SessionEvent` | `user_id`, `study_session_id`, `block_id`, `type`, `occurred_at`, `declared_seconds` | FKs, String? (FK block), Enum `SessionEventType`, DateTime, Int? | User, StudySession, SessionBlock? |
| `PracticeRecord`| `user_id`, `study_session_id`, `block_id`, `topic_id`, `questions`, `correct` | FKs, Int, Int (`0 <= correct <= questions`) | User, StudySession, SessionBlock, Topic |
| `SessionEvaluation`| `user_id`, `study_session_id`, `understanding`, `focus`, `difficulty`, `notes` | String (FK), String (FK unique), Enum `UnderstandingLevel`, Enum `FocusLevel`, Enum `DifficultyLevel`, String? | User, StudySession (1:1 obrigatório ao finalizar) |
| `Goal` | `user_id`, `kind`, `metric`, `period`, `period_start_local_date`, `target_value`, `subject_id`, `topic_id` | String (FK), Enum `GoalKind`, Enum `GoalMetric`, Enum `GoalPeriod`, String/DateTime, Float, String? (FK), String? (FK) | User, Subject?, Topic? (Progresso calculado dinamicamente) |

**Enums Definidos:**
- `PlannedSessionStatus`: `PLANNED`, `DONE`, `SKIPPED`, `RESCHEDULED`
- `BlockKind`: `REVIEW`, `NEW_CONTENT`, `PRACTICE`
- `StudySessionStatus`: `IN_PROGRESS`, `FINISHED`, `CANCELLED`
- `SessionEventType`: `BLOCK_START`, `PAUSE`, `RESUME`, `DISTRACTION_START`, `DISTRACTION_END`, `DISTRACTION_DECLARED`, `BLOCK_FINISH`, `SESSION_FINISH`, `SESSION_CANCEL`
- `UnderstandingLevel`: `NONE`, `PARTIAL`, `GOOD`, `MASTERED`
- `FocusLevel`: `LOW`, `MEDIUM`, `HIGH`
- `DifficultyLevel`: `EASY`, `NORMAL`, `HARD`
- `GoalKind`: `EFFORT`, `RESULT`
- `GoalMetric`: `EFFECTIVE_MINUTES`, `QUESTIONS`, `TOPICS_COMPLETED`, `REVIEWS`, `ACCURACY`
- `GoalPeriod`: `DAY`, `WEEK`, `MONTH`

## 3. Autenticação e Segurança
- **Mecanismo:** Autenticação baseada em sessão através de cookies `httpOnly` seguros (`SameSite=Lax`, `Secure` em produção).
- **Criptografia:** Senhas protegidas via hash unidirecional (Argon2 ou bcrypt).
- **Sessão & Middleware:** Middleware global de autenticação valida a sessão ativa, injeta `req.userId` e barra requisições não autenticadas retornando HTTP 401.
- **Isolamento de Dados (Multi-tenancy):** Toda e qualquer consulta ao banco filtra obrigatoriamente por `user_id`. Nenhuma operação cross-user é permitida.
- **Rotas de Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

## 4. Padrão de Erros e Validação Zod
- **Envelope Padronizado de Erro JSON:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | CONFLICT | DOMAIN_RULE_VIOLATION",
    "message": "Mensagem descritiva em português",
    "details": [ { "field": "campo", "message": "Mensagem específica em português" } ]
  }
}
```
- **Regras Zod:** Toda entrada (body, query, params) validada no backend via Zod antes da execução no controller. Mensagens de validação Zod sempre em português.

## 5. Fuso Horário e Idioma
- **Fuso Horário:** Detectado automaticamente no navegador no cadastro (`Intl.DateTimeFormat().resolvedOptions().timeZone`), salvo em `User.timezone`.
- **Início da Semana:** Segunda-feira (`week_starts_on = 'MONDAY'` / `1`).
- **UTC:** Todas as datas gravadas em UTC no PostgreSQL. Conversão para fuso local apenas na exibição e agregação de períodos.
- **Convenção de Idioma:** Código fonte (nomes de classes, tabelas, campos, endpoints, variáveis) em inglês; Toda interface com usuário, mensagens de erro da API, comentários de código, documentação e README obrigatoriamente em **português**.

## 6. Features Discovered
| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento de Erro | Descoberto Via |
|---|-----------|---------|-----------|----------|--------|----------------------|----------------|
| 1 | Auth | Cadastro de Usuário | Cria conta, detecta timezone e inicia sessão httpOnly | `email`, `name`, `password`, `timezone?` | Objeto `User` seguro (sem senha) + Cookie | 400 se inválido / 409 se email em uso | Contexto §3, §6 |
| 2 | Auth | Login / Autenticação | Valida credenciais e gera sessão | `email`, `password` | Objeto `User` + Cookie de sessão | 401 se credenciais inválidas | Contexto §3 |
| 3 | Auth | Logout | Destrói a sessão e invalida o cookie | Cookie de sessão | 204 No Content ou `{ success: true }` | 401 se não autenticado | Contexto §3 |
| 4 | Auth | Quem Sou Eu (`me`) | Retorna dados do usuário autenticado atual | Cookie de sessão | Dados do `User` ativo | 401 Unauthorized se sem sessão | Contexto §3 |
| 5 | Segurança | Middleware de Sessão | Injeta `user_id` em rotas protegidas | Request com Cookie | Injeção de `req.userId` | 401 imediato com JSON em português | Contexto §2, R1 |
| 6 | Segurança | Isolamento `user_id` | Escopa todas queries do Prisma por `user_id` | Contexto de usuário | Dados filtrados | Dados de terceiros nunca retornados | Contexto §2 |
| 7 | Matérias | CRUD Matérias | Gestão de matérias com nome e cor | `name`, `color`, `archived` | Subject criado/atualizado | 400 se inválido / 404 se não existir | Contexto §6, R2 |
| 8 | Assuntos | Árvore de Assuntos | Gestão hierárquica com `parent_id` e profundidade livre | `subject_id`, `parent_id?`, `name` | Topic criado/atualizado | 409 se ciclo / 404 se pai inexistente | Contexto §5, §6 |
| 9 | Assuntos | Prevenção de Ciclos | Impede que assunto se torne pai de si ou de descendente | `topic_id`, novo `parent_id` | Sucesso na movimentação | 422/400 Recusa com mensagem em português | R2, Contexto §5 |
| 10| Assuntos | Mover Assunto | Move assunto entre pais ou matérias, mantendo filhos | `topic_id`, novo `parent_id`, `subject_id` | Topic e filhos atualizados em cascata | 422 em ciclo / 404 | R3, Contexto §6 |
| 11| Assuntos | Arquivamento Cascata | Arquiva/desarquiva matéria ou assunto e descendentes | `id`, status de arquivamento | Registros atualizados | 404 se não encontrado | R3 |
| 12| Assuntos | Bloqueio de Exclusão | Exclusão definitiva proibida se houver sessões ligadas | `topic_id` para delete | 204 se sem sessões | 422 Recusa orientando arquivar | R3 |
| 13| Timer | Máquina de Estados | Estados: ESTUDANDO, PAUSADO, DISTRAÍDO | Eventos da sessão | Estado reconstruído | 400 se evento inválido | Contexto §7 |
| 14| Domain | Fórmulas de Estudo | Tempo efetivo, foco, aderência e aproveitamento | Eventos, questões, acertos | Cálculos puros determinísticos | Rejeita distração > tempo total | Contexto §8 |
| 15| Metas | Metas e Períodos | Metas de esforço/resultado por fuso do usuário | `kind`, `metric`, `period`, `target_value` | Progresso calculado | 400 se métricas inválidas | Contexto §6 |

## 7. Edge Cases
| # | Feature | Entrada / Cenário | Comportamento Observado / Esperado |
|---|---------|-------------------|-----------------------------------|
| 1 | Hierarquia | Assunto definido como filho de si mesmo (`id == parent_id`) | Validação do domain/API detecta ciclo e retorna 422 com mensagem explicativa em PT |
| 2 | Hierarquia | Assunto movido para um de seus descendentes | Verificação recursiva de ancestrais impede a alteração e rejeita com 422 |
| 3 | Mover Assunto | Mover nó intermediário de matéria A para matéria B | O nó e todos os descendentes migram para a matéria B (`subject_id` atualizado recursivamente) |
| 4 | Exclusão | Tentar deletar assunto com sessões de estudo vinculadas | Exclusão física é rejeitada (422) orientando o usuário a arquivar o assunto |
| 5 | Arquivamento | Matéria arquivada com múltiplos assuntos e sub-assuntos | Matéria e todos os tópicos descendentes são marcados como arquivados |
| 6 | Sessão / Timer | Distração declarada maior que a duração total do bloco | Sistema rejeita a declaração com mensagem de erro clara |
| 7 | Fusos Horários | Sessão iniciada às 23:50 no horário local | Gravada em UTC correto; contabilizada no dia local do usuário para metas e agenda |
| 8 | Aproveitamento | Prática com 0 questões ou menos de 10 questões (`MIN_QUESTIONS`) | Retorna 0% de aproveitamento; exibe status "dados insuficientes" se `< 10` |
| 9 | Segurança | Tentativa de acessar/editar `subject_id` de outro usuário | API retorna 404 Not Found (ou 403), tratando recurso de outro usuário como inexistente |
