# Relatório de Revisão Técnica e Crítica Adversarial — Marco 1 (reviewer_m1_2)

**Agente**: `reviewer_m1_2`  
**Data**: 2026-10-06  
**Veredito**: **APPROVE**  
**Avaliação Geral de Risco**: **BAIXO (LOW)**  
**Escopo Avaliado**: Milestone 1 — Infraestrutura de Banco de Dados, Docker Compose, Schema Prisma (Seção 6), Migrações SQL, Scripts de Seed, Testes Automatizados e Tratamento de Erros.

---

## 1. Sumário Executivo da Revisão

O trabalho submetido pelo agente `worker_m1` para o **Marco 1 (Milestone 1)** foi submetido a uma auditoria rigorosa, independente e adversarial. 

Todos os requisitos mandatórios delineados em `ORIGINAL_REQUEST.md`, `PROJECT.md` e na **Seção 6 de `01-contexto-do-projeto.md`** foram plenamente implementados e validados empiricamente no ambiente real (Windows, Docker 29, PostgreSQL 16 Alpine, Node.js 24, npm 11):
1. **Infraestrutura Docker & Ambiente**: `docker-compose.yml`, `.env.example` e `.env` estão funcionais, consistentes entre si e com documentação em português.
2. **Schema Prisma**: Contém com exatidão matemática os **11 modelos** (`User`, `Subject`, `Topic`, `PlannedSession`, `PlannedBlock`, `StudySession`, `SessionBlock`, `SessionEvent`, `PracticeRecord`, `SessionEvaluation`, `Goal`) e os **10 enums** especificados.
3. **Migração SQL Inicial**: A migração `20261006000000_init/migration.sql` roda do zero sem falhas e materializou com precisão todas as 11 tabelas, índices e tipos enum no PostgreSQL.
4. **Seed e Validação em Banco**: O script `npm --workspace=apps/api run db:seed` foi executado diretamente e validou a criação de todas as 11 entidades, chaves estrangeiras e a deleção em cascata a partir do usuário.
5. **Padronização de Erros e Idioma**: Envelope JSON de erro padronizado `{ error: { code, message } }` e 100% das mensagens, comentários, logs e documentação redigidos em português (mantendo em inglês apenas os identificadores técnicos exigidos pelo schema).
6. **Auditoria Forense de Integridade**: Não foi detectada nenhuma violação de integridade (zero implementações de fachada/mocks enganosos, zero resultados forjados ou hardcoded nas regras de domínio).

---

## 2. Achados e Observações (Findings)

### [Minor] Finding 1: Tipagem de prioridade no helper de testes E2E (`PlannedSessionSeed`)
- **O que**: Na interface `PlannedSessionSeed` em `tests/e2e/helpers/db-helper.ts` (linha 11), a propriedade `priority` foi tipada como `number`, enquanto no `schema.prisma` (linha 170) o campo `priority` do modelo `PlannedSession` é do tipo `String` com valor padrão `"MEDIUM"`.
- **Onde**: `tests/e2e/helpers/db-helper.ts:11` e `apps/api/prisma/schema.prisma:170`.
- **Por que**: Atualmente, `insertPlannedSession` não é invocado nos testes existentes, de modo que nenhum teste falhou. No entanto, se invocado no futuro passando um número para o Prisma Client, o Prisma rejeitará a inserção por incompatibilidade de tipo (`Expected String, provided Int`).
- **Sugestão para o próximo marco**: No Milestone 2 ou 3, alinhar `PlannedSessionSeed.priority?: string | number` convertendo explicitamente para `String(data.priority)` no `db-helper.ts`.

---

## 3. Reivindicações Verificadas (Verified Claims)

| Reivindicação do Worker M1 | Método de Verificação Independente | Resultado |
|---|---|---|
| PostgreSQL 16 executando no Docker | Execução de `node scripts/wait-for-db.mjs` e `docker compose exec postgres pg_isready` | **PASSOU** (Porta 5432 pronta e conectável) |
| Existência das 11 tabelas no PostgreSQL | Consulta DDL real: `docker compose exec -T postgres psql -U postgres -d estudos_db -c "\dt"` | **PASSOU** (11 tabelas + `_prisma_migrations`) |
| Existência dos 10 Enums no PostgreSQL | Consulta de catálogo real: `docker compose exec -T postgres psql -U postgres -d estudos_db -c "\dT"` | **PASSOU** (10 tipos enum nativos criados) |
| Migração inicial executada e registrada | Consulta SQL à tabela `_prisma_migrations`: registro de `20261006000000_init` | **PASSOU** (Migração aplicada com sucesso em 2026-10-06) |
| Script de seed exercita todas as entidades e cascata | Execução direta de `npm --workspace=apps/api run db:seed` | **PASSOU** (11/11 entidades criadas + cascata validada) |
| Testes unitários e de integração verdes | Execução independente de `npm test` na raiz do monorepo | **PASSOU** (3 arquivos, 20 testes aprovados em 4.34s) |
| Checagem de tipos estrita sem erros | Execução independente de `npm run typecheck` (`tsc -b`) | **PASSOU** (0 erros de compilação TypeScript) |
| Compilação de produção dos 3 workspaces | Execução independente de `npm run build` | **PASSOU** (`@estudos/domain`, `@estudos/api` e `@estudos/web` compilados com sucesso) |
| Envelope de erro padronizado em português | Invocação HTTP com Supertest na rota 404 e inspeção de `apps/api/src/app.ts` | **PASSOU** (Envelope `{ error: { code: 'NOT_FOUND', message: '...' } }` em português) |
| Ausência de violações de integridade | Auditoria manual de código em `packages/domain/src/index.ts`, `apps/api/src/app.ts`, `apps/api/prisma/seed.ts` | **PASSOU** (Implementação algorítmica legítima sem atalhos ou mocks forjados) |

---

## 4. Análise e Desafio Adversarial (Adversarial Review)

### Desafio 1: Prevenção de Ciclos com Dados Já Corrompidos (Loops Infinitos)
- **Suposição desafiada**: O algoritmo `wouldCreateHierarchyCycle` assume que a árvore existente é sempre um acíclico direcionado. O que acontece se uma falha externa anterior tiver introduzido um ciclo pré-existente nos dados?
- **Cenário de ataque**: Se o grafo já contiver um ciclo (ex.: A -> B -> A) e o usuário tentar mover outro nó para B, uma busca recursiva ingênua entraria em estouro de pilha (stack overflow) ou loop infinito.
- **Resultado do estresse**: O algoritmo em `packages/domain/src/index.ts:129-140` utiliza um `Set<string>` denominado `visited`. Ao detectar que `currentParentId` já foi visitado, o laço interrompe imediatamente e retorna `true` (ciclo detectado), prevenindo qualquer loop infinito ou negação de serviço (DoS).
- **Classificação**: **DEFESA ROBUSTA (PASSOU)**.

### Desafio 2: Divisão por Zero e Limites em Cálculos de Tempo e Aproveitamento
- **Suposição desafiada**: Métricas de taxa de acerto (`calculateAccuracy`), foco (`calculateFocusEfficiency`) e aderência (`calculatePlanAdherence`) podem receber 0 questões ou 0 minutos.
- **Cenário de ataque**: `total = 0` gerando `NaN` ou `Infinity`.
- **Resultado do estresse**: Em `packages/domain/src/index.ts`:
  - `calculateAccuracy(0, 0)` retorna `0` com guarda explícita `if (total <= 0) return 0;` e clamp de `Math.min(100, Math.max(0, ...))`.
  - `calculateFocusEfficiency(effective, 0)` retorna `0` via `if (totalMinutes <= 0) return 0;`.
  - `calculatePlanAdherence(effective, 0)` retorna `0` via `if (plannedMinutes <= 0) return 0;`.
- **Classificação**: **DEFESA ROBUSTA (PASSOU)**.

### Desafio 3: Deleção Proibida no Banco de Dados (Exclusão Física de Tópicos com Sessões)
- **Suposição desafiada**: A restrição R3 exige que a exclusão de um tópico seja recusada quando houver sessões vinculadas. Isso depende apenas do código de aplicação ou está protegido também no banco?
- **Resultado do estresse**: No arquivo `schema.prisma` (linhas 180, 226, 273, 288) e na DDL `migration.sql` (linhas 263, 273, 288), as chaves estrangeiras entre `topics` e `planned_sessions`, `study_sessions` e `practice_records` foram definidas com `ON DELETE RESTRICT`. Portanto, mesmo que uma query direta ou falha no backend tentasse excluir um tópico com sessões, o PostgreSQL bloquearia fisicamente no nível do motor relacional com erro de restrição.
- **Classificação**: **DEFESA EM PROFUNDIDADE (PASSOU)**.

---

## 5. Lacunas de Cobertura e Itens Não Verificados

- **Lacunas de Cobertura**: Nenhuma no escopo do Marco 1.
- **Itens Não Verificados**: Rotas de autenticação (`/register`, `/login`, etc.) e mutações de tópicos da API. Justificativa: Escopo planejado especificamente para os Marcos M2 e M3, conforme o planejamento estritamente faseado do projeto.

---

## 6. Veredito Final

**Veredito Oficial**: **APPROVE**  
O Marco 1 está aprovado com distinção, sem impedimentos, sem violações de integridade e com conformidade integral aos padrões de qualidade e de idioma do projeto. A equipe está autorizada a prosseguir para o Marco 2 (Autenticação, Sessão e Layout Base).
