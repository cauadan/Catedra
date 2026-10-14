# Handoff Report: Re-verificação Empírica do Marco 2

**Agente:** `challenger_m2_recheck`  
**Tipo de Handoff:** Hard (Avaliação e Re-verificação Completa Concluída)  
**Data:** 2026-10-06  

---

## 1. Observação (Observation)

1. **Execução de `npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts` (1ª tentativa):**
   O teste passou com 26/26 testes aprovados em 2472ms. O log do console exibiu mensagens `prisma:error` indicando que a restrição única (`email`) foi acionada durante `prisma.user.create` e capturada pelo bloco `try/catch`.
2. **Execução de `npm test` na raiz do monorepo (2 tentativas consecutivas):**
   Em ambas as execuções, o comando falhou com código de saída 1:
   ```text
    FAIL   @estudos/api  tests/adversarial-auth.test.ts > Auditoria Adversarial de Segurança: Autenticação e Sessão (@estudos/api) > 3. Rejeição de E-mail Duplicado (HTTP 409) e Normalização > deve resistir a condição de corrida em cadastros simultâneos com mesmo e-mail (concorrência)
   AssertionError: expected { …(2) } to deeply equal { …(2) }

   - Expected
   + Received

     {
       "conflictCount": 4,
       "statuses": [
   -     201,
         409,
         409,
         409,
   +     201,
         409,
       ],
     }

    ❯ tests/adversarial-auth.test.ts:389:43
       387|       expect(successCount).toBe(1);
       388|       // Se não for 409, documentar exatamente o que foi recebido (ex:…
       389|       expect({ statuses, conflictCount }).toEqual({
          |                                           ^
       390|         statuses: [201, 409, 409, 409, 409],
       391|         conflictCount: 4,

    Test Files  1 failed | 5 passed (6)
         Tests  1 failed | 61 passed (62)
   ```
3. **Bateria empírica repetida de 5 execuções isoladas:**
   - Execução 1: PASS
   - Execução 2: FAIL
   - Execução 3: FAIL
   - Execução 4: PASS
   - Execução 5: FAIL
   (Taxa de reprovação: 60%, 3 falhas em 5 execuções).
4. **Execução de `npm run typecheck` (`tsc -b`):**
   Concluída com código de saída 0 e zero erros de compilação TypeScript em todos os pacotes.
5. **Inspeção de `apps/api/src/services/auth.service.ts` (linhas 41-73):**
   ```typescript
   try {
     const user = await prisma.user.create({ ... });
     const sessionId = sessionService.createSession(user.id);
     return { success: true, user, sessionId };
   } catch (error) {
     if (
       error instanceof Prisma.PrismaClientKnownRequestError &&
       error.code === 'P2002'
     ) {
       return { success: false, reason: 'conflict' };
     }
     throw error;
   }
   ```
6. **Inspeção de `apps/api/tests/adversarial-auth.test.ts` (linhas 369-393):**
   ```typescript
   const promises = Array.from({ length: 5 }).map((_, index) =>
     request(app)
       .post('/api/auth/register')
       .send({
         name: `Concorrente ${index}`,
         email: raceEmail,
         password: `SenhaSegura${index}!`,
       })
   );

   const results = await Promise.all(promises);

   const statuses = results.map((r) => r.status);
   const bodies = results.map((r) => r.body);
   const successCount = statuses.filter((s) => s === 201).length;
   const conflictCount = statuses.filter((s) => s === 409).length;

   expect(successCount).toBe(1);
   expect({ statuses, conflictCount }).toEqual({
     statuses: [201, 409, 409, 409, 409],
     conflictCount: 4,
   });
   ```

---

## 2. Cadeia Lógica (Logic Chain)

1. A observação 5 demonstra que `auth.service.ts` captura devidamente o erro `P2002` do Prisma Client e retorna `{ success: false, reason: 'conflict' }`, gerando HTTP 409 CONFLICT no controlador e evitando qualquer HTTP 500.
2. A observação 2 e 3 mostram que, em todas as execuções (mesmo as que falharam na asserção), `successCount` foi exatamente 1 e `conflictCount` foi exatamente 4, sem ocorrência de status 500 e com apenas 1 registro inserido no banco de dados PostgreSQL.
3. A observação 6 evidencia que as requisições são disparadas em paralelo via `Promise.all(promises)`. Em ambientes assíncronos e sob carga de I/O de rede e banco, o agendamento de qual requisição chega e adquire a trava de inserção no PostgreSQL primeiro não é garantidamente a de índice 0 (`Concorrente 0`).
4. Quando a requisição que vence a corrida é a de índice 1, 2, 3 ou 4, o array `statuses` preserva a ordem do array de promises original, resultando em retornos como `[409, 409, 201, 409, 409]` ou `[409, 409, 409, 201, 409]`.
5. A asserção da linha 389 de `adversarial-auth.test.ts` exige que a posição [0] seja estritamente `201`, tornando o teste inerentemente intermitente (flaky).
6. Por conseguinte, a observação 2 confirma que `npm test` falha com código 1, violando o critério de que todos os 62 testes do monorepo devem passar.

---

## 3. Ressalvas (Caveats)

- A lógica de negócio em si em `apps/api/src/services/auth.service.ts` é sólida e corrigiu o vazamento do erro P2002 de integridade relacional.
- A vulnerabilidade encontrada não é do código em produção, mas da asserção do harness de teste adversarial.
- Não foram testados cenários com outros provedores de banco de dados (ex: SQLite), visto que o ambiente do projeto é estritamente PostgreSQL via Docker.

---

## 4. Conclusão (Conclusion)

O veredito oficial é **REQUEST_CHANGES**.

Embora a correção em `apps/api/src/services/auth.service.ts` seja eficaz e elimine o erro 500, o critério de aceitação de que `npm test` passe integralmente (62/62) não é atendido de forma confiável devido a um teste flaky em `apps/api/tests/adversarial-auth.test.ts`.

A correção é pontual e imediata: ordenar o array `statuses` antes da asserção de igualdade em `tests/adversarial-auth.test.ts`:
```typescript
const sortedStatuses = [...statuses].sort((a, b) => a - b);
expect({ statuses: sortedStatuses, conflictCount }).toEqual({
  statuses: [201, 409, 409, 409, 409],
  conflictCount: 4,
});
```

---

## 5. Método de Verificação (Verification Method)

Para verificar independentemente estas conclusões:

1. **Executar a suíte completa na raiz:**
   ```powershell
   npm test
   ```
   Observar que o teste de concorrência em `adversarial-auth.test.ts` falha com `AssertionError` quando outro índice recebe o código 201.

2. **Executar múltiplas repetições da suíte adversarial:**
   ```powershell
   npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts
   ```
   Executar 5 vezes e constatar a taxa de intermitência.

3. **Verificar tipagem estática:**
   ```powershell
   npm run typecheck
   ```
   Confirmar 0 erros (`tsc -b`).

4. **Condição de Invalidação:**
   Se uma execução demonstrar retorno de HTTP 500 ou múltiplos registros criados no banco de dados para o mesmo e-mail, a lógica de negócio em `auth.service.ts` seria invalidada. Como isso não ocorreu, a lógica de aplicação permanece validada.
