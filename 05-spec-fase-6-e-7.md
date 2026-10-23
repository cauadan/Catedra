Leia o arquivo `01-contexto-do-projeto.md` anexo. Ele prevalece sobre qualquer suposição.
Implemente SOMENTE as **Fases 6 e 7 unificadas — Metas de Estudo, Estatísticas, Visão de 30 Dias e Dashboard Analítico**.

### ⚙️ 1. CONTROLE DE WORKFLOW, SKILLS E INSPEÇÃO INICIAL (OBRIGATÓRIO)
1. **Idioma e Convenções:**
   - Identificadores de código (funções, variáveis, rotas, tipos) em **inglês**.
   - Interface, mensagens de erro da API/Zod, validações, comentários, commits, `README.md` e relatório final estritamente em **Português do Brasil (pt-BR)** (usando "você").
2. **Protocolo de Eficiência de Tokens e Passo 1 (Sem Código antes da Aprovação):**
   - **Uso de `graphify` e `trail-code`:** Se disponíveis no ambiente, use `graphify` e `trail-code` para mapear o monorepo. Caso não existam ou o grafo esteja desatualizado, faça busca direcionada (`rg` / pontos de entrada) e **sempre confirme as assinaturas lendo os arquivos reais**.
   - **Proibição de Subagentes e Brainstorming Longo:** **NÃO** use `subagent-driven-development` e **NÃO** abra ciclos de `brainstorming`.
   - **Passo 1 (Inspeção Obrigatória antes do Plano — 8 itens):** Inspecione o repositório e confirme obrigatoriamente no plano:
     1. **Branch base e dependências das Fases 4 e 5:** a branch atual e se as funções entregues nas Fases 4 e 5 existem em `@estudos/domain` (`calculateSessionMetrics`, métricas por bloco, `calculateAccuracy` com retorno `null` para zero questões, `deriveBlockState`). Se a branch `fase-4-5-execucao` ainda não tiver sido integrada ao `master`, a nova branch deve se chamar `fase-6-7-metas-estatisticas` e ser criada **a partir de `fase-4-5-execucao`**; se já estiver integrada, a partir do `master`. Se essas funções não existirem, isso é **dúvida bloqueante**;
     2. Os tipos exatos das colunas de `Goal` no `schema.prisma`, especialmente `period_start_local_date` (`@db.Date` ou `String`?) e `target_value` (`Int`, `Decimal` ou `Float`?). Se `period_start_local_date` for `@db.Date`, o Prisma retorna `Date` em `00:00:00.000Z` e a conversão de/para `YYYY-MM-DD` deve extrair a data UTC sem deslocar o dia;
     3. O tipo exato de `User.week_starts_on` no `schema.prisma` (`Int`, `String` ou enum?). Caso seja texto ou enum, defina um conversor limpo para número (`0` ou `1`) antes de chamar `getWeekWindowUtc` e `normalizeGoalPeriodStart`;
     4. As assinaturas e comportamentos atuais de `getWeekWindowUtc` (se o início da semana é fixo ou aceita `weekStartsOn`), das funções de métricas de bloco e de `calculateSessionMetrics` em `@estudos/domain`, para reutilizá-las sem duplicação;
     5. As rotas reais já cadastradas no `Shell.tsx` e `App.tsx` (use exatamente as rotas existentes, sem criar aliases);
     6. Como o cliente Prisma é instanciado em `apps/api/src/lib/prisma.ts` e como habilitar/escutar eventos de query (`log: [{ emit: 'event', level: 'query' }]` ou equivalente) para aferir a contagem exata de queries SQL no teste anti-N+1;
     7. Como scripts TypeScript já são executados no repositório (ex.: `tsx` em `apps/api/prisma/seed.ts` ou scripts existentes) para rodar `seed-sample-6m.ts` sem instalar pacotes extras desnecessários, e qual o formato dos identificadores (`id`) usado no schema (`uuid`, `cuid` etc.);
     8. Se `recharts` já consta em `apps/web/package.json` (**NÃO** instale nada no Passo 1; apenas relate no plano e instale na Task 1 após a aprovação, com justificativa de que consta na stack oficial do projeto).
   - Liste apenas dúvidas estritamente bloqueantes (se houver) e gere o plano (`writing-plans`). **Não escreva código nem altere pacotes antes da aprovação do plano.**
   - **Execução Inline:** Após aprovação, execute na sessão atual com `executing-plans` → `test-driven-development` → `verification-before-completion` → `finishing-a-development-branch` (**ATENÇÃO:** sem fazer merge nem push sem autorização explícita). Faça **um commit ao final de cada task** do plano, com mensagem em pt-BR.
3. **Integridade do Schema:**
   - Utilize o model `Goal` e as tabelas existentes no `schema.prisma` sem alterar o schema. O progresso das metas é **sempre calculado em tempo de execução**, nunca armazenado no banco.

---

### 🧠 2. PACOTE `packages/domain` (Funções Puras + TDD com Vitest)

Reaproveite as funções de calendário (`getDayWindowUtc`, `getWeekWindowUtc`, `utcToLocalDate`, `addDaysToLocalDate`), de árvore de assuntos e de métricas das fases anteriores:

1. **Janelas de Mês, Janela Móvel de 30 Dias e Normalização de Período (`calendar.ts`):**
   - `getMonthWindowUtc(localDate: string, timezone: string): { startUtc: Date; endUtc: Date; periodStartLocalDate: string; days: string[] }`:
     - Retorna o intervalo **semiaberto** `[startUtc, endUtc)` correspondente ao mês local de `localDate` no `timezone` do usuário (`00:00:00.000` do dia `YYYY-MM-01` até `00:00:00.000` do dia `01` do mês seguinte), a data canônica `YYYY-MM-01` e a lista de todos os dias locais do mês (`28`, `29`, `30` ou `31` dias).
   - `getRolling30DaysWindowUtc(referenceLocalDate: string, timezone: string): { startUtc: Date; endUtc: Date; startLocalDate: string; endLocalDate: string; days: string[] }`:
     - Retorna o intervalo semiaberto `[startUtc, endUtc)` dos últimos 30 dias locais terminando em `referenceLocalDate` inclusive: de `addDaysToLocalDate(referenceLocalDate, -29)` às `00:00:00.000` até `addDaysToLocalDate(referenceLocalDate, 1)` às `00:00:00.000`, com o array `days` contendo exatamente as 30 strings `YYYY-MM-DD` em ordem cronológica.
   - `normalizeGoalPeriodStart(localDate: string, period: 'DAY' | 'WEEK' | 'MONTH', weekStartsOn: number = 1): string`:
     - Função pura de aritmética de datas locais `YYYY-MM-DD` (não depende de `timezone`):
       - `DAY`: retorna o próprio `YYYY-MM-DD`.
       - `WEEK`: retorna a data `YYYY-MM-DD` do início daquela semana respeitando `weekStartsOn` (padrão `1` = segunda-feira, coerente com `User.week_starts_on`).
       - `MONTH`: retorna `YYYY-MM-01` daquele mês.
   - `getPreviousGoalPeriodStart(periodStartLocalDate: string, period: 'DAY' | 'WEEK' | 'MONTH', weekStartsOn: number = 1): string`:
     - Calcula o `period_start_local_date` imediatamente anterior (`-1` dia para `DAY`, `-7` dias para `WEEK`, mês anterior `YYYY-MM-01` para `MONTH`).
   - `getGoalPeriodWindowUtc(periodStartLocalDate: string, period: 'DAY' | 'WEEK' | 'MONTH', timezone: string): { startUtc: Date; endUtc: Date; days: string[] }`:
     - Reutiliza `getDayWindowUtc`, `getWeekWindowUtc` e `getMonthWindowUtc` para devolver a janela semiaberta de uma meta a partir do seu `period_start_local_date`.
   - **Testes obrigatórios de borda:** Sessão **iniciada** às `23:50` locais em `America/Rio_Branco` (`2026-10-31T23:50` local = `2026-11-01T04:50Z` deve pertencer a Outubro, não Novembro); fevereiro em ano bissexto (`2028-02-29`) vs. não-bissexto (`2026-02-28`); janela móvel de 30 dias cruzando virada de mês/ano e horário de verão (`America/New_York`); semana que atravessa a virada de mês (ex.: semana de `2026-10-26` a `2026-11-01`).

2. **Cálculo Puro de Progresso de Metas (`goals.ts`):**
   - Constante exportada: `MIN_QUESTIONS = 10`.
   - **Tipos de Status da Meta (`GoalStatus`):**
     - `'ACHIEVED' | 'IN_PROGRESS' | 'MISSED' | 'UPCOMING' | 'INSUFFICIENT_DATA'`
   - **Regras de coerência de `kind` e `metric` (validadas no Zod `.strict()`):**
     - `EFFORT` permite `metric` em: `'EFFECTIVE_MINUTES' | 'QUESTIONS' | 'TOPICS_COMPLETED' | 'REVIEWS'` (com `target_value` inteiro `>= 1`). *(Nota de UI: `TOPICS_COMPLETED` conta assuntos estudados no período e deve ser rotulado na interface como `"Assuntos estudados"`).*
     - `RESULT` permite `metric`: `'ACCURACY'` (com `target_value` entre `1` e `100`).
     - Combinar `RESULT` com métrica de esforço (ou `EFFORT` com `ACCURACY`) retorna erro de validação (`400 Bad Request`).
     - Se `topic_id` e `subject_id` forem ambos informados, `topic.subject_id === subject_id` é obrigatório (`400` se incompatíveis). Se apenas `topic_id` for informado, `subject_id` é inferido a partir do tópico.
   - **Atribuição de Período e Escopo Hierárquico (Regra Estrita):**
     - **Janela Temporal:** Uma sessão e seus registros pertencem à janela `[startUtc, endUtc)` estritamente pelo **`StudySession.started_at`** (sessão que cruza a meia-noite pertence ao dia em que foi iniciada). Todo `PracticeRecord` herda a data `started_at` da sua `StudySession`. Apenas sessões com `status === 'FINISHED'` entram nos cálculos.
     - **Escopo de Matéria/Assunto:**
       - Sem `subject_id` e sem `topic_id`: considera todas as matérias do usuário.
       - Com `subject_id` e sem `topic_id`: considera todos os tópicos daquela matéria.
       - Com `topic_id`: considera o próprio `topic_id` **e toda a sua subárvore de descendentes, inclusive descendentes arquivados** (`getTopicSubtreeIds(rootTopicId, allTopics)`), pois o histórico de estudo deve continuar sendo contado.
     - **Diferenciação de Filtro entre Sessão e Prática:**
       - `EFFECTIVE_MINUTES`, `REVIEWS` e `TOPICS_COMPLETED` são filtrados pelo `StudySession.topic_id` (e `subject_id`).
       - `QUESTIONS` e `ACCURACY` são filtrados pelo **`PracticeRecord.topic_id`** (pois uma sessão pode registrar questões de mais de um assunto na avaliação pós-sessão).
   - **Fórmulas e Ordem Estrita de Precedência de `GoalStatus` em `calculateGoalProgress(..., referenceNow: Date)`:**
     - `EFFECTIVE_MINUTES`: `soma(tempo_efetivo_segundos) / 60` (em ponto flutuante exato no domínio).
     - `QUESTIONS`: `soma(PracticeRecord.questions)` no escopo e janela.
     - `REVIEWS`: quantidade de blocos `SessionBlock` com `kind === 'REVIEW'` concluídos (`BLOCK_FINISH` e `tempo_efetivo > 0`) em sessões `FINISHED` no escopo e janela.
     - `TOPICS_COMPLETED`: quantidade de `StudySession.topic_id` **distintos** (no escopo) com pelo menos uma `StudySession` `FINISHED` e `tempo_efetivo > 0` na janela.
     - `ACCURACY`: `(soma de correct / soma de questions) * 100` dos `PracticeRecord`s no escopo e janela.
     - **Determinação de `status` e `progressPercent` (recebendo `referenceNow: Date` e a janela `[startUtc, endUtc)` da meta):**
       1. **Para `metric === 'ACCURACY'` (ordem estrita: `UPCOMING` → `INSUFFICIENT_DATA` → `ACHIEVED` → `MISSED` → `IN_PROGRESS`):**
          - **Passo 1 (`UPCOMING`):** Se `referenceNow < startUtc` (o período ainda não começou), retorna `status: 'UPCOMING'`, `isAchieved: false`, `progressPercent: null`, `questionsCount: totalQuestions`, `currentValue: totalQuestions > 0 ? accuracy : null`.
          - **Passo 2 (`INSUFFICIENT_DATA`):** Se `totalQuestions < MIN_QUESTIONS` (menos de 10 questões em período presente ou passado), retorna `status: 'INSUFFICIENT_DATA'`, `isAchieved: false`, `progressPercent: null`, `questionsCount: totalQuestions`, `currentValue: totalQuestions > 0 ? accuracy : null`.
          - **Passo 3 (`totalQuestions >= MIN_QUESTIONS`):** `progressPercent = Math.min(100, (currentValue / target_value) * 100)`.
            - Se `currentValue >= target_value` → `status: 'ACHIEVED'`, `isAchieved: true`;
            - Senão, se `referenceNow >= endUtc` → `status: 'MISSED'`, `isAchieved: false`;
            - Senão → `status: 'IN_PROGRESS'`, `isAchieved: false`.
          - *(Nota para o README: uma meta `ACCURACY` atingida no meio do período pode voltar a `IN_PROGRESS` caso novas questões reduzam o aproveitamento, pois o status é sempre recalculado.)*
       2. **Para metas de `EFFORT`:**
          - `progressPercent = Math.min(100, (currentValue / target_value) * 100)`.
          - Se `currentValue >= target_value` → `status: 'ACHIEVED'`, `isAchieved: true`;
          - Senão, se `referenceNow < startUtc` → `status: 'UPCOMING'`, `isAchieved: false`;
          - Senão, se `referenceNow >= endUtc` → `status: 'MISSED'`, `isAchieved: false`;
          - Senão → `status: 'IN_PROGRESS'`, `isAchieved: false`.

3. **Agregações Estatísticas e Evolução (`statistics.ts`):**
   - Função pura `calculatePeriodStatistics(...)` para uma janela `[startUtc, endUtc)` e lista `days: string[]`:
     - **Totais Gerais do Período (`overview`):**
       - `agendaPlannedMinutes`: soma de `planned_minutes` das `PlannedSession`s com status `PLANNED` ou `DONE` cujo `scheduled_start` caia na janela (indicador `"Carga Planejada na Agenda"`). Quando houver filtro de matéria ou assunto, filtra por `PlannedSession.topic_id` (com a subárvore, quando for `topic_id`).
       - `executedPlannedSeconds`: soma de `planned_minutes * 60` de todos os `SessionBlock`s pertencentes às `StudySession`s `FINISHED` na janela. *(Nota para o README: se uma sessão for encerrada antes de percorrer todas as etapas, todos os blocos planejados daquela sessão continuam no denominador, reduzindo a aderência de forma coerente com a Fase 4/5).*
       - `effectiveSeconds` e `effectiveMinutes` (`effectiveSeconds / 60`): tempo efetivo total estudado nas `StudySession`s `FINISHED` na janela.
       - `totalSessionSeconds`: tempo bruto total das `StudySession`s `FINISHED` na janela.
       - `effectiveness`: `totalSessionSeconds > 0 ? (effectiveSeconds / totalSessionSeconds) * 100 : null` (Foco; retorna `null` quando o total é zero para representar estado vazio, enquanto no resumo de uma sessão individual da Fase 4/5 retorna `0`).
       - `adherence`: `executedPlannedSeconds > 0 ? (effectiveSeconds / executedPlannedSeconds) * 100 : null` (compara o tempo efetivo das sessões concluídas contra o tempo planejado dos blocos dessas mesmas sessões concluídas). *(Nota para o README e para a UI: a aderência pode ultrapassar 100% quando o usuário estuda além do planejado; exiba o valor real, sem truncá-lo, e limite apenas o preenchimento visual da barra.)*
       - `completedSessionsCount`: total de `StudySession`s `FINISHED`.
       - `activeDaysCount`: quantidade de dias locais distintos na janela (`days`) que tiveram **`effectiveSeconds > 0`** (usado para medir consistência, especialmente na Visão de 30 Dias).
       - `totalDaysInPeriod`: `days.length` (ex.: `30` na visão de 30 dias, `7` na semana), permitindo exibir consistência como `activeDaysCount / totalDaysInPeriod`.
       - `totalQuestions`, `totalCorrect`, `totalErrors` (`totalQuestions - totalCorrect`) e `accuracy` (`calculateAccuracy(totalCorrect, totalQuestions)`).
     - **Filtro de Escopo vs. Quebra por Matéria (`bySubject`) e Assunto (`byTopic`):**
       - Quando `calculatePeriodStatistics` recebe um filtro `topic_id`, ela filtra os dados incluindo toda a **subárvore** daquele tópico (`getTopicSubtreeIds`, inclusive arquivados).
       - Na tabela de saída `byTopic`, o agrupamento é **direto por `topic_id`** (sem somar os valores dos filhos na linha do pai, evitando dupla contagem visual), atribuindo tempo/sessões por `StudySession.topic_id` e questões/acertos por `PracticeRecord.topic_id`, e incluindo `archived: boolean` e `hasSufficientQuestions: totalQuestions >= MIN_QUESTIONS`.
     - **Série Temporal Diária (`dailySeries` para Recharts):**
       - Array ordenado para cada dia `YYYY-MM-DD` da janela (agrupado por `utcToLocalDate(started_at, user.timezone)` para sessões/práticas e `utcToLocalDate(scheduled_start, user.timezone)` para agenda), contendo: `date`, `agendaPlannedMinutes`, `effectiveMinutes`, `questions`, `correct`, `accuracy` e `effectiveness`.
     - **Rastreabilidade (`formulaMetadata`):**
       - Numeradores e denominadores brutos para exibição em *tooltips* explicativos na UI.

---

### 🔌 3. BACKEND `apps/api` (Express + Prisma + Zod — Zero Queries N+1)

1. **Segurança, Isolamento, Locks com Namespace Próprio e Validação Estrita (`.strict()`):**
   - Todas as rotas exigem autenticação (`401` sem sessão) e filtram por `user_id`. Recursos inexistentes ou de outro usuário retornam **`404 Not Found`**.
   - Todos os schemas Zod de **body** e de **query params** (`req.query`) devem usar **`.strict()`**, retornando **`400 Bad Request`** com mensagem em português para datas inválidas (`2026-02-30`), `range` desconhecido ou parâmetros extras.
   - **Prevenção de Duplicatas de Meta com Lock em Namespace Próprio (`goals:`):**
     - Para não serializar nem competir com o lock de criação de sessões de estudo da Fase 4/5, tanto `POST /api/goals` quanto `POST /api/goals/copy` devem rodar em `$transaction` adquirindo lock com chave composta **no código** (evitando problemas de inferência de tipo na concatenação SQL): `const lockKey = \`goals:${userId}\`; await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))\``. O comportamento deve ser validado no teste de concorrência contra o PostgreSQL real.
     - Uma meta é considerada duplicada se já existir para o mesmo `user_id` outra meta com a mesma combinação `(kind, metric, period, period_start_local_date, subject_id ?? null, topic_id ?? null)`.
     - Em **`POST /api/goals`**, se a meta já existir, retorne **`409 Conflict`** com `code: 'GOAL_ALREADY_EXISTS'` e mensagem em pt-BR.

2. **Endpoints de Metas (`/api/goals`):**
   - `GET /api/goals?period=DAY|WEEK|MONTH&date=YYYY-MM-DD`:
     - Valida `req.query` com Zod `.strict()`. **Se `date` for omitido, assume o "Hoje" no `User.timezone`** (`utcToLocalDate(new Date(), user.timezone)`), idêntico ao comportamento do Dashboard.
     - Normaliza `date` com `normalizeGoalPeriodStart(date, period, userWeekStartsOn)`. Se `period` for omitido, retorna as metas do Dia, da Semana e do Mês correspondentes a `date`, carregando os dados **uma única vez** na janela que cobre os três períodos (`[min(início dia, início semana, início mês), max(fim dia, fim semana, fim mês))`, lembrando que a semana pode terminar depois do mês) e fatiando em memória.
     - Metas já existentes vinculadas a matérias/assuntos arquivados posteriormente continuam sendo retornadas e calculadas normalmente, marcadas com `is_archived_scope: true` (para exibir badge `"Arquivada"` na UI).
   - `POST /api/goals`:
     - Body `.strict()`: `{ kind, metric, period, period_start_local_date, target_value, subject_id?, topic_id? }`.
     - Normaliza `period_start_local_date` com `normalizeGoalPeriodStart(..., userWeekStartsOn)`.
     - Rejeita criação se a matéria ou assunto estiver arquivado (`400 Bad Request`). Rejeita duplicata com `409 GOAL_ALREADY_EXISTS` sob o advisory lock `goals:`.
     - Retorna `201 Created` com progresso calculado usando `referenceNow = new Date()`.
   - `POST /api/goals/copy`:
     - Body `.strict()`: `{ period: 'DAY' | 'WEEK' | 'MONTH', target_date: string }`.
     - Sob o advisory lock `goals:` em `$transaction`: normaliza `target_date` para o `targetPeriodStart` e calcula `previousPeriodStart = getPreviousGoalPeriodStart(targetPeriodStart, period, userWeekStartsOn)`.
     - Busca as metas do usuário em `previousPeriodStart`, ignora aquelas cujo `Subject` ou `Topic` esteja atualmente arquivado e ignora aquelas que já existam em `targetPeriodStart` (idempotente, sem lançar `409`), copiando apenas as ausentes para `targetPeriodStart`.
     - **Código HTTP de retorno:** Se `copiedCount > 0`, retorna **`201 Created`**; se `copiedCount === 0` (nenhuma meta nova copiada), retorna **`200 OK`**. Em ambos os casos o body é `{ copiedCount, data: metasDoPeriodoAlvoComProgresso }`.
   - `PATCH /api/goals/:id`:
     - Body `.strict()`: `{ target_value: number }`. **A validação do valor depende da métrica da meta existente:** inteiro `>= 1` para metas de esforço e valor entre `1` e `100` para `ACCURACY` (`400` se inválido). Atualiza e retorna `200 OK` com o progresso recalculado.
   - `DELETE /api/goals/:id`:
     - Exclui a meta do usuário (`204 No Content`, ou `404` se não existir/outro usuário).

3. **Endpoints de Estatísticas e Dashboard (`/api/statistics` e `/api/dashboard` — Carga Única em Lote):**
   - `GET /api/statistics?range=day|week|month|30d&date=YYYY-MM-DD&subject_id=...&topic_id=...`:
     - Valida `req.query` com Zod `.strict()`. Se `date` for omitido, usa o "Hoje" no `User.timezone`.
     - **Aceita matérias e assuntos arquivados nos filtros** (`404` apenas se o ID não existir ou pertencer a outro usuário).
     - Executa consultas em lote na janela `[startUtc, endUtc)` e retorna o resultado de `calculatePeriodStatistics` (incluindo `activeDaysCount` e `totalDaysInPeriod` no `overview`).
   - `GET /api/dashboard?date=YYYY-MM-DD`:
     - Valida `req.query` com Zod `.strict()`. Se `date` for omitido, usa o "Hoje" no `User.timezone`.
     - **Otimização de Carga Única (janela ampla correta):** Calcula a janela que cobre simultaneamente o Mês atual, a **Semana atual** e os Últimos 30 dias: `[min(monthStartUtc, weekStartUtc, rolling30StartUtc), max(monthEndUtc, weekEndUtc, rolling30EndUtc))`. A inclusão da semana é obrigatória, pois ela pode terminar depois do mês (ex.: em `2026-10-30`, a semana vai até `2026-11-01` e o mês termina em `2026-11-01T00:00` local). Busca sessões, blocos, eventos, práticas e sessões planejadas **uma única vez** selecionando apenas as colunas necessárias, e fatia em memória para montar:
       1. `today`:
          - `agendaPlannedMinutes` vs. `effectiveMinutes`, questões e aproveitamento de hoje;
          - `todaySessions`: lista de sessões planejadas de hoje;
          - `nextSession`: próxima sessão `PLANNED` de hoje (com `isLate: true` se `scheduled_start` já passou). Caso hoje não tenha nenhuma sessão `PLANNED` restante, busca a próxima sessão `PLANNED` futura a partir de amanhã (`isFutureDay: true`, `localDate`). *(Esta busca futura deve ser feita de modo que o número de queries não dependa do volume de dados.)*
       2. `activeSession` e `pendingEvaluation`: estado atual de execução;
       3. `goals`: metas do dia, da semana e do mês atuais com progresso calculado;
       4. `weekSummary`: estatísticas e série diária da semana atual;
       5. `rolling30Days`: resumo dos últimos 30 dias (`effectiveMinutes`, `agendaPlannedMinutes`, `effectiveness`, `adherence`, `totalQuestions`, `accuracy`, `activeDaysCount`, `totalDaysInPeriod` e `dailySeries`).

4. **Script de Seed de 6 Meses Rápido, Determinístico e Reutilizável (`apps/api/scripts/seed-sample-6m.ts`):**
   - Adicione o script `"seed:sample-6m"` no `package.json` raiz usando o mesmo runner TypeScript já adotado no repositório.
   - **Segurança:** Recuse a execução imediatamente (`process.exit(1)`) se `process.env.NODE_ENV === 'production'`.
   - **Função reutilizável nos testes:** Exporte `seedDemoData({ days, anchorDate })`, em que `days` define quantos dias de histórico gerar (ex.: `180` ou `10`) e `anchorDate` (`YYYY-MM-DD`) define o "hoje" do usuário demo, de modo que o dado mais recente caia em "hoje". O script de linha de comando chama essa função com `days = 180`.
   - **Determinismo, Inserção em Lote (`createMany`) e Idempotência Isolada:** Use um PRNG com **semente fixa**. Limpe e recrie dados **apenas** do usuário de demonstração (`demo@estudos.local`, senha documentada no README ex.: `Demo@123456`). Como `createMany` não devolve identificadores, **gere os IDs no próprio script** (no formato usado pelo schema, confirmado no Passo 1) para que blocos, eventos, avaliações e registros de prática referenciem as sessões corretamente. Defina e documente no plano a **ordem de inserção e de limpeza respeitando as chaves estrangeiras**. Gere ~180 dias de histórico realista, com eventos que respeitem estritamente a máquina de estados (`BLOCK_START` → `PAUSE`/`RESUME` → `BLOCK_FINISH` → `SESSION_FINISH`), avaliações pós-sessão, registros de prática e metas, inserindo tudo em lotes para que o processo rode em poucos segundos.

---

### 🖥️ 4. FRONTEND `apps/web` (Metas, Estatísticas, Dashboard, Estados Vazios e Cache)

*(Os nomes de arquivos de frontend citados abaixo são referências: use os **equivalentes já existentes** no repositório e não crie arquivos duplicados.)*

1. **Invalidação Completa de Cache no TanStack Query (Fases 2, 3, 4 e 5):**
   - Atualize as mutações existentes para invalidar as query keys `['dashboard']`, `['goals']` e `['statistics']`:
     - Mutações do Timer e Avaliação (`Timer.tsx`, `SessionEvaluationModal.tsx`, `AdHocSessionForm.tsx`): iniciar, pausar/retomar/avançar, concluir, cancelar e avaliar sessão;
     - Mutações da Agenda (`Agenda.tsx`, `PlannedSessionModal.tsx`): criar, editar, remarcar, pular e excluir sessão planejada;
     - Mutações de Matérias e Assuntos (`Subjects.tsx` — Fase 2): criar, editar e **arquivar/desarquivar** matéria ou assunto (pois altera `is_archived_scope` nas metas e rótulos nas estatísticas).

2. **Roteamento (`App.tsx`) e Navegação (`Shell.tsx`):**
   - Use **exatamente as rotas já definidas no `Shell.tsx`** (confirmadas no Passo 1) para conectar as páginas reais `Dashboard.tsx`, `Goals.tsx` e `Statistics.tsx`, removendo os placeholders dessas rotas.

3. **Página de Metas (`Goals.tsx`):**
   - Abas para **Metas Diárias**, **Metas Semanais**, **Metas Mensais** e **Visão de 30 Dias (Janela Móvel)**.
   - Navegação de período (`Anterior`, `Atual`, `Próximo`) nas abas Diária, Semanal e Mensal.
   - **Conteúdo da Aba "Visão de 30 Dias (Janela Móvel)":**
     - Alimentada por `GET /api/statistics?range=30d&date=YYYY-MM-DD`.
     - Exibe cards de destaque para: **Consistência / Dias Estudados** (`activeDaysCount` de `30` dias, com percentual), **Horas/Minutos Efetivos Estudados**, **Total de Questões Resolvidas**, **Taxa de Acerto Geral (%)**, **Efetividade/Foco (%)** e **Aderência (%)**, acompanhados do gráfico de evolução diária dos últimos 30 dias.
   - **Estado Vazio e Botão "Copiar metas do período anterior":**
     - Quando o período selecionado (Dia/Semana/Mês) não possuir metas cadastradas, exibir estado vazio amigável com CTA **"Criar Meta"** e o botão **"Copiar metas do período anterior"** (que aciona `POST /api/goals/copy`).
   - Modal de criação/edição de meta com validação de tipo (`Esforço` vs. `Resultado`) e escopo (Geral, Matéria ativa ou Assunto ativo). Rotule `TOPICS_COMPLETED` como **"Assuntos estudados"**.
   - **Badges de Status da Meta:**
     - `ACHIEVED`: `"Meta atingida"` (verde).
     - `IN_PROGRESS`: `"Em andamento"` (azul).
     - `MISSED`: `"Não atingida no período"` (vermelho/cinza).
     - `UPCOMING`: `"Período futuro"` (neutro).
     - `INSUFFICIENT_DATA`: **"Dados insuficientes (X/10 questões)"** (amarelo/neutro, sem barra de percentual enganosa).
     - Se `is_archived_scope === true`, exibir etiqueta discreta **"Arquivada"**.

4. **Página de Desempenho e Estatísticas (`Statistics.tsx` com Recharts e Estados Vazios):**
   - Filtros de período (`Hoje`, `Esta Semana`, `Últimos 30 Dias`, `Este Mês`) e filtros de Matéria e Assunto (permitindo selecionar inclusive itens arquivados para consulta histórica).
   - **Tratamento Obrigatório de Estado Vazio (Usuário Novo / Período sem Dados):**
     - Quando não houver sessões nem planejamentos no período, exibir **Estado Vazio amigável** (sem `NaN`, sem `undefined%` e sem gráficos Recharts quebrados), com botões de chamada para ação (CTA): **"Planejar na Agenda"** (`/agenda`) e **"Iniciar Estudo Agora"** (`/timer`).
   - Cards de indicadores com **rastreabilidade explicável** (mostrando a fórmula e os números brutos de numerador/denominador). Exiba separadamente **"Carga Planejada na Agenda"** e **"Aderência das Sessões Concluídas"** (exibindo o valor real mesmo acima de 100%).
   - Gráficos Recharts limpos (*Tempo Planejado vs. Efetivo por Dia* e *Aproveitamento e Questões*). *(Para que os testes SSR com `react-dom/server` funcionem sem warning, forneça dimensões de fallback ou wrapper seguro para ambiente de teste.)*
   - Tabela por Matéria e por Assunto (com badge `"Dados insuficientes (< 10 questões)"` quando `totalQuestions < 10` e badge `"Arquivado"` se aplicável).

5. **Novo Dashboard Principal (`Dashboard.tsx` — Orientado a Ação e Estado Vazio):**
   - **Card Principal "O que estudar agora?":**
     - Prioridade 1: Sessão `IN_PROGRESS` (botão `"Retomar Cronômetro"`) ou `pendingEvaluation` (botão `"Concluir Avaliação Pendente"`).
     - Prioridade 2: `nextSession` de hoje (exibindo tag `"Em atraso"` se `isLate === true`, ou indicando a data futura se `isFutureDay === true`, com botão **"Iniciar Estudo"** para sessões de hoje).
     - **Estado Vazio (Usuário Novo sem Sessões Planejadas nem Histórico):** Exibe boas-vindas orientadas a ação com CTAs diretos para **"Cadastrar Matérias"** (`/subjects`), **"Planejar Agenda"** (`/agenda`) e **"Iniciar Estudo Avulso"** (`/timer`), garantindo zero `NaN` nos indicadores.
   - **Comparativo do Dia com Rótulos Explícitos:** `"Planejado na Agenda Hoje"` vs. `"Tempo Efetivo Estudado Hoje"` + Questões/Aproveitamento do dia.
   - **Progresso das Metas Ativas** (Dia/Semana) e **Resumo da Semana / Últimos 30 Dias** com gráfico Recharts compacto.

---

### 📌 Decisões Complementares Consolidadas (Rodadas 1 a 3)
- **Branch base:** o Passo 1 confirma a branch atual e a presença das funções das Fases 4 e 5. A nova branch é `fase-6-7-metas-estatisticas`, criada a partir de `fase-4-5-execucao` (ou do `master`, se já integrada). Sem essas funções, é dúvida bloqueante.
- **Estados vazios (obrigatório, Fase 7):** `Statistics`, `Goals` e `Dashboard` tratam usuário sem dados (sem `NaN`, sem gráfico quebrado), com CTA para planejar ou iniciar estudo.
- **`GoalStatus` para `ACCURACY`:** `UPCOMING` (`referenceNow < startUtc`) → `INSUFFICIENT_DATA` (`< MIN_QUESTIONS`) → `ACHIEVED` → `MISSED` → `IN_PROGRESS`.
- **`POST /api/goals/copy` concorrente:** ambas as chamadas têm sucesso, sem duplicatas no banco (a soma de `copiedCount` das duas chamadas equivale a uma única cópia); `copiedCount === 0` retorna `200 OK` e `copiedCount > 0` retorna `201 Created`. O erro `409 GOAL_ALREADY_EXISTS` vale apenas para `POST /api/goals`.
- **Janela ampla (Dashboard e `GET /api/goals` sem `period`):** `[min(mês, semana, 30 dias), max(mês, semana, 30 dias))`, com teste em dia de virada de mês com a semana atravessando o mês.
- **Anti-N+1 (invariância de escala):** a contagem de queries SQL de `/api/dashboard` e `/api/statistics` deve ser **idêntica** com 10 e com 180 dias de dados, **comparando as duas execuções na mesma situação de estado** (sem sessão ativa, sem avaliação pendente e com o mesmo cenário de "próxima sessão"), além de respeitar um teto folgado de queries e de tempo. O teste de desempenho fica em arquivo próprio (`apps/api/tests/statistics-performance.test.ts`), limpando o usuário demo ao final.
- **Seed:** exporta `seedDemoData({ days, anchorDate })`; IDs gerados no script; ordem de inserção e limpeza respeitando as chaves estrangeiras; semente fixa; bloqueado em `production`.
- **`overview` e Visão de 30 Dias:** `overview` inclui `activeDaysCount` (dias com `effectiveSeconds > 0`) e `totalDaysInPeriod`; a aba "Visão de 30 Dias" usa `GET /api/statistics?range=30d`.
- **Lock e cache:** lock das metas com chave composta no código (`goals:${userId}`) e validado contra o banco real. Arquivar/desarquivar matéria ou assunto invalida `['goals']` e `['statistics']`.
- **Escopo e filtros:** `getTopicSubtreeIds` inclui descendentes arquivados; `agendaPlannedMinutes` filtra por `PlannedSession.topic_id` (subárvore); filtros de estatística aceitam itens arquivados; `PATCH` de meta valida o valor pela métrica.
- **Documentar no README:** aderência pode exceder 100%; meta `ACCURACY` atingida pode voltar a `IN_PROGRESS`; `date` omitido em `GET /api/goals` assume "hoje" no fuso do usuário.

---

### 🚫 5. FORA DO ESCOPO DESTA ENTREGA (RESERVADO PARA A FASE 8)
- Cálculo da "Nota do Assunto" (70% questões + 30% autoavaliação), classificação em Ponto Forte / Regular / Ponto Fraco e motor de alertas/recomendações do **Observatório Semanal** (exclusivos da Fase 8).

---

### ✅ 6. CRITÉRIOS DE ACEITE E EVIDÊNCIAS DE ENTREGA

Antes de concluir a branch, execute e comprove com a **saída real dos comandos** no relatório final:
- [ ] **Estados Vazios Amigáveis:** Usuário novo (sem dados) abre Dashboard, Metas e Estatísticas sem erros, sem `NaN` e com estados vazios amigáveis e CTAs funcionais.
- [ ] **Regras de `ACCURACY` e `MIN_QUESTIONS = 10`:** Meta `ACCURACY` em período futuro mostra `"Período futuro"` (`UPCOMING`); no período atual/passado com `< 10` questões mostra `"Dados insuficientes (X/10 questões)"` (`INSUFFICIENT_DATA`); com `>= 10` questões é avaliada corretamente em `ACHIEVED`, `IN_PROGRESS` ou `MISSED`.
- [ ] **Progresso Sempre Calculado e Coerência Dashboard ↔ Estatísticas ↔ Domínio:** Nenhuma coluna de progresso é gravada no banco; concluir sessão ou avaliar atualiza metas e estatísticas imediatamente via invalidação de cache; todos os números da UI batem com as funções puras do `@estudos/domain`.
- [ ] **Precisão de Fuso e Fronteiras (`domain` + `api`):** Sessão **iniciada** às `23:50` locais (`America/Rio_Branco`) contabiliza na meta e nas estatísticas do dia, semana e mês locais corretos; viradas de semana (`User.week_starts_on`) e de mês testadas com intervalos semiabertos `[startUtc, endUtc)`.
- [ ] **Semana que Atravessa o Mês (Dashboard):** Teste de integração com data de referência `2026-10-30` (semana de `2026-10-26` a `2026-11-01`) comprovando que uma sessão planejada em `2026-11-01` aparece no `weekSummary` e nas metas semanais, e que o resumo mensal de outubro não a inclui.
- [ ] **Teste de Exatidão Não-Circular (Fixture Calculada à Mão):** Teste de integração da API com uma fixture pequena onde os totais esperados (segundos efetivos, aderência, efetividade, `activeDaysCount`, questões por assunto e progresso das metas) são **constantes literais calculadas à mão no teste**, sem chamar o `domain` para gerar o gabarito.
- [ ] **Concorrência de Metas (`Promise.all` em PostgreSQL Real):**
  - Duas chamadas simultâneas de `POST /api/goals` (mesma meta) resultam em 1 criação (`201`) e 1 conflito (`409 GOAL_ALREADY_EXISTS`), sem duplicatas no banco;
  - Duas chamadas simultâneas de `POST /api/goals/copy` (mesmo período) têm sucesso (`201`/`200`), a soma de `copiedCount` equivale a uma única cópia e não há duplicatas no banco.
- [ ] **Seed de 6 Meses e Prova Anti-N+1 (`queries(10d) === queries(180d)`):** Script `npm run seed:sample-6m` rápido (com `createMany`, PRNG fixo e bloqueio em `production`) e teste isolado comprovando que `GET /api/dashboard` e `GET /api/statistics` executam exatamente a **mesma quantidade de queries SQL** com 10 e com 180 dias de histórico, nas mesmas condições de estado (prova de número constante de consultas, independente do volume), limpando o usuário demo ao final.
- [ ] **Não-Regressão e Build (Com Saída Real no Relatório):**
  - `npm run typecheck` (0 erros).
  - `npm test` (100% passando em todos os pacotes).
  - `npm run test:tz` (100% passando sob `Asia/Tokyo`).
- [ ] **`README.md` e Relatório Final:** Documentar em pt-BR os novos endpoints, o script `seed:sample-6m` (e credenciais demo), a fórmula de aderência (incluindo o efeito de sessões encerradas antes de todas as etapas e a possibilidade de exceder 100%), a diferença de `effectiveness` (`null` no período vazio vs `0` na sessão), o comportamento de metas `ACCURACY` e o checklist de validação manual da interface.

**Passo 1 agora:** Faça a inspeção do repositório, confirme todos os 8 itens obrigatórios da seção 1.2, liste apenas dúvidas estritamente bloqueantes (se houver) e apresente o plano de arquivos e tarefas (`writing-plans`). Não escreva código nem instale pacotes antes da minha aprovação.
