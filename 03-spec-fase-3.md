Leia o arquivo `01-contexto-do-projeto.md` anexo. Ele prevalece sobre qualquer suposição.
Implemente SOMENTE a **Fase 3 — Agenda e Planejamento**.

### ⚙️ 1. CONTROLE DE WORKFLOW, SKILLS E IDIOMA (OBRIGATÓRIO)
1. **Idioma:** Toda a interface, mensagens de erro da API/Zod, comentários de código, commits, testes, README e o relatório final devem estar estritamente em **Português (pt-BR)**. Não derive para o inglês.
2. **Skills Superpowers (Economia de Tokens):**
   - **NÃO** use `subagent-driven-development` e **NÃO** abra ciclo de `brainstorming` socrático (todas as especificações já estão fechadas abaixo).
   - Primeiro, inspecione o repositório atual para reaproveitar a estrutura das Fases 1 e 2 (`schema.prisma`, utilitários de erro, middleware de auth, componente de árvore de assuntos, tokens visuais e layout). Verifique no `schema.prisma` os nomes exatos dos enums, a nulabilidade de `topic_id`, `notes`, etc., e as constraints de unicidade/chaves estrangeiras em `PlannedSession` e `PlannedBlock`.
   - Apresente um plano enxuto (`writing-plans`) e aguarde minha aprovação.
   - Após aprovação, execute inline usando: `executing-plans` → `test-driven-development` → `verification-before-completion` → `finishing-a-development-branch` (**ATENÇÃO:** na skill `finishing-a-development-branch`, apenas verifique os testes e apresente as opções; **NÃO faça merge nem push** sem minha autorização explícita).
3. **Integridade do Schema e Dependências:**
   - Use exatamente os nomes de campos e enums já definidos no `schema.prisma` (Fase 1). Não altere o schema sem antes avisar e justificar.
   - Verifique a versão instalada de `date-fns` e instale uma versão compatível de `date-fns-tz` (v3.x com `fromZonedTime` e `toZonedTime`). Embora `date-fns-tz` conste na seção 3 do `01-contexto-do-projeto.md`, registre e justifique sua adição no relatório final (bem como qualquer outra biblioteca caso seja estritamente necessária).

---

### 🧠 2. PACOTE `packages/domain` (Funções Puras + TDD com Vitest)

**Regra de ouro de Fuso Horário:** Nenhuma função (nem no `domain`, nem na `api`, nem no `web`) pode depender do fuso horário do processo/servidor ou do navegador (proibido usar `new Date('YYYY-MM-DD')` ou `startOfWeek` baseados no fuso local da máquina). Todo cálculo deve ser 100% determinado pelo parâmetro `timezone: string` ou por aritmética pura de calendário.

1. **Aritmética de Calendário, Conversão de Fuso e Janelas (`date-fns-tz`):**
   - `isValidLocalDate(dateStr: string): boolean` e `isValidLocalDateTime(dateTimeStr: string): boolean`: valida formato estrito (`YYYY-MM-DD` e `YYYY-MM-DDTHH:mm`) **e** existência real no calendário (rejeitar `2026-02-30`, `2026-04-31`, etc.).
   - `addDaysToLocalDate(localDate: string, days: number): string`: soma ou subtrai `days` (ex.: `±1`, `±7`) de uma data `YYYY-MM-DD` usando cálculo puro de calendário (ex.: `Date.UTC`), totalmente independente de fuso horário, para uso na navegação `Anterior` / `Próximo` e construção de semanas.
   - `localDateTimeToUtc(localIsoWithoutTz: string, timezone: string): Date`: converte `YYYY-MM-DDTHH:mm` para `Date` (UTC) via `fromZonedTime`. Documente e teste o comportamento determinístico do `fromZonedTime` em horários inexistentes (primavera/início do DST) e ambíguos (outono/fim do DST). A API aceita o resultado determinístico produzido por esta função.
   - `utcToLocalDate(utcDate: Date, timezone: string): string`: converte um instante UTC para `YYYY-MM-DD` no `timezone` do usuário (usado para posicionar sessões nos dias e descobrir o "Hoje" com `utcToLocalDate(new Date(), user.timezone)`).
   - `utcToLocalTime(utcDate: Date, timezone: string): string`: converte um instante UTC para `HH:mm` no `timezone` do usuário.
   - `getDayWindowUtc(localDate: string, timezone: string): { startUtc: Date; endUtc: Date }`: retorna o intervalo **semiaberto** `[startUtc, endUtc)`, onde `startUtc` é `00:00:00.000` de `localDate` no fuso informado e `endUtc` é `00:00:00.000` de `addDaysToLocalDate(localDate, 1)` no mesmo fuso.
   - `getWeekWindowUtc(localDate: string, timezone: string, weekStartsOn?: 1): { startUtc: Date; endUtc: Date; days: string[] }`: retorna o intervalo semiaberto `[startUtc, endUtc)` da semana local iniciando na segunda-feira (`00:00` de segunda até `00:00` da segunda seguinte) e o array `days` com as 7 strings `YYYY-MM-DD` de segunda a domingo.
   - **Testes obrigatórios de Calendário, Fuso e DST no `domain`:**
     - `addDaysToLocalDate`: virada de mês (`2026-01-31` + 1 → `2026-02-01`), virada de ano (`2026-12-31` + 1 → `2027-01-01`, `2026-01-01` - 1 → `2025-12-31`), ano bissexto (`2028-02-28` + 1 → `2028-02-29` e `2026-02-28` + 1 → `2026-03-01`) e salto de `±7` dias.
     - `America/Rio_Branco` (UTC-5): sessão às `23:30` locais (`04:30Z` do dia seguinte) cai dentro da janela do dia local correto, fora do dia seguinte, e `utcToLocalDate` retorna o dia local correto.
     - Virada de semana: domingo `23:59` local vs. segunda `00:00` local.
     - Datas concretas de Horário de Verão (DST) em `America/New_York`:
       - Dia `2026-03-08` (início do DST): `endUtc - startUtc` tem exatamente **23 horas**; Semana de `2026-03-02` tem **167 horas**.
       - Dia `2026-11-01` (fim do DST): `endUtc - startUtc` tem exatamente **25 horas**; Semana de `2026-10-26` tem **169 horas**.
       - Contiguidade: o `endUtc` de cada dia da semana é estritamente igual ao `startUtc` do dia seguinte, e a união exata dos 7 dias coincide com `[week.startUtc, week.endUtc)`.
       - Horário inexistente (`2026-03-08T02:30`) e ambíguo (`2026-11-01T01:30`) em `America/New_York`.

2. **Validação e Presets de Etapas (`PlannedBlock`):**
   - Limites de `planned_minutes` da sessão: inteiro entre **5 e 480 minutos**.
   - Regras de `validatePlannedBlocks(plannedMinutes, blocks)`:
     - Deve haver ao menos 1 bloco válido.
     - Cada `kind` (`REVIEW`, `NEW_CONTENT`, `PRACTICE`) aparece **no máximo uma vez**.
     - Blocos com `0` minutos não são persistidos (filtrar/rejeitar, aceitando apenas inteiros `>= 1`).
     - A soma dos `planned_minutes` dos blocos deve ser **estritamente igual** ao `planned_minutes` da sessão.
     - Ordenação canônica obrigatória de `position` sequencial a partir de `1` na ordem fixa: `REVIEW` → `NEW_CONTENT` → `PRACTICE`.
   - `calculateBlockPreset(plannedMinutes: number, preset: 'BALANCED' | 'PRACTICE_FOCUS' | 'NEW_ONLY')`:
     - Minutos inteiros:
       - `BALANCED` (25% / 50% / 25%): `review = Math.round(total * 0.25)`, `practice = Math.round(total * 0.25)`, `newContent = total - review - practice`.
       - `PRACTICE_FOCUS` (20% / 80%): `review = Math.round(total * 0.20)`, `practice = total - review` (sem `NEW_CONTENT`).
       - `NEW_ONLY` (100%): `NEW_CONTENT = total`.
     - Omitir qualquer bloco cujo valor calculado seja `0` e atribuir `position` sequencial (`1, 2...`).

3. **Resumo do Período e Sobreposição de Horários:**
   - `summarizePlannedSessions(sessions)` retorna:
     - `totalPlannedMinutes`: soma de `planned_minutes` considerando **apenas** sessões com status `PLANNED` e `DONE` (`SKIPPED` e `RESCHEDULED` ficam de fora).
     - `plannedCount`: quantidade de sessões `PLANNED`.
     - `doneCount`: quantidade de sessões `DONE`.
     - `activeAndDoneCount`: `plannedCount + doneCount`.
     - `minutesByKind`: `{ REVIEW, NEW_CONTENT, PRACTICE }` somando os blocos apenas das sessões `PLANNED` e `DONE`.
   - `findOverlappingSessionIds(sessions)`:
     - Avalia apenas sessões com `status === 'PLANNED'` presentes na lista carregada, onde cada sessão ocupa `[scheduled_start, scheduled_start + planned_minutes)`.
     - Retorna `Set<string>` com os IDs que se sobrepõem.
     - **Regras:** Sessões adjacentes (fim de A === início de B) **NÃO** conflitam (incluir teste unitário). Cada sessão pertence ao dia local do seu `scheduled_start` (`utcToLocalDate`), mesmo se cruzar a meia-noite *(limitação aceita: na visão diária, uma sessão que cruza a meia-noite só é comparada com as sessões carregadas naquela janela; documente isso no relatório)*.

---

### 🔌 3. BACKEND `apps/api` (Express + Prisma + Zod)

1. **Segurança, Isolamento e Validação Estrita (`.strict()` + Enums):**
   - Todas as rotas exigem sessão ativa (`401` sem sessão) e filtram por `user_id`.
   - Recursos de outro usuário ou inexistentes (`PlannedSession`, `Subject`, `Topic`) retornam **`404 Not Found`** (nunca `403`).
   - Todos os schemas Zod de `body` e `query` devem usar **`.strict()`**, validar `priority`, `activity_type` e `kind` com os enums do Prisma (`z.nativeEnum(...)`), e validar datas reais com `isValidLocalDate` / `isValidLocalDateTime` (retornando `400` para datas como `2026-02-30` ou campos não permitidos como `user_id`, `status`, `rescheduled_from_id`).

2. **Validação de Matéria/Assunto, Par Resultante e Arquivados:**
   - Se `topic_id` estiver presente (ou for obrigatório no schema), exija sempre que **`topic.subject_id === subject_id`** (retornando `400` se pertencer a outra matéria).
   - **No `POST /api/planned-sessions`:** `Subject` e `Topic` devem existir para o `user_id` (`404` se não existirem ou forem de outro usuário) e estar ativos (`archived === false`, retornando `400` se arquivados).
   - **No `PATCH /api/planned-sessions/:id`:**
     - Se um novo `subject_id` ou `topic_id` enviado não existir ou pertencer a outro usuário, retornar `404`.
     - Se apenas `subject_id` ou apenas `topic_id` for enviado no payload parcial, valide a relação `effectiveTopic.subject_id === effectiveSubjectId` combinando o campo enviado com o valor já armazenado na sessão (`400` se incompatíveis).
     - Valide `archived === false` apenas para o `subject_id` e/ou `topic_id` que estiverem sendo **alterados** em relação ao que já estava salvo na sessão (permitindo editar notas/duração/blocos/prioridade/tipo de uma sessão cujo item foi arquivado *após* o agendamento).
   - **No `POST /api/planned-sessions/:id/reschedule`:** **Recusar (`400 Bad Request`)** a remarcação caso o `Subject` ou `Topic` da sessão esteja arquivado (`archived === true`), com mensagem orientando a desarquivar antes de remarcar.

3. **Máquina de Estados e Proteção Contra Condição de Corrida (Concorrência):**
   - Criação inicia em `PLANNED`. `DONE` não pode ser definido manualmente na Fase 3. `DONE`, `SKIPPED` e `RESCHEDULED` são finais para edição/remarcação/mudança de status.
   - **Ordem determinística de validação nas mutações (`PATCH`, `status`, `reschedule`, `DELETE`):**
     1. Validar schema Zod do payload (`400` se inválido).
     2. Buscar a sessão por `{ id, user_id }` (`404` se a sessão não existir ou for de outro usuário).
     3. Verificar se o `status` atual da sessão permite a operação (`409 Conflict` se o status for inválido para aquela rota).
     4. Verificar referências e regras de domínio: no `PATCH`, se um `subject_id` ou `topic_id` novo não existir para o usuário retorna `404`; se estiver arquivado ou com relação `topic.subject_id !== subject_id` (no `PATCH` ou `reschedule`), retorna `400 Bad Request`.
     5. Executar dentro de `$transaction` usando mutação condicional atômica (`updateMany` ou `deleteMany`) filtrando pelo `status` esperado e verificando `result.count === 1` (se `count === 0` por corrida concorrente, abortar transação e retornar **`409 Conflict`**).
   - **Testes obrigatórios de concorrência (`Promise.all`):**
     - Duas chamadas simultâneas de `reschedule` (e de `status`) sobre a mesma sessão `PLANNED` devem resultar deterministicamente em **exatamente um sucesso (`200`/`201`) e um `409 Conflict`** (criando apenas uma sessão filha no `reschedule`).
     - Duas chamadas simultâneas de `DELETE` sobre a mesma sessão devem resultar em **exatamente um sucesso (`200`/`204`) e a outra chamada retornando `404` ou `409`** (pois a requisição perdedora pode ler o banco após o commit da primeira e receber `404`, ou passar pela leitura inicial antes do commit e falhar no `deleteMany` com `409`; ambos são corretos).

4. **Contrato Exato dos Endpoints:**
   - `GET /api/planned-sessions?view=day|week&date=YYYY-MM-DD`:
     - Valida `view` (`'day' | 'week'`) e `date` real. Usa `User.timezone` e funções do `domain` para buscar `scheduled_start: { gte: startUtc, lt: endUtc }`.
     - Retorna todas as sessões do período (inclusive se `Subject`/`Topic` foram arquivados depois, enviando a flag `archived`), `local_date` e `local_time` calculados no `User.timezone`, `timezone: user.timezone`, `blocks` ordenados por `position ASC`, `overlapping_ids` e `summary` (`summarizePlannedSessions`).
   - `POST /api/planned-sessions`:
     - Body `.strict()` exigindo: `subject_id`, `topic_id` (conforme schema), `scheduled_start_local` (`YYYY-MM-DDTHH:mm`), `planned_minutes` (5..480), `priority` (enum), `activity_type` (enum), `notes` (opcional) e `blocks` (**obrigatório**, ao menos 1 bloco, validado por `validatePlannedBlocks`).
     - Converte `scheduled_start_local` para UTC com `User.timezone` e cria sessão + blocos em `$transaction`.
   - `PATCH /api/planned-sessions/:id`:
     - Apenas quando `status === 'PLANNED'` (`409` caso contrário).
     - Body `.strict()` permitindo atualizar parcialmente: `subject_id`, `topic_id`, `priority`, `activity_type`, `notes`, `planned_minutes` e `blocks`.
     - **Regra de par `planned_minutes` + `blocks`:** No `PATCH`, `planned_minutes` e `blocks` devem ser enviados **ambos juntos ou nenhum dos dois** (enviar apenas um retorna `400`). Quando enviados, substituem integralmente os blocos anteriores na `$transaction` executando **`deleteMany` antes de `createMany`** (evitando colisão de constraint de unicidade), junto com `updateMany({ where: { id, user_id, status: 'PLANNED' }, ... })` checando `count === 1`.
     - **Proibição de `scheduled_start`:** Se `scheduled_start` ou `scheduled_start_local` for enviado no `PATCH`, rejeitar com **`400 Bad Request`** e mensagem clara em português orientando a usar a rota de remarcação (`/reschedule`).
   - `PATCH /api/planned-sessions/:id/status`:
     - Body `.strict()` aceitando **unicamente** `{ status: z.literal('SKIPPED') }` (qualquer outro valor, inclusive `'DONE'`, retorna **`400`**).
     - Se a sessão não estiver em `PLANNED`, retorna **`409 Conflict`**. Atualiza com `updateMany({ where: { id, user_id, status: 'PLANNED' }, data: { status: 'SKIPPED' } })` checando `count === 1`.
   - `POST /api/planned-sessions/:id/reschedule`:
     - Ordem de checagem: `400` (payload inválido) → `404` (não existe para o usuário) → `409` (`status !== 'PLANNED'`) → `400` (`Subject` ou `Topic` arquivado).
     - Body `.strict()`: exige `scheduled_start_local` (é permitido remarcar até para o mesmo horário se o usuário desejar). `planned_minutes` e `blocks` devem vir **ambos juntos ou nenhum dos dois** (`400` se vier só um); se omitidos, copia `planned_minutes` e `blocks` da original. Copia `subject_id`, `topic_id`, `priority`, `activity_type` e `notes` da original.
     - Na `$transaction`: executa `updateMany({ where: { id, user_id, status: 'PLANNED' }, data: { status: 'RESCHEDULED' } })` (se `count !== 1` → aborta com `409`) e cria a nova `PlannedSession` (`status: 'PLANNED'`, `rescheduled_from_id: original.id`) + seus `PlannedBlock`s.
   - `DELETE /api/planned-sessions/:id`:
     - Retorna `404` se não existir para o `user_id`.
     - Retorna **`409 Conflict`** se: (1) `status` atual não for `PLANNED` nem `SKIPPED` (ou seja, `RESCHEDULED` ou `DONE` retornam `409`); (2) possuir qualquer `StudySession` vinculada; ou (3) outra `PlannedSession` apontar para ela via `rescheduled_from_id`.
     - **Proteção contra corrida na exclusão:** Dentro da `$transaction`, verifique novamente os dependentes, apague os `PlannedBlock`s e execute `deleteMany({ where: { id, user_id, status: { in: ['PLANNED', 'SKIPPED'] } } })`. Se `count !== 1`, aborte e retorne **`409 Conflict`**. No código de produção, capture também erros de chave estrangeira do Prisma (`P2003`) e converta para **`409 Conflict`** *(se não for possível provocar `P2003` de forma determinística em teste de integração sem mock frágil, não crie teste artificial; apenas registre no relatório final que o fallback `P2003` foi implementado por defesa em profundidade e que os casos de `StudySession` e sessão filha foram testados pela checagem transacional)*.

---

### 🖥️ 4. FRONTEND `apps/web` (Fuso do Usuário e UX Coerente)

1. **Uso Estrito de `User.timezone` e Navegação Pura:**
   - **Nunca** use o fuso do navegador para agrupar sessões, formatar horas ou calcular datas.
   - Descubra o "Hoje" com `utcToLocalDate(new Date(), user.timezone)`.
   - Nos botões `Anterior` e `Próximo`, use exclusivamente `addDaysToLocalDate(currentDate, ±1)` (visão Dia) e `addDaysToLocalDate(currentDate, ±7)` (visão Semana).
   - Agrupe as sessões nas colunas usando `utcToLocalDate(session.scheduled_start, user.timezone)` e exiba o horário com `utcToLocalTime`.
2. **Cabeçalho e Cards de Resumo:**
   - Alternador `Dia` | `Semana` (Seg–Dom), controles `Anterior`, `Hoje`, `Próximo` e badge com o `User.timezone`.
   - Cards de resumo via `summarizePlannedSessions`: *Carga Planejada* (`totalPlannedMinutes`), *Sessões* (`plannedCount` planejadas e `doneCount` concluídas) e *Distribuição por Etapa* (`REVIEW`, `NEW_CONTENT`, `PRACTICE`).
3. **Grade Semanal / Diária e Cards:**
   - Estados completos: *Carregando*, *Vazio* (com CTA) e *Erro* (com retry). Layout responsivo em telas estreitas.
   - **Card (`PlannedSessionCard`):** Cor da matéria, horário local, duração, Matéria, Assunto, Prioridade, Tipo de Atividade e Status. Badges para `(Arquivado)`, `"Remarcada"` (`rescheduled_from_id`) e `"Conflito de horário"` (`overlapping_ids`). Pílulas de etapas (`Rev Xm • Novo Ym • Prát Zm`). Ações rápidas quando `PLANNED`: *Editar*, *Remarcar*, *Pular (`SKIPPED`)* e *Excluir*.
4. **Modal de Planejamento e Construtor de Etapas:**
   - Seletores de Matéria e Assunto em árvore listando **apenas itens ativos** (`!archived`), filtrados pela matéria selecionada.
   - Input livre de duração (5 a 480 min) + atalhos (`30m`, `45m`, `60m`, `90m`, `120m`).
   - Presets de 1 clique (`Equilibrado`, `Foco em Prática`, `Só Conteúdo Novo`) via `calculateBlockPreset`.
   - Barra de validação das etapas: **Amarela** (faltam minutos), **Verde** (soma exata), **Vermelha** (excedeu minutos), bloqueando o botão de salvar enquanto não estiver verde.

---

### 🚫 5. FORA DO ESCOPO DESTA FASE
- Execução do timer, criação de `StudySession` ou `SessionEvent` pela interface, sugestão automática de revisão, avaliação pós-sessão, registro de questões, metas, estatísticas e Observatório.

---

### ✅ 6. CRITÉRIOS DE ACEITE E ENTREGA FINAL

Antes de encerrar, execute e comprove com o output real no relatório:
- [ ] **Isolamento e Segurança:** Usuário A não lê nem altera dados do Usuário B (`404`); sem sessão retorna `401`; `.strict()` rejeita campos extras e `scheduled_start_local` no `PATCH` com `400`.
- [ ] **Regras de Domínio e Arquivamento:** `topic.subject_id !== subject_id` (inclusive quando enviado parcialmente no `PATCH`) retorna `400`; criar ou remarcar com item arquivado retorna `400`; editar notas/blocos de sessão cujo item foi arquivado depois funciona.
- [ ] **Máquina de Estados e Concorrência:** Ordem determinística de erros (`400` → `404` da sessão → `409` de status → `404`/`400` de domínio); chamadas concorrentes duplas (`Promise.all`) em `reschedule` e `status` retornam exatamente um sucesso e um `409`, e no `DELETE` retornam exatamente um sucesso e um `404` ou `409`; exclusão de sessão `RESCHEDULED`, `DONE`, referenciada por filha ou com `StudySession` retorna `409`, enquanto `PLANNED` e `SKIPPED` sem dependentes são excluídas com sucesso.
- [ ] **Fuso Horário, DST e Independência do SO (Compatível com Windows/PowerShell):**
  - Configure um script `test:tz` compatível com Windows (ex.: via `node -e "process.env.TZ='Asia/Tokyo'; process.env.TZ_TEST='1'; ..."` ou `globalSetup` do Vitest + `--pool=forks`, já que `setupFiles` em pool de `threads` pode não alterar o fuso do worker no Windows).
  - Inclua um teste de sanidade **condicional** (`if (process.env.TZ_TEST === '1') { expect(new Date().getTimezoneOffset()).toBe(-540); }`) que garanta que o `npm test` padrão passe no fuso normal da máquina e que o `npm run test:tz` comprove que os testes rodaram de fato sob `Asia/Tokyo` (UTC+9).
- [ ] **Não-Regressão e Tipagem:** Todos os testes das Fases 1, 2 e 3 passando tanto em `npm test` quanto em `npm run test:tz` na raiz, e `tsc --noEmit` sem erros em `domain`, `api` e `web`.
- [ ] **Verificação da Interface e Documentação:** Fluxo validado na UI sem erros no console e `README.md` atualizado em português.
- [ ] **Relatório Final:** Entregar resumo do que foi feito, arquivos criados/alterados, justificativa de dependências (`date-fns-tz`), comandos e saída real dos testes (`npm test` e `npm run test:tz`), limitações/decisões documentadas (sessão `RESCHEDULED` quando filha é excluída; sobreposição de sessão que cruza meia-noite na visão diária; comportamento de `fromZonedTime` em DST; caminho `P2003`) e o que ficou de fora.

**Passo 1 agora:** Inspecione o repositório, liste apenas dúvidas reais (se houver divergência com o `schema.prisma` atual) e apresente o plano de arquivos e tarefas para minha aprovação.