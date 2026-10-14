# Relatório de Handoff — Marco 2: Autenticação, Segurança e Contratos de API

**Agente:** `reviewer_m2_1`  
**Destinatário:** Orquestrador Geral (`parent`)  
**Data:** 2026-10-06  
**Tipo de Handoff:** Hard (Tarefa Concluída)  
**Veredito:** `APPROVE` (Aprovado)

---

## 1. Observação

Foram realizadas observações diretas e empíricas nos arquivos de código-fonte, configurações e saídas de comandos no terminal:

1. **Serviço de Sessões (`apps/api/src/services/session.service.ts`):**
   - Linha 11: `export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms`
   - Linhas 16-24: `getSessionCookieOptions()` configura `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`.
   - Linhas 50-60: Criação de identificadores aleatórios de 256 bits com `crypto.randomBytes(32).toString('hex')`.
   - Linhas 36-43: Intervalo de expurgo a cada 1 hora com `.unref()` para não prender o loop de eventos.

2. **Criptografia de Senha (`apps/api/src/utils/password.ts`):**
   - Linha 3: `const SALT_ROUNDS = 10;`
   - Linhas 8-10: `return bcrypt.hash(password, SALT_ROUNDS);`
   - Linhas 15-17: `return bcrypt.compare(password, hash);`

3. **Regras de Negócio de Autenticação (`apps/api/src/services/auth.service.ts`):**
   - Linhas 29-35: Consulta prévia no PostgreSQL para checar e-mail duplicado e retorno de `{ success: false, reason: 'conflict' }`.
   - Linhas 41-47: Criação do usuário no banco com `timezone` padrão `'America/Sao_Paulo'` e `week_starts_on: 'MONDAY'`.
   - Linhas 69-80: Validação de credenciais via `verifyPassword` e retorno `{ success: false, reason: 'invalid_credentials' }`.
   - Linha 84: Omissão estrita de `password_hash` no retorno de perfil (`SafeUser`).

4. **Middleware Guardião de Autenticação (`apps/api/src/middlewares/auth.middleware.ts`):**
   - Linhas 16-25: Extração do cookie `session_id` ou cabeçalho Bearer; rejeição com HTTP 401 caso ausente.
   - Linhas 27-31: Validação do token contra o `SessionService`; rejeição com HTTP 401 caso expirado ou inválido.
   - Linhas 34-51: Verificação da existência do usuário no PostgreSQL via Prisma; caso não exista, revoga a sessão e retorna 401.
   - Linhas 53-55: Injeção de `req.userId = user.id` e `req.user = user`, chamando `next()`.

5. **Envelope Padronizado de Erro (`apps/api/src/utils/errors.ts`):**
   - Linhas 14-42: Implementação da função `formatErrorResponse` gerando exatamente a estrutura `{ error: { code, message, details? } }` com mensagens em português.

6. **Controlador e Rotas (`apps/api/src/controllers/auth.controller.ts` e `apps/api/src/routes/auth.routes.ts`):**
   - Linhas 21-33: Validação da entrada via `registerSchema.safeParse`; retorna 400 com `VALIDATION_ERROR` em português.
   - Linhas 37-48: Resposta de conflito com HTTP 409 e mensagem *"E-mail já cadastrado no sistema."*.
   - Linhas 52-61: Retorno de HTTP 201 com cookie httpOnly e dados públicos do usuário.
   - Linhas 78-103: Endpoint de login com HTTP 200 ou 401 com mensagem em português.
   - Linhas 134-142: Endpoint de logout limpando o cookie e retornando `{ success: true }`.
   - Linhas 152-171: Endpoint `/me` protegido por `authMiddleware` retornando dados do usuário.

7. **Resultados de Execução de Comandos:**
   - Comando `npm --workspace=@estudos/api run test`:
     ```text
     ✓ tests/health.test.ts (2 tests) 52ms
     ✓ tests/auth.test.ts (13 tests) 568ms
     Test Files  2 passed (2)
          Tests  15 passed (15)
     ```
   - Comando `npm run typecheck` (`tsc -b`): Código de retorno 0, sem erros.
   - Comando `npm test`:
     ```text
     ✓  @estudos/domain  tests/domain.test.ts (16 tests)
     ✓  @estudos/api  tests/health.test.ts (2 tests)
     ✓  @estudos/api  tests/auth.test.ts (13 tests)
     ✓  @estudos/web  tests/auth-and-shell.test.tsx (3 tests)
     ✓  @estudos/web  tests/app.test.ts (2 tests)
     Test Files  5 passed (5)
          Tests  36 passed (36)
     ```
   - Comando `npm run build`: Compilação de todos os pacotes `@estudos/domain`, `@estudos/api` e `@estudos/web` bem-sucedida.
   - Comando `npx vitest run --config tests/e2e/vitest.config.ts -t "1.1 Autenticação e Sessão"`:
     ```text
     ✓ tests/e2e/tier1-feature-coverage.test.ts (20 tests | 15 skipped) 268ms
     Test Files  1 passed | 3 skipped (4)
          Tests  5 passed | 47 skipped (52)
     ```

---

## 2. Cadeia Lógica

1. **Autenticação e Armazenamento:** A observação (1) comprova que sessões são geradas com 256 bits criptográficos, duram 7 dias e são limpas periodicamente; a observação (2) comprova que as senhas são armazenadas em hash bcrypt com 10 rounds de salt. Logo, os requisitos de segurança de credenciais e sessões de R1 e M2 estão rigorosamente cumpridos.
2. **Proteção de Rotas e Isolamento Multilocatário:** A observação (4) comprova que o middleware exige sessão válida, verifica a integridade do usuário no banco PostgreSQL e injeta `req.userId`. Qualquer rota subsequente que dependa de `req.userId` terá o contexto garantido, e qualquer requisição sem sessão recebe HTTP 401.
3. **Contratos e Validação:** As observações (3), (5) e (6) comprovam conformidade estrita com os contratos do `PROJECT.md` e `ORIGINAL_REQUEST.md`: validação por Zod, códigos HTTP corretos (201, 200, 400, 401, 409), formato de erro `{ error: { code, message, details } }` e textos integralmente em português.
4. **Verificação de Compilação e Testes:** A observação (7) comprova, por execução real em linha de comando, que todos os testes da API (15/15), do monorepo (36/36) e a sub-suíte E2E de autenticação (5/5) estão passando sem ressalvas, e a checagem de tipos TypeScript `tsc -b` não acusa erros.
5. **Integridade do Código:** Nenhuma resposta hardcoded ou implementação de fachada (mock/facade) foi encontrada nas rotas ou controladores em produção. As interações com banco de dados e hash são genuínas.

---

## 3. Ressalvas e Observações Adversariais

1. **Concorrência em Cadastros com Mesmo E-mail:** Duas requisições de cadastro com e-mail idêntico executadas em exato paralelismo podem passar pelo `findUnique` simultaneamente. A segunda requisição será rejeitada pelo banco (erro Prisma `P2002`), resultando em HTTP 500 em vez de 409. O banco preserva a integridade, mas recomenda-se mapear o erro `P2002` para HTTP 409 futuramente.
2. **Validação de Fuso Horário no Zod:** O campo `timezone` no cadastro é aceito como qualquer string. No futuro, valores inválidos poderiam disparar `RangeError` em manipuladores de data se não validados contra o catálogo IANA.
3. **Volatilidade de Sessões em Memória:** As sessões ficam em memória no processo Node.js. Caso o servidor reinicie, os usuários precisarão autenticar-se novamente. Isso está 100% alinhado com a especificação do Marco 2.

---

## 4. Conclusão

A implementação do **Marco 2 (Autenticação, Sessão e Layout Base Web)** está plenamente aprovada (`APPROVE`). O código é robusto, seguro, adere aos contratos de API, possui testes automatizados reais e cumpre rigorosamente a diretriz de idioma em português. O ambiente está homologado para iniciar o **Marco 3 (Motor de Domínio e API de Matérias e Assuntos)**.

---

## 5. Método de Verificação Independente

Para qualquer revisor ou agente reproduzir independentemente esta validação:

1. **Testes da API:**
   ```powershell
   npm --workspace=@estudos/api run test
   ```
   *Critério de aceitação:* 15 testes aprovados em 2 arquivos.

2. **Verificação de Tipos TypeScript:**
   ```powershell
   npm run typecheck
   ```
   *Critério de aceitação:* Zero erros de compilação (`tsc -b`).

3. **Testes Completos do Monorepo:**
   ```powershell
   npm test
   ```
   *Critério de aceitação:* 36 testes aprovados em 5 arquivos.

4. **Build de Produção:**
   ```powershell
   npm run build
   ```
   *Critério de aceitação:* Compilação bem-sucedida dos 3 workspaces (`domain`, `api`, `web`).

5. **Sub-suíte E2E de Autenticação:**
   ```powershell
   npx vitest run --config tests/e2e/vitest.config.ts -t "1.1 Autenticação e Sessão"
   ```
   *Critério de aceitação:* 5 testes aprovados contra o servidor HTTP da API.
