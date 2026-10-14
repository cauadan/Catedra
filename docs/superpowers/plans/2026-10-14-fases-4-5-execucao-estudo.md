# Fases 4 e 5 — Execução do Estudo: Plano de Implementação

> **Para agentes:** executar inline com superpowers:executing-plans + test-driven-development (aprovado pelo usuário). Passos com checkbox (`- [ ]`).

**Goal:** Timer por etapa baseado em eventos, avaliação pós-sessão e registro de prática multi-assunto, com API concorrente-segura e UI resiliente a recarregamento.

**Architecture:** Fórmulas e máquinas de estados ficam em funções puras de `@estudos/domain` (segundos inteiros, percentuais 0–100), consumidas igualmente pela API (com `referenceNow = new Date()`) e pelo frontend (com `referenceNow = Date.now() + clockOffsetMs`). A API serializa mutações com `pg_advisory_xact_lock` (criação) e `SELECT ... FOR UPDATE` em `study_sessions` (demais mutações).

**Tech Stack:** TypeScript, Zod 3, Vitest 3, Express 4, Prisma 6 + PostgreSQL 16 (Docker), React 19, TanStack Query 5, Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-10-14-fases-4-5-execucao-estudo.md` (+ `01-contexto-do-projeto.md`, que prevalece).

## Resultado da inspeção (Passo 1)

| # | Item | Achado |
|---|---|---|
| 1 | Nulabilidade | `PracticeRecord.block_id String?` (nulo), `SessionEvent.block_id String?` (nulo), `PlannedSession.topic_id String` (**obrigatório**) |
| 2 | `SessionEvaluation.study_session_id` | `@unique` ✅ (1:1) |
| 3 | Nomes físicos | Só `@@map` de tabela; **nenhum `@map` de coluna** (colunas já em snake_case). Tabelas: `study_sessions`, `session_blocks`, `session_events`, `session_evaluations`, `practice_records`, `planned_sessions`, `planned_blocks`, `topics`, `subjects` |
| 4 | Banco real nos testes | ✅ testes da API usam `PrismaClient` + `supertest` contra o Postgres do Docker (`estudos-postgres`), sem mocks |
| 5 | Domínio | Pacote `@estudos/domain`. `validatePlannedBlocks(plannedMinutes: number, blocks: ReadonlyArray<{kind, planned_minutes}>): { ok: true; blocks: {kind, planned_minutes, position}[] } \| { ok: false; message: string }` (descarta etapas com 0 min, rejeita `kind` repetido, ordena canonicamente). `calculateBlockPreset(plannedMinutes, preset: 'BALANCED' \| 'PRACTICE_FOCUS' \| 'NEW_ONLY')`. **`position` começa em 1** |
| 6 | Scripts raiz | `test:tz` ✅ (`node scripts/test-tz.mjs`) e `typecheck` ✅ (`tsc -b`) existem |

Outros achados: `master` já contém a Fase 3 (HEAD `51e2e51`); `/timer` hoje é `PlaceholderModule`; os testes web atuais são smoke tests sem Testing Library (ambiente `happy-dom`, sem dependência extra); `index.ts` do domain já exporta um `calculateAccuracy` legado (ver Decisão D1).

## Global Constraints
- Identificadores em inglês; UI, mensagens, comentários, commits e README em pt-BR ("você").
- `schema.prisma` inalterado; nenhuma dependência nova.
- Tempo em segundos inteiros ≥ 0; percentuais 0–100 sem arredondar no domínio; `toFixed(1)` só na UI.
- `MAX_EVENT_GAP_MINUTES = 120`.
- Zod `.strict()` em todas as entradas; recursos de outro usuário → `404`.
- Timestamps só do relógio do servidor.
- Branch `fase-4-5-execucao` a partir de `master`; sem merge/push sem autorização.

## Decisões (rulings) a aprovar
- **D1 — `calculateAccuracy` legado:** `index.ts` exporta `calculateAccuracy(correct, total): number` (0 quando total = 0, com clamp) usado só em `domain.test.ts`. Proposta: mover para `practice.ts` com a semântica nova (`null` quando `questions === 0`, sem clamp), ajustar a asserção `calculateAccuracy(0, 0)` → `null`, e manter `mapUnderstandingToScore` como alias de `normalizeUnderstandingScore`. `calculateFocusEfficiency`/`calculatePlanAdherence` (legados, escala 0–1, sem uso) ficam intocados.
- **D2 — Segundos:** cada timestamp vira `Math.floor(ms / 1000)` antes de qualquer subtração, garantindo `total = efetivo + pausado + rt + dc` sem drift de arredondamento.
- **D3 — Ordenação de eventos:** por `occurred_at`; em empate, `BLOCK_START` primeiro e `DISTRACTION_DECLARED`/`BLOCK_FINISH` por último (sort estável para os demais). A API consulta `orderBy: [{ occurred_at: 'asc' }, { created_at: 'asc' }]`.
- **D4 — Sessão `FINISHED`:** `calculateSessionMetrics` usa `ended_at` como `referenceNow` (blocos abertos não crescem após o fim).
- **D5 — Ordem de checagem na criação:** Zod (`400`) → lock → `ACTIVE_SESSION_EXISTS` → `PENDING_EVALUATION_EXISTS` → recurso (`404`) → `PLANNED_SESSION_NOT_AVAILABLE` (`409`) / assunto arquivado (`400`).
- **D6 — Modo 2:** Zod exige `planned_minutes` inteiro ≥ 1 por etapa e chama `validatePlannedBlocks(soma, blocks)`; `kind` repetido é rejeitado (comportamento existente). Modo 1 não valida arquivamento (spec não pede).
- **D7 — Status HTTP:** `201` em criação de sessão e de avaliação; `200` nas demais.
- **D8 — Códigos de erro novos:** `ACTIVE_SESSION_EXISTS`, `PENDING_EVALUATION_EXISTS`, `PLANNED_SESSION_NOT_AVAILABLE`, `SESSION_NOT_IN_PROGRESS`, `INVALID_TRANSITION`, `BLOCK_NOT_ACTIVE`, `LAST_BLOCK`, `SESSION_NOT_FINISHED`, `EVALUATION_ALREADY_EXISTS`, `DECLARED_DISTRACTION_EXCEEDED` (422), `TOPIC_ARCHIVED` (400). `P2002` na avaliação vira `409 EVALUATION_ALREADY_EXISTS` (rede de segurança além do lock).
- **D9 — Progresso da etapa:** `calculateBlockProgress` no domínio (para o frontend não fazer contas).
- **D10 — README da Fase 3:** a seção da Fase 3 que foi redigida possui pequenas imprecisões textuais (cita `PATCH /:id/reschedule`, filtros `start_date/end_date` e status `COMPLETED/CANCELLED`; o real é `POST /:id/reschedule`, `?view=day|week&date=` e apenas `SKIPPED`). Conforme instrução do usuário, esta correção será feita em um commit separado e isolado antes ou durante a documentação final.

## Review Focus
1. Duplo clique / requisições simultâneas → exatamente 1 sucesso (lock) — Tasks 3–5.
2. Recarregar no meio de pausa/distração → mesmo estado e mesmos segundos — Task 1 (função pura com `referenceNow`) + Task 7.
3. Declaração excedente → `422` sem nenhum evento novo nem mudança de status — Task 4.
4. Eventos no mesmo instante (declaração + fim + início do próximo) → cálculo correto — Task 1 (D3).
5. Cancelar sessão cuja planejada já foi alterada (não está mais `DONE`) → não reverte — Task 4.

---

### Task 1: Domínio — timer, fórmulas e métricas (`packages/domain/src/timer.ts`)

**Files:** Create `packages/domain/src/timer.ts`, `packages/domain/tests/timer.test.ts`; Modify `packages/domain/src/index.ts` (`export * from './timer.js'`).

**Produces:**
```ts
export const MAX_EVENT_GAP_MINUTES = 120;
export const SESSION_EVENT_TYPES = ['BLOCK_START','PAUSE','RESUME','DISTRACTION_START','DISTRACTION_END','DISTRACTION_DECLARED','BLOCK_FINISH','SESSION_FINISH','SESSION_CANCEL'] as const;
export type SessionEventTypeDTO; export type StudySessionStatusDTO = 'IN_PROGRESS'|'FINISHED'|'CANCELLED';
export type BlockExecutionState = 'NOT_STARTED'|'STUDYING'|'PAUSED'|'DISTRACTED'|'FINISHED';
export interface SessionEventDTO { type: SessionEventTypeDTO; block_id: string|null; occurred_at: Date; declared_seconds?: number|null }
export interface SessionBlockDTO { id: string; kind: BlockKindDTO; planned_minutes: number; position: number }
export type TransitionResult = { ok: true } | { ok: false; error: string };
export type ManualEventType = 'PAUSE'|'RESUME'|'DISTRACTION_START'|'DISTRACTION_END';
export interface BlockTimes { totalSeconds; pausedSeconds; distractedRealtimeSeconds; distractedDeclaredSeconds; effectiveSeconds }
export interface BlockMetrics extends BlockTimes { blockId: string; kind: BlockKindDTO; plannedSeconds: number; state: BlockExecutionState; isIncomplete: boolean }
export interface SessionMetrics { effectiveSeconds; totalSeconds; plannedSeconds; effectiveness: number; adherence: number|null; delaySeconds: number|null; blocks: BlockMetrics[]; activeBlockId: string|null }
export interface SessionMetricsInput { status: StudySessionStatusDTO; started_at: Date; ended_at: Date|null; planned_start: Date|null }

sortSessionEvents(events): SessionEventDTO[]                         // D3
deriveBlockState(events): BlockExecutionState                          // eventos de UM bloco; transições inválidas são ignoradas
validateBlockTransition(events, type: ManualEventType | 'BLOCK_FINISH'): TransitionResult
calculateBlockTimes(events, referenceNow: Date): BlockTimes            // não iniciado → zeros
validateDeclaredDistraction(events, declaredSeconds: number, referenceNow: Date): TransitionResult
isBlockIncomplete(block, events, sessionStatus, referenceNow): boolean
findActiveBlock(blocks, events): SessionBlockDTO|null                  // iniciado e não finalizado
findNextBlock(blocks, events): SessionBlockDTO|null                    // menor position NOT_STARTED
deriveSessionState(sessionEvents, blocks): StudySessionStatusDTO
calculateBlockProgress(effectiveSeconds, plannedMinutes): number        // 0–100, limitado a 100; planned 0 → 0
calculateSessionMetrics(session, blocks, events, referenceNow): SessionMetrics|null   // CANCELLED → null; FINISHED usa ended_at (D4)
```
Mensagens de erro pt-BR (ex.: `'Só é possível pausar enquanto você está estudando.'`, `'Esta etapa já possui uma distração declarada.'`, e literal `'A distração declarada excede o tempo disponível da etapa.'`).

- [ ] **Passo 1: Testes que falham** em `timer.test.ts` (helper `ev(type, 'HH:mm:ss', extra?)` sobre `2026-10-14T` UTC):
  - `deriveBlockState`: `[]`→`NOT_STARTED`; START→`STUDYING`; START,PAUSE→`PAUSED`; START,DISTRACTION_START,RESUME→`STUDYING`; START,PAUSE,BLOCK_FINISH→`FINISHED`.
  - `validateBlockTransition`: PAUSE em `PAUSED` → `{ok:false}`; DISTRACTION_START em `PAUSED` → `{ok:false}`; DISTRACTION_END em `STUDYING` → `{ok:false}`; RESUME em `DISTRACTED` → `{ok:true}`; BLOCK_FINISH em `NOT_STARTED` → `{ok:false}`.
  - `calculateBlockTimes` — caso normal: START 10:00:00, FINISH 10:30:00 → `{ total: 1800, effective: 1800 }`; pausas múltiplas (10:05–10:07 e 10:10–10:15) → `paused 420, effective 1380`; distração RT encerrada por RESUME (10:05→10:08) → `rt 180`; intervalo aberto (PAUSE 10:20, sem fim, `referenceNow` 10:25) → `total 1500, paused 300`; declarada 600 → `effective = total - 600`; resultado zero (`dc` = líquido) → `effective 0`; frações de ms truncadas (D2): START `10:00:00.900`, ref `10:00:01.100` → `total 1`.
  - `validateDeclaredDistraction`: líquido 1200 s, declarar 1200 → ok; 1260 → erro literal; segunda declaração → erro; `0`/não inteiro → erro.
  - `isBlockIncomplete`: sessão `FINISHED` com bloco sem FINISH → `true`; planned 30 min, STUDYING contínuo 7201 s → `true` e 7200 s → `false`; planned 90 min (limite 10800) com 7201 s → `false`; com `DISTRACTION_DECLARED` e gap 3 h → `false`; `CANCELLED` → `false`; `NOT_STARTED` → `false`.
  - `findActiveBlock`/`findNextBlock` com 3 blocos (positions 1..3).
  - `calculateSessionMetrics`: `CANCELLED` → `null`; dois blocos 1500+1200 efetivos, total 3000, planejado 3600 → `effectiveness 90`, `adherence 75`; avulsa → `delaySeconds null`; `started_at` 10:03:20 vs planejado 10:00:00 → `delaySeconds 200`; `totalSeconds 0` → `effectiveness 0`; `FINISHED` com `referenceNow` posterior não cresce (D4); empate de timestamp DECLARED+FINISH+START do próximo no mesmo instante calcula corretamente.
- [ ] **Passo 2:** `npx vitest run packages/domain/tests/timer.test.ts` → FAIL (módulo inexistente).
- [ ] **Passo 3:** Implementar `timer.ts` e exportar no `index.ts`.
- [ ] **Passo 4:** mesmo comando → PASS; `npm run test:tz` (só domain é suficiente aqui) → PASS.
- [ ] **Passo 5:** `git commit -m "feat(domain): maquina de estados do timer, formulas de tempo e metricas da sessao"`

---

### Task 2: Domínio — prática e schemas Zod da execução

**Files:** Create `packages/domain/src/practice.ts`, `packages/domain/src/study-session.ts`, `packages/domain/tests/practice.test.ts`, `packages/domain/tests/study-session-schemas.test.ts`; Modify `packages/domain/src/index.ts` (remover `calculateAccuracy`/`mapUnderstandingToScore` legados — D1 — e exportar os módulos novos), `packages/domain/tests/domain.test.ts` (asserção `(0,0)` → `null`).

**Produces:**
```ts
// practice.ts
calculateAccuracy(correct: number, questions: number): number|null
calculateAggregateAccuracy(records: ReadonlyArray<{questions:number; correct:number}>): { totalQuestions:number; totalCorrect:number; accuracy:number|null }
validatePracticeRecord(r: {questions:number; correct:number}): { ok: boolean; error?: string }
normalizeUnderstandingScore(level: UnderstandingLevelDTO): number
mapUnderstandingToScore = normalizeUnderstandingScore   // alias legado
UNDERSTANDING_LEVELS / FOCUS_LEVELS / DIFFICULTY_LEVELS + *_LABELS (pt-BR: 'Não entendi','Parcialmente','Entendi','Dominei' | 'Baixa','Média','Alta' | 'Fácil','Normal','Difícil')
// study-session.ts
studySessionCreateSchema   // union estrita: { planned_session_id } | { topic_id, blocks: [{kind, planned_minutes ≥ 1}] } → transform com validatePlannedBlocks(soma) (D6)
studySessionEventSchema    // { type: ManualEventType }
declaredDistractionSchema  // { declared_minutes?: int ≥ 1 } — usado em /blocks/:id/finish e /finish
sessionEvaluationSchema    // understanding, focus, difficulty, notes? (≤1000), practice_records?: [{ block_id?, topic_id, questions int ≥0, correct int ≥0 }]
```

- [ ] **Passo 1: Testes que falham:** `calculateAccuracy(0,0)` → `null`; `(1,3)` → `100/3` exato (`toBe(33.333333333333336)`); `(18,20)` → `90`; agregado `[{10,7},{5,5},{0,0}]` → `{15,12,80}`; agregado vazio → `accuracy null`; `validatePracticeRecord` rejeita `correct > questions`, negativos e `1.5`; normalização 0/33/67/100. Schemas: corpo com campo extra → falha com `'Campo não permitido na requisição.'`; modo 2 com `planned_minutes: 0` → falha; soma 4 → falha; blocos fora de ordem → saída canônica com `position` 1..n; `{}` em `declaredDistractionSchema` → ok; `declared_minutes: 0` → falha; `notes` com 1001 caracteres → falha.
- [ ] **Passo 2:** `npx vitest run packages/domain` → FAIL.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** `npx vitest run packages/domain` → PASS (incluindo `domain.test.ts` ajustado); `npx tsc -b` → 0 erros.
- [ ] **Passo 5:** `git commit -m "feat(domain): calculos de pratica, autoavaliacao e schemas Zod da execucao do estudo"`

---

### Task 3: API — criação, leitura e infraestrutura de lock

**Files:** Create `apps/api/src/services/study-session.service.ts`, `apps/api/src/controllers/study-session.controller.ts`, `apps/api/src/routes/study-session.routes.ts`, `apps/api/tests/helpers/study-fixtures.ts`, `apps/api/tests/study-session.create.test.ts`; Modify `apps/api/src/utils/errors.ts` (códigos D8), `apps/api/src/app.ts` (`app.use('/api/study-sessions', studySessionRouter)`).

**Produces (service, todos com `userId` primeiro):**
```ts
lockUserForCreation(tx, userId): Promise<void>            // tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
lockSessionForUpdate(tx, userId, sessionId): Promise<{ id; status }>   // tx.$queryRaw`SELECT id, status FROM "study_sessions" WHERE id = ${sessionId} AND user_id = ${userId} FOR UPDATE`; vazio → AppError 404
toSessionView(session, referenceNow): StudySessionView   // linha + topic{subject} + blocks(position asc) + events(D3) + evaluation + practice_records + planned_start + metrics (calculateSessionMetrics)
StudySessionService.create(userId, input: StudySessionCreateInput): Promise<StudySessionView>
StudySessionService.getActive(userId): Promise<StudySessionView|null>
StudySessionService.getPendingEvaluation(userId): Promise<StudySessionView|null>
StudySessionService.getById(userId, id): Promise<StudySessionView>
```
Rotas (ordem obrigatória): `GET /active` → `{ data, server_now }`, `GET /pending-evaluation` → `{ data }`, `GET /:id` → `{ data }`, `POST /` → `201 { data }`. Fixture: `createStudyUser(label)` → `{ cookie, user, subject, topic }` (padrão de `planned-session.concurrency.test.ts`), e `backdateSession(sessionId, seconds)` que desloca `occurred_at`/`started_at` para trás via Prisma (usado nas Tasks 4–5).

- [ ] **Passo 1: Testes que falham** (`study-session.create.test.ts`, Postgres real):
  - sem cookie em `GET /active`, `POST /` → `401`.
  - modo 2 válido (`REVIEW 10`, `PRACTICE 20`) → `201`, 2 blocos `position` 1 e 2, um `BLOCK_START` no bloco 1, `planned_session_id null`; `GET /active` traz `server_now` ISO e `metrics.activeBlockId` = bloco 1.
  - segunda criação com ativa → `409 ACTIVE_SESSION_EXISTS` + mensagem literal.
  - modo 1: planejada vira `DONE`, blocos clonados; planejada sem `PlannedBlock` → um bloco `NEW_CONTENT` com `planned_minutes` da planejada e `position 1`; planejada `SKIPPED` → `409 PLANNED_SESSION_NOT_AVAILABLE`; planejada de outro usuário → `404`.
  - modo 2 com assunto arquivado → `400 TOPIC_ARCHIVED`; assunto de outro usuário → `404`; corpo com campo extra → `400`.
  - sessão `FINISHED` sem avaliação (criada via Prisma) bloqueia → `409 PENDING_EVALUATION_EXISTS`; `GET /pending-evaluation` a retorna com `metrics`.
  - `GET /:id` de outro usuário → `404`.
- [ ] **Passo 2:** `npx vitest run apps/api/tests/study-session.create.test.ts` → FAIL.
- [ ] **Passo 3:** Implementar service, controller (padrão `safeParse` + `AppError` do `PlannedSessionController`) e rotas.
- [ ] **Passo 4:** mesmo comando → PASS; `npx tsc -b` → 0 erros.
- [ ] **Passo 5:** `git commit -m "feat(api): criacao e consulta de sessoes de estudo com lock consultivo por usuario"`

---

### Task 4: API — eventos, avanço de etapa, conclusão e cancelamento

**Files:** Modify `study-session.service.ts`, `study-session.controller.ts`, `study-session.routes.ts`; Create `apps/api/tests/study-session.flow.test.ts`.

**Produces:**
```ts
StudySessionService.recordEvent(userId, id, type: ManualEventType): Promise<StudySessionView>
StudySessionService.finishBlock(userId, id, blockId, declaredMinutes?: number): Promise<StudySessionView>
StudySessionService.finish(userId, id, declaredMinutes?: number): Promise<StudySessionView>
StudySessionService.cancel(userId, id): Promise<StudySessionView>
```
Cada um: `$transaction` → `lockSessionForUpdate` → `409 SESSION_NOT_IN_PROGRESS` → leitura de blocos/eventos → validação pura → um único `const now = new Date()` → inserções. Controllers usam `req.body ?? {}`.

- [ ] **Passo 1: Testes que falham:**
  - `PAUSE` → `200`, estado `PAUSED`; `PAUSE` de novo → `409 INVALID_TRANSITION`; `DISTRACTION_START` em pausa → `409`; `RESUME` → `200`.
  - `/blocks/:b2/finish` com bloco 1 ativo → `409 BLOCK_NOT_ACTIVE`; blockId inexistente → `404`.
  - `/blocks/:b1/finish` sem corpo → `200`, bloco 1 `FINISHED`, bloco 2 com `BLOCK_START` no mesmo `occurred_at`; resposta com `metrics`.
  - `/blocks/:b2/finish` no último bloco → `409 LAST_BLOCK` com `"Use a conclusão da sessão para encerrar a última etapa."`.
  - `/finish` com `declared_minutes: 1` logo após o início → `422 DECLARED_DISTRACTION_EXCEEDED`; contagem de eventos e `status` inalterados.
  - após `backdateSession(id, 600)`: `/finish` com `declared_minutes: 5` → `200`, `FINISHED`, `ended_at` preenchido, `DISTRACTION_DECLARED` com `declared_seconds 300`, `metrics.effectiveSeconds ≈ total - 300`.
  - mutação em sessão `FINISHED` → `409 SESSION_NOT_IN_PROGRESS`.
  - cancelar sessão vinculada → `CANCELLED`, `SESSION_CANCEL` sem `BLOCK_FINISH`, planejada volta a `PLANNED`, `GET /:id` com `metrics: null`; cancelar quando a planejada já foi alterada para `SKIPPED` via Prisma → continua `SKIPPED`.
  - sessão de outro usuário → `404` em todas as mutações.
- [ ] **Passo 2:** `npx vitest run apps/api/tests/study-session.flow.test.ts` → FAIL.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** → PASS; `npx tsc -b` → 0 erros.
- [ ] **Passo 5:** `git commit -m "feat(api): eventos do timer, avanco de etapa, conclusao e cancelamento com FOR UPDATE"`

---

### Task 5: API — avaliação, prática e concorrência

**Files:** Modify service/controller/routes; Create `apps/api/tests/study-session.evaluation.test.ts`, `apps/api/tests/study-session.concurrency.test.ts`.

**Produces:** `StudySessionService.evaluate(userId, id, input: SessionEvaluationInput): Promise<StudySessionView>` → `POST /:id/evaluation` `201 { data }`.

- [ ] **Passo 1: Testes que falham:**
  - avaliar sessão `IN_PROGRESS` → `409 SESSION_NOT_FINISHED`; avaliar de novo → `409 EVALUATION_ALREADY_EXISTS`.
  - `practice_records` `[{topic A, 10, 7}, {topic B, 0, 0}, {topic B, 5, 5}]` sem `block_id` em sessão com bloco `PRACTICE` → grava 2 registros, ambos no bloco `PRACTICE`; sessão sem `PRACTICE` → no último bloco por `position`.
  - `correct > questions` → `400`; `topic_id` de outro usuário → `404`; `block_id` de outra sessão → `404`.
  - após avaliar, `GET /pending-evaluation` → `{ data: null }` e nova criação é permitida.
  - concorrência (`Promise.all`, banco real): 2× `POST /` (modo 2) → status ordenados `[201, 409]` e 1 sessão no banco; 2× `PAUSE` → `[200, 409]` e 1 evento `PAUSE`; 2× `/evaluation` → `[201, 409]` e 1 `SessionEvaluation`.
- [ ] **Passo 2:** `npx vitest run apps/api/tests/study-session.evaluation.test.ts apps/api/tests/study-session.concurrency.test.ts` → FAIL.
- [ ] **Passo 3:** Implementar (filtrar `questions === 0` após `validatePracticeRecord`; `P2002` → `409`).
- [ ] **Passo 4:** → PASS; suíte completa da API (`npx vitest run --project @estudos/api`) → PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): avaliacao pos-sessao e registros de pratica com testes de concorrencia"`

---

### Task 6: Web — cliente da API, formatação, Dashboard e "Iniciar Estudo" na Agenda

**Files:** Create `apps/web/src/lib/study-session-api.ts`, `apps/web/src/lib/format.ts`, `apps/web/tests/format.test.ts`, `apps/web/tests/dashboard.test.tsx`; Modify `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/components/agenda/PlannedSessionCard.tsx` (prop `onStartStudy?: (session) => void`, botão só quando `status === 'PLANNED'`), `apps/web/src/pages/Agenda.tsx` (mutação + diálogo de 409), `apps/web/tests/planned-session-card.test.tsx`.

**Produces:**
```ts
// study-session-api.ts — tipos StudySessionView (espelho da API) e:
fetchActiveSession(): Promise<{ data: StudySessionView|null; server_now: string }>
fetchPendingEvaluation(), startStudySession(body), postSessionEvent(id, type), finishBlock(id, blockId, declared_minutes?), finishSession(id, declared_minutes?), cancelSession(id), submitEvaluation(id, body)
computeClockOffsetMs(serverNowIso: string, clientNowMs: number): number
toDomainEvents(events: ApiSessionEvent[]): SessionEventDTO[]     // string ISO → Date (adaptação, sem fórmulas)
// format.ts
formatDuration(seconds: number): string        // 'MM:SS' ou 'H:MM:SS'
formatPercent(value: number|null): string      // null → '–'; senão `${value.toFixed(1)}%`
```
Mensagens do 409 na Agenda: `ACTIVE_SESSION_EXISTS`/`PENDING_EVALUATION_EXISTS` → texto literal da spec + botão **"Ir para o Cronômetro"** (`navigate('/timer')`); `PLANNED_SESSION_NOT_AVAILABLE` → mensagem da API + `invalidateQueries(['planned-sessions'])`. Sucesso → `navigate('/timer')`.

- [ ] **Passo 1: Testes que falham** (`react-dom/server` `renderToStaticMarkup`, sem dependência nova): `formatPercent(null)` → `'–'`, `formatPercent(100/3)` → `'33.3%'`; `formatDuration(65)` → `'01:05'`, `3725` → `'1:02:05'`; `computeClockOffsetMs('2026-10-14T10:00:05.000Z', Date.parse('2026-10-14T10:00:00.000Z'))` → `5000`; Dashboard contém `Concluído` 2×, `Ativo`, `Fase 6`, `Fase 7`, `Fase 8` e link `/timer`; card `PLANNED` com `onStartStudy` contém `Iniciar Estudo`, card `DONE` não contém.
- [ ] **Passo 2:** `npx vitest run --project @estudos/web` → FAIL.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** → PASS; `npx tsc -b` → 0 erros.
- [ ] **Passo 5:** `git commit -m "feat(web): cliente de sessoes de estudo, dashboard atualizado e botao Iniciar Estudo na agenda"`

---

### Task 7: Web — Tela do Cronômetro e Modal de Avaliação

**Files:** Create `apps/web/src/pages/Timer.tsx`, `apps/web/src/hooks/useStudyClock.ts`, `apps/web/src/components/timer/AdHocSessionForm.tsx`, `TimerDisplay.tsx`, `FinishStepDialog.tsx`, `PendingEvaluationBanner.tsx`, `apps/web/src/components/evaluation/SessionEvaluationModal.tsx`, `apps/web/tests/timer-components.test.tsx`, `apps/web/tests/evaluation-modal.test.tsx`; Modify `apps/web/src/App.tsx` (`/timer` → `<Timer />`).

**Produces:**
- `useStudyClock(clockOffsetMs: number): Date` — `setInterval` de 1 s devolvendo `new Date(Date.now() + clockOffsetMs)`.
- `TimerDisplay` (props: `session: StudySessionView`, `referenceNow: Date`, `isPending: boolean`, callbacks) — chama `calculateSessionMetrics`, `findActiveBlock`, `findNextBlock`, `calculateBlockProgress` do domínio; rótulos `Estudando`/`Pausado`/`Distraído`; `Revisão`/`Conteúdo Novo`/`Prática`; `Avançar Etapa` só se houver próximo bloco; `Concluir Estudo` sempre; aviso literal de `isIncomplete`; todos os botões `disabled={isPending}`.
- `FinishStepDialog` (props `mode: 'advance'|'finish'`, `errorMessage?: string`) — campo opcional `declared_minutes` (inteiro ≥ 1); `422` mostrado no diálogo, que permanece aberto.
- `SessionEvaluationModal` (props `session`, `topics` ativos) — chips, observações (≤ 1000), linhas de prática (inicial: assunto da sessão, 0/0), `+ Adicionar outro assunto`, remover linha, aproveitamento por linha via `calculateAccuracy` + `formatPercent`, rodapé via `calculateAggregateAccuracy`; no submit descarta `questions === 0`; após `201` mostra resumo (`formatDuration(effectiveSeconds)`, `formatPercent(effectiveness)`, `formatPercent(adherence)`) e botão que leva a `/agenda`.
- `Timer.tsx` — queries `['study-session','active']` e `['study-session','pending']`; recalcula `clockOffsetMs` a cada resposta de `/active`; sem ativa e com pendente → `PendingEvaluationBanner` ("Concluir Avaliação Pendente") e formulário bloqueado; livre → `AdHocSessionForm` (matéria/assunto `!archived`, duração 5–480 com atalhos 30/45/60/90/120, presets `BALANCED`/`PRACTICE_FOCUS`/`NEW_ONLY` via `calculateBlockPreset` ou edição manual validada por `validatePlannedBlocks`); erro `409` em qualquer mutação → `refetch` de `/active`; após `Concluir Estudo` abre o modal automaticamente.

- [ ] **Passo 1: Testes que falham** (`renderToStaticMarkup`, sessão fixture com `referenceNow` fixo):
  - 3 blocos, ativo o 1º → contém `Avançar Etapa` e `Concluir Estudo`; ativo o último → não contém `Avançar Etapa`.
  - eventos START + PAUSE → contém `Pausado`; START 10:00:00 com ref 10:01:05 → contém `01:05`.
  - gap de 3 h sem declaração (planned 30) → contém o aviso literal; com `DISTRACTION_DECLARED` → não contém.
  - `isPending` → botões com atributo `disabled`.
  - `FinishStepDialog` com `errorMessage` → exibe a mensagem.
  - `SessionEvaluationModal` inicial → contém `Não entendi`, `Dominei`, `+ Adicionar outro assunto` e rodapé `–`.
- [ ] **Passo 2:** `npx vitest run --project @estudos/web` → FAIL.
- [ ] **Passo 3:** Implementar.
- [ ] **Passo 4:** → PASS; `npx tsc -b` → 0 erros.
- [ ] **Passo 5:** `git commit -m "feat(web): tela do cronometro por etapa e modal de avaliacao pos-sessao"`

---

### Task 8: Verificação, validação manual, README e relatório

**Files:** Modify `README.md` (Fases 4 e 5: como rodar, endpoints, concorrência, limitações; corrigir a seção da Fase 3 — D10).

- [ ] **Passo 1:** `npm run typecheck` → saída sem erros.
- [ ] **Passo 2:** `npm test` → 100% (Postgres do Docker ativo).
- [ ] **Passo 3:** `npm run test:tz` → 100% sob `Asia/Tokyo`.
- [ ] **Passo 4: Validação manual** (`npm run dev`): criar planejada na Agenda → "Iniciar Estudo" → `/timer` → pausar/retomar/distrair → F5 (estado e segundos preservados) → "Avançar Etapa" com distração excedente (erro 422 no diálogo) e válida → "Concluir Estudo" → modal com 2 assuntos e uma linha 0/0 → salvar → resumo → `/agenda`; console sem erros. Modo depende da Decisão Q2 abaixo.
- [ ] **Passo 5:** Atualizar README; `git commit -m "docs: README das Fases 4 e 5 e correcao da secao da Fase 3"`.
- [ ] **Passo 6:** `finishing-a-development-branch` — apresentar resultados e opções; **sem merge/push**.
