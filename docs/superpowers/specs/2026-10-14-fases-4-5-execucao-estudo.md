# Spec — Fases 4 e 5 unificadas: Execução do Estudo (Timer por Etapa, Avaliação Pós-Sessão e Prática)

> Cópia fiel da especificação enviada pelo usuário em 2026-10-14. `01-contexto-do-projeto.md` prevalece sobre qualquer suposição.

## 1. Convenções
- Identificadores de código em **inglês**; UI, mensagens de erro (API/Zod), comentários, commits, README e relatórios em **pt-BR** (sempre "você").
- Usar as tabelas existentes: `StudySession`, `SessionBlock`, `SessionEvent`, `SessionEvaluation`, `PracticeRecord`. Não alterar o schema sem avisar e justificar.

## 2. `packages/domain` (funções puras + TDD)

**Unidades:** tempo interno em **segundos** (inteiro ≥ 0). Percentuais (`efetividade`, `aderencia`, `accuracy`) na escala **0–100**, ponto flutuante exato (arredondar para 1 casa só na UI). Reutilizar `validatePlannedBlocks` e `calculateBlockPreset` (ordem canônica `REVIEW`, `NEW_CONTENT`, `PRACTICE`).

### 2.1 Máquinas de estados
- `StudySession.status` (`IN_PROGRESS | FINISHED | CANCELLED`) no banco é a fonte autoritativa. `deriveSessionState(sessionEvents, blocks)` serve para validação/testes. Em `SESSION_FINISH`/`SESSION_CANCEL`, `block_id` é nulo.
- `deriveBlockState(events: SessionEventDTO[]): BlockExecutionState` — `NOT_STARTED`, `STUDYING`, `PAUSED`, `DISTRACTED`, `FINISHED`.
  - `BLOCK_START` → `STUDYING`
  - `PAUSE` → `PAUSED` (só a partir de `STUDYING`)
  - `RESUME` → `STUDYING` (a partir de `PAUSED`, ou de `DISTRACTED` encerrando a distração aberta no instante do evento)
  - `DISTRACTION_START` → `DISTRACTED` (só a partir de `STUDYING`)
  - `DISTRACTION_END` → `STUDYING` (só a partir de `DISTRACTED`)
  - `BLOCK_FINISH` → `FINISHED` (a partir de `STUDYING`, `PAUSED` ou `DISTRACTED`, encerrando pausa/distração aberta)
- Validações de transição retornam `{ ok: true } | { ok: false; error: string }` (sem exceções).

### 2.2 Fórmulas (segundos)
- `MAX_EVENT_GAP_MINUTES = 120` (exportada).
- Por bloco iniciado (sessões `IN_PROGRESS`/`FINISHED`):
  - `tempo_total = (BLOCK_FINISH ?? referenceNow) - BLOCK_START`
  - `tempo_pausado = Σ PAUSE → (RESUME | BLOCK_FINISH | referenceNow)`
  - `tempo_distraido_rt = Σ DISTRACTION_START → (DISTRACTION_END | RESUME | BLOCK_FINISH | referenceNow)`
  - `tempo_distraido_dc = Σ DISTRACTION_DECLARED.declared_seconds`
  - `tempo_efetivo = max(0, total - pausado - rt - dc)`
- `validateDeclaredDistraction`: no máximo **uma** declaração por bloco; UI/API recebem `declared_minutes` (inteiro ≥ 1) → `declared_seconds = declared_minutes * 60`; exige `declared_seconds <= total - pausado - rt`, senão `{ ok: false, error: 'A distração declarada excede o tempo disponível da etapa.' }` (API → **422**).
- `isIncomplete`:
  - Sessão `CANCELLED` → `false` e `metrics = null`.
  - Em `IN_PROGRESS`/`FINISHED`, `true` (só aviso visual) se: (1) sessão `FINISHED` e bloco com `BLOCK_START` sem `BLOCK_FINISH`; **ou** (2) bloco **sem** `DISTRACTION_DECLARED` e algum intervalo contínuo em `STUDYING` (do último `BLOCK_START`/`RESUME`/`DISTRACTION_END` até o próximo evento ou `BLOCK_FINISH`/`referenceNow`) ultrapassar `max(120 * 60, 2 * planned_minutes * 60)` segundos. Com `DISTRACTION_DECLARED`, o critério 2 é sempre `false`.
- `calculateSessionMetrics`: `CANCELLED` → `null`. Senão:
  - `tempo_efetivo_sessao = Σ tempo_efetivo`; `tempo_total_sessao = Σ tempo_total`; `tempo_planejado_sessao = Σ planned_minutes * 60`
  - `efetividade = total > 0 ? efetivo / total * 100 : 0`
  - `aderencia = planejado > 0 ? efetivo / planejado * 100 : null`
  - `atraso = planned_start ? Math.round((started_at - planned_start) / 1000) : null`

### 2.3 Prática (sem arredondamento precoce)
- `calculateAccuracy(correct, questions): number | null` — `questions === 0` → `null`; senão `(correct / questions) * 100` exato.
- `calculateAggregateAccuracy(records): { totalQuestions; totalCorrect; accuracy: number | null }` — soma e usa `calculateAccuracy`.
- `validatePracticeRecord({ questions, correct }): { ok: boolean; error?: string }` — inteiros, `questions >= 0`, `0 <= correct <= questions`. Erros (`questions - correct`) nunca são salvos.
- `normalizeUnderstandingScore(level)`: `NONE = 0`, `PARTIAL = 33`, `GOOD = 67`, `MASTERED = 100`.

## 3. `apps/api` (Express + Prisma + Zod)

### 3.1 Segurança e concorrência
- Todas as rotas autenticadas (`401`), filtradas por `user_id`; inexistente/de outro usuário → `404`. Schemas Zod com `.strict()`.
- Em `study-session.routes.ts`, declarar `/active` e `/pending-evaluation` **antes** de `/:id`.
- Criação: dentro de `$transaction`, `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${userId}))\`` antes de checar sessão ativa/avaliação pendente.
- Mutações (`/:id/events`, `/:id/blocks/:blockId/finish`, `/:id/finish`, `/:id/cancel`, `/:id/evaluation`): dentro de `$transaction`, `SELECT ... FOR UPDATE` na linha da sessão do usuário antes de ler eventos/blocos.
- Timestamps (`occurred_at`, `started_at`, `ended_at`) só pelo relógio do servidor.

### 3.2 `POST /api/study-sessions`
- No máximo uma `IN_PROGRESS` e nenhuma `FINISHED` sem avaliação:
  - `IN_PROGRESS` → `409`, `code: 'ACTIVE_SESSION_EXISTS'`, `"Você já tem uma sessão de estudo em andamento."`
  - `FINISHED` sem avaliação → `409`, `code: 'PENDING_EVALUATION_EXISTS'`, `"Você tem uma sessão concluída aguardando avaliação."`
- Modo 1 `{ planned_session_id }`: `404` se não existir para o usuário; status ≠ `PLANNED` → `409` `PLANNED_SESSION_NOT_AVAILABLE`. Em transação: `updateMany({ where: { id, user_id, status: 'PLANNED' }, data: { status: 'DONE' } })` (`count !== 1` → `409` `PLANNED_SESSION_NOT_AVAILABLE`), cria `StudySession` `IN_PROGRESS`, clona `PlannedBlock` → `SessionBlock` (sem blocos: um único `NEW_CONTENT` com `plannedSession.planned_minutes` e `position` inicial), insere `BLOCK_START` no primeiro bloco.
- Modo 2 `{ topic_id, blocks: [{ kind, planned_minutes }] }`: `Topic`/`Subject` do usuário (`404`), não arquivados (`400`). Reutiliza `validatePlannedBlocks` (soma 5–480, inteiros ≥ 1, ordem canônica). Cria sessão (`planned_session_id: null`), blocos e `BLOCK_START` do primeiro.

### 3.3 Demais endpoints
- `GET /active` → `{ data: sessão com metrics e estado derivado | null, server_now }`.
- `GET /pending-evaluation` → `{ data: sessão FINISHED sem avaliação (blocos, tópico/matéria, metrics) | null }`.
- `GET /:id` → sessão completa (blocos, eventos, avaliação, `practice_records`, `metrics`; `null` se `CANCELLED`).
- `POST /:id/events` `{ type: 'PAUSE' | 'RESUME' | 'DISTRACTION_START' | 'DISTRACTION_END' }`: lock; `409` se não `IN_PROGRESS`; valida no bloco ativo com `deriveBlockState` (`409` se inválida).
- `POST /:id/blocks/:blockId/finish` (`req.body ?? {}`, `{ declared_minutes?: int ≥ 1 }`): lock; `409` se não `IN_PROGRESS`; `404` se o bloco não pertence à sessão; `409` se não for o ativo; `409` `"Use a conclusão da sessão para encerrar a última etapa."` se for o último; `now` único, valida declaração antes de inserir (`422`); insere `DISTRACTION_DECLARED` (se houver), `BLOCK_FINISH`, `BLOCK_START` do próximo em `now`; retorna sessão completa com `metrics`.
- `POST /:id/finish` (`req.body ?? {}`, `{ declared_minutes? }`): lock; `409` se não `IN_PROGRESS`; valida declaração antes de inserir (`422`, nada encerrado); insere `DISTRACTION_DECLARED`?, `BLOCK_FINISH`, `SESSION_FINISH`; `status: 'FINISHED'`, `ended_at: now`; retorna sessão com `metrics`.
- `POST /:id/cancel`: lock; `409` se não `IN_PROGRESS`; insere `SESSION_CANCEL` (sem `BLOCK_FINISH`), `CANCELLED`, `ended_at`; se vinculada, `updateMany({ where: { id: planned_session_id, user_id, status: 'DONE' }, data: { status: 'PLANNED' } })`.
- `POST /:id/evaluation`: lock; `409` se não `FINISHED` ou já avaliada. Body `.strict()`: `understanding`, `focus`, `difficulty`, `notes?` (≤ 1000), `practice_records?: [{ block_id?, topic_id, questions, correct }]`. Valida cada item com `validatePracticeRecord` (`400`); descarta `questions === 0`; `topic_id` do usuário (`404`); `block_id` enviado deve pertencer à sessão; omitido → primeiro bloco `PRACTICE`, senão último bloco por `position`. Salva tudo em transação; retorna sessão com `metrics`.

## 4. `apps/web`
1. **Dashboard:** Matérias e Assuntos → `Concluído` (`/subjects`); Agenda e Planejamento → `Concluído` (`/agenda`); Cronômetro de Estudo → `Ativo` (`/timer`); Metas → `Fase 6`; Desempenho e Estatísticas → `Fase 7`; Observatório Semanal → `Fase 8`.
2. **`/timer`:** `clockOffsetMs = new Date(server_now).getTime() - Date.now()` a cada busca de `/active`; a cada 1 s, `referenceNow = new Date(Date.now() + clockOffsetMs)` e chamar as funções do `domain` (sem reimplementar fórmulas). Recupera sessão ativa; sem ativa e com pendente → banner com **"Concluir Avaliação Pendente"** e bloqueio de novo estudo. Formulário avulso: matéria/assunto ativos, duração 5–480 com atalhos 30/45/60/90/120, blocos via `calculateBlockPreset` ou ajuste manual validado. Visor: matéria (cor), assunto, etapas com destaque (`Revisão`, `Conteúdo Novo`, `Prática`), contador central, barra de progresso vs. planejado da etapa, estado `Estudando`/`Pausado`/`Distraído`. Aviso `isIncomplete`: *"Detectamos um longo período sem atividade nesta etapa. Recomendamos declarar o tempo de distração ao avançar ou concluir."* Botões `disabled` durante `isPending`; em `409`, refazer `/active`. Etapas intermediárias: `Avançar Etapa`; última: só `Concluir Estudo`. Ambos os diálogos com `declared_minutes` opcional; `422` exibido no diálogo sem fechar.
3. **Modal de avaliação:** abre após `Concluir Estudo` ou via banner. Chips: Entendimento (Não entendi/Parcialmente/Entendi/Dominei), Concentração (Baixa/Média/Alta), Dificuldade (Fácil/Normal/Difícil), Observações. Linhas de prática (pré-preenchida com o assunto da sessão, 0/0), seletor de assunto ativo, Questões, Acertos, aproveitamento `toFixed(1)%` ou `"–"`; `+ Adicionar outro assunto`, remover linha; descarta `questions === 0` no submit; rodapé com Aproveitamento Consolidado (`calculateAggregateAccuracy`). Ao salvar, mostra resumo (`metrics`) e redireciona para `/agenda`.
4. **Agenda:** botão **"Iniciar Estudo"** em cards `PLANNED`; sucesso → `/timer`; `409` `ACTIVE_SESSION_EXISTS`/`PENDING_EVALUATION_EXISTS` → aviso com botão **"Ir para o Cronômetro"**; `PLANNED_SESSION_NOT_AVAILABLE` → mensagem e recarregar agenda.

## 5. Fora do escopo
Metas (Fase 6); gráficos Recharts, dashboard analítico e Observatório (Fases 7 e 8).

## 6. Critérios de aceite
- Testes de integração: `401`, `404`, `409` (`ACTIVE_SESSION_EXISTS`, `PENDING_EVALUATION_EXISTS`, `PLANNED_SESSION_NOT_AVAILABLE`, bloco inativo, último bloco, avaliação duplicada), `422` (sem encerrar bloco/sessão).
- Concorrência `Promise.all` em PostgreSQL real: criação, `PAUSE` duplo e avaliação → exatamente 1 sucesso e 1 `409`.
- Resiliência/relógio/`isIncomplete` conforme 2.2.
- Avaliação pendente bloqueia novo início e é recuperada por `/pending-evaluation`; `questions === 0` descartado; multi-assunto em ponto flutuante.
- Cancelamento reverte `PlannedSession` para `PLANNED` só se ainda `DONE`.
- `npm test`, `npm run test:tz` e `npm run typecheck` com saída real no relatório.
- Validação manual da UI (Agenda → timer → F5 → avançar/concluir com distração → avaliação com prática → `/agenda`) sem erros no console.
- `README.md` em pt-BR (como rodar, endpoints, concorrência, limitações).
- Relatório final (feito, arquivos, testes com saída real, fora do escopo, limitações: fallback do bloco de prática, bloqueio por avaliação pendente, locks transacionais sem índice único parcial).
