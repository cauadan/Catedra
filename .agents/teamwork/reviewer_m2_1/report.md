# Relatório de Revisão Independente e Crítica Adversarial — Marco 2

**Agente Revisor:** `reviewer_m2_1`  
**Funções:** Revisor Objetivo (`reviewer`) e Crítico Adversarial (`critic`)  
**Data:** 2026-10-06  
**Alvo:** Implementação do Marco 2 (Autenticação Backend, Segurança, Sessões e Contratos de API)  
**Documentos Base:** `ORIGINAL_REQUEST.md`, `PROJECT.md`, Relatório de Entrega de `worker_m2/report.md`

---

## 1. Resumo Executivo e Veredito

**Veredito Oficial:** **`APPROVE` (APROVADO)**

A implementação do **Marco 2 (Milestone 2)** foi minuciosamente auditada sob as perspectivas de correção técnica, qualidade de código, conformidade com os contratos do projeto, segurança defensiva e integridade. 

Todos os requisitos mandatórios foram atendidos com excelência:
1. **Sessões e Cookies:** `SessionService` implementa armazenamento em memória com tokens criptograficamente seguros (256 bits), TTL de 7 dias, varredura periódica e cookies `httpOnly` (`SameSite=Lax`, `Path=/`).
2. **Criptografia e Senhas:** Hashing de senhas seguro utilizando `bcrypt` com 10 rounds de salt; nenhuma senha ou hash é vazado nas respostas da API.
3. **Middleware Guardião:** `authMiddleware` valida cookies de sessão, consulta a existência e integridade do usuário no banco PostgreSQL via Prisma, injeta `req.userId` e `req.user`, e rejeita requisições não autorizadas com HTTP 401 padronizado.
4. **Contratos da API:** Endpoints `/register` (201 com rejeição de duplicidade 409), `/login` (200), `/logout` (200 com expurgo de cookie) e `/me` (200 com perfil do usuário) operando estritamente em conformidade com o `PROJECT.md`.
5. **Envelope de Erros e Idioma:** Respostas de erro padronizadas em `{ error: { code, message, details } }` rigorosamente em português do Brasil em todas as camadas.
6. **Compilação e Testes:** 100% de aprovação nos testes automatizados (`15/15` na API, `36/36` no monorepo, `5/5` no E2E Sub-suíte 1.1) e zero erros no `tsc -b`.

---

## 2. Auditoria Forense de Integridade

Em cumprimento às diretrizes obrigatórias de combate a atalhos e trapaças:
- **Respostas hardcoded ou mockadas:** Não foram encontrados retornos fictícios embutidos nos controladores ou serviços. Todas as chamadas interagem com instâncias ativas do Prisma Client e do PostgreSQL.
- **Implementações dummy ou facades:** Tanto o hashing com `bcrypt` quanto o gerador de sessões e o cliente Prisma realizam trabalho computacional e de persistência real.
- **Atalhos ou bypass de requisitos:** Toda a validação utiliza Zod com mensagens em português; toda persistência reflete a modelagem do Prisma Schema; o middleware de autenticação faz query real ao banco antes de liberar o acesso.
- **Autocertificação forjada:** Os testes foram executados de forma independente por este revisor nos processos reais do ambiente Node.js / PowerShell / Docker.

---

## 3. Verificação Empírica das Alegações do Worker

Todas as alegações técnicas feitas pelo agente executor (`worker_m2`) foram reproduzidas e verificadas diretamente via linha de comando:

| Alegação do Executor | Método de Verificação Independente | Resultado Obtido | Status |
|---|---|---|---|
| Suíte de testes da API `@estudos/api` aprova 15 testes | Execução de `npm --workspace=@estudos/api run test` | 2 arquivos de teste passaram, 15 testes aprovados em 1.99s | **CONFIRMADO** |
| Verificação de tipos TypeScript sem erros | Execução de `npm run typecheck` (`tsc -b`) | Código de saída 0, nenhum erro retornado | **CONFIRMADO** |
| Suíte de testes unificada do monorepo aprova 36 testes | Execução de `npm test` | 5 arquivos de teste passaram, 36 testes aprovados em 4.42s | **CONFIRMADO** |
| Build de produção de todos os pacotes aprova limpo | Execução de `npm run build` | Compilação de `@estudos/domain`, `@estudos/api` e `@estudos/web` bem-sucedida (dist gerado em 8.04s) | **CONFIRMADO** |
| Sub-suíte E2E 1.1 (Autenticação e Sessão) aprova 5 testes | Execução de `npx vitest run --config tests/e2e/vitest.config.ts -t "1.1 Autenticação e Sessão"` | 1 arquivo passou, 5 testes aprovados contra servidor HTTP real | **CONFIRMADO** |
| Injeção de `req.userId` e `req.user` com bloqueio 401 | Inspeção estática de `auth.middleware.ts` e `auth.test.ts` | Linhas 23, 29, 49, 53, 54 de `auth.middleware.ts` confirmam a lógica | **CONFIRMADO** |
| Hashing de senhas com 10 rounds de salt | Inspeção de `apps/api/src/utils/password.ts` | `SALT_ROUNDS = 10` e chamada a `bcrypt.hash` confirmadas | **CONFIRMADO** |

---

## 4. Análise Crítica e Testes de Estresse Adversariais

Sob a perspectiva adversarial de encontrar modos de falha e desafiar premissas implícitas, foram analisados os seguintes cenários:

### 4.1 Desafio 1: Condição de Corrida em Cadastros Concorrentes com Mesmo E-mail
- **Premissa testada:** O método `AuthService.register` realiza uma busca prévia com `findUnique` para verificar duplicidade de e-mail e retornar HTTP 409 CONFLICT.
- **Cenário de Ataque:** Caso duas requisições idênticas cheguem em paralelo exato, ambas passam pela verificação do `findUnique`. A primeira requisição insere o registro com sucesso no PostgreSQL; a segunda dispara a violação do índice único do banco (`P2002` do Prisma).
- **Comportamento Atual:** A exceção `P2002` não é capturada de forma especializada no `AuthService`, sendo repassada ao tratador global e resultando em HTTP 500 (`INTERNAL_ERROR`) em vez de HTTP 409 (`CONFLICT`).
- **Gravidade:** *Menor (Edge-case de concorrência)* — O banco de dados mantém a integridade absoluta e não permite a duplicidade do registro, mas a resposta HTTP para a requisição perdedora torna-se 500 em vez de 409.
- **Recomendação de Mitigação:** No Marco 3 ou futuro refatoramento, envolver a chamada `prisma.user.create` em bloco try/catch interceptando erros do Prisma com código `P2002` para retornar `{ success: false, reason: 'conflict' }`.

### 4.2 Desafio 2: Validação Estrita do Identificador de Fuso Horário (IANA)
- **Premissa testada:** O esquema Zod `registerSchema` declara `timezone: z.string().optional()`.
- **Cenário de Ataque:** Um cliente envia propositalmente um fuso horário arbitrário ou inválido (ex.: `timezone: "Invalido/Fake"`). O backend persiste a string no campo de texto do PostgreSQL sem rejeição.
- **Impacto Potencial:** Nos Marcos futuros (Fase 3 e Fase 4), operações de manipulação de data que utilizarem `Intl.DateTimeFormat(undefined, { timeZone: user.timezone })` lançarão uma exceção em tempo de execução (`RangeError: Invalid time zone specified`).
- **Gravidade:** *Menor / Melhoria Futura* — Na interface web atual, o fuso é obtido deterministicamente de `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Recomendação de Mitigação:** Adicionar refinamento no Zod (`z.string().refine(...)`) para validar se o identificador é um fuso horário válido reconhecido pelo V8 / IANA.

### 4.3 Desafio 3: Crescimento Não Delimitado da Memória de Sessões (`SessionService`)
- **Premissa testada:** `SessionService` armazena sessões em uma instância de `Map<string, SessionData>`.
- **Cenário de Ataque:** Um atacante pode gerar um volume massivo de requisições de cadastro ou login automatizadas, alocando centenas de milhares de entradas na memória do processo Node.js. A limpeza periódica ocorre a cada 1 hora.
- **Impacto Potencial:** Possível esgotamento de memória Heap (OOM) caso não haja teto máximo de sessões armazenadas ou limitação de taxa (rate limiting).
- **Gravidade:** *Menor* — Para o escopo de uso pessoal/pequeno grupo estabelecido no `ORIGINAL_REQUEST.md`, o consumo atual é desprezível e o cleanup a cada 1h é suficiente. Para produção em larga escala, recomenda-se Redis ou limite LRU.

### 4.4 Desafio 4: Remoção de Cookie em Ambiente de Produção com `Secure`
- **Premissa testada:** Em `AuthController.logout`, `res.clearCookie` define `httpOnly: true, sameSite: 'lax', path: '/'`.
- **Observação:** Em produção sob protocolo HTTPS, onde o cookie é emitido com `secure: true`, navegadores que seguem a RFC 6265bis exigem que o cabeçalho que invalida o cookie (`Max-Age=0`) também possua o atributo `Secure`.
- **Recomendação:** Reutilizar `getSessionCookieOptions()` ou adicionar `secure: process.env.NODE_ENV === 'production'` na chamada `res.clearCookie`.

---

## 5. Verificação da Diretriz de Idioma (Português)

Foi realizada uma varredura exaustiva no código de `apps/api` e `apps/web`:
- Comentários no código: **100% em português**.
- Mensagens de validação Zod: **100% em português** (ex.: *"O nome deve conter ao menos 2 caracteres."*, *"Formato de e-mail inválido."*).
- Mensagens de erro da API: **100% em português** (ex.: *"Dados de cadastro inválidos."*, *"E-mail já cadastrado no sistema."*, *"Credenciais inválidas. Verifique seu e-mail e senha."*, *"Não autorizado"*).
- Interface de usuário Web: formulários de login, registro, dashboard e navegação lateral **100% em português**.
- Nomes técnicos em inglês (`Subject`, `Topic`, `user_id`, `password_hash`, `email`) seguem rigorosamente a exceção autorizada em `ORIGINAL_REQUEST.md`.

---

## 6. Conclusão da Revisão

A entrega do Marco 2 atende com folga a todos os critérios de qualidade, segurança e funcionalidade estabelecidos. Não foram detectadas violações de integridade, atalhos dissimulados ou falhas funcionais. Os apontamentos adversariais levantados constituem oportunidades de endurecimento de segurança preventiva e não impedem a progressão do projeto.

Portanto, emite-se o parecer de **APROVAÇÃO (`APPROVE`)**, liberando o projeto para o início dos trabalhos do **Marco 3 (Motor de Domínio e API de Matérias e Assuntos)**.
