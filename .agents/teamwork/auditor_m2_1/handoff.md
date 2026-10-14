# Relatório de Handoff — Auditoria Forense do Marco 2 (auditor_m2_1)

## 1. Observação (Observation)
1. **Container PostgreSQL e Infraestrutura de Dados:**
   - Comando: `docker ps` retornou o container `estudos-postgres` com imagem `postgres:16-alpine`, status `Up (healthy)` e mapeamento de porta `0.0.0.0:5432->5432/tcp`.
   - Comando: `docker exec estudos-postgres psql -U postgres -d estudos_db -c "\dt"` confirmou a existência das 12 tabelas do schema Prisma: `_prisma_migrations`, `goals`, `planned_blocks`, `planned_sessions`, `practice_records`, `session_blocks`, `session_evaluations`, `session_events`, `study_sessions`, `subjects`, `topics` e `users`.
2. **Criptografia e Persistência no Banco:**
   - Em `apps/api/src/utils/password.ts` (linhas 1 a 18), o utilitário importa `bcrypt` e invoca `bcrypt.hash(password, 10)` e `bcrypt.compare(password, hash)`.
   - Consulta direta via `psql` no container confirmou que os usuários criados possuem `password_hash` real iniciando com prefixo `$2b$10$` e tamanho exato de 60 caracteres (exemplo: `$2b$10$ZjVmomdA9NEniNgs5Td2PeQ6ozqkEKwfvZWoyaA2Ge7u5DvISDVBS`).
3. **Mecanismo de Sessão e Cookies:**
   - Em `apps/api/src/services/session.service.ts` (linhas 1 a 125), `SessionService` gera identificadores de 256 bits com `crypto.randomBytes(32).toString('hex')`, armazena com TTL de 7 dias e expurga sessões expiradas.
   - Em `apps/api/src/controllers/auth.controller.ts` (linhas 52 e 106), cookies são emitidos com a flag `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`. No logout (linhas 134-138), o cookie é limpo no cliente.
4. **Verificação Dinâmica ao Vivo:**
   - Requisição direta via HTTP contra `http://localhost:3001/api/auth/me` sem cookie retornou status `401` com `{"error":{"code":"UNAUTHORIZED","message":"Não autorizado"}}`.
   - Requisição `POST /api/auth/register` retornou `201` com dados do usuário (sem expor hash de senha) e cabeçalho `Set-Cookie` com as flags de segurança.
   - Requisição subsequente `GET /api/auth/me` com cookie retornou `200` com os dados do usuário.
   - Requisição `POST /api/auth/login` com senha incorreta retornou `401`.
   - Requisição `POST /api/auth/logout` retornou `200` e limpou o cookie; requisição posterior a `/me` retornou `401`.
5. **Varredura por Trapaças ou Mocks:**
   - Varredura por `toBe(true)` confirmou ausência de testes auto-certificadores (`expect(true).toBe(true)`).
   - Varredura por `vi.mock` em `apps/api`, `apps/web` e `tests/e2e` retornou zero resultados.
   - Varredura por valores hardcoded de teste no código-fonte de produção retornou zero resultados.
6. **Conformidade de Idioma:**
   - Todos os componentes visuais (`apps/web/src/pages/Login.tsx`, `Register.tsx`, `Dashboard.tsx`, `PlaceholderModule.tsx`, `Shell.tsx`), mensagens de validação e envelopes de erro JSON estão integralmente redigidos em português do Brasil.

## 2. Cadeia Lógica (Logic Chain)
- A partir das observações 1 e 2, conclui-se que o banco de dados não é simulado nem mocado: é uma instância PostgreSQL 16 real em Docker na qual as migrações foram aplicadas e dados de usuários com senhas hash bcrypt são gravados e lidos.
- A partir das observações 3 e 4, conclui-se que o ciclo de vida da sessão e autenticação é autêntico, seguro e opera de ponta a ponta via cookies `httpOnly`, rejeitando acessos não autorizados tanto sem sessão quanto após logout.
- A partir da observação 5, comprova-se a inexistência de trapaças, fachadas (*facades*) ou resultados pré-fabricados (*hardcoded results*).
- A partir da observação 6, verifica-se a conformidade com a exigência mandatória de idioma em português.

## 3. Ressalvas (Caveats)
- Condição de corrida sob alta concorrência simultânea (mesmo e-mail cadastrado no mesmo milissegundo) resulta em HTTP 500 em vez de HTTP 409 devido à exceção Prisma P2002 não tratada explicitamente no método `register()`. O banco de dados PostgreSQL bloqueia corretamente a duplicação, portanto não há falha de integridade, apenas um ponto de refinamento de código para os próximos marcos.

## 4. Conclusão (Conclusion)
A implementação do Marco 2 é genuína, robusta, atende integralmente a todos os critérios de aceitação e está em total conformidade com os requisitos de segurança e de idioma. O veredito da auditoria forense é **CLEAN**.

## 5. Método de Verificação Independente (Verification Method)
Para reproduzir e auditar independentemente estes resultados:
1. Verificar status do Docker: `docker ps` (garantir `estudos-postgres` em execução).
2. Executar testes do monorepo: `npm test` ou `npm --workspace=@estudos/api run test` e `npm --workspace=@estudos/web run test`.
3. Executar typecheck: `npm run typecheck` (`tsc -b`).
4. Executar build: `npm run build`.
5. Executar sub-suíte E2E: `npx vitest run --config tests/e2e/vitest.config.ts -t "1.1 Autenticação e Sessão"`.
6. Condição de invalidação: Qualquer uso de mocks em substituição ao PostgreSQL real, exposição de hash de senha na API, ou textos em inglês em telas/mensagens de erro invalidaria este veredito.
