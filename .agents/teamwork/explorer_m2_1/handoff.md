# Relatório de Handoff (Milestone 2 - Backend Authentication & Session Architecture)

**Agente:** `explorer_m2_1`  
**Destinatário:** Orquestrador Geral (`6c849950-5226-48b8-8b65-43c0632e6a59`) e Worker M2  
**Tipo de Handoff:** Hard (Investigação e Formulação de Design Concluídas com Sucesso)  
**Data:** 2026-10-06  

---

## 1. Observation (Observações)

Durante a investigação no repositório `c:\Users\cauad\Documents\Estudos`, foram realizadas observações diretas e verificadas por comandos e leitura de arquivos:

1. **Dependências do Backend (`apps/api/package.json`)**:
   - As linhas 24 a 31 mostram:
     ```json
     "dependencies": {
       "@estudos/domain": "*",
       "@prisma/client": "^6.4.1",
       "bcrypt": "^5.1.1",
       "cookie-parser": "^1.4.7",
       "cors": "^2.8.5",
       "dotenv": "^16.4.7",
       "express": "^4.21.2",
       "zod": "^3.24.2"
     }
     ```
   - As linhas 33 a 44 mostram os pacotes dev:
     ```json
     "devDependencies": {
       "@types/bcrypt": "^5.0.2",
       "@types/cookie-parser": "^1.4.8",
       "@types/cors": "^2.8.17",
       "@types/express": "^5.0.0",
       "@types/node": "^22.13.5",
       "@types/supertest": "^6.0.2",
       "prisma": "^6.4.1",
       "supertest": "^7.0.0",
       "tsx": "^4.19.3",
       "typescript": "^5.7.3",
       "vitest": "^3.0.7"
     }
     ```
   - O comando de teste `node --input-type=module -e "import bcrypt from 'bcrypt'; const h = await bcrypt.hash('Senha123!', 10); console.log('match:', await bcrypt.compare('Senha123!', h));"` executou com código 0 e confirmou o funcionamento pleno do bcrypt em ambiente ESM Node 24.

2. **Resolução de Módulos TypeScript (`apps/api/tsconfig.json`)**:
   - As linhas 4 a 6 configuram:
     ```json
     "target": "ES2022",
     "module": "NodeNext",
     "moduleResolution": "NodeNext"
     ```
   - Todo import relativo em arquivos TypeScript do backend deve terminar obrigatoriamente com a extensão `.js` (ex.: `./routes/auth.routes.js`).

3. **Estrutura Atual do Servidor (`apps/api/src/app.ts`)**:
   - Linhas 12-19 mostram que `express.json()`, `cookieParser()` e `cors({ credentials: true })` já estão configurados no pipeline da aplicação. Não existem rotas de autenticação montadas ainda.

4. **Schema do Banco de Dados e Preservação (`apps/api/prisma/schema.prisma` e `01-contexto-do-projeto.md`)**:
   - `01-contexto-do-projeto.md` (Seção 2, Regra 4) estipula: *"Não altere o schema do banco sem avisar e explicar o motivo."*
   - O modelo `User` possui os campos `id`, `email`, `name`, `password_hash`, `timezone` (com default `"America/Sao_Paulo"`), `week_starts_on` (com default `"MONDAY"`), `created_at` e `updated_at`.
   - O PostgreSQL está ativo via Docker Compose (`estudos-postgres` na porta 5432, status saudável).

5. **Expectativas da Suíte de Testes E2E Opaque-Box (`tests/e2e/helpers/api-client.ts` e `tests/e2e/tier1-feature-coverage.test.ts`)**:
   - O `api-client.ts` faz parsing automático do cookie `session_id` através do cabeçalho `Set-Cookie`.
   - O teste `tests/e2e/tier1-feature-coverage.test.ts` (linhas 36-100) valida a sub-suite 1.1:
     - `POST /api/auth/register` com `{ name, email, password, timezone }` -> 201 com cookie `session_id` e `{ user: { id, name, email, timezone, week_starts_on } }`.
     - `GET /api/auth/me` com sessão -> 200.
     - `GET /api/auth/me` sem sessão -> 401.
     - `POST /api/auth/logout` -> 200 e invalida sessão.
     - `POST /api/auth/login` com `{ email, password }` -> 200 com novo cookie e restabelecimento da sessão.

6. **Validação de Tipos e Testes Existentes**:
   - O comando `npm run typecheck --prefix apps/api` executou com código 0 e zero erros.
   - O comando `npm test` na raiz executou 20 testes em 3 pacotes (`@estudos/domain`, `@estudos/api`, `@estudos/web`) com 100% de sucesso.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Hashing Seguro**:
   - A partir da Observação 1, `bcrypt` versão 5.1.1 já está instalado e verificado em tempo de execução no Node 24 ESM.
   - Adotar um fator de custo de 10 rounds atende ao requisito de segurança moderna sem comprometer a performance de resposta ou o tempo de execução dos testes.

2. **Gestão de Sessão sem Mutação do Banco**:
   - A partir das Observações 4 e 5, o projeto prescreve 11 modelos de dados e proíbe alterações desnecessárias no schema.
   - O prompt de ativação oferece explicitamente: *"Session store: in-memory or PostgreSQL table/map with expiration, tied to user"*.
   - A criação de uma classe `SessionService` baseada em `Map<string, SessionData>` com geração de tokens via `crypto.randomBytes(32).toString('hex')` e TTL de 7 dias atende integralmente aos requisitos de segurança, expiração e auditoria sem alterar o schema do Prisma nem necessitar de migrações complexas.
   - O timer de expiração periódica usa `timer.unref()` para evitar que o processo de testes do Vitest fique bloqueado.

3. **Segurança de Cookies httpOnly**:
   - A partir das Observações 3 e 5, o cookie `session_id` com flags `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 7 dias` e `secure: process.env.NODE_ENV === 'production'` garante que o cookie seja inacessível via JavaScript malicioso (anti-XSS), prevenindo ataques CSRF e funcionando perfeitamente tanto em desenvolvimento local (`http://localhost:5173`) quanto em produção.

4. **Middleware de Autenticação e Injeção Multilocatária**:
   - A partir da Observação 5, o middleware `authMiddleware` valida `req.cookies.session_id` (com fallback para `Authorization: Bearer <sessionId>`).
   - Se o token for vazio ou inexistente, responde HTTP 401 imediatamente com `{ error: { code: "UNAUTHORIZED", message: "Não autorizado" } }`.
   - Se existir, busca o usuário no PostgreSQL via `prisma.user.findUnique`.
   - Injeta `req.userId` e `req.user` (sem `password_hash`), permitindo que todas as rotas privadas dos próximos marcos filtrem obrigatoriamente por `user_id`.

5. **Padronização de Erros em Português**:
   - O formato JSON padronizado em `PROJECT.md` (`VALIDATION_ERROR`, `UNAUTHORIZED`, `CONFLICT`, `NOT_FOUND`, `INTERNAL_ERROR`) é centralizado no utilitário `apps/api/src/utils/errors.ts`, garantindo que todas as respostas de falha retornem mensagens descritivas em português e campo de detalhes quando aplicável.

---

## 3. Caveats (Ressalvas)

- **Reinício do Processo e Persistência de Sessões**: Como o `SessionService` utiliza armazenamento in-memory, o reinício manual do processo da API em desenvolvimento revogará as sessões ativas existentes, exigindo que o usuário ou cliente realize novo login. Essa decisão é intencional e adequada ao escopo de desenvolvimento/teste e preservação estrita do schema Prisma da Seção 6. Caso a persistência de longo prazo pós-reboot se torne mandatória em fases futuras, a arquitetura do `SessionService` já possui a interface modular para acoplar uma tabela PostgreSQL ou Redis.
- **Normalização de E-mails**: Decidiu-se normalizar todos os e-mails para minúsculas (`toLowerCase().trim()`) antes da gravação e consulta no banco para evitar inconsistências de capitalização.
- Nenhuma outra ressalva identificada.

---

## 4. Conclusion (Conclusão)

A arquitetura técnica de autenticação e sessão do backend está completamente projetada, formalizada e validada contra os requisitos de `ORIGINAL_REQUEST.md`, `PROJECT.md`, `01-contexto-do-projeto.md` e a suíte de testes E2E existente.

Os 10 arquivos a serem criados/modificados pelo Worker foram especificados com código-fonte integral em `report.md`:
1. `apps/api/src/types/express.d.ts` (Declaração de tipos de `Request`)
2. `apps/api/src/lib/prisma.ts` (Instância singleton do Prisma)
3. `apps/api/src/utils/errors.ts` (Formatador do envelope de erros padronizado em português)
4. `apps/api/src/utils/password.ts` (Hashing e verificação com bcrypt)
5. `apps/api/src/services/session.service.ts` (Gerenciador in-memory de sessões e cookies)
6. `apps/api/src/services/auth.service.ts` (Regras de negócio de cadastro, login e logout)
7. `apps/api/src/middlewares/auth.middleware.ts` (Middleware de proteção 401 e injeção de contexto)
8. `apps/api/src/controllers/auth.controller.ts` (Controlador HTTP das rotas `/api/auth/*`)
9. `apps/api/src/routes/auth.routes.ts` (Roteador Express)
10. `apps/api/src/app.ts` (Montagem das rotas)

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e verificar a integridade da implementação, execute os seguintes passos:

1. **Checagem Estática de Tipos TypeScript**:
   ```powershell
   npm run typecheck --prefix apps/api
   ```
   - *Condição de Sucesso*: Compilação com código de saída 0 e nenhum erro detectado pelo compilador.

2. **Execução dos Testes Automatizados da API**:
   ```powershell
   npm run test --prefix apps/api
   ```
   - *Condição de Sucesso*: Vitest executa e aprova 100% dos testes unitários e de integração de `health.test.ts` e `auth.test.ts`.

3. **Execução da Suíte Global de Testes do Monorepo**:
   ```powershell
   npm test
   ```
   - *Condição de Sucesso*: Todos os pacotes (`domain`, `api`, `web`) executam com sucesso.

4. **Execução da Sub-suite 1.1 dos Testes E2E Opaque-Box**:
   Inicie o servidor da API em outro terminal (`npm run dev --prefix apps/api`) e execute:
   ```powershell
   npx vitest run tests/e2e/tier1-feature-coverage.test.ts -t "1.1 Autenticação e Sessão"
   ```
   - *Condição de Sucesso*: Todos os 5 testes da sub-suite 1.1 de autenticação e sessão passam sem falhas.

5. **Condições de Invalidação**:
   - Falha ao definir ou receber o cookie `session_id`.
   - Resposta a rotas protegidas sem sessão diferente de HTTP 401.
   - Mensagens de erro emitidas em inglês em vez de português.
   - Erros de compilação relacionados a extensões em imports ESM (`NodeNext`).
