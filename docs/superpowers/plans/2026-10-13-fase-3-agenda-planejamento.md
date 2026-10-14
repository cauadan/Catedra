# Fase 3 — Agenda e Planejamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o módulo completo da Fase 3 (Agenda e Planejamento de Estudos), englobando funções puras de manipulação temporal e validação de blocos em `@estudos/domain`, API REST transacional e protegida contra condições de corrida em `@estudos/api`, e interface de usuário diária/semanal em `@estudos/web`.

**Architecture:** Isolamento total de regras de calendário e fuso horário no pacote `@estudos/domain` com funções puras baseadas em `date-fns-tz` v3, independentes do fuso do sistema operacional. No backend `@estudos/api`, controladores e serviços Express integrados ao Prisma ORM com validação estrita Zod (`.strict()`), ordem determinística de erros e operações atômicas em `$transaction` (`updateMany`/`deleteMany` com validação de `count === 1` para prevenção de race conditions). No frontend `@estudos/web`, visualização de agenda em modos Dia e Semana com navegação temporal pura via `user.timezone`, cards de métricas consolidadas, e modal interativo para montagem de sessões e blocos de estudo com presets e validação visual de minutos.

**Tech Stack:** React 19, TypeScript 5.7+, Tailwind CSS, TanStack Query, Lucide React, Express, Prisma ORM, PostgreSQL, Zod, date-fns v4 / date-fns-tz v3, Vitest.

**Spec:** `03-spec-fase-3.md` (com base em `01-contexto-do-projeto.md`)

## Global Constraints

- **Idioma estrito:** Interface, validações, mensagens de erro, commits, testes, documentação e relatórios estritamente em Português (pt-BR).
- **Sem mutação do schema:** Preservar a integridade do `apps/api/prisma/schema.prisma` estabelecido na Fase 1.
- **Independência de fuso horário:** Nenhuma lógica de tempo pode depender do fuso do SO do servidor ou do navegador. Todos os cálculos de calendário são parametrizados por `timezone: string` ou executados via aritmética pura em UTC.
- **Isolamento de usuário:** Toda consulta e mutação deve filtrar obrigatoriamente por `user_id`. Recursos inexistentes ou pertencentes a outros usuários retornam `404 Not Found` (nunca `403`).
- **Validação estrita no backend:** Schemas Zod de entrada devem conter `.strict()` para rejeitar campos não permitidos.
- **Funções puras e TDD:** Todas as regras de negócio, conversões e cálculos de minutos e sobreposição ficam em `packages/domain` com cobertura de testes unitários.

## Review Focus

1. **Horário de Verão (DST) em `America/New_York` no início (`2026-03-08`, 23h) e término (`2026-11-01`, 25h):** O sistema deve produzir janelas diárias e semanais contíguas e estritamente correspondentes à duração real em UTC.
2. **Condição de Corrida em chamadas simultâneas (`Promise.all`):** Requisições concorrentes de remarcação (`reschedule`), alteração de status ou exclusão (`DELETE`) da mesma sessão devem resolver deterministicamente em exatamente 1 sucesso e 1 erro (`409 Conflict` ou `404 Not Found`), sem duplicações órfãs.
3. **Validação de Matéria e Assunto Arquivados:** Tentativa de criar ou remarcar sessão com matéria ou assunto arquivado deve ser rejeitada com `400 Bad Request`. Edição parcial (`PATCH`) de notas ou blocos em sessão cujo assunto foi arquivado após o agendamento deve continuar sendo permitida.
4. **Sessões que cruzam a meia-noite local e detecção de sobreposição:** Sessão pertence ao dia local do seu `scheduled_start`. Sessões adjacentes (fim de A == início de B) não geram conflito.
5. **Independência do SO no Windows (`test:tz`):** Os testes devem passar tanto no fuso local quanto sob o script `npm run test:tz` emulando `Asia/Tokyo` (UTC+9), validado por teste de sanidade condicional.

---

### Task 1: Configuração de Dependências, Vitest e Script de Fuso Horário

**Files:**
- Modify: `packages/domain/package.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `package.json`
- Create: `packages/domain/tests/timezone-sanity.test.ts`

**Interfaces:**
- Consumes: Configuração do Vitest e Node.js
- Produces: Dependências `date-fns` e `date-fns-tz` no `@estudos/domain`, resolução do alias `@estudos/domain` em `apps/api`, e script `npm run test:tz` funcional no Windows.

- [ ] **Passo 1: Escrever teste de sanidade condicional de fuso horário**

Criar `packages/domain/tests/timezone-sanity.test.ts` contendo:
```typescript
import { describe, it, expect } from 'vitest';

describe('Sanidade de Configuração de Fuso Horário (test:tz)', () => {
  it('deve confirmar fuso Asia/Tokyo (UTC+9, offset -540) quando executado via test:tz', () => {
    if (process.env.TZ_TEST === '1') {
      expect(new Date().getTimezoneOffset()).toBe(-540);
    } else {
      expect(typeof new Date().getTimezoneOffset()).toBe('number');
    }
  });
});
```

- [ ] **Passo 2: Rodar teste para verificar execução inicial**

Executar: `npx vitest run packages/domain/tests/timezone-sanity.test.ts`
Esperado: PASS (fuso padrão do sistema).

- [ ] **Passo 3: Instalar `date-fns` e `date-fns-tz` em `packages/domain` e configurar alias no `apps/api/vitest.config.ts`**

Instalar dependências:
`npm install date-fns@^4.1.0 date-fns-tz@^3.2.0 --workspace=@estudos/domain`

Atualizar `apps/api/vitest.config.ts` adicionando alias:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@estudos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Adicionar script no `package.json` da raiz:
`"test:tz": "node -e \"process.env.TZ='Asia/Tokyo'; process.env.TZ_TEST='1'; const { spawnSync } = require('child_process'); const res = spawnSync('npx', ['vitest', 'run', '--pool=forks'], { stdio: 'inherit', shell: true, env: process.env }); process.exit(res.status ?? 0);\""`

- [ ] **Passo 4: Executar `npm test` e `npm run test:tz` para validar**

Executar: `npm run test:tz`
Esperado: PASS, com o teste condicional validando offset `-540` no worker fork.

- [ ] **Passo 5: Commit das configurações iniciais**

```bash
git add package.json packages/domain/package.json apps/api/vitest.config.ts packages/domain/tests/timezone-sanity.test.ts
git commit -m "chore(config): instalar date-fns-tz, configurar alias da api e script test:tz"
```

---

### Task 2: Funções Puras de Calendário, Fuso e Janelas UTC (`packages/domain`)

**Files:**
- Create: `packages/domain/src/calendar.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/tests/calendar.test.ts`

**Interfaces:**
- Consumes: `date-fns-tz` (`fromZonedTime`, `toZonedTime`, `formatInTimeZone`)
- Produces:
  - `isValidLocalDate(dateStr: string): boolean`
  - `isValidLocalDateTime(dateTimeStr: string): boolean`
  - `addDaysToLocalDate(localDate: string, days: number): string`
  - `localDateTimeToUtc(localIsoWithoutTz: string, timezone: string): Date`
  - `utcToLocalDate(utcDate: Date, timezone: string): string`
  - `utcToLocalTime(utcDate: Date, timezone: string): string`
  - `getDayWindowUtc(localDate: string, timezone: string): { startUtc: Date; endUtc: Date }`
  - `getWeekWindowUtc(localDate: string, timezone: string, weekStartsOn?: 1): { startUtc: Date; endUtc: Date; days: string[] }`

- [ ] **Passo 1: Escrever os testes unitários de fuso horário, calendário e Horário de Verão (DST)**

Criar `packages/domain/tests/calendar.test.ts` com cobertura estrita para:
- Validação estrita de formato e calendário real (`2026-02-30` e `2026-04-31` rejeitados; `2026-02-28` aceito).
- `addDaysToLocalDate`: viradas de mês (`2026-01-31` + 1), viradas de ano (`2026-12-31` + 1 e `2026-01-01` - 1), anos bissextos (`2028-02-28` + 1 vs `2026-02-28` + 1) e saltos de `±7` dias.
- Fuso `America/Rio_Branco` (UTC-5): sessão às 23:30 locais (04:30Z seguinte) agrupada no dia local correto.
- Fuso `America/New_York` (DST 2026):
  - Início DST (`2026-03-08`): janela diária com exatamente 23 horas; semana de `2026-03-02` com 167 horas.
  - Fim DST (`2026-11-01`): janela diária com exatamente 25 horas; semana de `2026-10-26` com 169 horas.
  - Contiguidade: `endUtc` do dia N estritamente igual ao `startUtc` do dia N+1.
  - Horários ambíguos e inexistentes em conversão determinística via `fromZonedTime`.

- [ ] **Passo 2: Rodar testes para verificar falha (TDD)**

Executar: `npx vitest run packages/domain/tests/calendar.test.ts`
Esperado: FAIL (módulos ainda não implementados).

- [ ] **Passo 3: Implementar funções em `packages/domain/src/calendar.ts` e exportar em `index.ts`**

Implementar funções utilizando cálculos puros de calendário via aritmética UTC e conversões determinísticas com `date-fns-tz`.

- [ ] **Passo 4: Rodar testes para verificar sucesso**

Executar: `npx vitest run packages/domain/tests/calendar.test.ts`
Esperado: PASS (todos os casos de teste de DST, contiguidade e calendário validados).

- [ ] **Passo 5: Commit**

```bash
git add packages/domain/src/calendar.ts packages/domain/src/index.ts packages/domain/tests/calendar.test.ts
git commit -m "feat(domain): adicionar funcoes puras de calendario, fuso horario e janelas UTC"
```

---

### Task 3: Schemas de Validação Zod e Presets de Etapas (`PlannedBlock`)

**Files:**
- Create: `packages/domain/src/planning.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/tests/planning.test.ts`

**Interfaces:**
- Consumes: `isValidLocalDate`, `isValidLocalDateTime`
- Produces:
  - Enums e Tipos: `PlannedSessionPriority`, `PlannedActivityType`, `PlannedSessionStatusDTO`, `BlockKindDTO`
  - `validatePlannedBlocks(plannedMinutes: number, blocks: Array<{ kind: BlockKindDTO; planned_minutes: number }>): { ok: boolean; message?: string; normalizedBlocks?: Array<{ kind: BlockKindDTO; planned_minutes: number; position: number }> }`
  - `calculateBlockPreset(plannedMinutes: number, preset: 'BALANCED' | 'PRACTICE_FOCUS' | 'NEW_ONLY'): Array<{ kind: BlockKindDTO; planned_minutes: number; position: number }>`
  - Schemas Zod: `plannedSessionCreateSchema`, `plannedSessionUpdateSchema`, `plannedSessionRescheduleSchema`, `plannedSessionStatusUpdateSchema`, `plannedSessionQuerySchema`

- [ ] **Passo 1: Escrever testes unitários para validação de blocos e presets**

Criar `packages/domain/tests/planning.test.ts`:
- Limites de duração: entre 5 e 480 minutos.
- Presets:
  - `BALANCED`: 25% revisão, 25% prática, restante conteúdo novo (soma exata).
  - `PRACTICE_FOCUS`: 20% revisão, 80% prática (sem conteúdo novo).
  - `NEW_ONLY`: 100% conteúdo novo.
- Validação de blocos:
  - Rejeitar blocos com 0 minutos.
  - Garantir que cada kind apareça no máximo 1 vez.
  - Garantir que a soma seja estritamente igual à duração da sessão.
  - Ordenação canônica de posição: `REVIEW (1)` -> `NEW_CONTENT (2)` -> `PRACTICE (3)`.
- Validação Zod estrita:
  - Rejeição de `scheduled_start_local` no payload de update (`PATCH`).
  - Rejeição de envio isolado de `planned_minutes` ou `blocks` no `PATCH`.
  - Rejeição de status manual inválido (somente `SKIPPED` no endpoint de status).

- [ ] **Passo 2: Rodar testes para verificar falha (TDD)**

Executar: `npx vitest run packages/domain/tests/planning.test.ts`
Esperado: FAIL.

- [ ] **Passo 3: Implementar regras e schemas em `packages/domain/src/planning.ts` e exportar em `index.ts`**

Definir os schemas estritos com `.strict()`, refinamentos e funções de cálculo e normalização de blocos.

- [ ] **Passo 4: Rodar testes para verificar aprovação**

Executar: `npx vitest run packages/domain/tests/planning.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add packages/domain/src/planning.ts packages/domain/src/index.ts packages/domain/tests/planning.test.ts
git commit -m "feat(domain): implementar validacao de blocos, presets e schemas Zod da agenda"
```

---

### Task 4: Resumo do Período e Detecção de Sobreposição de Sessões

**Files:**
- Create: `packages/domain/src/summary.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/tests/summary.test.ts`

**Interfaces:**
- Consumes: Tipos de sessão planejada e blocos
- Produces:
  - `summarizePlannedSessions(sessions: PlannedSessionSummaryItem[]): PlannedPeriodSummary`
  - `findOverlappingSessionIds(sessions: PlannedSessionIntervalItem[]): Set<string>`

- [ ] **Passo 1: Escrever testes unitários para resumo e sobreposições**

Criar `packages/domain/tests/summary.test.ts`:
- Resumo de período:
  - Somar apenas sessões com status `PLANNED` e `DONE` (ignorar `SKIPPED` e `RESCHEDULED`).
  - Contabilizar `totalPlannedMinutes`, contadores (`plannedCount`, `doneCount`, `activeAndDoneCount`) e `minutesByKind` (`REVIEW`, `NEW_CONTENT`, `PRACTICE`).
- Detecção de sobreposição:
  - Avaliar apenas sessões com `status === 'PLANNED'`.
  - Sessões adjacentes (ex: 14:00-15:00 e 15:00-16:00) **não** devem ser consideradas sobrepostas.
  - Sessões com interseção real (ex: 14:00-15:30 e 15:00-16:00) devem ter ambos os IDs retornados no `Set`.
  - Sessões com status diferente de `PLANNED` não entram no cálculo de sobreposição.

- [ ] **Passo 2: Rodar testes para verificar falha (TDD)**

Executar: `npx vitest run packages/domain/tests/summary.test.ts`
Esperado: FAIL.

- [ ] **Passo 3: Implementar `summarizePlannedSessions` e `findOverlappingSessionIds` em `summary.ts` e exportar em `index.ts`**

- [ ] **Passo 4: Rodar testes para verificar sucesso**

Executar: `npx vitest run packages/domain/tests/summary.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add packages/domain/src/summary.ts packages/domain/src/index.ts packages/domain/tests/summary.test.ts
git commit -m "feat(domain): implementar resumo de periodo e deteccao de sobreposicoes"
```

---

### Task 5: Serviço Backend de Sessões Planejadas (`apps/api`)

**Files:**
- Create: `apps/api/src/services/planned-session.service.ts`
- Test: `apps/api/tests/planned-session.service.test.ts`

**Interfaces:**
- Consumes: `prisma`, funções do `@estudos/domain`
- Produces: `PlannedSessionService` com métodos transacionais:
  - `list(userId: string, timezone: string, view: 'day' | 'week', dateStr: string)`
  - `create(userId: string, timezone: string, input: PlannedSessionCreateInput)`
  - `update(userId: string, id: string, input: PlannedSessionUpdateInput)`
  - `updateStatus(userId: string, id: string, status: 'SKIPPED')`
  - `reschedule(userId: string, timezone: string, id: string, input: PlannedSessionRescheduleInput)`
  - `delete(userId: string, id: string)`

- [ ] **Passo 1: Escrever testes unitários do serviço cobrindo regras de negócio e transações**

Criar `apps/api/tests/planned-session.service.test.ts`:
- Ordem determinística de checagens: `404` para sessão inexistente ou de outro usuário; `409` para status inadequado; `400` para matéria/assunto arquivados ou incompatíveis.
- Substituição atômica de blocos com `deleteMany` antes de `createMany`.
- Verificação atômica de `count === 1` em mutações para proteção de concorrência.
- Tratamento de exceção `P2003` mapeando para `409 Conflict`.

- [ ] **Passo 2: Rodar teste para verificar falha (TDD)**

Executar: `npx vitest run apps/api/tests/planned-session.service.test.ts`
Esperado: FAIL.

- [ ] **Passo 3: Implementar `PlannedSessionService` em `apps/api/src/services/planned-session.service.ts`**

Garantir uso de `$transaction`, queries filtrando estritamente por `user_id`, ordenação determinística e geração de erros semânticos.

- [ ] **Passo 4: Rodar testes para verificar sucesso**

Executar: `npx vitest run apps/api/tests/planned-session.service.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add apps/api/src/services/planned-session.service.ts apps/api/tests/planned-session.service.test.ts
git commit -m "feat(api): implementar servico transacional de sessoes planejadas"
```

---

### Task 6: Controladores e Rotas da API (`apps/api`)

**Files:**
- Create: `apps/api/src/controllers/planned-session.controller.ts`
- Create: `apps/api/src/routes/planned-session.routes.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `PlannedSessionService`, `authMiddleware`, schemas de validação Zod
- Produces: Rotas REST expostas em `/api/planned-sessions`

- [ ] **Passo 1: Criar `PlannedSessionController` com mapeamento estrito de códigos HTTP**

Implementar respostas em formato padronizado `{ error: { code, message, details? } }` em português:
- `GET /api/planned-sessions?view=day|week&date=YYYY-MM-DD`: `200 OK`
- `POST /api/planned-sessions`: `201 Created`
- `PATCH /api/planned-sessions/:id`: `200 OK`
- `PATCH /api/planned-sessions/:id/status`: `200 OK`
- `POST /api/planned-sessions/:id/reschedule`: `201 Created`
- `DELETE /api/planned-sessions/:id`: `204 No Content`

- [ ] **Passo 2: Criar `planned-session.routes.ts` e registrar no `apps/api/src/app.ts`**

Conectar as rotas sob `app.use('/api/planned-sessions', authMiddleware, plannedSessionRouter)`.

- [ ] **Passo 3: Validar inicialização do servidor e roteamento via teste básico**

Executar: `npm test --workspace=@estudos/api`
Esperado: Rotas compilando sem erro de tipagem.

- [ ] **Passo 4: Commit**

```bash
git add apps/api/src/controllers/planned-session.controller.ts apps/api/src/routes/planned-session.routes.ts apps/api/src/app.ts
git commit -m "feat(api): adicionar controladores e rotas REST para sessoes planejadas"
```

---

### Task 7: Testes de Integração, Isolamento e Concorrência da API (`apps/api`)

**Files:**
- Create: `apps/api/tests/planned-session.integration.test.ts`
- Create: `apps/api/tests/planned-session.concurrency.test.ts`

**Interfaces:**
- Consumes: Servidor Express `app`, banco PostgreSQL de teste
- Produces: Suite completa de testes de integração e concorrência

- [ ] **Passo 1: Escrever testes de integração cobrindo fluxos felizes e limites de segurança**

Cobrir:
- Tentativa de acesso sem login (`401 Unauthorized`).
- Isolamento: Usuário A não lê nem altera sessões do Usuário B (`404 Not Found`).
- Validação Zod estrita rejeitando payload desconhecido e `scheduled_start_local` no PATCH com `400 Bad Request`.
- Incompatibilidade entre Matéria e Assunto (`topic.subject_id !== subject_id`) retornando `400`.
- Criação e remarcação com Matéria ou Assunto arquivados retornando `400`.
- Edição de notas/blocos permitida em sessão cujo assunto foi arquivado após criação.
- Tentativa de exclusão de sessão `RESCHEDULED` ou `DONE` retornando `409 Conflict`.
- Exclusão bem-sucedida de sessão `PLANNED` ou `SKIPPED` sem dependentes.

- [ ] **Passo 2: Escrever testes de concorrência com `Promise.all`**

Cobrir:
- Duas chamadas simultâneas de `reschedule` sobre a mesma sessão: exatamente 1 sucesso (`201`) e 1 conflito (`409`), gerando apenas 1 nova sessão.
- Duas chamadas simultâneas de mudança de status (`SKIPPED`): exatamente 1 sucesso (`200`) e 1 conflito (`409`).
- Duas chamadas simultâneas de `DELETE`: exatamente 1 sucesso (`204`) e 1 falha (`404` ou `409`).

- [ ] **Passo 3: Executar testes de integração e concorrência**

Executar: `npx vitest run apps/api/tests/planned-session.integration.test.ts apps/api/tests/planned-session.concurrency.test.ts`
Esperado: PASS (100% de sucesso sob concorrência e cenários adversários).

- [ ] **Passo 4: Commit**

```bash
git add apps/api/tests/planned-session.integration.test.ts apps/api/tests/planned-session.concurrency.test.ts
git commit -m "test(api): adicionar testes de integracao, isolamento multi-tenant e concorrencia"
```

---

### Task 8: Componentes de Interface da Agenda (`apps/web`)

**Files:**
- Create: `apps/web/src/components/agenda/PlannedSessionCard.tsx`
- Create: `apps/web/src/components/agenda/PlannedSessionModal.tsx`
- Create: `apps/web/src/components/agenda/AgendaSummaryCards.tsx`
- Create: `apps/web/src/components/agenda/AgendaHeader.tsx`
- Create: `apps/web/tests/planned-session-card.test.tsx`

**Interfaces:**
- Consumes: Tipos e utilitários de `@estudos/domain`, API client `api`
- Produces:
  - `PlannedSessionCard`: Exibe horário local, cor da matéria, assunto, prioridade, badges de arquivado/remarcada/conflito, pílulas de blocos e ações rápidas (Editar, Remarcar, Pular, Excluir).
  - `PlannedSessionModal`: Modal acessível com seletores de matéria e assuntos ativos, input de duração e atalhos rápidos (30m, 45m, 60m, 90m, 120m), presets de etapas (Equilibrado, Foco em Prática, Só Conteúdo Novo), e barra de status colorida (Amarela, Verde, Vermelha) bloqueando submissão inválida.
  - `AgendaSummaryCards`: Cards de Carga Planejada, Total de Sessões e Distribuição por Etapa.
  - `AgendaHeader`: Controles de navegação temporal, alternador Dia/Semana e badge com o fuso do usuário.

- [ ] **Passo 1: Escrever teste de renderização e comportamento do `PlannedSessionCard`**

Criar `apps/web/tests/planned-session-card.test.tsx` testando renderização de tags, horário local e acionamento de callbacks de ações.

- [ ] **Passo 2: Rodar teste para verificar falha (TDD)**

Executar: `npx vitest run apps/web/tests/planned-session-card.test.tsx`
Esperado: FAIL.

- [ ] **Passo 3: Implementar componentes em `apps/web/src/components/agenda/`**

- [ ] **Passo 4: Rodar teste para verificar aprovação**

Executar: `npx vitest run apps/web/tests/planned-session-card.test.tsx`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add apps/web/src/components/agenda/ apps/web/tests/planned-session-card.test.tsx
git commit -m "feat(web): criar componentes de card, modal de agendamento e cabecalho da agenda"
```

---

### Task 9: Página Principal da Agenda e Integração no Roteador (`apps/web`)

**Files:**
- Create: `apps/web/src/pages/Agenda.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/tests/agenda-page.test.tsx`

**Interfaces:**
- Consumes: Componentes da Task 8, `useAuth`, TanStack Query
- Produces: Página `/agenda` totalmente funcional e responsiva, substituindo o placeholder da Fase 2.

- [ ] **Passo 1: Escrever teste da página `Agenda.tsx`**

Testar carregamento dos dados pela query do TanStack Query, alternância entre modos Dia e Semana, navegação temporal determinística e abertura do modal de agendamento.

- [ ] **Passo 2: Rodar teste para verificar falha (TDD)**

Executar: `npx vitest run apps/web/tests/agenda-page.test.tsx`
Esperado: FAIL.

- [ ] **Passo 3: Implementar `apps/web/src/pages/Agenda.tsx` e plugar no `App.tsx`**

Substituir o `PlaceholderModule` da rota `/agenda` no `App.tsx` pelo componente `Agenda`.

- [ ] **Passo 4: Rodar teste para verificar aprovação**

Executar: `npx vitest run apps/web/tests/agenda-page.test.tsx`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add apps/web/src/pages/Agenda.tsx apps/web/src/App.tsx apps/web/tests/agenda-page.test.tsx
git commit -m "feat(web): integrar pagina completa da agenda com visao diaria e semanal"
```

---

### Task 10: Verificação Completa, Tipagem, Documentação e Relatório Final

**Files:**
- Modify: `README.md`
- Verify: Todas as suítes de teste e verificações estáticas

**Interfaces:**
- Consumes: Todo o monorepo
- Produces: Repositório validado, sem regressões, documentado e pronto para entrega.

- [ ] **Passo 1: Executar checagem estática de tipos em todos os pacotes**

Executar: `npm run typecheck` (ou `tsc --noEmit` em `packages/domain`, `apps/api` e `apps/web`).
Esperado: 0 erros de compilação TypeScript.

- [ ] **Passo 2: Executar suite completa de testes em ambiente padrão**

Executar: `npm test`
Esperado: 100% dos testes passando (Fase 1, Fase 2 e Fase 3).

- [ ] **Passo 3: Executar suite completa de testes sob script de fuso horário**

Executar: `npm run test:tz`
Esperado: 100% dos testes passando sob emulação de fuso `Asia/Tokyo`.

- [ ] **Passo 4: Atualizar `README.md`**

Documentar instruções de execução da Fase 3, novos endpoints, scripts e decisões de arquitetura em português.

- [ ] **Passo 5: Commit e preparação do relatório**

```bash
git add README.md
git commit -m "docs: atualizar README com instrucoes e especificacoes da Fase 3"
```
