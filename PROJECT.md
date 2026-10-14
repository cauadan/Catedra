# Projeto: Plataforma de Gestão e Análise de Estudos (Fases 1 & 2)

## Arquitetura
- **Estrutura Monorepo (workspaces do npm):**
  - `apps/web`: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui. Roteador no cliente, TanStack Query para gerenciamento de cache e estado assíncrono, detecção de fuso horário via `Intl.DateTimeFormat`.
  - `apps/api`: Node.js + Express + TypeScript + Prisma ORM. Autenticação por sessão baseada em cookies `httpOnly`, middleware injetor de `user_id`, validação com Zod e tratamento padronizado de erros JSON integralmente em português.
  - `packages/domain`: Biblioteca pura em TypeScript (sem dependências de I/O, banco de dados ou interface visual). Contém esquemas Zod compartilhados, validação de invariantes da árvore de tópicos (prevenção de ciclos, recálculo de caminhos e integridade), fórmulas e regras determinísticas. Testada via Vitest.
- **Infraestrutura de Banco de Dados:**
  - PostgreSQL 16 executando via `docker-compose.yml` na raiz do projeto.
  - Arquivo `.env.example` com credenciais e URL padrão (`postgresql://postgres:postgres@localhost:5432/estudos_db?schema=public`).
  - Schema Prisma completo contendo todos os 11 modelos e 10 enums da Seção 6 do contexto, com migração inicial funcional que roda perfeitamente do zero.
- **Segurança e Isolamento Multilocatário:**
  - Criptografia unidirecional de senhas via hash seguro (`bcrypt` ou `argon2`).
  - Cookies de sessão `httpOnly` (`SameSite=Lax`, `Path=/`, `Secure` em produção).
  - Isolamento estrito de dados: toda e qualquer consulta ou mutação filtra obrigatoriamente por `user_id`.

## Inventário de Funcionalidades
| # | Funcionalidade | Descrição | Marco | Origem |
|---|----------------|-----------|-------|--------|
| 1 | Estrutura Monorepo | Configuração de workspaces npm com `apps/web`, `apps/api`, `packages/domain`, TypeScript e scripts na raiz | M1 | Contexto §3, R1 |
| 2 | Banco de Dados & Docker Compose | Configuração do PostgreSQL via Docker Compose e arquivo `.env.example` | M1 | R3, Contexto §3 |
| 3 | Schema Prisma Completo | Implementação dos 11 modelos e 10 enums da Seção 6 com migração inicial funcional do zero | M1 | Contexto §6, R1 |
| 4 | Configuração Vitest & Zod | Configuração de testes automatizados em todos os pacotes e Zod para esquemas compartilhados | M1 | R1, Contexto §2 |
| 5 | Cadastro de Usuário | Endpoint `POST /api/auth/register` com nome, email, senha, fuso horário detectado e semana iniciando na segunda-feira | M2 | R1, R3, Contexto §3 |
| 6 | Login & Sessão | Endpoint `POST /api/auth/login` com validação de senha e emissão de cookie `httpOnly` | M2 | R1, Contexto §3 |
| 7 | Logout | Endpoint `POST /api/auth/logout` que destrói a sessão e remove o cookie `httpOnly` | M2 | R1, Contexto §3 |
| 8 | Quem Sou Eu (`me`) | Endpoint `GET /api/auth/me` que retorna os dados do perfil autenticado | M2 | R1, Contexto §3 |
| 9 | Middleware de Autenticação | Middleware que injeta `user_id` em rotas privadas e bloqueia requisições sem sessão com HTTP 401 | M2 | R1, Contexto §2 |
| 10 | Layout Base Web & Marcadores de Navegação | Estrutura visual da aplicação com navegação para módulos futuros (Painel, Matérias, Agenda, Cronômetro, Metas, Estatísticas, Observatório) | M2 | R1, Contexto §9 |
| 11 | CRUD de Matérias | Endpoints `GET /api/subjects`, `POST`, `PATCH`, `DELETE` gerenciando nome, cor e arquivamento | M3 | R2, Contexto §6 |
| 12 | CRUD de Assuntos | Endpoints `GET /api/topics`, `POST`, `PATCH`, `DELETE` com hierarquia recursiva por `parent_id` e profundidade livre | M3 | R2, Contexto §6 |
| 13 | Prevenção de Ciclos na Árvore | Algoritmo que impede que um assunto se torne pai de si mesmo ou de qualquer um de seus descendentes (rejeição com HTTP 400) | M3 | R2, Contexto §5 |
| 14 | Mover Assunto (Mesma Matéria) | Reatribuição de nó pai preservando todos os nós filhos e descendentes intactos | M3 | R2, Contexto §5 |
| 15 | Mover Assunto (Outra Matéria) | Transferência para outra matéria atualizando recursivamente e atomicamente o `subject_id` de todos os descendentes | M3 | R3, Contexto §5 |
| 16 | Arquivamento em Cascata | Arquivar matéria arquiva todos os seus tópicos; arquivar tópico arquiva descendentes; desarquivar restaura em cascata | M3 | R3, Contexto §5 |
| 17 | Proteção de Exclusão (Sessões Vinculadas) | Exclusão física rejeitada caso existam sessões (`PlannedSession`, `StudySession`, `PracticeRecord`) vinculadas ao tópico ou descendentes, orientando arquivamento | M3 | R3, Contexto §5 |
| 18 | Isolamento entre Usuários | Validação estrita de `user_id` em todas as consultas e operações (cobertura com testes de API para dois usuários) | M3 | R2, R3 |
| 19 | Interface da Árvore de Assuntos | Tela interativa em português para visualização em árvore com 3 ou mais níveis de profundidade, criação, renomeação, movimentação e arquivamento | M4 | R2, Critérios F2 |
| 20 | Validação e Modais na Interface | Modais de confirmação e mensagens de feedback em português (alerta e orientação de arquivar quando houver sessões vinculadas) | M4 | R2, R3 |
| 21 | Testes E2E Completos (Níveis 1 a 4) | Suíte de testes ponta a ponta cobrindo todos os requisitos funcionais e regras de negócio sem falhas | M5 | R1, R2, R3 |
| 22 | Blindagem Adversária (Nível 5) | Testes de estresse com cenários adversários e auditoria forense de integridade | M5 | Protocolo de Integridade |
| 23 | Documentação e Relatório Final | README completo em português com guia de execução passo a passo e relatório final de entrega | M5 | R3, Critérios F1-F2 |

## Marcos de Entrega
| # | Nome | Escopo | Dependências | Status |
|---|------|--------|--------------|--------|
| M1 | Fundação do Monorepo e Banco de Dados | Configuração do monorepo (`apps/web`, `apps/api`, `packages/domain`), Docker Compose com PostgreSQL, `.env.example`, schema Prisma completo da Seção 6, migração inicial funcional do zero, configuração do Vitest e Zod | nenhuma | CONCLUÍDO |
| M2 | Autenticação, Sessão e Layout Base | Hash de senhas, cookies de sessão `httpOnly`, middleware de autenticação (401), rotas de autenticação (`/register`, `/login`, `/logout`, `/me`), detecção de fuso horário, semana iniciando na segunda-feira, layout base web com marcadores de módulos futuros | M1 | CONCLUÍDO |
| M3 | Motor de Domínio e API de Matérias e Assuntos | Algoritmos de hierarquia (ciclos, movimentação, cascata de arquivamento, proteção de exclusão por sessões vinculadas), endpoints da API para Matérias e Assuntos, filtro estrito por `user_id`, testes de API com dois usuários | M2 | EM_ANDAMENTO |
| M4 | Interface Web da Árvore de Assuntos | Interface de gerenciamento em árvore em português (profundidade >= 3), modais de criação, edição, movimentação, arquivamento e exclusão com feedback em português, zero erros no console | M3 | PLANEJADO |
| M5 | Integração E2E Final, Blindagem e Entregáveis | Aprovação em 100% dos testes E2E (Níveis 1 a 4), blindagem adversária (Nível 5), auditoria forense limpa, README e Relatório Final completos em português | M4, TESTES_PRONTOS | PLANEJADO |

## Contratos de Interface

### Endpoints de Autenticação (`apps/api`)
- `POST /api/auth/register`:
  - Corpo da requisição: `{ name: string, email: string, password: string, timezone?: string }`
  - Resposta de sucesso: 201 `{ user: { id: string, name: string, email: string, timezone: string, week_starts_on: string } }` + Cookie `session_id` (`httpOnly`)
  - Resposta de erro: 400 (dados inválidos) ou 409 (e-mail já cadastrado)
- `POST /api/auth/login`:
  - Corpo da requisição: `{ email: string, password: string }`
  - Resposta de sucesso: 200 `{ user: { id: string, name: string, email: string, timezone: string, week_starts_on: string } }` + Cookie `session_id` (`httpOnly`)
  - Resposta de erro: 401 (credenciais inválidas)
- `POST /api/auth/logout`:
  - Resposta de sucesso: 200 `{ success: true }` + Remoção do Cookie
- `GET /api/auth/me`:
  - Resposta de sucesso: 200 `{ user: { id: string, name: string, email: string, timezone: string, week_starts_on: string } }`
  - Resposta de erro: 401 (não autenticado)

### Endpoints de Matérias (`apps/api`)
- `GET /api/subjects?include_archived=boolean`:
  - Resposta de sucesso: 200 Lista de matérias `Subject[]`
- `POST /api/subjects`:
  - Corpo da requisição: `{ name: string, color: string }`
  - Resposta de sucesso: 201 `Subject`
- `PATCH /api/subjects/:id`:
  - Corpo da requisição: `{ name?: string, color?: string, archived?: boolean }`
  - Resposta de sucesso: 200 `Subject` (quando `archived` for alterado, propaga em cascata para todos os tópicos da matéria)
- `DELETE /api/subjects/:id`:
  - Resposta de sucesso: 204 (caso não haja tópicos ou não haja sessões vinculadas aos seus tópicos) ou 400/409 orientando a arquivar

### Endpoints de Assuntos (`apps/api`)
- `GET /api/topics?subject_id=string&include_archived=boolean`:
  - Resposta de sucesso: 200 Lista de tópicos `Topic[]`
- `POST /api/topics`:
  - Corpo da requisição: `{ subject_id: string, name: string, parent_id?: string | null }`
  - Resposta de sucesso: 201 `Topic`
- `PATCH /api/topics/:id`:
  - Corpo da requisição: `{ name?: string, subject_id?: string, parent_id?: string | null, archived?: boolean }`
  - Invariantes de validação:
    * Se `parent_id` for alterado: validar que não cria ciclo (não pode ser pai de si mesmo nem de nenhum descendente). Caso forme ciclo, retornar HTTP 400 com mensagem em português.
    * Se `subject_id` for alterado: mover o tópico e atualizar atomicamente e recursivamente o `subject_id` de todos os seus nós descendentes.
    * Se `archived` for alterado: propagar o novo estado recursivamente para todos os descendentes.
  - Resposta de sucesso: 200 `Topic`
- `DELETE /api/topics/:id`:
  - Invariantes de validação: Verificar se existem registros de `PlannedSession`, `StudySession` ou `PracticeRecord` vinculados ao tópico ou a qualquer nó de sua subárvore descendente.
  - Se existirem vínculos: retornar HTTP 400 ou 409 com mensagem explicativa em português orientando o usuário a arquivar em vez de excluir.
  - Se não existirem vínculos: realizar a exclusão física do tópico e de sua subárvore em cascata -> 204 No Content.

### Formato Padronizado de Resposta de Erro JSON
Todas as mensagens de erro e detalhamentos devem ser retornadas em português:
```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | CONFLICT | DOMAIN_RULE_VIOLATION",
    "message": "Mensagem descritiva em português",
    "details": [
      {
        "field": "campo",
        "message": "Mensagem detalhada da validação em português"
      }
    ]
  }
}
```

## Estrutura de Diretórios do Código
```
c:\Users\cauad\Documents\Estudos\
├── apps\
│   ├── api\
│   │   ├── prisma\
│   │   │   ├── schema.prisma
│   │   │   └── migrations\
│   │   ├── src\
│   │   │   ├── config\
│   │   │   ├── controllers\
│   │   │   ├── middlewares\
│   │   │   ├── routes\
│   │   │   ├── services\
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── tests\
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web\
│       ├── src\
│       │   ├── components\
│       │   │   ├── layout\
│       │   │   ├── ui\
│       │   │   └── tree\
│       │   ├── pages\
│       │   ├── hooks\
│       │   ├── services\
│       │   ├── types\
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
├── packages\
│   └── domain\
│       ├── src\
│       │   ├── tree\
│       │   ├── auth\
│       │   ├── formulas\
│       │   └── index.ts
│       ├── tests\
│       ├── package.json
│       └── tsconfig.json
├── tests\
│   └── e2e\
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```
