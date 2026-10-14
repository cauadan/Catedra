# Relatório de Revisão e Crítica Adversária: Marco 2 (Frontend Web Auth, Shell Layout & Interface)

**Data:** 2026-10-06  
**Revisor:** `reviewer_m2_2` (Reviewer & Adversarial Critic)  
**Escopo Avaliado:** Marco 2 — Autenticação Web Frontend, Roteamento SPA, Layout Shell, Validações e Conformidade Linguística  
**Veredicto Final:** **APPROVE** (Aprovado)

---

## 1. Sumário Executivo da Revisão

A auditoria independente e adversarial do Marco 2 analisou a implementação do frontend web localizado em `apps/web/src/`, as suítes de testes (`apps/web/tests/`, `tests/e2e/`), a compilação do monorepo e o relatório do `worker_m2`.

### Principais Constatações:
1. **Auditoria de Integridade**: Nenhuma violação de integridade detectada. Não há resultados de teste embutidos (hardcoded), nem implementações ocas (dummy/facades) ou atalhos artificiais. Toda a lógica de autenticação, sessões, roteamento, controle de acesso e tratamento de erros foi implementada de ponta a ponta com lógica real.
2. **Conformidade Estrita com a Diretriz de Idioma (Português)**: 100% dos textos visíveis na interface, rótulos de acessibilidade (`aria-label`), mensagens de validação de formulário, envelopes de erro capturados e marcadores de navegação estão em português do Brasil. Os identificadores de código preservam os termos em inglês exigidos pelo schema do banco e especificações de contrato.
3. **Execução de Build e Testes**: Todos os testes passaram sem advertências ou falhas:
   - `npm --workspace=@estudos/web run test`: 5/5 testes aprovados.
   - `npm run build`: Compilação de produção (`@estudos/domain`, `@estudos/api`, `@estudos/web`) concluída com êxito em 7.16s.
   - `npm test` (monorepo): 36/36 testes aprovados em 5 arquivos.
   - `npm run typecheck` (`tsc -b`): Zero erros de tipagem.
   - E2E Sub-suíte 1.1 (`1.1 Autenticação e Sessão`): 5/5 cenários aprovados.

---

## 2. Auditoria Detalhada dos Componentes

### 2.1 Contexto de Autenticação e Tipos (`AuthContext.tsx` e `types/auth.ts`)
- **Restauração de Sessão**: O hook `useEffect` dispara `fetchCurrentUser` que consulta `GET /api/auth/me`. Em caso de HTTP 401 ou erro de rede, o estado `user` é definido como `null` e `isLoading` é finalizado de forma determinística (`finally`), prevenindo telas congeladas.
- **Login e Registro**: Ambos os métodos executam chamadas à API via cliente HTTP centralizado, atualizam o estado atômico `user` e retornam a entidade segura (`SafeUser` / `UserProfile`) para o chamador.
- **Encerramento de Sessão (`logout`)**: Chama `POST /api/auth/logout` no backend para invalidar o cookie de sessão no servidor e garante, em bloco `finally`, a limpeza do usuário no estado local da aplicação mesmo se a requisição remota falhar por problemas transitórios de rede.
- **Contratos de Tipagem**: Totalmente alinhados aos esquemas do `@estudos/domain`.

### 2.2 Utilitário de Fuso Horário (`lib/timezone.ts`)
- **Detecção do Navegador**: Invoca `Intl.DateTimeFormat().resolvedOptions().timeZone` envolvido em bloco `try/catch`. Caso o navegador não exponha o método ou ocorra falha, recorre com segurança ao padrão `'America/Sao_Paulo'`.
- **Formatação Amigável**: Função `formatTimezoneLabel` mapeia `America/Sao_Paulo` para `"Horário de Brasília (America/Sao_Paulo)"`, garantindo clareza para o usuário brasileiro.

### 2.3 Cliente HTTP Base (`lib/api.ts`)
- **Envio de Credenciais**: Configurado explicitamente com `credentials: 'include'`, permitindo o transporte seguro de cookies `httpOnly` através de requisições autenticadas (inclusive sob o proxy do Vite).
- **Extração e Tratamento de Erros**: Interpreta envelopes de erro padronizados (`{ error: { code, message, details } }`). Em casos de resposta sem corpo JSON (como quedas de servidor ou respostas HTTP 204), fornece fallbacks em português com base nos códigos HTTP (401, 404, >= 500).

### 2.4 Guarda de Rotas Privadas (`ProtectedRoute.tsx`)
- **Estado de Carregamento**: Apresenta indicador visual acessível ("Verificando autenticação...") durante a validação da sessão em `fetchCurrentUser`.
- **Redirecionamento**: Redireciona usuários desautenticados para `/login` usando `<Redirect to="/login" />` sem loops de redirecionamento.
- **Acesso Autorizado**: Renderiza os nós filhos (`children`) de maneira transparente quando o usuário está autenticado.

### 2.5 Estrutura de Layout e Navegação (`Shell.tsx`)
- **Barra Lateral Responsiva e Gaveta Mobile**: Menu lateral para desktop (`md:flex`) e gaveta modal (`mobileMenuOpen`) para dispositivos móveis com overlay sombreado, botão de fechar (`X`), fechamento ao clicar fora ou navegar.
- **Marcadores dos 7 Módulos**:
  1. *Painel* (`/dashboard`)
  2. *Matérias e Assuntos* (`/subjects`) — com destaque visual e insígnia *"Fase 2"*
  3. *Agenda e Planejamento* (`/agenda`)
  4. *Cronômetro de Estudo* (`/timer`)
  5. *Metas de Estudo* (`/goals`)
  6. *Desempenho e Estatísticas* (`/stats`)
  7. *Observatório Semanal* (`/observatory`)
- **Perfil do Usuário e Cabeçalho**: Apresenta iniciais do usuário, nome, e-mail, fuso horário detectado, indicador de início da semana na segunda-feira e botão "Encerrar Sessão" com feedback visual de carregamento.

### 2.6 Telas de Autenticação (`Login.tsx` e `Register.tsx`)
- **Validação Local em Português**:
  - `Login`: E-mail obrigatório, formato de e-mail e senha obrigatória.
  - `Register`: Nome obrigatório (mínimo 2 caracteres), e-mail obrigatório e formato, senha obrigatória (mínimo 6 caracteres), confirmação de senha obrigatória e correspondência de senhas ("As senhas não coincidem").
- **Mapeamento de Erros de Campo da API**: Os erros do backend retornados em `error.details` são mapeados diretamente para cada campo no formulário.
- **Acessibilidade e Usabilidade**: Alternância de visibilidade de senha (ícones `Eye` / `EyeOff` com `aria-label`), desativação de botão durante envio e spinners animados.

---

## 3. Avaliação Adversária e Testes de Estresse

| Cenário de Teste / Hipótese Adversária | Comportamento Esperado | Comportamento Observado | Veredicto |
|---|---|---|---|
| **Ausência de suporte a `Intl.DateTimeFormat`** | Fallback seguro para `America/Sao_Paulo` sem disparar exceção não tratada. | `try/catch` captura qualquer falha e retorna o fallback estável. | **Aprovado** |
| **Resposta HTTP 401 na inicialização da aplicação** | Identificar sessão inexistente, setar `user` como `null`, encerrar `isLoading` e manter rota pública ou redirecionar rota privada. | `catch` filtra `status === 401`, limpa `user` e `finally` seta `isLoading = false`. | **Aprovado** |
| **Tentativa de acesso a rota privada sem autenticação** | Bloqueio imediato com redirecionamento para `/login`. | `ProtectedRoute` renderiza `<Redirect to="/login" />`. | **Aprovado** |
| **Usuário já autenticado acessa `/login` ou `/register`** | Redirecionamento automático para `/dashboard` sem piscar tela de formulário. | `AppRoutes` verifica `isAuthenticated` e renderiza `<Redirect to="/dashboard" />`. | **Aprovado** |
| **Falha ou indisponibilidade da API no logout** | Limpeza do estado local do usuário mesmo se o servidor falhar. | Bloco `finally` em `logout()` garante `setUser(null)`. | **Aprovado** |
| **Envio de resposta HTTP 204 sem corpo** | Cliente HTTP não quebra com erro de parsing JSON. | `apiFetch` verifica `status === 204` e `content-length === '0'` retornando `undefined`. | **Aprovado** |
| **Tentativa de cadastro com senhas divergentes** | Validação bloqueia envio e orienta em português. | Mensagem "As senhas não coincidem." exibida abaixo do campo. | **Aprovado** |

---

## 4. Reivindicações Verificadas Independentemente

- **Comando:** `npm --workspace=@estudos/web run test`
  - **Resultado:** 5 testes aprovados em 2 arquivos (0 falhas).
- **Comando:** `npm run build`
  - **Resultado:** 1645 módulos transformados, chunks gerados em `dist/`, 0 erros.
- **Comando:** `npm test`
  - **Resultado:** 36 testes aprovados em 5 arquivos no monorepo (100% de sucesso).
- **Comando:** `npm run typecheck`
  - **Resultado:** `tsc -b` finalizado com código 0 (zero erros de tipagem).
- **Comando:** `npx vitest run --config tests/e2e/vitest.config.ts -t "1.1 Autenticação e Sessão"`
  - **Resultado:** 5/5 testes E2E aprovados contra a API real.

---

## 5. Veredicto Final

**VEREDICTO: APPROVE**

O trabalho desenvolvido pelo `worker_m2` atende plenamente e com rigor a todas as especificações do Marco 2 descritas em `ORIGINAL_REQUEST.md` e `PROJECT.md`. O código é limpo, seguro, resiliente, totalmente em português e livre de qualquer padrão de violação de integridade. A base está pronta para a transição para o **Marco 3 (Motor de Domínio e API de Matérias e Assuntos)**.
