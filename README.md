# Plataforma de Gestão e Análise de Estudos

Bem-vindo ao monorepo da **Plataforma de Gestão e Análise de Estudos**. Este repositório contém a infraestrutura base (Fase 1), o gerenciamento da Árvore de Matérias e Assuntos (Fase 2), o módulo de Agenda e Planejamento (Fase 3), a Execução do Estudo com Timer por Etapa e Avaliação Pós-Sessão (Fases 4 e 5 unificadas) e o módulo de Metas de Estudo, Estatísticas, Visão de 30 Dias e Dashboard Analítico (Fases 6 e 7 unificadas).

## Estrutura do Projeto

O projeto adota uma arquitetura de Monorepo com NPM Workspaces:
- `apps/api`: Backend em Node.js com Express e Prisma ORM (PostgreSQL).
- `apps/web`: Frontend em React 19 (Vite) com TanStack Query, Recharts e Tailwind CSS.
- `packages/domain`: Biblioteca compartilhada contendo contratos (Zod), tipos e funções puras de regras de negócio (calendário, planejamento, cálculo de blocos, timer, metas e estatísticas agregadas).

## Pré-requisitos

- **Node.js** v24+
- **NPM** v11+
- **Docker** (para rodar o banco de dados PostgreSQL localmente)

## Como Rodar

1. Inicie o Docker Desktop em sua máquina.
2. Na raiz do projeto, suba o banco de dados rodando o Docker Compose:
   ```bash
   docker compose up -d
   ```
3. Instale as dependências de todo o monorepo:
   ```bash
   npm install
   ```
4. Configure as variáveis de ambiente (use os `.env.example` localizados em `apps/api` e `apps/web` como base).
5. Rode a migração inicial do banco de dados (Prisma):
   ```bash
   npm run db:push --workspace=@estudos/api
   # ou npx prisma db push --schema=apps/api/prisma/schema.prisma
   ```
6. (Opcional) Popule o banco com 6 meses de histórico realista de demonstração:
   ```bash
   npm run seed:sample-6m
   ```
   - **E-mail de demonstração:** `demo@estudos.local`
   - **Senha de demonstração:** `Demo@123456`
7. Inicie a aplicação (Backend e Frontend simultaneamente):
   ```bash
   npm run dev
   ```
8. Acesse a interface web em `http://localhost:5173`.

## Como Testar

Os testes automatizados foram criados utilizando **Vitest** e utilizam o banco de dados real (não mockado) na API para garantir a integridade das operações, bloqueios de concorrência (`pg_advisory_xact_lock` e `SELECT ... FOR UPDATE`) e regras de negócio.

Para executar toda a bateria de testes de uma vez a partir da raiz:

```bash
npm test
```

Para executar a suíte completa sob emulação de fuso horário internacional (garantindo que todas as conversões de datas e regras de fuso são puras e não dependem do fuso local da máquina):

```bash
npm run test:tz
```

Para verificar se há algum erro de tipagem no TypeScript (sem gerar arquivos de build) em todos os pacotes:

```bash
npm run typecheck
```

## O Que Foi Entregue

### Fundação (Fase 1)
- Banco configurado via Docker, schema inicial do Prisma completo, sistema de registro, login (senhas salvas com bcrypt) e emissão de sessões por `httpOnly` cookie.

### Matérias e Assuntos (Fase 2)
- CRUD completo de matérias (`Subject`) e assuntos (`Topic`).
- Regra de negócio implementada no domínio (`packages/domain`) validando e impedindo criação de ciclos na árvore de assuntos.
- Arquivamento em cascata (se você arquiva uma matéria, todos os assuntos vinculados são arquivados).
- Proteção de exclusão caso haja sessões futuras vinculadas.
- Interface do usuário (`Subjects.tsx`) em formato de árvore recursiva (profundidade livre) permitindo gerenciar tudo visualmente.

### Agenda e Planejamento (Fase 3)
- **Domínio Puro (`packages/domain`)**:
  - Utilitários de calendário e fuso horário (`calendar.ts`) com validação de formato ISO `YYYY-MM-DD` e `HH:mm`, cálculo de janelas temporais diárias, semanais, mensais e móveis de 30 dias em UTC, e conversão determinística fuso local ↔ UTC.
  - Resolução robusta de transições de Horário de Verão (DST) implementada via `Intl.DateTimeFormat` seguindo a especificação Temporal `'compatible'`.
  - Validações Zod estritas (`planning.ts`) para criação, atualização, remarcação e filtragem de sessões planejadas, com garantia de consistência de blocos de estudo (`NEW_CONTENT`, `EXERCISES`, `THEORY`, `PRACTICE`, `REVIEW`, `OTHER`).
- **Backend e API REST (`apps/api`)**:
  - Endpoints completos sob `/api/planned-sessions` (`POST /`, `GET /`, `PATCH /:id`, `POST /:id/reschedule`, `PATCH /:id/status`, `DELETE /:id`).
- **Frontend (`apps/web`)**:
  - Página `/agenda` integrada ao TanStack Query, com alternância entre visão Diária e Semanal, cards responsivos (`PlannedSessionCard`) e modal de planejamento (`PlannedSessionModal`).

### Execução do Estudo, Timer por Etapa e Avaliação Pós-Sessão (Fases 4 e 5 Unificadas)
- **Domínio Puro (`packages/domain`)**:
  - Máquina de estados determinística do timer por etapa (`timer.ts`): estados `NOT_STARTED`, `STUDYING`, `PAUSED`, `DISTRACTED` e `FINISHED`.
  - Fórmulas de tempo líquido e efetivo calculadas estritamente em segundos inteiros: cômputo de pausas, distrações em tempo real e compensação por distração não cronometrada (`DISTRACTION_DECLARED`).
  - Avaliação de exercícios e acurácia (`practice.ts`): função `calculateAccuracy`, agregador `calculateAggregateAccuracy` e normalização de notas qualitativas de entendimento (`normalizeUnderstandingScore`).
- **Backend e API REST (`apps/api`)**:
  - Endpoints sob `/api/study-sessions`: `POST /`, `GET /active`, `GET /pending-evaluation`, `POST /:id/events`, `POST /:id/blocks/:blockId/finish`, `POST /:id/finish`, `POST /:id/cancel` e `POST /:id/evaluation`.
- **Frontend (`apps/web`)**:
  - Página `/timer` com relógio sincronizado (`useStudyClock`), diálogo de avanço/conclusão (`FinishStepDialog`), banner de avaliação pendente (`PendingEvaluationBanner`), formulário de estudo avulso (`AdHocSessionForm`) e modal de avaliação pós-sessão (`SessionEvaluationModal`).

### Metas de Estudo, Estatísticas, Visão de 30 Dias e Dashboard Analítico (Fases 6 e 7 Unificadas)
- **Domínio Puro (`packages/domain`)**:
  - Extensões de calendário (`calendar.ts`): `getMonthDateStrings`, `getMonthUtcRange`, `getRollingDaysDateStrings`, `getRollingDaysUtcRange` e `normalizeGoalPeriodStart` (normalizando `WEEK` para a segunda-feira ISO-8601 e `MONTH` para `YYYY-MM-01`).
  - Regras e contratos de Metas (`goals.ts`):
    - Tipos (`EFFORT` e `RESULT`), métricas (`EFFECTIVE_MINUTES`, `QUESTIONS`, `TOPICS_COMPLETED`, `REVIEWS`, `ACCURACY`) e períodos (`DAY`, `WEEK`, `MONTH`).
    - Coexistência de `subject_id` e `topic_id`: ambos podem ser enviados juntos quando o assunto pertence à matéria informada (`topic.subject_id === subject_id`); se apenas `topic_id` for enviado, `subject_id` é inferido automaticamente a partir do assunto.
    - Precedência determinística de status de metas (`deriveGoalStatus`):
      1. `UPCOMING` (`Período futuro`): quando `referenceLocalDate < periodStartLocalDate`.
      2. `INSUFFICIENT_DATA` (`Dados insuficientes (X/10 questões)`): exclusivo para metas `ACCURACY` com menos de 10 questões resolvidas no escopo/período (`questionsCount < 10`), avaliado antes de `ACHIEVED`/`MISSED`/`IN_PROGRESS`.
      3. `ACHIEVED` (`Meta atingida`): quando `currentValue >= targetValue` (com `questionsCount >= 10` no caso de `ACCURACY`).
      4. `MISSED` (`Não atingida no período`): quando `referenceLocalDate > periodEndLocalDate` e a meta não foi atingida.
      5. `IN_PROGRESS` (`Em andamento`): nos demais casos durante o período vigente.
      - *Nota sobre reversibilidade de `ACCURACY`:* como a taxa de acerto é uma média acumulada no período, uma meta de `ACCURACY` que estava `ACHIEVED` durante o período vigente pode retornar para `IN_PROGRESS` caso novas questões registradas reduzam a taxa acumulada abaixo de `target_value`.
  - Motor Puro de Estatísticas (`statistics.ts`):
    - Cálculos exatos em ponto flutuante no domínio (sem `Math.floor` em `effectiveMinutes = effectiveSeconds / 60` e sem `Math.round` em `effectiveness` ou `adherence`), deixando o arredondamento exclusivamente para a camada de exibição.
    - **Fórmula de Aderência (`adherence`):** compara a soma do tempo efetivo (`effectiveSeconds`) das sessões `FINISHED` no período com a soma da duração planejada dos blocos (`planned_minutes * 60`, ou seja, `executedPlannedSeconds`) dessas mesmas sessões concluídas:
      $$\text{adherence} = \frac{\text{effectiveSeconds}}{\text{executedPlannedSeconds}} \times 100$$
      - Se uma sessão for encerrada antecipadamente (com etapas não iniciadas), todos os blocos planejados dessa sessão `FINISHED` continuam compondo o denominador `executedPlannedSeconds`, refletindo fielmente o quanto do roteiro da sessão foi cumprido.
      - Se o estudante estudar por mais tempo líquido do que o previsto nos blocos da sessão concluída, a aderência pode ultrapassar `100%` (sem teto artificial).
      - A **Carga Planejada na Agenda (`agendaPlannedMinutes`)** é mantida como indicador separado, somando `planned_minutes` apenas das `PlannedSession` com status `PLANNED` ou `DONE` (excluindo `SKIPPED` e `RESCHEDULED`).
    - **Diferença de `effectiveness` (Período vazio vs. Sessão individual):** em uma sessão individual (`calculateSessionMetrics`), `totalSessionSeconds === 0` retorna `effectiveness = 0`; já no agregador de período (`calculatePeriodStatistics`), quando não há segundos brutos acumulados (`totalSessionSeconds === 0`), retorna `effectiveness = null` (exibido como `"—"` na interface) para distinguir ausência de dados de foco zero.
    - **Definição de `TOPICS_COMPLETED` e `REVIEWS`:**
      - `TOPICS_COMPLETED` (*Assuntos estudados*): quantidade de `topic_id` distintos em sessões `FINISHED` na janela com tempo efetivo `> 0`.
      - `REVIEWS` (*Blocos de revisão concluídos*): quantidade de `SessionBlock` com `kind === 'REVIEW'`, estado derivado `'FINISHED'` (`BLOCK_FINISH`) e tempo efetivo do bloco `> 0` em sessões `FINISHED` na janela.
- **Backend e API REST (`apps/api`)**:
  - `/api/goals`:
    - `POST /`: Criação de meta protegida com `pg_advisory_xact_lock(hashtext('goals:' || userId))`, normalização automática de `period_start_local_date`, bloqueio de escopo arquivado (`400`) e retorno `409 Conflict` (`code: 'GOAL_ALREADY_EXISTS'`) em caso de duplicidade no mesmo período/métrica/escopo.
    - `GET /`: Listagem de metas com progresso calculado em tempo real. Se o parâmetro `date` for omitido, assume automaticamente a data de "hoje" no fuso horário do usuário, normalizada para o início do `period` filtrado.
    - `PATCH /:id`: Atualização de `target_value` revalidada contra a `metric` da meta existente (`1..100` para `ACCURACY`, `<= 100000` para métricas de esforço).
    - `DELETE /:id`: Remoção de meta do usuário.
    - `POST /copy`: Cópia idempotente e transacional das metas do período imediatamente anterior (ignorando metas vinculadas a matérias/assuntos arquivados e metas já existentes no destino).
  - `/api/statistics`:
    - `GET /?range=day|week|month|30d&date=YYYY-MM-DD&subject_id=...&topic_id=...`: Retorna `overview`, `bySubject`, `byTopic`, `dailySeries` e `formulaMetadata`. Inclui itens arquivados na resposta histórica com flag `archived: true`.
    - **Garantia Anti-N+1:** consultas em lote constantes (`queries(10d) === queries(180d) <= 25` queries SQL em `< 2000ms`), comprovadas por teste de integração com contador de eventos do Prisma.
  - `/api/dashboard`:
    - `GET /?date=YYYY-MM-DD`: Endpoint único consolidando `today` (`nextSession` com flags `isLate` e `isFutureDay`, `todaySessions`), `activeSession`, `pendingEvaluation`, `goals`, `weekSummary`, `rolling30Days` e `subjectProgress` (apenas tempo e questões por matéria ativa, sem classificação forte/fraca).
- **Frontend (`apps/web`)**:
  - Página `/goals` (`Goals.tsx`): Abas `Diárias`, `Semanais`, `Mensais` e `Visão de 30 Dias` (alimentada por `GET /api/statistics?range=30d`), modal de criação e edição de metas, botão `"Copiar metas do período anterior"`, exibição dos 5 badges de status (`GoalStatusBadge.tsx`) e etiqueta `"Arquivada"` para escopos arquivados.
  - Página `/stats` (`Statistics.tsx`): Seletor de período (`Hoje`, `Esta Semana`, `Últimos 30 Dias`, `Este Mês`), filtros por matéria e assunto (incluindo arquivados), cards de indicadores explicáveis com fórmulas e numerador/denominador brutos, gráfico Recharts de evolução diária e tabelas `Por Matéria` e `Por Assunto` com aviso `"Dados insuficientes (< 10 questões)"`.
  - Página `/dashboard` (`Dashboard.tsx`): Estado vazio orientativo para usuários novos, card `"O que estudar agora?"` (priorizando sessão em andamento/avaliação pendente ou próxima sessão planejada com badge `"Em atraso"`), comparativo `"Planejado na Agenda Hoje"` vs. `"Tempo Efetivo Estudado Hoje"`, metas ativas, resumo semanal/30 dias e progresso por matéria.
  - Invalidação reativa de cache (`['dashboard']`, `['goals']`, `['statistics']`) integrada diretamente nas mutações de `Timer.tsx`, `Agenda.tsx`, `Subjects.tsx` e `Goals.tsx`.

### Roteiro de Validação Manual no Navegador (Fases 6 e 7)
1. Suba o banco (`docker compose up -d`), rode `npm run seed:sample-6m` e inicie a aplicação (`npm run dev`).
2. Faça login com `demo@estudos.local` / `Demo@123456`.
3. Acesse `/dashboard` e verifique o card `"O que estudar agora?"`, os cards comparativos de hoje (`"Planejado na Agenda Hoje"` vs. `"Tempo Efetivo Estudado Hoje"`), as metas ativas e o progresso por matéria.
4. Acesse `/goals`, alterne entre as abas `Diárias`, `Semanais`, `Mensais` e `Visão de 30 Dias`, crie uma nova meta, edite seu valor alvo e teste o botão `"Copiar metas do período anterior"`.
5. Acesse `/stats`, alterne entre `Hoje`, `Esta Semana`, `Últimos 30 Dias` e `Este Mês`, filtre por matéria/assunto e verifique as fórmulas explicáveis nos cards e os avisos de amostra insuficiente (`< 10 questões`) nas tabelas.

## O Que Ficou de Fora (Próximas Fases)

Conforme a arquitetura e o planejamento modular da plataforma:

- **Fase 8**: Observatório Semanal e Classificação Diagnóstica (classificação de matérias e assuntos em Forte, Regular e Fraco, detecção de gargalos e relatório consolidado de evolução).
