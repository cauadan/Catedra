# Relatório de Auditoria Adversarial e Desafio Empírico: Marco 2 (Milestone 2)

**Data:** 2026-10-06  
**Auditor / Desafiador Empírico:** `challenger_m2_1`  
**Escopo:** Autenticação Backend, Invariantes de Segurança, Integridade de Sessão e Persistência (`apps/api`, `packages/domain`, PostgreSQL)  
**Veredito Oficial:** **REQUEST_CHANGES** (Solicitação de Alterações)

---

## 1. Resumo Executivo da Auditoria Adversarial

**Avaliação Geral de Risco:** **MÉDIO** (MEDIUM)

O Marco 2 (Autenticação, Sessão e Layout Base) apresentou uma base técnica sólida: o algoritmo de hash de senhas utiliza bcrypt real com custo 10 e tamanho de 60 caracteres, os cookies são emitidos com a flag `httpOnly`, as rotas privadas bloqueiam tokens ausentes ou forjados com HTTP 401 padronizado em português, e a suíte padrão de testes de integração (`apps/api/tests/auth.test.ts`) passou com 13/13 sucessos.

Contudo, mediante a aplicação de testes adversariais empíricos de estresse e concorrência (`apps/api/tests/adversarial-auth.test.ts`), **foi identificada e comprovada empiricamente uma vulnerabilidade de condição de corrida (Race Condition / TOCTOU)** no endpoint de cadastro (`POST /api/auth/register`). Quando requisições simultâneas tentam cadastrar o mesmo endereço de e-mail, a aplicação falha ao capturar a violação de chave única lançada pelo Prisma Client (`P2002`), resultando no retorno de **HTTP 500 INTERNAL_ERROR** com despejo de stack trace no log do servidor, em vez do retorno de **HTTP 409 CONFLICT** padronizado em português exigido pelas especificações de `PROJECT.md`.

---

## 2. Verificação Empírica dos Critérios Obrigatórios

### 2.1 Disponibilidade e Conectividade do Banco de Dados
- **Comando Executado:** `npm run db:wait`
- **Resultado:**
  ```text
  [wait-for-db] Aguardando inicialização do PostgreSQL em 127.0.0.1:5432...
  [wait-for-db] Sucesso: PostgreSQL está pronto e acessível em 127.0.0.1:5432!
  ```
- **Avaliação:** **APROVADO**. O PostgreSQL 16 via Docker Compose está plenamente operacional na porta 5432.

---

### 2.2 Auditoria das Invariantes de Sessão e Cookies em Rotas Protegidas (`GET /api/auth/me`)
Foram submetidos vetores de ataque específicos contra o `authMiddleware`:
1. **Requisição sem cookie e sem cabeçalho Authorization:** Retorna HTTP 401 com envelope `{ "error": { "code": "UNAUTHORIZED", "message": "Não autorizado" } }` (**Aprovado**).
2. **Cookie vazio (`session_id=`):** Retorna HTTP 401 (**Aprovado**).
3. **Cookie composto apenas por espaços em branco (`session_id=   `):** Retorna HTTP 401 (**Aprovado**).
4. **Cookie com injeção SQL (`session_id=' OR 1=1 --`):** Retorna HTTP 401 (**Aprovado**).
5. **Cookie com token arbitrário forjado (64 caracteres hexadecimais):** Retorna HTTP 401 (**Aprovado**).
6. **Tentativa de DoS / Buffer Overflow via cookie gigante (15.000 caracteres):** Retorna HTTP 401 sem sobrecarregar a memória nem derrubar o processo Node.js (**Aprovado**).
7. **Cabeçalho `Authorization: Bearer` com token forjado ou vazio:** Retorna HTTP 401 (**Aprovado**).
8. **Sessão Expirada (TTL de 7 dias):** Utilizando avanço temporal de 8 dias via `vi.setSystemTime`, a requisição com o cookie anteriormente válido foi rejeitada com HTTP 401 e o registro expirado foi removido da memória (**Aprovado**).
9. **Usuário deletado do banco de dados com sessão viva em memória:** O middleware consulta o banco, detecta que o usuário não existe mais, purga a sessão órfã do `SessionService` e retorna HTTP 401 (**Aprovado**).

---

### 2.3 Auditoria contra Injeção SQL e Payloads Malformados (`/api/auth/register` e `/api/auth/login`)
1. **Injeção SQL em e-mail no cadastro (`admin' OR 1=1; --` e `test'; DROP TABLE users; --@estudos.test`):** O Zod intercepta o formato inválido e responde imediatamente com HTTP 400 `VALIDATION_ERROR` com mensagens explicativas em português (**Aprovado**).
2. **Injeção SQL no nome do usuário (`Robert'); DROP TABLE subjects;--`):** O Prisma parametriza a consulta adequadamente; o usuário é criado com o texto literal como nome, sem corrupção ou execução de comandos SQL no PostgreSQL (**Aprovado**).
3. **Bypass de autenticação no login com injeção SQL na senha (`' OR '1'='1`):** A verificação via `bcrypt.compare` falha de forma segura e o endpoint responde com HTTP 401 `UNAUTHORIZED` ("Credenciais inválidas. Verifique seu e-mail e senha.") (**Aprovado**).
4. **Tentativa de injeção SQL no e-mail durante o login:** Rejeitado pelo validador Zod com HTTP 400 `VALIDATION_ERROR` (**Aprovado**).
5. **Poluição de protótipo (`__proto__`) e tipos invertidos (números/arrays em vez de strings):** Rejeitados pelo Zod com HTTP 400 sem corrupção do protótipo global do Node.js (**Aprovado**).
6. **Strings longas (10.000 caracteres no nome):** Processadas e salvas com sucesso sem estouro de pilha (**Aprovado**).

---

### 2.4 Rejeição de E-mail Duplicado (HTTP 409) e Condição de Corrida
1. **Cadastro com mesmo e-mail sequencial:** Retorna HTTP 409 `CONFLICT` com a mensagem `"E-mail já cadastrado no sistema."` (**Aprovado**).
2. **Cadastro com e-mail em letras maiúsculas (`USUARIO@ESTUDOS.TEST` vs `usuario@estudos.test`):** Normalizado via `.toLowerCase().trim()` e rejeitado com HTTP 409 (**Aprovado**).
3. **Cadastro com espaços extras no e-mail (`  usuario@estudos.test  `):** Normalizado e rejeitado com HTTP 409 (**Aprovado**).
4. **CONCORRÊNCIA SIMULTÂNEA (5 requisições paralelas com mesmo e-mail inédito via `Promise.all`):**
   - **Comportamento Esperado:** 1 requisição com HTTP 201 e 4 requisições com HTTP 409 CONFLICT.
   - **Comportamento Real Observado:** 1 requisição com HTTP 201 e **4 requisições com HTTP 500 INTERNAL_ERROR**.
   - **Log de Erro Verbatim do Servidor:**
     ```text
     [ERRO INTERNO DO SERVIDOR]: PrismaClientKnownRequestError: 
     Invalid `prisma.user.create()` invocation:
     Unique constraint failed on the fields: (`email`)
         at ... (apps/api/src/services/auth.service.ts:40:18)
         at register (apps/api/src/controllers/auth.controller.ts:35:22) {
       code: 'P2002',
       meta: { modelName: 'User', target: [ 'email' ] },
       clientVersion: '6.19.3'
     }
     ```
   - **Avaliação:** **REPROVADO**. Trata-se de uma falha de robustez e violação do contrato de resposta (retorno de 500 em vez de 409).

---

### 2.5 Criptografia e Armazenamento Seguro de Senhas (PostgreSQL + Bcrypt)
Foi realizada auditoria direta na tabela `users` do banco de dados PostgreSQL via Prisma:
- **Senha em texto plano submetida:** `MinhaSenhaUltraSecreta@2026!`
- **Valor armazenado no campo `password_hash`:** `$2b$10$w...` (hash bcrypt real, comprimento exato de 60 caracteres).
- **Invariantes Criptográficas Validadas:**
  * O texto plano da senha não é armazenado e não está presente como substring.
  * O algoritmo utilizado é o `bcrypt` com fator de custo 10 (`$2b$10$`).
  * `bcrypt.compare(plainPassword, dbUser.password_hash)` retorna `true`.
  * `bcrypt.compare(wrongPassword, dbUser.password_hash)` retorna `false`.
  * Em nenhum endpoint (`/register`, `/login`, `/me`) os campos `password` ou `password_hash` são retornados no corpo da resposta JSON.
- **Avaliação:** **APROVADO**.

---

### 2.6 Auditoria dos Cabeçalhos `Set-Cookie` e Flags de Segurança
- **No Cadastro (`POST /api/auth/register`):** O cabeçalho `Set-Cookie` contém:
  * `session_id=<token_hex_64>`
  * `HttpOnly` (impede acesso via scripts do navegador / mitigação de XSS)
  * `SameSite=Lax` (proteção contra CSRF)
  * `Path=/`
- **No Login (`POST /api/auth/login`):** O cabeçalho `Set-Cookie` é emitido com todas as flags `HttpOnly`, `SameSite=Lax` e `Path=/`.
- **No Logout (`POST /api/auth/logout`):** O cabeçalho `Set-Cookie` expira o cookie com `Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax` ou `Max-Age=0`.
- **Avaliação:** **APROVADO**.

---

### 2.7 Execução da Suíte Existente de Testes (`apps/api/tests/auth.test.ts`)
- **Comando:** `npm --workspace=@estudos/api run test -- tests/auth.test.ts`
- **Resultado:**
  ```text
  RUN  v3.2.7 C:/Users/cauad/Documents/Estudos/apps/api
  ✓ tests/auth.test.ts (13 tests) 633ms

  Test Files  1 passed (1)
       Tests  13 passed (13)
  ```
- **Avaliação:** **APROVADO**.

---

## 3. Relatório Detalhado de Desafio (Challenge Details)

### Desafio 1 [MÉDIO / ALTO]: Condição de Corrida TOCTOU em Cadastro Simultâneo
- **Suposição Desafiada:** A suposição de que a verificação prévia `await prisma.user.findUnique({ where: { email } })` em `auth.service.ts` é suficiente para garantir a detecção de duplicidade de e-mails.
- **Cenário de Ataque / Falha:**
  1. Duas ou mais requisições de cadastro para o mesmo e-mail chegam simultaneamente ou dentro de uma janela de ~100ms.
  2. Ambas as requisições executam `prisma.user.findUnique` ao mesmo tempo e ambas recebem `null` (usuário ainda não existe).
  3. Ambas as requisições executam o cálculo de hash `hashPassword(password)` (que leva aproximadamente 80 a 100ms devido ao custo 10 do bcrypt).
  4. Ambas as requisições chamam `prisma.user.create`.
  5. A primeira requisição insere o registro com sucesso no banco.
  6. A segunda requisição viola a restrição `@unique` do PostgreSQL na tabela `users`.
  7. O Prisma Client lança uma exceção `PrismaClientKnownRequestError` com código `P2002`.
  8. Como o `auth.service.ts` não possui tratamento para erros de banco, a exceção é propagada até o manipulador global em `apps/api/src/app.ts`, resultando em resposta HTTP 500 com código `INTERNAL_ERROR`.
- **Raio de Destruição (Blast Radius):**
  - Usuários que clicam duas vezes rapidamente no botão de cadastro recebem erro interno 500 da aplicação, gerando percepção de falha no servidor.
  - Logs de produção são poluídos com exceções não tratadas de integridade relacional.
  - Violação do contrato de interface do `PROJECT.md` que prescreve HTTP 409 para conflito de e-mail.
- **Mitigação Recomendada para o Worker:**
  No arquivo `apps/api/src/services/auth.service.ts` (ou no `auth.controller.ts`), capturar exceções do Prisma no momento da criação do usuário. Se o erro for do tipo `PrismaClientKnownRequestError` com `error.code === 'P2002'`, tratar como conflito:
  ```typescript
  import { Prisma } from '@prisma/client';
  // ...
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

---

## 4. Observações Arquiteturais Adicionais

1. **Armazenamento de Sessões em Memória (`SessionService`):**
   O `SessionService` armazena as sessões em um `Map` local na memória da API. Embora atenda perfeitamente aos requisitos do Marco 2 e simplifique a implementação em desenvolvimento, qualquer reinicialização do processo Node.js ou escalonamento horizontal invalidará todas as sessões ativas. Para ambientes de produção com múltiplos nós, recomenda-se a migração futura para Redis ou persistência de sessões no banco de dados.
2. **Logout com Autenticação Bearer:**
   O método `AuthController.logout` obtém o `sessionId` exclusivamente de `req.cookies?.[SESSION_COOKIE_NAME]`. Clientes que utilizem o cabeçalho `Authorization: Bearer <token>` (suportado pelo `authMiddleware`) não têm sua sessão revogada na memória ao chamar o endpoint de logout. Sugere-se extrair o identificador de sessão de ambas as fontes no controlador de logout.
3. **Validação de Fuso Horário no Esquema Zod:**
   O campo `timezone` no Zod aceita qualquer string arbitrária. Em marcos futuros (Agenda/Metas), valores inválidos podem gerar exceções na manipulação de datas com fusos não reconhecidos pelo padrão IANA.

---

## 5. Resultados Consolidados dos Testes de Estresse

| Cenário de Teste | Comportamento Esperado | Comportamento Obtido | Resultado |
|---|---|---|---|
| Rota `/me` sem token | HTTP 401 | HTTP 401 | **PASS** |
| Cookie forjado / malicioso | HTTP 401 | HTTP 401 | **PASS** |
| Cookie com SQL Injection | HTTP 401 | HTTP 401 | **PASS** |
| Cookie com 15.000 caracteres | HTTP 401 sem falha | HTTP 401 sem falha | **PASS** |
| Sessão após expiração (TTL 7 dias) | HTTP 401 | HTTP 401 | **PASS** |
| Usuário deletado do banco | Sessão purgada, HTTP 401 | Sessão purgada, HTTP 401 | **PASS** |
| Injeção SQL no cadastro (e-mail) | HTTP 400 Zod | HTTP 400 Zod | **PASS** |
| Injeção SQL no cadastro (nome) | Sanitizado no DB | Sanitizado no DB | **PASS** |
| Injeção SQL no login (senha) | HTTP 401 | HTTP 401 | **PASS** |
| Hash no PostgreSQL | Bcrypt $2b$, 60 chars | Bcrypt $2b$, 60 chars | **PASS** |
| Flags Set-Cookie | HttpOnly, SameSite=Lax | HttpOnly, SameSite=Lax | **PASS** |
| E-mail duplicado sequencial | HTTP 409 em português | HTTP 409 em português | **PASS** |
| **E-mail duplicado concorrente** | **HTTP 409 em português** | **HTTP 500 (Prisma P2002)** | **FAIL** |

---

## 6. Veredito Empírico e Próximos Passos

**Veredito:** **REQUEST_CHANGES**

O código é de excelente qualidade e atende a quase todos os requisitos de segurança, com exceção da resiliência a condições de corrida no cadastro.

**Ação Requerida do Worker (`worker_m2`):**
1. Adicionar o tratamento do erro `P2002` do Prisma no método `AuthService.register` (ou `AuthController.register`), retornando `{ success: false, reason: 'conflict' }` de modo que a API responda com **HTTP 409 CONFLICT** e a mensagem em português padronizada.
2. Executar `npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts` e confirmar que todos os 26 testes adversariais passam com 100% de sucesso.
