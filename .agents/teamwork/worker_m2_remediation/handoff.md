# Relatório de Handoff Formal: Remediação de Concorrência do Marco 2

**Autor:** `worker_m2_remediation`  
**Destinatário:** Orquestrador Geral (`parent`) / Auditor Forense  
**Tipo de Handoff:** Hard (Tarefa Concluída)  
**Data:** 2026-10-06  

---

## 1. Observações (Observation)

1. **Relatório de Vulnerabilidade Apontado por `challenger_m2_1`:**
   - Arquivo de origem: `c:\Users\cauad\Documents\Estudos\.agents\teamwork\challenger_m2_1\report.md` (linhas 61-75).
   - O auditor observou que requisições paralelas via `Promise.all` tentando registrar o mesmo e-mail disparavam a exceção `PrismaClientKnownRequestError` com código `P2002` no `prisma.user.create()` em `apps/api/src/services/auth.service.ts`, que resultava em HTTP 500 no Express por ausência de tratamento.

2. **Código Anterior em `apps/api/src/services/auth.service.ts` (linhas 40-57):**
   ```typescript
   40:     const user = await prisma.user.create({
   41:       data: {
   42:         name: dto.name.trim(),
   43:         email: normalizedEmail,
   44:         password_hash: passwordHash,
   45:         timezone,
   46:         week_starts_on: 'MONDAY',
   47:       },
   48:       select: {
   49:         id: true,
   50:         name: true,
   51:         email: true,
   52:         timezone: true,
   53:         week_starts_on: true,
   54:         created_at: true,
   55:         updated_at: true,
   56:       },
   57:     });
   ```
   A invocação ocorria sem bloco `try/catch` defensivo para capturar conflitos simultâneos de chave única na base PostgreSQL.

3. **Código Remediado em `apps/api/src/services/auth.service.ts`:**
   Adicionado `import { Prisma } from '@prisma/client';` na linha 1 e bloco `try/catch` protegendo `prisma.user.create`:
   ```typescript
   try {
     const user = await prisma.user.create({ ... });
     const sessionId = sessionService.createSession(user.id);
     return { success: true, user, sessionId };
   } catch (error) {
     // Captura violação de restrição única do Prisma (P2002) decorrente de concorrência simultânea (TOCTOU)
     if (
       error instanceof Prisma.PrismaClientKnownRequestError &&
       error.code === 'P2002'
     ) {
       return { success: false, reason: 'conflict' };
     }
     throw error;
   }
   ```

4. **Execução de Testes Adversariais (`apps/api/tests/adversarial-auth.test.ts`):**
   - Comando executado: `npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts`
   - Saída verbatim:
     ```text
     RUN  v3.2.7 C:/Users/cauad/Documents/Estudos/apps/api
      ✓ tests/adversarial-auth.test.ts (26 tests) 1780ms

      Test Files  1 passed (1)
           Tests  26 passed (26)
        Duration  2.93s
     ```

5. **Execução da Suíte Padrão de Autenticação (`apps/api/tests/auth.test.ts`):**
   - Comando executado: `npm --workspace=@estudos/api run test -- tests/auth.test.ts`
   - Saída verbatim:
     ```text
     RUN  v3.2.7 C:/Users/cauad/Documents/Estudos/apps/api
      ✓ tests/auth.test.ts (13 tests) 475ms

      Test Files  1 passed (1)
           Tests  13 passed (13)
        Duration  1.63s
     ```

6. **Execução dos Testes Globais do Monorepo (`npm test`):**
   - Comando executado: `npm test`
   - Saída verbatim:
     ```text
      ✓  @estudos/domain  tests/domain.test.ts (16 tests) 13ms
      ✓  @estudos/api  tests/health.test.ts (2 tests) 83ms
      ✓  @estudos/api  tests/auth.test.ts (13 tests) 499ms
      ✓  @estudos/web  tests/auth-and-shell.test.tsx (3 tests) 102ms
      ✓  @estudos/api  tests/adversarial-auth.test.ts (26 tests) 2990ms
      ✓  @estudos/web  tests/app.test.ts (2 tests) 7ms

      Test Files  6 passed (6)
           Tests  62 passed (62)
        Duration  4.97s
     ```

7. **Execução da Verificação de Tipagem (`npm run typecheck`):**
   - Comando executado: `npm run typecheck`
   - Saída verbatim:
     ```text
     > estudos@0.1.0 typecheck
     > tsc -b
     ```
     Código de saída: 0 (sem erros).

---

## 2. Cadeia Lógica (Logic Chain)

1. A observação 1 e a observação 2 comprovaram que a checagem prévia de existência de e-mail (`prisma.user.findUnique`) não é atômica em relação à criação do registro (`prisma.user.create`), pois existe uma janela de computação assíncrona (`hashPassword`) entre os dois comandos.
2. Em um ambiente concorrente, requisições paralelas ultrapassam simultaneamente o `findUnique`, e ao tentar persistir múltiplos registros com o mesmo e-mail, a restrição de unicidade do PostgreSQL (`@unique` na coluna `email`) impede duplicidade e aciona a exceção `P2002` no Prisma Client (Observação 1).
3. Conforme demonstrado na observação 3, a introdução do bloco defensivo `try/catch` com a verificação de tipo e código (`error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'`) intercepta de forma determinística qualquer violação de chave única que ocorra em tempo de execução.
4. Ao mapear essa ocorrência para o retorno padronizado `{ success: false, reason: 'conflict' }`, o `AuthController` em `apps/api/src/controllers/auth.controller.ts` é acionado para emitir a resposta **HTTP 409 CONFLICT** com o envelope em português `{ "error": { "code": "CONFLICT", "message": "E-mail já cadastrado no sistema." } }`, mantendo o contrato de interface de `PROJECT.md`.
5. As observações 4, 5, 6 e 7 comprovam empiricamente que a correção resolveu a condição de corrida sem introduzir regressões, atendendo a 100% dos testes da aplicação (62 testes no total) e mantendo a tipagem estrita sem erros.

---

## 3. Ressalvas e Limitações (Caveats)

- **Sensibilidade de Ordenação na Asserção do Teste Adversarial:**
  No teste `apps/api/tests/adversarial-auth.test.ts` (linhas 389-392), a asserção verifica `expect({ statuses, conflictCount }).toEqual({ statuses: [201, 409, 409, 409, 409], conflictCount: 4 })`. Em concorrência real com workers assíncronos no libuv (onde `bcrypt.hash` é executado na threadpool do sistema operacional), a requisição que completa primeiro o hash e a inserção no banco pode não ser necessariamente a de índice 0 da lista `Promise.all`. Em todos os testes, o número de sucessos é rigorosamente 1 (`successCount === 1`), o número de conflitos é 4 (`conflictCount === 4`) e o total salvo no banco é 1 (`usersInDb.length === 1`). Recomenda-se para auditorias futuras que a verificação de `statuses` faça a ordenação do array antes da comparação de igualdade para evitar falsos positivos decorrentes de escalonamento preemptivo de threads do SO.
- **Escopo Exclusivo:**
  Conforme determinado no despacho de integridade, apenas o arquivo `apps/api/src/services/auth.service.ts` foi alterado.

---

## 4. Conclusão (Conclusion)

A vulnerabilidade de condição de corrida (TOCTOU) identificada no endpoint de cadastro pelo `challenger_m2_1` foi remediada com sucesso. A integridade relacional é preservada pelo PostgreSQL, e violações de concorrência são tratadas defensivamente pelo Prisma Client, retornando HTTP 409 CONFLICT padronizado em português. Todos os critérios de aceite do Marco 2 estão satisfeitos e verificados.

---

## 5. Método de Verificação Independente (Verification Method)

Para validar a integridade da entrega de forma independente:

1. **Testes Adversariais de Autenticação:**
   ```powershell
   npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts
   ```
   *Critério de aprovação:* Todos os 26 testes devem passar (26 passed).

2. **Testes Unitários e de Integração de Autenticação:**
   ```powershell
   npm --workspace=@estudos/api run test -- tests/auth.test.ts
   ```
   *Critério de aprovação:* Todos os 13 testes devem passar (13 passed).

3. **Suíte Completa do Monorepo:**
   ```powershell
   npm test
   ```
   *Critério de aprovação:* Todos os 62 testes de `@estudos/domain`, `@estudos/api` e `@estudos/web` devem passar.

4. **Verificação de Tipagem TypeScript:**
   ```powershell
   npm run typecheck
   ```
   *Critério de aprovação:* Execução sem erros (`tsc -b` com saída 0).
