# Relatório de Desafio Adversário — Milestone 2: Integridade do Monorepo, Estado do Frontend e Alinhamento E2E

**Agente**: `challenger_m2_2` (Empirical Challenger)  
**Data**: 2026-10-06  
**Veredito Empírico**: **APROVADO (APPROVE)**  
**Escopo Avaliado**: Integridade do Monorepo, Typechecking TypeScript, Alinhamento E2E (Sub-suíte 1.1), Detecção e Persistência de Fusos Horários (Timezones), Estado do Frontend Web e Shell de Navegação.

---

## 1. Sumário Executivo

Como desafiante empírico adversário, submeti as entregas do `worker_m2` referentes ao **Marco 2 (Milestone 2)** a uma auditoria rigorosa baseada em execução empírica de código e testes de estresse, sem presumir a veracidade de nenhuma alegação prévia.

Todas as verificações foram executadas diretamente no ambiente Windows/Node 24/PostgreSQL real. Além de rodar a suíte completa de testes do monorepo, a verificação estrita de tipos do TypeScript e a sub-suíte 1.1 de testes ponta a ponta (E2E), desenvolvi e executei um harness de testes de estresse adversarial (`scripts/adversarial-stress-m2-timezone.mjs`) contendo **156 asserções adicionais** com foco em fusos horários de fronteira mundial, casos patológicos na API `Intl`, persistência relacional no PostgreSQL e integridade de sessões baseadas em cookies `httpOnly`.

### Resultados Consolidados das Verificações Empíricas:
1. **`npm test`**: **36/36 testes aprovados** (100% de sucesso) nos 3 workspaces (`@estudos/domain`, `@estudos/api`, `@estudos/web`).
2. **`npm run typecheck` (`tsc -b`)**: **0 erros de compilação**, confirmando a integridade das referências de projeto entre pacotes.
3. **`npm run build`**: **0 erros**, empacotamento de produção do Vite e compilação ESM concluídos com êxito em 6.63s.
4. **Sub-suíte E2E 1.1 (`1.1 Autenticação e Sessão`)**: **5/5 testes aprovados** contra os endpoints HTTP reais da API (`http://localhost:3001`).
5. **Harness Adversário de Fuso Horário e Sessão**: **156/156 asserções aprovadas** cobrindo fusos extremos (UTC, Asia/Tokyo, America/Noronha, Pacific/Kiritimati UTC+14, Australia/Eucla UTC+8:45, etc.), fallbacks para entradas corrompidas e persistência exata no banco de dados.
6. **Veredito Empírico Final**: **APROVADO (APPROVE)**.

---

## 2. Auditoria e Validação Empírica das Alegações do Worker

| Alegação do Worker | Método de Verificação Independente | Resultado Empírico Observado | Status |
|---|---|---|---|
| `npm test` executa 36 testes com sucesso | Execução direta de `npm test` via Vitest | 5 arquivos de teste, 36 testes aprovados em 4.63s | Confirmado |
| `tsc -b` passa sem nenhum erro de tipo | Execução direta de `npm run typecheck` | Código de saída 0, zero avisos e zero erros de tipo | Confirmado |
| `npm run build` gera artefatos de produção | Execução de `npm run build` nos 3 pacotes | Build concluído com sucesso (Vite dist gerado em 6.63s) | Confirmado |
| E2E Sub-suíte 1.1 passa contra a API real | `npx vitest run --config tests/e2e/vitest.config.ts -t "1.1 Autenticação e Sessão"` | 5 testes aprovados (100%) em 1.32s | Confirmado |
| Detecção de fuso horário adota fallback seguro | Execução de harness com mocking patológico de `Intl` | Retorna determinístico `'America/Sao_Paulo'` em falhas | Confirmado |
| Semana inicia na segunda-feira | Inspeção de respostas HTTP e registros PostgreSQL | Campo `week_starts_on` retorna e grava `'MONDAY'` | Confirmado |
| Cookie emitido com `httpOnly` e `SameSite=Lax` | Inspeção dos cabeçalhos `Set-Cookie` retornados | Presença estrita de `HttpOnly; SameSite=Lax; Path=/` | Confirmado |
| Sessões revogadas bloqueiam acessos subsequentes | Teste de logout com reutilização posterior de token | Endpoint `/api/auth/me` responde HTTP 401 UNAUTHORIZED | Confirmado |

---

## 3. Desafio Adversário: Detecção, Formatação e Persistência de Fusos Horários

O tratamento de fuso horário foi desafiado em múltiplos cenários globais e patológicos através do script `scripts/adversarial-stress-m2-timezone.mjs`:

### 3.1 Fusos Horários Globais e de Fronteira Reais (17 Localidades)
Foram testados fusos horários cobrindo todos os quadrantes terrestres e especificidades regionais:
- **`UTC`**: Tempo Universal Coordenado (offset 0).
- **`America/Noronha`**: UTC-2 (arquipélago brasileiro de Fernando de Noronha).
- **`America/Sao_Paulo`**: UTC-3 (fuso horário padrão de Brasília).
- **`America/Manaus`**: UTC-4 (região amazônica brasileira).
- **`America/Rio_Branco`**: UTC-5 (Acre).
- **`Asia/Tokyo`**: UTC+9 (Japão).
- **`Pacific/Kiritimati`**: UTC+14 (Ilhas da Linha / Kiribati, fuso horário mais adiantado do planeta).
- **`America/Adak`**: UTC-10 (Ilhas Aleutas, EUA).
- **`Pacific/Pago_Pago`** & **`Pacific/Niue`**: UTC-11.
- **`Australia/Eucla`**: UTC+8:45 (offset fracionário raro na Austrália Ocidental).
- **`Asia/Kathmandu`**: UTC+5:45 (Nepal, offset fracionário).
- **`Asia/Kolkata`**: UTC+5:30 (Índia, offset fracionário).
- **`Pacific/Chatham`**: UTC+12:45 (Ilhas Chatham, Nova Zelândia).
- **`Atlantic/Azores`**: UTC-1 (Portugal insular).
- **`Europe/London`** e **`Europe/Berlin`**.

**Resultado**: Todas as 17 localidades foram corretamente detectadas e formatadas sem corrupção de string.

### 3.2 Entradas Patológicas e Resiliência a Falhas no Navegador
Simulamos 9 cenários patológicos de falha na API nativa `Intl` do navegador:
1. `timeZone` como string vazia `""`
2. `timeZone` com apenas espaços em branco `"   "`
3. `timeZone` nulo (`null`)
4. `timeZone` indefinido (`undefined`)
5. Objeto `resolvedOptions()` sem a propriedade `timeZone`
6. `timeZone` com tipo numérico (`12345`)
7. Exceção lançada ao invocar `resolvedOptions()`
8. Exceção lançada ao instanciar `DateTimeFormat()`
9. Objeto `globalThis.Intl` inexistente ou corrompido

**Resultado**: Em todos os 9 cenários, a função `detectBrowserTimezone()` degradou de forma elegante e determinística para `'America/Sao_Paulo'`, impedindo qualquer crash em tempo de execução no frontend.

### 3.3 Persistência Relacional e Ciclo de Sessão no Backend Real
Para cada fuso de teste (incluindo UTC, Asia/Tokyo, America/Noronha, Pacific/Kiritimati, Australia/Eucla, America/Manaus, e casos com fuso vazio/omitido), o harness executou:
1. Requisição real `POST /api/auth/register` contra a API Express.
2. Verificação do código HTTP 201 e integridade do payload de retorno.
3. Verificação do cabeçalho `Set-Cookie` com as flags `httpOnly` e `SameSite=Lax`.
4. Consulta direta no PostgreSQL via `@prisma/client` na tabela `users` para atestar que o fuso horário e `week_starts_on: 'MONDAY'` foram persistidos fidedignamente.
5. Requisição `GET /api/auth/me` utilizando o cookie emitido para confirmar a leitura do fuso horário na sessão autenticada.
6. Requisição `POST /api/auth/logout` para revogar a sessão.
7. Requisição imediata `GET /api/auth/me` com o cookie revogado, confirmando que o sistema rejeita a sessão com HTTP 401 UNAUTHORIZED.
8. Requisição `POST /api/auth/login` validando que o fuso original do usuário é retornado no login.
9. Limpeza transacional dos registros de teste do banco de dados ao final da execução.

**Resultado**: 100% dos testes de integração com a API e banco de dados foram aprovados.

---

## 4. Avaliação do Estado do Frontend e Shell de Navegação

A inspeção do código e dos testes do frontend revelou alta conformidade com as diretrizes do projeto:
1. **Roteamento SPA**: O `RouterContext.tsx` gerencia estados de rota via History API de forma autônoma e leve, sem conflitos com React 19.
2. **Contexto de Autenticação (`AuthContext.tsx`)**: Implementa inicialização assíncrona restaurando o perfil em `/api/auth/me` e aplicando fallback duplo na detecção de timezone (`data.timezone || detectBrowserTimezone()`).
3. **Shell de Navegação (`Shell.tsx`)**:
   - Contém todos os 7 módulos da aplicação identificados por ícones Lucide e rótulos estritamente em português (`Painel`, `Matérias e Assuntos`, `Agenda e Planejamento`, `Cronômetro de Estudo`, `Metas de Estudo`, `Desempenho e Estatísticas`, `Observatório Semanal`).
   - Apresenta badge indicando que "Matérias e Assuntos" é o escopo da Fase 2.
   - Exibe o cartão do usuário autenticado com iniciais, e-mail, fuso horário ativo e o indicador de início da semana na segunda-feira.
4. **Páginas de Login e Cadastro (`Login.tsx` e `Register.tsx`)**:
   - Tratamento completo de erros de validação em português, sincronizado com as respostas Zod da API.
   - Detecção automática do fuso horário no momento da montagem com exibição amigável via `formatTimezoneLabel`.

---

## 5. Resumo de Riscos e Desafios

**Avaliação Geral de Risco**: **BAIXO (LOW)**

### Desafio 1: Inserção de Strings Arbitrárias no Campo Timezone
- **Premissa Desafiada**: O esquema Zod aceita qualquer string como timezone no registro (`timezone: z.string().optional()`). Um cliente malicioso poderia enviar uma string que não é um fuso IANA válido (ex.: `"Fantasia/Atlantida"`).
- **Cenário de Ataque**: Usuário envia timezone inválido via API direta.
- **Raio de Explosão**: Baixo. No cadastro, o frontend padrão sempre envia fusos legítimos do `Intl`. Se uma string inválida for enviada manualmente via API, ela é salva como string na coluna `timezone` do PostgreSQL. Caso no futuro alguma biblioteca como `date-fns-tz` ou `Intl` formate datas para esse usuário, uma exceção poderia ocorrer se o valor não for validado.
- **Mitigação Recomendada para Fases Futuras**: No Marco 3 ou na integração da Agenda (Fase 3), adicionar um refinamento Zod ou validação via `Intl.supportedValuesOf('timeZone')` ou `try { Intl.DateTimeFormat(undefined, { timeZone }) }` no backend para rejeitar identificadores não IANA. Para o escopo do Marco 2, a implementação atual cumpre 100% dos requisitos contratuais.

---

## 6. Veredito Final

**Veredito**: **APROVADO (APPROVE)**

O Milestone 2 cumpre integralmente todos os requisitos arquiteturais, de segurança, de integridade do monorepo e de alinhamento com a suíte de testes E2E. Não foram encontradas falhas empíricas ou regressões impeditivas. O monorepo está plenamente apto e seguro para o avanço ao **Marco 3 (Motor de Domínio e API de Matérias e Assuntos)**.
