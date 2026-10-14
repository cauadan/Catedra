# Relatório de Especificação — Fases 1 (Fundação) e 2 (Matérias e Assuntos)

## 1. Visão Geral e Arquitetura Monorepo
- **Estrutura:** `apps/web` (React 19 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query), `apps/api` (Node + Express + TypeScript), `packages/domain` (regras e cálculos puros + Vitest).
- **Banco & ORM:** PostgreSQL (via Docker Compose) com Prisma ORM. Schema completo com todos os modelos previstos nas Fases 1–8 (`User`, `Subject`, `Topic`, `PlannedSession`, `PlannedBlock`, `StudySession`, `SessionBlock`, `SessionEvent`, `PracticeRecord`, `SessionEvaluation`, `Goal`) em migração inicial única.
- **Idioma:** Identificadores e schema em inglês (`Subject`, `Topic`, `user_id` etc.); todo o restante estritamente em português (UI, mensagens de erro da API, validações, documentação e comentários).

## 2. Fase 1: Fundação — Escopo e Requisitos Técnicos
- **Autenticação & Sessão:** Senhas com hash seguro (`argon2` ou `bcrypt`). Sessão baseada em cookie `httpOnly` (`SameSite=Lax`, `Secure` em prod).
- **Endpoints de Autenticação:**
  - `POST /api/auth/register`: `{ name, email, password, timezone? }` -> cadastra usuário, seta cookie de sessão httpOnly e retorna dados do usuário.
  - `POST /api/auth/login`: `{ email, password }` -> valida credenciais, seta cookie de sessão httpOnly.
  - `POST /api/auth/logout`: limpa cookie de sessão httpOnly e encerra sessão.
  - `GET /api/auth/me`: retorna os dados do usuário autenticado atual; retorna 401 se não autenticado.
- **Middleware de Autenticação:** Injeta `req.userId` em rotas privadas; bloqueia requisições sem sessão válida com HTTP 401 (`{ error: "Não autorizado" }`).
- **Layout & Navegação:** Tela de login/cadastro e layout base com sidebar/header exibindo placeholders de navegação para os futuros módulos (*Dashboard*, *Matérias e Assuntos*, *Planejador/Agenda*, *Timer/Sessão*, *Metas*, *Desempenho/Estatísticas*, *Observatório*).

## 3. Fase 2: Matérias e Assuntos — Escopo, Algoritmos e Invariantes
- **CRUD de Matérias (`Subject`):** `GET /api/subjects`, `POST /api/subjects`, `PATCH /api/subjects/:id`, `DELETE /api/subjects/:id`. Campos: `name`, `color` (hex), `archived`.
- **CRUD de Assuntos (`Topic`):** `GET /api/topics`, `POST /api/topics`, `PATCH /api/topics/:id`, `DELETE /api/topics/:id`. Campos: `name`, `subject_id`, `parent_id` (nullable), `archived`. Suporte a profundidade ilimitada.
- **Invariantes e Algoritmos de Árvore:**
  1. *Prevenção de Ciclos:* Ao atualizar `parent_id` de um tópico $T$, validar que `new_parent_id != T.id` e que `new_parent_id` não é nenhum descendente de $T$ na árvore. Em caso de ciclo, retornar HTTP 400 com mensagem explicativa em português.
  2. *Reparenting (Mover na mesma matéria):* Mover $T$ para outro nó pai preserva todos os seus descendentes intactos.
  3. *Mover entre Matérias:* Ao transferir $T$ para outra matéria, transferir em cascata todos os descendentes, atualizando atomicamente seus respectivos `subject_id`.
  4. *Arquivamento e Desarquivamento em Cascata:* Arquivar uma matéria arquiva todos os seus tópicos; arquivar um tópico arquiva todos os seus descendentes. Desarquivar restaura a entidade e todos os seus descendentes em cascata.
  5. *Proteção de Exclusão (Delete Protection):* Hard delete rejeitado (HTTP 400/409) se existirem sessões vinculadas (`PlannedSession`, `StudySession`, `PracticeRecord`) para o tópico ou qualquer um de seus descendentes, instruindo o arquivamento.
- **Isolamento Multitenant:** Todas as consultas e mutações filtram obrigatoriamente por `user_id`. Testes de API cobrem isolamento estrito com 2 usuários.
- **Interface da Árvore (UI):** Visualização hierárquica em árvore com profundidade 3+, ações de criar, renomear, mover e arquivar, sem erros no console.

## 4. Features Discovered
| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento de Erro | Discoberto Via |
|---|-----------|---------|-----------|----------|--------|-----------------------|----------------|
| 1 | Auth | Registro de Usuário | Cadastro com email, senha e detecção de timezone | `name`, `email`, `password`, `timezone?` | Usuário DTO + Cookie httpOnly | 400 Email em uso/dados inválidos | R1, R3, Seção 6 |
| 2 | Auth | Login / Logout | Inicia/destrói sessão via cookie httpOnly | `email`, `password` | 200 OK + Cookie / Clear Cookie | 401 Credenciais inválidas | R1, Seção 3 |
| 3 | Auth | Usuário Atual (Me) | Retorna perfil da sessão autenticada | Cookie de sessão | `{ id, name, email, timezone }` | 401 Não autorizado | R1, Critérios F1 |
| 4 | Auth | Middleware Auth | Valida sessão e injeta `user_id` em rotas privadas | Cookie de sessão | `req.userId` populado | 401 Bloqueia requisição | R1, Seção 2 |
| 5 | DB | Migração Inicial Prisma | Schema PostgreSQL com modelos de todas as fases | `schema.prisma` | Banco sincronizado | Falha se banco indisponível | R1, Seção 6 |
| 6 | Nav | Layout com Placeholders | Shell de navegação com links para módulos futuros | Sessão do usuário | Shell com rotas/links | Redireciona para /login | R1, R3 |
| 7 | Matérias | CRUD Matérias | Criar, ler, atualizar nome/cor/arquivar, deletar | `name`, `color`, `archived` | Subject DTO | 400 Zod / 404 Não encontrado | R2, Seção 6 |
| 8 | Assuntos | CRUD Assuntos | Criar, renomear, mudar pai/matéria, arquivar, deletar | `name`, `subject_id`, `parent_id` | Topic DTO | 400 Zod / 404 Não encontrado | R2, Seção 6 |
| 9 | Árvore | Prevenção de Ciclos | Bloqueia atribuição de pai a si ou descendente | `topic_id`, `new_parent_id` | Topic DTO atualizado | 400 Ciclo detectado na hierarquia | R2, Critérios F2 |
| 10 | Árvore | Mover entre Matérias | Atualiza recursivamente `subject_id` da subárvore | `topic_id`, `new_subject_id`, `new_parent_id?` | Topic DTO + subárvore | 400 / 404 se matéria inválida | R3, Critérios F2 |
| 11 | Árvore | Cascata Arquivamento | Arquivar/desarquivar propaga para descendentes | `id`, `archived: boolean` | Entidade + subárvore atualizada | 404 Não encontrado | R3, Critérios F2 |
| 12 | Árvore | Proteção de Exclusão | Bloqueia deleção se houver sessões vinculadas | `id` | 204 No Content (se sem vínculos) | 400/409 Possui sessões; arquive | R3, Critérios F2 |
| 13 | Multitenant | Isolamento por Usuário | Validação e filtro estrito por `user_id` | `req.userId` | Dados exclusivos do usuário | 404 ou 403 para dados de terceiros | R2, R3 |
| 14 | UI | Visualização em Árvore | Componente interativo em PT-BR com profundidade 3+ | Árvore de matérias e tópicos | Renderização DOM limpa | Tratamento de erro sem logs no console | R2, Critérios F2 |

## 5. Edge Cases
| # | Feature | Cenário / Entrada | Comportamento Observado / Requisito |
|---|---------|-------------------|--------------------------------------|
| 1 | Auth | Registro sem fuso horário informado | Detectar fuso no navegador via `Intl`; default `UTC`; `week_starts_on: MONDAY`. |
| 2 | Auth | Acesso a rota protegida sem sessão | Responde com HTTP 401 `{ error: "Não autorizado" }`; tela redireciona para login. |
| 3 | Matérias | Exclusão de matéria com tópicos que possuem sessões | Rejeita com 400/409 orientando arquivar; cascata de verificação em todos os tópicos. |
| 4 | Árvore | Mover tópico definindo a si próprio como pai | Detecta `new_parent_id === topic_id`; rejeita com HTTP 400 imediatamente. |
| 5 | Árvore | Mover tópico definindo um descendente como pai | Algoritmo percorre árvore e detecta ciclo indireto; rejeita com HTTP 400. |
| 6 | Árvore | Mover raiz da árvore para outra matéria | Subárvore inteira é transferida atomicamente (transação Prisma) com novo `subject_id`. |
| 7 | Arquivamento | Desarquivar tópico raiz ou matéria | Desarquiva a raiz e propaga em cascata para todos os tópicos descendentes. |
| 8 | Exclusão | Tópico com sessão planejada ou executada | Rejeita deleção com mensagem orientando arquivamento (testável via seed direta). |
| 9 | Multitenancy | Usuário A tenta acessar/mutar ID do Usuário B | Query retorna 404/403; nenhum dado alheio é modificado ou exposto. |
| 10 | UI Árvore | Árvore com nós aninhados além de 3 níveis | Renderização recursiva mantém indentação, botões de ação e zero erros no console. |

## 6. Matriz de Verificação e Critérios de Aceite
- **Fase 1 (Fundação):**
  - Conta criada, login autenticado, cookie httpOnly emitido, logout encerra sessão, rota protegida acessível.
  - Tentativa sem cookie de sessão resulta em HTTP 401.
  - `prisma migrate dev` roda do zero sem erro em banco PostgreSQL limpo.
  - Pelo menos um teste automatizado executando em Vitest (`npm test`).
- **Fase 2 (Matérias e Assuntos):**
  - Dois usuários simultâneos: Usuário A não vê nem altera matérias/assuntos do Usuário B.
  - Tentativa de ciclo na hierarquia rejeitada pela API com HTTP 400.
  - Mover assunto preserva filhos e atualiza `subject_id` em cascata se mudar de matéria.
  - Arquivar/desarquivar matéria ou assunto propaga recursivamente para descendentes.
  - Tentativa de exclusão de tópico com sessão vinculada é rejeitada com orientação de arquivamento.
  - Suíte `npm test` passa integralmente na raiz; `tsc` compila sem erros.
  - Revisor consegue subir Docker, rodar migração, abrir navegador e operar árvore de 3 níveis sem erro de console.
