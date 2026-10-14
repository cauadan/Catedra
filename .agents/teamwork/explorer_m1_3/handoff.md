# Handoff Report — Milestone 1: Prisma Schema & Initial Migration

**From:** explorer_m1_3  
**To:** worker_m1 (e orchestrator_1)  
**Date:** 2026-10-06  
**Type:** Hard (Task complete)  

---

## 1. Observation

- **Requisitos de Negócio e Modelo de Dados:**
  - `01-contexto-do-projeto.md` (Linhas 91-117): Define as 11 entidades de dados e seus atributos: `User`, `Subject`, `Topic`, `PlannedSession`, `PlannedBlock`, `StudySession`, `SessionBlock`, `SessionEvent`, `PracticeRecord`, `SessionEvaluation` e `Goal`. Especifica também que todas as tabelas possuem `id`, `user_id` (exceto `User`), `created_at` e `updated_at` em UTC.
  - `01-contexto-do-projeto.md` (Linhas 101, 103, 105, 110, 114, 116): Define explicitamente os valores permitidos para status, tipos e métricas correspondentes aos 10 enums: `PlannedSessionStatus`, `BlockKind`, `StudySessionStatus`, `SessionEventType`, `UnderstandingLevel`, `FocusLevel`, `DifficultyLevel`, `GoalKind`, `GoalMetric`, `GoalPeriod`.
  - `02-prompts-por-fase.md` (Linhas 22, 33): Define para a Fase 1: "Prisma com PostgreSQL; schema completo conforme a seção 6 do contexto, com migração inicial" e "Migração roda do zero sem erro em um banco vazio".
  - `PROJECT.md` (Linhas 10-11, 22, 30, 47, 85-98): Ratifica que os identificadores seguem o schema do contexto em inglês (`Subject`, `Topic`, `user_id`, etc.), migração inicial funcional do zero, regras de árvore com auto-relação (`parent_id`) e restrição de exclusão de tópicos vinculados a sessões.
  - `ORIGINAL_REQUEST.md` (Linha 15, 29, 41): Ambiente Windows com Node v24, npm 11, Docker 29; PostgreSQL via Docker Compose; migração roda do zero sem erro.

---

## 2. Logic Chain

1. **Definição de Tipos e Nomes:**
   - Com base na Seção 6 do contexto e no PROJECT.md (Observação 1), as propriedades no Prisma utilizam a nomenclatura em snake_case (`user_id`, `created_at`, `updated_at`, etc.) para garantir compatibilidade imediata com os contratos JSON da API e convenções SQL.
   - Tabelas mapeadas explicitamente com `@@map("users")`, `@@map("topics")`, etc. para aderir ao padrão snake_case plural em PostgreSQL.

2. **Integridade Referencial e Cascatas:**
   - Todo dado pertence a um usuário: `user User @relation(fields: [user_id], references: [id], onDelete: Cascade)`. A exclusão do usuário limpa seus dados em cascata.
   - Em `Topic`, o auto-relacionamento hierárquico `parent_id` possui `onDelete: Cascade` para permitir que, quando uma subárvore for deletada após verificação de negócio, seus descendentes sejam excluídos de forma atômica no banco.
   - Para proteger contra violações da regra de negócio de exclusão física quando há sessões vinculadas (`PlannedSession`, `StudySession`, `PracticeRecord`), configurou-se `onDelete: Restrict` nas chaves estrangeiras de `Topic` nessas tabelas, provendo garantia de integridade em profundidade (defense-in-depth).

3. **Cardinalidade 1:1 em Avaliação de Sessão:**
   - O documento estabelece que "Uma sessão finalizada tem exatamente uma avaliação". No Prisma, isso é assegurado definindo `study_session_id String @unique` em `SessionEvaluation`, criando uma relação 1:1 estrita com `StudySession`.

4. **Gerenciamento de Datas e Fusos:**
   - Conforme Contexto §4 (Datas em UTC), `created_at`, `updated_at`, `scheduled_start`, `started_at`, `ended_at` e `occurred_at` utilizam o tipo `DateTime`.
   - O campo `period_start_local_date` de `Goal` foi tipado como `String` para armazenar a representação da data civil no fuso do usuário (ex.: `"2026-10-06"`), eliminando distorções de fuso horário em agregações.

5. **Estratégia de Migração Determinística:**
   - Foi gerado tanto o schema declarativo (`schema.prisma`) quanto a especificação DDL completa em SQL (`migration.sql`). Isso permite que a migração inicial seja aplicada via `prisma migrate deploy` ou `prisma migrate dev --name init` sem risco de prompts interativos bloqueantes.

---

## 3. Caveats

- **Ambiente de Banco Ativo:** A execução física dos comandos `prisma migrate dev` ou `prisma migrate deploy` requer que o contêiner Docker PostgreSQL esteja ativo (`docker compose up -d`). Caso o banco não esteja rodando no momento da execução, o comando falhará com erro de conexão TCP (`ECONNREFUSED 5432`). O Worker deve certificar-se de subir o PostgreSQL antes de rodar os scripts de banco.
- **Validação de Entrada:** O schema Prisma garante integridade referencial e tipos em nível de banco; as regras de negócio de alto nível (ex.: validação de acertos `0 <= correct <= questions`, soma de minutos dos blocos planejados igual à sessão planejada, verificação de ciclos de árvore) devem ser validadas no backend com schemas Zod (`packages/domain` e `apps/api`), conforme estabelecido nos requisitos.

---

## 4. Conclusion

A formulação técnica para o Milestone 1 está concluída e completamente documentada.
Os artefatos prontos para implementação pelo Worker são:
1. `apps/api/prisma/schema.prisma` com os 11 modelos, 10 enums, chaves, índices e diretivas de relação.
2. `apps/api/prisma/migrations/20261006000000_init/migration.sql` com o DDL PostgreSQL idempotente e completo.
3. `apps/api/prisma/seed.ts` script de verificação exercitando todos os 11 modelos, 10 enums e relações relacionais/hierárquicas.
4. Scripts padronizados de execução no `package.json` (`db:migrate`, `db:deploy`, `db:seed`, `db:generate`).

O relatório técnico detalhado com os códigos completos está arquivado em:
`c:\Users\cauad\Documents\Estudos\.agents\teamwork\explorer_m1_3\report.md`.

---

## 5. Verification Method

Para verificar independentemente a formulação e a execução do schema:

1. **Inspeção do Relatório:**
   - Verificar a presença e consistência dos 11 modelos e 10 enums em `report.md`.

2. **Comando de Teste do Schema:**
   Após a criação dos arquivos pelo Worker e com o PostgreSQL rodando:
   ```powershell
   # 1. Gerar Prisma Client
   npm --workspace=apps/api run db:generate

   # 2. Executar Migração Inicial
   npm --workspace=apps/api run db:deploy

   # 3. Executar Script de Verificação/Seed
   npm --workspace=apps/api run db:seed
   ```
   **Critério de Sucesso:** O script `seed.ts` deve imprimir `[1/11 OK]` até `[11/11 OK]`, validar o teste de deleção em cascata e finalizar com `=== TODOS OS 11 MODELOS E 10 ENUMS FORAM VALIDADOS COM SUCESSO! ===` com código de saída 0.
