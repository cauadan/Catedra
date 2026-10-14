# Original User Request

## Initial Request — 2026-10-06T03:40:58Z

Construir as **Fases 1 (Fundação) e 2 (Matérias e assuntos)** da Plataforma de Gestão e Análise de Estudos, uma aplicação web de uso pessoal/pequeno grupo. **Tudo em português** (interface, mensagens de erro, comentários, README e relatório final).

Working directory: c:\Users\cauad\Documents\Estudos
Integrity mode: development

Material de referência (obrigatório ler, nesta ordem de prioridade; os arquivos estão no working directory):
1. `01-contexto-do-projeto.md` — prevalece sobre tudo
2. `02-prompts-por-fase.md` — escopo e critérios das Fases 1 e 2
3. `Documentação Inicial — Plataforma de Gestão e Análise de Estudos.md` — visão de produto

Ambiente: Windows, PowerShell, Node v24, npm 11, Docker 29 disponível; PostgreSQL NÃO está instalado localmente.

## Requisitos

### R1. Fundação (Fase 1)
Monorepo com `apps/web`, `apps/api` e `packages/domain`, usando a stack definida na seção 3 do contexto. Schema Prisma **completo** (seção 6) com migração inicial. Cadastro, login, logout e "quem sou eu" com senha em hash e sessão por cookie httpOnly; middleware que injeta `user_id` e bloqueia rotas sem sessão (401). Vitest e Zod configurados. Tela de login/cadastro e layout base com navegação vazia para os módulos.

### R2. Matérias e assuntos (Fase 2)
CRUD de matérias (nome, cor, arquivar) e de assuntos com hierarquia por `parent_id` de profundidade livre. Tela em árvore para visualizar, criar, renomear, mover e arquivar. Arquivar em vez de excluir quando houver sessões vinculadas. Impedir ciclos na hierarquia; mover preserva os filhos.

### R3. Restrições
- O foco de entrega são as Fases 1 e 2. As próximas fases (agenda, timer, metas, estatísticas, observatório) serão adicionadas em breve, então a arquitetura, a navegação e a organização do código devem estar preparadas para recebê-las sem retrabalho; não é preciso entregá-las agora, mas não as dificulte.
- Toda consulta filtra por `user_id`; toda entrada validada no backend com Zod.
- Não adicionar bibliotecas fora da stack sem justificar no relatório.
- **Banco:** PostgreSQL via docker-compose dentro do projeto. Fornecer `.env.example`.
- **Idioma:** identificadores de código seguem o schema do contexto em inglês (Subject, Topic, `user_id` etc.); **todo o resto em português** — textos da interface, mensagens de erro da API, comentários, README e relatório final.
- **Mover assunto:** pode mudar de pai e também de matéria; todos os descendentes acompanham (inclusive o `subject_id`).
- **Arquivar:** arquivar matéria ou assunto arquiva os descendentes em cascata; desarquivar restaura em cascata.
- **Excluir:** exclusão definitiva permitida apenas quando não houver sessões vinculadas (planejadas ou executadas) ao item ou a seus descendentes; caso haja, a API recusa e orienta a arquivar. A regra deve estar implementada e testada desde já (os testes podem inserir sessões diretamente no banco).
- **Fuso horário:** no cadastro, usar o fuso detectado no navegador; semana começa na segunda-feira.

## Critérios de Aceite

### Fase 1
- [ ] É possível criar conta, entrar, sair e acessar uma rota protegida.
- [ ] Usuário sem sessão recebe 401.
- [ ] Migração roda do zero sem erro em um banco vazio.
- [ ] Existe pelo menos um teste automatizado executando.

### Fase 2
- [ ] Um usuário nunca vê nem altera matérias ou assuntos de outro (testes de API com dois usuários).
- [ ] Não é possível criar ciclo (assunto pai de si mesmo ou de um descendente) — teste de API.
- [ ] Mover um assunto preserva seus filhos — teste de API.
- [ ] `npm test` passa na raiz; `tsc` sem erros em todos os pacotes.
- [ ] Testes de API cobrem: mover entre matérias levando descendentes, arquivar/desarquivar em cascata e recusa de exclusão quando há sessão vinculada.
- [ ] Um revisor independente consegue, seguindo apenas o README, subir o banco com Docker, rodar a migração, abrir a interface, criar conta e montar uma árvore com 3 níveis (criar, renomear, mover e arquivar) sem erros no console.

### Entrega
- [ ] Interface, mensagens e documentação em português.
- [ ] README em português com como rodar, testar e o que ficou de fora.
- [ ] Relatório final em português: resumo, arquivos criados/alterados, como rodar e testar, o que ficou de fora e bibliotecas adicionadas com justificativa.

## Follow-up — 2026-10-06T04:16:23Z

Lembrete do usuário (prioridade alta): ele reclamou que o projeto anterior ficou em inglês. O PROJECT.md publicado mistura inglês (títulos, tabela de Milestones, contratos). Por favor, garanta que TODOS os artefatos que ficam no repositório (PROJECT.md, README, comentários no código, mensagens de commit, mensagens de erro da API, textos da UI, relatório final) estejam em português. Apenas identificadores de código (nomes de modelos, campos, variáveis, rotas) ficam em inglês, conforme o schema do contexto. Corrija o PROJECT.md quando for conveniente.

## Follow-up — 2026-10-06T19:16:27Z

O servidor reiniciou. Por favor, recomece exatamente de onde parou. O último relatório indicava que o planejamento do Marco 2 (Autenticação e Layout) havia sido finalizado pelo agente substituto (explorer_m2_2_repl) e que o worker_m2 seria despachado para a implementação do código.


