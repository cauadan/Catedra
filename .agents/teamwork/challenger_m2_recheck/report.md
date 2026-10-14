# Relatório de Re-verificação e Desafio Empírico: Marco 2 (Milestone 2 Recheck)

**Data:** 2026-10-06  
**Auditor / Desafiador Empírico:** `challenger_m2_recheck`  
**Escopo:** Re-verificação empírica da correção da condição de corrida de concorrência em `apps/api/src/services/auth.service.ts` e estabilidade da suíte de testes (`apps/api/tests/adversarial-auth.test.ts`, monorepo `npm test`, `npm run typecheck`)  
**Veredito Oficial:** **REQUEST_CHANGES** (Solicitação de Alterações)

---

## 1. Resumo Executivo da Auditoria Adversarial (Challenge Summary)

**Avaliação Geral de Risco:** **MÉDIO** (MEDIUM)

A implementação de correção em `apps/api/src/services/auth.service.ts` desenvolvida por `worker_m2_remediation` cumpriu o objetivo fundamental de infraestrutura: capturar o erro `PrismaClientKnownRequestError` com código `P2002` no método `prisma.user.create` e retornar `{ success: false, reason: 'conflict' }`, eliminando 100% dos erros HTTP 500 decorrentes de violação de chave única no banco de dados PostgreSQL.

Entretanto, uma auditoria empírica estrita com múltiplas execuções e sob carga do monorepo comprovou que **a suíte de testes adversariais (`tests/adversarial-auth.test.ts`) possui uma asserção de teste intermitente (flaky test) na verificação de concorrência**. A asserção da linha 389-392 presume erroneamente que as requisições assíncronas concorrentes disparadas em paralelo via `Promise.all` sempre serão concluídas com a primeira requisição do array vencendo a corrida. 

Quando outra requisição concorrente adquire a trava de inserção primeiro no PostgreSQL, o status `201` é retornado em outro índice do array (ex.: `[409, 409, 201, 409, 409]`), resultando em falha da suíte com taxa de erro empírica de 60% (3 falhas em 5 execuções isoladas) e quebrando o comando obrigatório do monorepo (`npm test` com 61/62 testes passando).

---

## 2. Desafios e Resultados de Estresse (Challenges)

### Desafio 1 [MÉDIO / ALTO]: Asserção Não-Determinística e Flakiness em Teste de Concorrência

- **Suposição Desafiada:** A suposição de que a ordem dos elementos retornados por `Promise.all` em requisições paralelas refletirá deterministicamente `statuses: [201, 409, 409, 409, 409]`, assumindo que a requisição de índice 0 sempre completará a inserção relacional antes das demais.
- **Cenário de Ataque / Falha:**
  1. Em ambientes com agendamento de threads assíncronas do Node.js, pool de conexões do Prisma ou execução paralela de testes de outros workspaces (`npm test`), qualquer uma das 5 requisições pode alcançar o banco e completar o `create` primeiro.
  2. As 4 requisições restantes falham na chave única e recebem corretamente HTTP 409.
  3. No entanto, `expect({ statuses, conflictCount }).toEqual({ statuses: [201, 409, 409, 409, 409], conflictCount: 4 })` compara a ordem exata das posições no array.
  4. Quando a requisição vencedora for de índice 1, 2, 3 ou 4, a asserção lança `AssertionError: expected { ... } to deeply equal { ... }`, reprovando o teste mesmo com o backend se comportando de forma 100% correta.
- **Raio de Destruição (Blast Radius):**
  - Quebra de pipelines de integração contínua (CI/CD) de forma intermitente.
  - O comando obrigatório `npm test` da raiz do repositório falha aleatoriamente (código de saída 1).
  - Falsos positivos que mascaram a integridade real do sistema.
- **Mitigação Recomendada:**
  Em `apps/api/tests/adversarial-auth.test.ts`, ajustar a asserção das linhas 389-393 para ordenar o array antes da validação ou validar as contagens e a ausência de códigos divergentes:
  ```typescript
  // Diagnóstico empírico: 1 sucesso (201) e 4 conflitos (409)
  expect(successCount).toBe(1);
  expect(conflictCount).toBe(4);
  const sortedStatuses = [...statuses].sort((a, b) => a - b);
  expect(sortedStatuses).toEqual([201, 409, 409, 409, 409]);
  ```

---

## 3. Resultados Detalhados dos Testes Empíricos

| Cenário de Teste | Comportamento Esperado | Comportamento Obtido | Resultado |
|---|---|---|---|
| Suíte Adversarial Isolada (`npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts`) - Execução 1 | 26/26 Aprovados | 26/26 Aprovados (2.47s) | **PASS** |
| Suíte Adversarial Isolada - Execuções Repetidas (Bateria de 5 execuções) | 5/5 Aprovados | 2 Aprovados, 3 Reprovados (Falha em `statuses: [409, ...]`) | **FAIL** (Taxa de falha 60%) |
| Suíte Global do Monorepo (`npm test`) - Execução 1 | 62/62 Aprovados | 61/62 Aprovados (1 falha em `adversarial-auth.test.ts`) | **FAIL** |
| Suíte Global do Monorepo (`npm test`) - Execução 2 | 62/62 Aprovados | 61/62 Aprovados (1 falha em `adversarial-auth.test.ts`) | **FAIL** |
| Checagem Estática de Tipagem (`npm run typecheck`) | 0 erros (`tsc -b`) | 0 erros (`tsc -b` concluído com sucesso) | **PASS** |
| Resiliência a Erro 500 no Backend (`auth.service.ts`) | 0 erros HTTP 500 sob concorrência | 0 erros HTTP 500 (100% dos erros P2002 mapeados para 409) | **PASS** |
| Integridade Relacional no PostgreSQL | Exatamente 1 usuário criado no banco | `users.length === 1` em todas as tentativas concorrentes | **PASS** |

---

## 4. Áreas Não Desafiadas (Unchallenged Areas)

- **Fluxos das Fases 3 a 6 (Cronômetro, Metas, Estatísticas):** Fora do escopo do Marco 2.
- **Frontend E2E completo no navegador:** Focado nesta rodada na camada de persistência da API e resiliência a concorrência.

---

## 5. Veredito Oficial e Ações Requeridas

**Veredito:** **REQUEST_CHANGES**

O código da aplicação em `auth.service.ts` está correto e resolve a condição de corrida. Porém, a suíte de testes de concorrência em `adversarial-auth.test.ts` introduziu uma asserção frágil que quebra `npm test` e impede a aprovação com determinismo.

**Ação Necessária:**
1. Atualizar a asserção de linha 389-393 de `apps/api/tests/adversarial-auth.test.ts` para ordenar `statuses` antes do `toEqual` (ou verificar `sortedStatuses`).
2. Reexecutar `npm test` e garantir 62/62 testes passando determinística e repetidamente.
