# Relatório de Avaliação Adversarial — Marco 1: Banco de Dados & Integridade Prisma

**Agente**: `challenger_m1_1`  
**Data**: 2026-10-06  
**Função**: Empirical Challenger (Adversarial Critic & Domain Specialist)  
**Veredito Final**: **APPROVE (APROVADO)**  
**Nível de Risco Geral**: **BAIXO (LOW)**  

---

## 1. Resumo da Avaliação e Veredito

O Marco 1 (Fundação do Monorepo, Docker PostgreSQL, Schema Prisma e Migrações) foi submetido a uma rigorosa bateria de testes e estresses empíricos adversariais. Todos os componentes foram verificados diretamente no ambiente de execução:

1. **Contêiner PostgreSQL**: Ativo, saudável (`healthy`) na porta 5432 e respondendo a conexões TCP e comandos SQL.
2. **Migrações e Seeds**: A migração inicial `20261006000000_init` e o script de seed `prisma/seed.ts` foram executados do zero e aplicados com sucesso absoluto.
3. **Restrições de Integridade Referencial**: Todos os 10 cenários adversariais testados em `scripts/verify-adversarial-m1.ts` (restrições `onDelete: Restrict`, `onDelete: Cascade`, `onDelete: SetNull`, unicidade `@unique`, geração de UUID v4 e valores padrão) foram validados com 100% de sucesso.
4. **Veredito**: **APPROVE**. O Marco 1 cumpre com louvor os critérios de integridade relacional, prontidão de testes e conformidade arquitetural estipulados em `ORIGINAL_REQUEST.md` e `PROJECT.md`.

---

## 2. Evidências Empíricas de Execução

### 2.1 Verificação de Infraestrutura Docker & Conectividade
A inspeção direta dos serviços revelou:
- **Comando**: `docker ps --filter "name=estudos-postgres"`
  - **Resultado**: Contêiner `estudos-postgres` (imagem `postgres:16-alpine`) ativo com status `Up (healthy)`, mapeando as portas `0.0.0.0:5432->5432/tcp`.
- **Comando**: `node scripts/wait-for-db.mjs`
  - **Resultado**: `[wait-for-db] Sucesso: PostgreSQL está pronto e acessível em 127.0.0.1:5432!`.

### 2.2 Execução de Migração e Seed
- **Comando**: `npm --workspace=apps/api run db:deploy`
  - **Resultado**: 1 migração encontrada (`20261006000000_init`). Banco sincronizado sem erros.
- **Comando**: `npm --workspace=apps/api run db:seed`
  - **Resultado**: Criação sequencial e interligada de todas as 11 entidades (`User`, `Subject`, `Topic`, `PlannedSession`, `PlannedBlock`, `StudySession`, `SessionBlock`, `SessionEvent`, `PracticeRecord`, `SessionEvaluation`, `Goal`), exercitando todos os 10 enums do sistema e validando a deleção em cascata limpa ao final.

---

## 3. Bateria de Desafios Adversariais (`scripts/verify-adversarial-m1.ts`)

Foi implementada e executada uma suíte autônoma de estresse empírico cobrindo cenários destrutivos e de borda diretamente contra a instância PostgreSQL. Todos os 10 testes foram aprovados:

| # | Cenário Adversarial | Hipótese Testada | Comportamento Observado | Status |
|---|---------------------|------------------|-------------------------|--------|
| 1 | **Geração de UUID v4** | Chaves primárias geradas pelo `@default(uuid())` devem seguir estritamente o formato RFC 4122 v4. | Validação por regex em 6 entidades geradas sem ID explícito. Todas em conformidade. | **APROVADO** |
| 2 | **onDelete: Restrict (PlannedSession)** | A exclusão física de um `Topic` que possui `PlannedSession` vinculada deve ser bloqueada. | O PostgreSQL rejeitou a exclusão com código Prisma `P2003` (violação de chave estrangeira). O registro permaneceu intacto. | **APROVADO** |
| 3 | **onDelete: Restrict (StudySession)** | A exclusão física de um `Topic` que possui `StudySession` executada deve ser bloqueada. | Operação rejeitada pelo banco (`P2003`). Integridade de dados preservada. | **APROVADO** |
| 4 | **onDelete: Restrict (PracticeRecord)** | A exclusão física de um `Topic` com `PracticeRecord` vinculado deve ser bloqueada. | Rejeição imediata (`P2003`). Exclusão orfã impedida. | **APROVADO** |
| 5 | **Propagação Hierárquica de Restrict** | Tentativa de excluir um Tópico Pai cuja árvore possui Tópico Filho vinculado a `StudySession`. | Como o pai acionaria `Cascade` para o filho, e o filho está protegido por `Restrict`, o PostgreSQL abortou a exclusão inteira atomicamente. Ambos continuaram íntegros. | **APROVADO** |
| 6 | **Proteção de Exclusão em Subject** | Tentativa de excluir `Subject` quando tópicos vinculados possuem `StudySession`. | Bloqueio imediato pelo PostgreSQL via chave estrangeira restritiva de `StudySession -> Topic`. | **APROVADO** |
| 7 | **onDelete: SetNull** | Ao excluir registros pais em relações opcionais (`rescheduled_from`, `planned_session_id`, `block_id` em eventos/prática, metas), os campos dependentes devem se tornar `NULL` sem corromper os filhos. | Validado com sucesso: campos migraram para `NULL` e registros filhos mantidos intactos. | **APROVADO** |
| 8 | **Unicidade Estrita (@unique)** | Inserção de e-mails duplicados em `User` e múltiplas avaliações em `SessionEvaluation` (relação 1:1). | Ambas as tentativas foram bloqueadas com erro `P2002` (violação de restrição única). | **APROVADO** |
| 9 | **Deleção em Cascata Raiz (User)** | Exclusão do usuário raiz deve limpar em cascata todas as tabelas dependentes. | Criação de grafo completo nas 11 tabelas. Exclusão do usuário resultou em exatamente 0 registros remanescentes nas 11 tabelas. | **APROVADO** |
| 10 | **Valores Padrão e Enums** | Campos com `@default` (`timezone`, `week_starts_on`, `archived`, `priority`, `status`) devem assumir os valores definidos pelo contexto. | Todos os valores padrão conferidos rigorosamente. | **APROVADO** |

---

## 4. Análise de Superfície de Ataque e Recomendações para os Próximos Marcos

Durante os testes adversariais, foram identificados pontos de atenção arquitetural importantes para orientar a implementação dos próximos marcos:

### 4.1 Comportamento de Exclusão de Matéria vs Sessões Planejadas
- **Constatação Empírica**: No PostgreSQL, a tabela `subjects` possui relação `onDelete: Cascade` direta com `planned_sessions` e com `topics`. Caso uma matéria seja excluída diretamente pelo banco, sessões planejadas seriam apagadas em cascata caso não haja `StudySession`.
- **Requisito de Negócio (R3 & Critérios F2)**: "Exclusão definitiva permitida apenas quando não houver sessões vinculadas (planejadas ou executadas) ao item ou a seus descendentes; caso haja, a API recusa e orienta a arquivar."
- **Recomendação para o Marco 3 (`worker_m3`)**: O serviço de Matérias (`DELETE /api/subjects/:id`) deve obrigatoriamente fazer a verificação explícita na camada de aplicação antes de emitir a deleção no Prisma, verificando a existência de qualquer `PlannedSession` ou `StudySession` em toda a árvore da matéria e retornando HTTP 400/409 caso existam.

### 4.2 Invariantes Numéricos e Regras Temporais
- **Constatação**: O Prisma ORM não gera cláusulas `CHECK (planned_minutes > 0)` no DDL por padrão.
- **Recomendação para o Marco 2 e 3**: A validação com Zod (`packages/domain`) deve garantir que `planned_minutes`, `questions`, `correct` e `declared_seconds` sejam estritamente inteiros positivos e que `correct <= questions`. O `@estudos/domain` já possui esquemas Zod preparados para isso, devendo ser consumidos nos middlewares da API.

---

## 5. Validação da Suíte do Repositório

Além dos testes adversariais de banco de dados, a integridade de compilação e testes do repositório foi verificada:
- `npm test`: 3 suítes, 20 testes passando (100% de sucesso).
- `npm run typecheck`: `tsc -b` executado sem nenhum erro de tipagem.
- `npm run build`: Compilação de `@estudos/domain`, `@estudos/api` e `@estudos/web` concluída com êxito.

---

## 6. Conclusão

O Milestone 1 atende integralmente a todos os critérios de aceitação e integridade exigidos. O veredito é **APPROVE**, liberando o projeto para o início imediato do **Milestone 2 (Autenticação, Sessão e Layout Base)**.
