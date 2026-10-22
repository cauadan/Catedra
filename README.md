# Plataforma de Gestão e Análise de Estudos

Bem-vindo ao monorepo da **Plataforma de Gestão e Análise de Estudos**. Este repositório contém a infraestrutura base (Fase 1), o gerenciamento da Árvore de Matérias e Assuntos (Fase 2), o módulo de Agenda e Planejamento (Fase 3), a Execução do Estudo com Timer por Etapa e Avaliação Pós-Sessão (Fases 4 e 5 unificadas), o módulo de Metas de Estudo, Estatísticas, Visão de 30 Dias e Dashboard Analítico (Fases 6 e 7 unificadas) e a **Fase 8 (Finalização do MVP: Classificação de Assuntos 70/30, Observatório Semanal e Restauração Completa do Dashboard)**.

## Estrutura do Projeto

O projeto adota uma arquitetura de Monorepo com NPM Workspaces:
- `apps/api`: Backend em Node.js com Express e Prisma ORM (PostgreSQL).
- `apps/web`: Frontend em React 19 (Vite) com TanStack Query, Recharts e Tailwind CSS.
- `packages/domain`: Biblioteca compartilhada contendo contratos (Zod), tipos e funções puras de regras de negócio (calendário, planejamento, cálculo de blocos, timer, metas, estatísticas agregadas, limiares centralizados e motor do observatório semanal).

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
    - Precedência determinística de status de metas (`deriveGoalStatus`): `UPCOMING`, `INSUFFICIENT_DATA` (mínimo de 10 questões para acurácia), `ACHIEVED`, `MISSED` e `IN_PROGRESS`.
  - Motor Puro de Estatísticas (`statistics.ts`):
    - Fórmulas exatas de Aderência (`effectiveSeconds / executedPlannedSeconds * 100`) e Foco/Efetividade (`effectiveSeconds / totalSessionSeconds * 100`).
    - Carga Planejada na Agenda mantida como métrica independente.
- **Backend e API REST (`apps/api`)**:
  - `/api/goals`: CRUD completo e endpoint `/copy` idempotente de metas.
  - `/api/statistics`: agregação por dia, semana, mês e 30 dias com metadados explicáveis de fórmulas.
  - `/api/dashboard`: agregação analítica consolidada com cards e progresso.
- **Frontend (`apps/web`)**:
  - Páginas `/goals` e `/stats` com gráficos Recharts e tabelas detalhadas.

### Finalização do MVP: Classificação Diagnóstica, Observatório e Dashboard Completo (Fase 8)
- **Centralização de Limiares Determinísticos (`packages/domain/src/thresholds.ts`)**:
  - Constantes padronizadas exportadas como fonte única de verdade: `MIN_QUESTIONS = 10`, `SCORE_WEIGHT_ACCURACY = 0.7`, `SCORE_WEIGHT_UNDERSTANDING = 0.3`, `STRONG_THRESHOLD = 80`, `WEAK_THRESHOLD = 60`, `CLASSIFICATION_EPSILON = 1e-9`, `LOW_UNDERSTANDING_THRESHOLD = 50`, `MAX_TOPIC_RECOMMENDATIONS = 5`, `CLASSIFICATION_WINDOW_DAYS = 30`, `NEGLECT_DAYS = 7`, `MIN_DISTRACTION_ANALYSIS_SECONDS = 1800`, `ADHERENCE_ALERT_THRESHOLD = 70`, `PLANNING_GAP_ALERT_MINUTES = 60`, `EFFECTIVENESS_ALERT_THRESHOLD = 75`, `ACCURACY_DROP_ALERT_POINTS = 10` e `CONSISTENCY_ALERT_MIN_DAYS = 3`.
  - Todas as funções de cálculo suportam injeção de configuração através de `DEFAULT_STUDY_THRESHOLDS`.
- **Fórmula de Classificação 70/30 e Fallback 100% (`packages/domain/src/observatory.ts`)**:
  - Janela móvel de 30 dias locais terminando em `classificationEndLocalDate = min(periodEndLocalDate, todayLocalDate)`.
  - Helper único `getClassificationWindow` reutilizado por `/api/statistics`, `/api/dashboard` e `/api/observatory`, garantindo que um assunto tenha exatamente a mesma nota nas 3 telas.
  - Se `evaluationsCount > 0`: `finalScore = 0.7 * accuracyScore + 0.3 * understandingAvgScore` (`usedFallback = false`).
  - Se `evaluationsCount === 0`: `finalScore = accuracyScore` (`usedFallback = true`, pesos 100%/0%).
  - Truncamento em 1 casa decimal e classificação imune a imprecisões de ponto flutuante IEEE 754 via `adjustedScore = finalScore + CLASSIFICATION_EPSILON` (`displayScore = Math.floor(adjustedScore * 10) / 10`).
  - Sinal complementar `lowUnderstandingSignal` quando média de entendimento `< 50`.
- **Motor do Observatório Semanal (`calculateWeeklyObservatory`)**:
  - Comparativo semana selecionada vs. semana anterior em dias locais inteiros.
  - Em semanas parciais em andamento (`isPartialWeek = true`), compara os `elapsedDaysCount` primeiros dias da semana contra os mesmos dias da semana anterior.
  - Cômputo de minutos planejados até agora (`agendaPlannedElapsedMinutes`) e lacuna de planejamento (`planningGapMinutes`), onde sessões avulsas aumentam o tempo efetivo sem planejamento prévio e reduzem o gap.
  - Matérias negligenciadas (`neglectedSubjects`): matérias ativas sem estudo nos últimos 7 dias, com proteção para matérias recém-criadas há menos de 7 dias.
  - Alertas acionáveis determinísticos (`insightsAndRecommendations`) com severidades (`HIGH`, `MEDIUM`, `LOW`, `INFO`), limite de 5 recomendações por categoria e chips de `evidence` (`label: value (limite: threshold)`).
- **Backend e API REST (`apps/api`)**:
  - `GET /api/observatory?date=YYYY-MM-DD`: endpoint isolado por usuário, validado com Zod `.strict()`, rejeitando semanas futuras com `400 Bad Request` e carga em lote único sem N+1.
  - Enriquecimento de `/api/statistics` e `/api/dashboard` com objetos de classificação e contagens na janela unificada.
- **Frontend (`apps/web`)**:
  - Restauração completa do `Dashboard.tsx`: renderiza sempre o painel completo, card "O que estudar agora?", indicadores, metas, progresso e a grade de **6 Módulos da Plataforma** com badge padronizado **"Disponível"**.
  - Atualização do `Statistics.tsx`: consome `thresholds.ts`, exibe cabeçalho `"Classificação (30 dias até DD/MM)"` e tooltips dinâmicos a partir de `classification.weightsUsed`.
  - Nova página `Observatory.tsx` conectada nas rotas `/observatory` e `/observatorio`, removendo todos os placeholders da aplicação:
    1. Seletor de semana com navegação temporal e banner informativo de semana parcial;
    2. Estado vazio amigável quando `hasAnyData === false` com CTAs `"Planejar na Agenda"` e `"Iniciar Estudo Agora"`;
    3. Comparativo de métricas com deltas em relação à semana anterior;
    4. Análise de foco, pausas e distrações (tempo real e declarada);
    5. Classificação de assuntos em 30 dias (Pontos Fracos, Regulares, Fortes e Insuficientes);
    6. Revisões e Práticas Recomendadas com botões `"Agendar Revisão"` e `"Agendar Prática"`;
    7. Matérias negligenciadas e alertas com chips de evidência.
  - Invalidação reativa de cache de `['observatory']` em mutações de Timer, Agenda, Metas, Dashboard e Matérias/Assuntos.

### Roteiro de Validação Manual no Navegador (Fase 8)
1. Suba o banco (`docker compose up -d`), rode `npm run seed:sample-6m` e inicie a aplicação (`npm run dev`).
2. Faça login com `demo@estudos.local` / `Demo@123456`.
3. Acesse `/dashboard` e confira:
   - Card "O que estudar agora?";
   - Comparativo de hoje e metas ativas;
   - Progresso por matéria com badges de classificação (Ponto forte, Regular, Ponto fraco);
   - Seção **Módulos da Plataforma** com todos os 6 cards ativos com o badge **"Disponível"**.
4. Acesse `/observatory` pelo menu lateral ou card do Dashboard e confira:
   - O seletor de semana (Semana Anterior, Semana Atual, Avançar Semana desabilitado na semana atual);
   - O banner de comparação de dias da semana parcial em andamento;
   - As 5 seções analíticas completas (Comparativo, Foco e Distrações, Classificação 30d, Revisões e Práticas Recomendadas, Matérias Negligenciadas e Alertas com chips de evidência);
   - Os botões acionáveis `"Agendar Revisão"` e `"Agendar Prática"` redirecionando para a `/agenda`.
5. Acesse `/stats` e confira que a coluna `"Classificação (30 dias até DD/MM)"` exibe as mesmas notas e classificações do Observatório e Dashboard.

## O Que Ficou de Fora (Fora do Escopo do MVP)

Conforme a Seção 10 do documento de requisitos do produto (`01-contexto-do-projeto.md`), os seguintes itens estão explicitamente fora do escopo do MVP e não devem ser implementados:
- Testes formais de retenção de memória;
- Algoritmos automáticos de repetição espaçada (SRS complexo no estilo Anki/SuperMemo);
- Indicador global e simplista de "saúde dos estudos";
- Detecção e agrupamento estatístico de padrões de erro recorrentes;
- Notificações externas (e-mails, push notifications ou webhooks);
- Integrações ou recursos baseados em IA generativa (todas as regras e diagnósticos do sistema são 100% determinísticos e explicáveis).
