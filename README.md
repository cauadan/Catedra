# Plataforma de Gestão e Análise de Estudos

Bem-vindo ao monorepo da **Plataforma de Gestão e Análise de Estudos**. Este repositório contém a infraestrutura base (Fase 1), o gerenciamento da Árvore de Matérias e Assuntos (Fase 2) e o módulo completo de Agenda e Planejamento (Fase 3).

## Estrutura do Projeto

O projeto adota uma arquitetura de Monorepo com NPM Workspaces:
- `apps/api`: Backend em Node.js com Express e Prisma ORM (PostgreSQL).
- `apps/web`: Frontend em React 19 (Vite) com TanStack Query e Tailwind CSS.
- `packages/domain`: Biblioteca compartilhada contendo contratos (Zod), tipos e funções puras de regras de negócio (calendário, planejamento, cálculo de blocos e métricas agregadas).

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
6. Inicie a aplicação (Backend e Frontend simultaneamente):
   ```bash
   npm run dev
   ```
7. Acesse a interface web em `http://localhost:5173`.

## Como Testar

Os testes automatizados foram criados utilizando **Vitest** e utilizam o banco de dados real (não mockado) na API para garantir a integridade das operações e regras de negócio.

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
- CRUD completo de matérias (Subjects) e assuntos (Topics).
- Regra de negócio implementada no backend (`packages/domain`) validando e impedindo criação de ciclos na árvore de assuntos.
- Arquivamento em cascata (se você arquiva uma matéria, todos os assuntos são arquivados).
- Proteção de exclusão caso haja sessões futuras vinculadas.
- Interface do usuário (`Subjects.tsx`) em formato de árvore recursiva (profundidade livre) permitindo gerenciar tudo visualmente.

### Agenda e Planejamento (Fase 3)
- **Domínio Puro (`packages/domain`)**:
  - Utilitários de calendário e fuso horário (`calendar.ts`) com validação de formato ISO YYYY-MM-DD e HH:mm, cálculo de janelas temporais diárias e semanais em UTC e conversão determinística fuso local ↔ UTC.
  - Resolução robusta de transições de Horário de Verão (DST) implementada via `Intl.DateTimeFormat` seguindo a especificação Temporal `'compatible'` (horários inexistentes no avanço de primavera avançam para o fuso pós-transição; horários ambíguos no retorno de outono selecionam o primeiro instante/offset).
  - Validações Zod estritas (`planning.ts`) para criação, atualização, remarcação e filtragem de sessões planejadas, com garantia de consistência de blocos de estudo (`NEW_CONTENT`, `EXERCISES`, `THEORY`, `PRACTICE`, `REVIEW`, `OTHER`), cuja soma deve corresponder rigorosamente à duração total planejada.
  - Funções de cálculo de presets de blocos (Equilibrado, Foco em Prática, Conteúdo Novo) e agregadores de sumário e detecção de sobreposição/conflito em tempo de execução (`summary.ts`).
- **Backend e API REST (`apps/api`)**:
  - Endpoints sob `/api/planned-sessions`:
    - `POST /`: Criação com validação de existência e status ativo da matéria/assunto vinculado, bloqueio de conflitos quando aplicável e persistência atômica.
    - `GET /`: Listagem com filtros por intervalo de datas (`start_date`, `end_date`), assunto (`topic_id`) e status, retornando dados ordenados, sumário agregado e IDs de sessões conflitantes.
    - `PATCH /:id`: Edição parcial com checagem de propriedade (`user_id`) e integridade.
    - `POST /:id/reschedule`: Remarcação transacional (cria uma nova sessão com `rescheduled_from_id` apontando para a anterior e marca a sessão original como `RESCHEDULED`).
    - `PATCH /:id/status`: Transição de status (`PLANNED`, `DONE`, `SKIPPED`, `RESCHEDULED`).
    - `DELETE /:id`: Exclusão atômica de sessão pertencente ao usuário.
  - Concorrência e Isolamento: Testes de corrida (`Promise.all`) validando tratamento determinístico de conflitos simultâneos (retornando 409 Conflict em violações de chave estrangeira concorrentes ou 404 em idempotência).
- **Frontend (`apps/web`)**:
  - Página `/agenda` completa integrada ao TanStack Query, com alternância instantânea entre visão Diária e Semanal e controles de navegação no tempo.
  - Cards de sumário dinâmicos destacando carga total planejada, total de sessões e distribuição por etapa de estudo.
  - Cards de sessão ricos (`PlannedSessionCard`) com visualização de matéria, assunto, pílulas de blocos de estudo, badges de prioridade, avisos de sobreposição, botão "Iniciar Estudo" e menu de ações rápidas.
  - Modal de planejamento (`PlannedSessionModal`) com atalhos de duração, preenchimento inteligente de presets de estudo, e barra de validação dinâmica colorida (Amarela, Verde e Vermelha) impedindo o envio de dados inconsistentes.

### Execução do Estudo, Timer por Etapa e Avaliação Pós-Sessão (Fases 4 e 5 Unificadas)
- **Domínio Puro (`packages/domain`)**:
  - Máquina de estados determinística do timer por etapa (`timer.ts`): estados `NOT_STARTED`, `STUDYING`, `PAUSED`, `DISTRACTED` e `FINISHED`, transições válidas e tratamento de desempate temporal determinístico.
  - Fórmulas de tempo líquido e efetivo calculadas estritamente em segundos inteiros: cômputo de pausas, distrações em tempo real e compensação por distração não cronometrada (`DISTRACTION_DECLARED`).
  - Detecção visual de etapa incompleta (`isBlockIncomplete`) com base no limite configurável `MAX_EVENT_GAP_MINUTES = 120` ou o dobro da duração planejada da etapa.
  - Métricas agregadas da sessão (`calculateSessionMetrics`): tempo efetivo total, tempo total de relógio, efetividade/foco (0 a 100%) e aderência ao planejamento (0 a 100%).
  - Avaliação de exercícios e acurácia (`practice.ts`): função `calculateAccuracy`, agregador `calculateAggregateAccuracy` e normalização de notas qualitativas de entendimento (`normalizeUnderstandingScore`).
  - Esquemas de validação Zod estritos (`study-session.ts`) com rejeição de propriedades não permitidas (`.strict()`).
- **Backend e API REST (`apps/api`)**:
  - Endpoints sob `/api/study-sessions`:
    - `POST /`: Início de sessão em dois modos (Modo 1: a partir de uma sessão planejada via `planned_session_id`; Modo 2: avulsa informando `topic_id` e roteiro de etapas). Protegido com trava de concorrência (`pg_advisory_xact_lock`) e validação estrita (máximo de 1 sessão ativa e bloqueio caso haja avaliação pendente).
    - `GET /active`: Retorna a sessão em andamento com carimbo do servidor (`server_now`) para sincronização do cronômetro no cliente sem drift.
    - `GET /pending-evaluation`: Retorna a sessão concluída que necessita de avaliação antes de permitir novos estudos.
    - `POST /:id/events`: Registro de eventos manuais de transição (`PAUSE`, `RESUME`, `DISTRACTION_START`, `DISTRACTION_END`) com bloqueio pessimista transacional (`SELECT ... FOR UPDATE`).
    - `POST /:id/blocks/:blockId/finish`: Finalização de bloco com avanço determinístico para a próxima etapa e compensação opcional de distração declarada (validada estritamente contra o tempo líquido disponível, respondendo 422 Unprocessable Entity em caso de excesso).
    - `POST /:id/finish`: Conclusão da sessão, consolidação e persistência das métricas no banco de dados.
    - `POST /:id/cancel`: Cancelamento da sessão sem cômputo de métricas nem poluição do histórico.
    - `POST /:id/evaluation`: Avaliação pós-sessão (compreensão, foco, dificuldade, anotações de até 1000 caracteres) e persistência de registros de prática (`PracticeRecord`) associados ao bloco de prática correspondente.
  - Concorrência em PostgreSQL real: Testes com `Promise.all` cobrindo criação simultânea de sessões, eventos concorrentes em condição de corrida e submissão duplicada de avaliação.
- **Frontend (`apps/web`)**:
  - Página `/timer` com relógio sincronizado em tempo real (`useStudyClock`), cards de tempo, barra de progresso, alertas visuais para intervalos longos sem registro e controles de estudo.
  - Diálogo de avanço de etapa e conclusão (`FinishStepDialog`) com input opcional de distração declarada e exibição em linha de erros de validação (HTTP 422).
  - Banner de avaliação pendente (`PendingEvaluationBanner`) bloqueando a criação de novos estudos até a conclusão da avaliação da sessão anterior.
  - Formulário de estudo avulso (`AdHocSessionForm`) com seletor de matérias e assuntos ativos, atalhos de tempo e presets automáticos (`BALANCED`, `PRACTICE_FOCUS`, `NEW_ONLY`).
  - Modal de avaliação pós-sessão (`SessionEvaluationModal`) com chips de autoavaliação, múltiplas linhas de exercícios por assunto, cálculo em tempo real de aproveitamento percentual e tela de resumo consolidado com navegação para a Agenda.
  - Integração na `/agenda`: Botão "Iniciar Estudo" em cards planejados e diálogo informativo em caso de conflito (HTTP 409) com atalho de redirecionamento para o cronômetro.

## O Que Ficou de Fora (Próximas Fases)

Conforme a arquitetura e o planejamento modular da plataforma:

- **Fase 6**: Metas de Estudo (definição e acompanhamento de metas de horas e volume de questões resolvidas).
- **Fase 7**: Desempenho e Estatísticas (classificação de matérias e assuntos em FORTE, REGULAR e FRACO, com cálculo ponderado de notas).
- **Fase 8**: Observatório Semanal (relatório consolidado semanal com insights de constância, hábitos e evolução).
