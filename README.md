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
  - Cards de sessão ricos (`PlannedSessionCard`) com visualização de matéria, assunto, pílulas de blocos de estudo, badges de prioridade, avisos de sobreposição e menu de ações rápidas.
  - Modal de planejamento (`PlannedSessionModal`) com atalhos de duração, preenchimento inteligente de presets de estudo, e barra de validação dinâmica colorida (Amarela, Verde e Vermelha) impedindo o envio de dados inconsistentes.

## O Que Ficou de Fora (Próximas Fases)

Conforme instruído no contexto e nos marcos arquiteturais, a base foi desenvolvida de forma modular e expansível para as próximas entregas:

- **Fase 4**: Metas de Estudo e Estatísticas Qualitativas (Classificação FORTE, REGULAR, FRACO).
- **Fase 5**: Observatório Semanal e relatórios de aderência ao plano.
- **Execução Realizada e Cronômetro**: Registro de sessões executadas reais e integração com timer em tempo real (conforme especificado para os módulos de estudo em execução).
