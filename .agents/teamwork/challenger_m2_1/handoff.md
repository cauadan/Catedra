# Relatório de Handoff Formal: Auditoria Adversarial do Marco 2

**Autor:** `challenger_m2_1`  
**Destinatário:** Orquestrador Geral / `worker_m2`  
**Tipo de Handoff:** Hard (com solicitação pontual de correções - REQUEST_CHANGES)  
**Data:** 2026-10-06  

---

## 1. Observações (Observation)

1. **Disponibilidade do Banco de Dados:**
   - Comando executado: `npm run db:wait`
   - Saída obtida:
     ```text
     [wait-for-db] Aguardando inicialização do PostgreSQL em 127.0.0.1:5432...
     [wait-for-db] Sucesso: PostgreSQL está pronto e acessível em 127.0.0.1:5432!
     ```

2. **Execução da Suíte Existente de Testes de Autenticação:**
   - Comando executado: `npm --workspace=@estudos/api run test -- tests/auth.test.ts`
   - Saída obtida:
     ```text
     ✓ tests/auth.test.ts (13 tests) 633ms
     Test Files  1 passed (1)
          Tests  13 passed (13)
     ```

3. **Execução da Suíte de Testes Adversariais (`apps/api/tests/adversarial-auth.test.ts`):**
   - Comando executado: `npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts`
   - Saída obtida: 25 testes passaram e 1 teste falhou.
   - Trecho verbatim do log de erro e falha da asserção:
     ```text
     [ERRO INTERNO DO SERVIDOR]: PrismaClientKnownRequestError: 
     Invalid `prisma.user.create()` invocation:
     Unique constraint failed on the fields: (`email`)
         at AuthService.register (C:\Users\cauad\Documents\Estudos\apps\api\src\services\auth.service.ts:40:18)
         at register (C:\Users\cauad\Documents\Estudos\apps\api\src\controllers\auth.controller.ts:35:22) {
       code: 'P2002',
       meta: { modelName: 'User', target: [ 'email' ] },
       clientVersion: '6.19.3'
     }

     FAIL  tests/adversarial-auth.test.ts > Auditoria Adversarial de Segurança: Autenticação e Sessão (@estudos/api) > 3. Rejeição de E-mail Duplicado (HTTP 409) e Normalização > deve resistir a condição de corrida em cadastros simultâneos com mesmo e-mail (concorrência)
     AssertionError: expected { …(2) } to deeply equal { …(2) }

     - Expected
     + Received

       {
     -   "conflictCount": 4,
     +   "conflictCount": 0,
         "statuses": [
           201,
     -     409,
     -     409,
     -     409,
     -     409,
     +     500,
     +     500,
     +     500,
     +     500,
         ],
       }
     ```

4. **Código-fonte em `apps/api/src/services/auth.service.ts` (linhas 29-47):**
   ```typescript
   29:     const existingUser = await prisma.user.findUnique({
   30:       where: { email: normalizedEmail },
   31:     });
   32: 
   33:     if (existingUser) {
   34:       return { success: false, reason: 'conflict' };
   35:     }
   36: 
   37:     const passwordHash = await hashPassword(dto.password);
   38:     const timezone = dto.timezone?.trim() || 'America/Sao_Paulo';
   39: 
   40:     const user = await prisma.user.create({
   ...
   ```
   Não há bloco `try/catch` em torno de `prisma.user.create` nem verificação de erros com código `P2002` do Prisma.

5. **Auditoria Forense de Criptografia no PostgreSQL:**
   - Registro consultado na tabela `users` para o usuário de auditoria:
     * `password_hash`: string com 60 caracteres iniciada por `$2b$10$` (formato autêntico do bcrypt).
     * `password_hash !== plainPassword` e não contém o texto plano como substring.
     * `bcrypt.compare(plainPassword, user.password_hash)` retornou `true`.
     * `bcrypt.compare('wrong', user.password_hash)` retornou `false`.

6. **Auditoria das Flags de Cookie `Set-Cookie`:**
   - Respostas de `/api/auth/register` e `/api/auth/login` emitem o cabeçalho `Set-Cookie` contendo `session_id=...`, `HttpOnly`, `SameSite=Lax` e `Path=/`.
   - Resposta de `/api/auth/logout` emite `Set-Cookie` com `Expires=Thu, 01 Jan 1970 00:00:00 GMT` / `Max-Age=0` preservando a flag `HttpOnly`.

---

## 2. Cadeia Lógica (Logic Chain)

1. A especificação em `PROJECT.md` estabelece no contrato de interface do endpoint `POST /api/auth/register` que a resposta para duplicidade de e-mail deve ser HTTP 409 (`CONFLICT`), e todas as respostas de erro devem seguir o envelope `{ error: { code, message, details } }` em português.
2. A observação 4 demonstra que o método `AuthService.register` realiza uma checagem preliminar `findUnique`, seguida pelo cálculo assíncrono do hash bcrypt (`hashPassword`), antes de executar `prisma.user.create`.
3. Como o cálculo de hash consome cerca de 80ms a 100ms de CPU, existe uma janela temporal onde múltiplas requisições paralelas com o mesmo e-mail encontram `existingUser === null`.
4. Ambas as requisições prosseguem e invocam `prisma.user.create`. A primeira requisição tem sucesso, enquanto as requisições subsequentes colidem na restrição `@unique` do PostgreSQL na coluna `email`, gerando a exceção `PrismaClientKnownRequestError` com código `P2002` (Observação 3).
5. Como o `AuthService.register` não trata essa exceção (Observação 4), ela propaga pelo controlador Express até o middleware genérico de erro 500 em `apps/api/src/app.ts`.
6. Por conseguinte, conforme comprovado na Observação 3, as requisições concorrentes recebem **HTTP 500 INTERNAL_ERROR** em vez de **HTTP 409 CONFLICT**, violando o contrato de interface especificado.
7. Em contrapartida, as demais invariantes obrigatórias (rejeição de cookies maliciosos/expirados com 401, mitigação de injeção SQL, hash real de senhas e cookies httpOnly) foram plenamente verificadas e validadas (Observações 1, 2, 5 e 6).

---

## 3. Ressalvas e Limitações (Caveats)

- **Persistência de Sessões em Memória:** O `SessionService` armazena sessões em memória RAM (`Map`). Não foram investigados cenários de perda de estado após reinicialização da API, dado que o escopo atual é mono-instância local de desenvolvimento (Fases 1 e 2).
- **Controle de Força Bruta (Rate Limiting):** Não existe limitação de taxa de requisições por IP no Express. Esse comportamento não viola os requisitos funcionais do Marco 2, mas é uma recomendação de melhoria para produção.
- **Validação de Timezone:** O esquema Zod aceita strings genéricas no campo `timezone` sem validar contra a lista oficial da IANA.

---

## 4. Conclusão (Conclusion)

O Marco 2 está quase integralmente aprovado em suas invariantes de segurança fundamentais (criptografia de senhas, proteção por cookies httpOnly, isolamento de rotas e mitigação de injeção SQL).

No entanto, em virtude do bug de concorrência que resulta em HTTP 500 no cadastro simultâneo de e-mails duplicados, o veredito oficial é **REQUEST_CHANGES**.

**Ação Corretiva Específica:**
O agente responsável (`worker_m2`) deve envolver a chamada `prisma.user.create` em `apps/api/src/services/auth.service.ts` em um bloco `try/catch` que intercepte erros do tipo `PrismaClientKnownRequestError` com `error.code === 'P2002'`, retornando `{ success: false, reason: 'conflict' }`, para que o `AuthController` responda com **HTTP 409 CONFLICT** padronizado.

---

## 5. Método de Verificação Independente (Verification Method)

Para verificar independentemente a correção deste apontamento:

1. **Executar a suíte de testes adversariais:**
   ```powershell
   npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts
   ```
   *Condição de invalidação do relatório:* Todos os 26 testes devem passar (26 passed). Se o teste de concorrência passar com status 409 para as 4 requisições conflitantes, o bug foi sanado com sucesso.

2. **Executar a suíte completa de testes do monorepo:**
   ```powershell
   npm test
   ```
   *Condição de aprovação:* Todos os testes dos 3 workspaces (`@estudos/domain`, `@estudos/api`, `@estudos/web`) devem passar sem nenhuma falha.
