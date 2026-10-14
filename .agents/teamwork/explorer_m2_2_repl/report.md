# Relatório de Design Técnico: Frontend Web Auth & Base Layout (Marco 2)

**Data:** 2026-10-06  
**Autor:** `explorer_m2_2_repl`  
**Escopo:** `apps/web` (Autenticação, Gestão de Sessão, Roteador Leve, Shell Responsivo e Páginas)  
**Destinatário:** Orquestrador Geral e Worker do Milestone 2  

---

## 1. Resumo Executivo e Arquitetura

Este documento estabelece o design técnico completo para a camada frontend (`apps/web`) do Marco 2 da Plataforma de Gestão e Análise de Estudos, em estrita conformidade com `ORIGINAL_REQUEST.md`, `PROJECT.md` e o contrato de backend detalhado em `.agents/teamwork/explorer_m2_1/report.md`.

### 1.1 Decisões Arquiteturais Centrais
1. **Comunicação Segura de Sessão**: O cliente HTTP base (`src/lib/api.ts`) utiliza `credentials: 'include'` em todas as chamadas. Os cookies `session_id` (`httpOnly`, `SameSite=Lax`) emitidos pelo backend são trafegados e mantidos automaticamente pelo navegador.
2. **Roteador Leve Zero-Dependencies (React 19)**: Sistema de roteamento próprio (`src/contexts/RouterContext.tsx`) em menos de 100 linhas. Suporta tanto caminhos de URL (`/login`, `/subjects`) quanto fallback por *hash* (`#/login`), intercepta cliques para navegação SPA e escuta eventos `popstate` e `hashchange`.
3. **Detecção Automática de Fuso Horário**: Utiliza a API nativa `Intl.DateTimeFormat().resolvedOptions().timeZone` com fallback seguro para `'America/Sao_Paulo'`. O fuso detectado é enviado no payload de cadastro (`POST /api/auth/register`) e exibido visualmente na interface.
4. **Shell Responsivo com 7 Módulos**: Barra lateral colapsável no mobile com menu gaveta e fixa no desktop, cabeçalho com identificação do usuário, fuso horário, semana iniciando na segunda-feira e atalhos para todos os módulos planejados (com destaque para "Matérias e Assuntos" pronto para a Fase 2).
5. **Idioma Rigorosamente em Português**: 100% das mensagens, rótulos de campos, feedbacks de validação, placeholders e botões na língua portuguesa.

---

## 2. Catálogo de Arquivos Propostos para o Worker

Todos os códigos-fonte foram gerados, revisados e encontram-se disponíveis no diretório do agente para cópia direta:

| Arquivo de Destino (`apps/web/src/`) | Fonte Proposta (`.agents/teamwork/explorer_m2_2_repl/`) | Linhas | Responsabilidade |
|---|---|---|---|
| `types/auth.ts` | `proposed_types_auth.ts` | ~30 | Tipagens de usuário, inputs e envelopes de erro |
| `lib/utils.ts` | `proposed_lib_utils.ts` | ~10 | Concatenação de classes CSS via `clsx` e `tailwind-merge` |
| `lib/timezone.ts` | `proposed_lib_timezone.ts` | ~25 | Detecção via `Intl` e formatação amigável de fuso |
| `lib/api.ts` | `proposed_lib_api.ts` | ~70 | Cliente HTTP com `credentials: 'include'` e classe `ApiError` |
| `contexts/RouterContext.tsx` | `proposed_contexts_RouterContext.tsx` | ~110 | Roteador cliente SPA (React 19, zero dependências) |
| `contexts/AuthContext.tsx` | `proposed_contexts_AuthContext.tsx` | ~90 | Provedor de autenticação (`login`, `register`, `logout`, `/me`) |
| `components/auth/ProtectedRoute.tsx` | `proposed_components_ProtectedRoute.tsx` | ~35 | Guardião de rotas autenticadas com redirecionamento |
| `components/layout/Shell.tsx` | `proposed_components_Shell.tsx` | ~200 | Layout base, sidebar responsiva, drawer mobile e header |
| `pages/Login.tsx` | `proposed_pages_Login.tsx` | ~150 | Formulário de login, validação em PT-BR e link para cadastro |
| `pages/Register.tsx` | `proposed_pages_Register.tsx` | ~190 | Formulário de cadastro, detecção de fuso e validação em PT-BR |
| `pages/Dashboard.tsx` | `proposed_pages_Dashboard.tsx` | ~140 | Painel inicial com status operacional e cards de módulos |
| `pages/PlaceholderModule.tsx` | `proposed_pages_PlaceholderModule.tsx` | ~90 | Tela informativa para módulos futuros e Fase 2 |
| `App.tsx` | `proposed_App.tsx` | ~100 | Integração de rotas públicas e privadas dentro do Shell |
| `main.tsx` | `proposed_main.tsx` | ~30 | Ponto de entrada com `QueryClientProvider` do TanStack Query |
| `../tests/auth-and-shell.test.tsx` | `proposed_tests_auth.test.tsx` | ~45 | Testes unitários de fuso horário, shell e navegação |

---

## 3. Especificação das Telas e Fluxos

### 3.1 Tela de Login (`/login`)
- **Entradas**: E-mail e Senha (com alternância de visibilidade do campo).
- **Validação Local**: Verifica obrigatoriedade e formato de e-mail antes do disparo.
- **Integração**: Aciona `POST /api/auth/login`. Em caso de HTTP 401, exibe `"Credenciais inválidas. Verifique seu e-mail e senha."` em banner de erro estilizado em vermelho suave.
- **Sucesso**: Redireciona o usuário diretamente para `/dashboard`.

### 3.2 Tela de Cadastro (`/register`)
- **Entradas**: Nome completo (mínimo 2 caracteres), E-mail, Senha (mínimo 6 caracteres), Confirmação de senha e exibição do fuso detectado.
- **Validação Local**: Garante coincidência de senhas (`"As senhas não coincidem."`) e regras de tamanho.
- **Integração**: Aciona `POST /api/auth/register` enviando `timezone`. Caso o e-mail já exista (HTTP 409), exibe `"Já existe um usuário cadastrado com este e-mail."`.
- **Sucesso**: Redireciona para `/dashboard`.

### 3.3 Shell Base e Navegação
- **Estrutura**:
  - `Painel` (`/dashboard`): Visão geral dos estudos e status do sistema.
  - `Matérias e Assuntos` (`/subjects`): Marcador pronto para a Fase 2 (CRUD e árvore de tópicos).
  - `Agenda e Planejamento` (`/agenda`), `Cronômetro de Estudo` (`/timer`), `Metas de Estudo` (`/goals`), `Desempenho e Estatísticas` (`/stats`), `Observatório Semanal` (`/observatory`): Marcadores futuros com cartões explicativos.
- **Header e Perfil**:
  - Exibe avatar com iniciais do nome, nome completo e fuso horário.
  - Botão de logout que limpa a sessão tanto no servidor (`/api/auth/logout`) quanto no estado local, redirecionando para `/login`.

---

## 4. Recomendações Práticas para o Worker

1. **Gravação dos Arquivos**: Copiar diretamente os arquivos `proposed_*` para seus respectivos caminhos sob `apps/web/src/`.
2. **Build e Testes**: Executar `npm run build --workspace=@estudos/web` e `npm run test --workspace=@estudos/web` para confirmar integridade completa.
3. **Consistência de Módulos**: Como `apps/web/tsconfig.json` utiliza `"moduleResolution": "Bundler"`, imports internos sem extensão funcionam perfeitamente e mantêm o código limpo.
