# Infraestrutura de Testes End-to-End (E2E) — Fases 1 & 2

Plataforma de Gestão e Análise de Estudos

---

## 1. Visão Geral da Arquitetura de Testes E2E

A suíte de testes ponta-a-ponta (E2E) foi projetada estritamente sob a metodologia **caixa-preta opaca (opaque-box)**, garantindo que todo o comportamento da aplicação seja verificado a partir de seus contratos de interface externos (APIs HTTP, cabeçalhos, cookies de sessão e códigos de status) e regras de negócio especificadas em `ORIGINAL_REQUEST.md` e `PROJECT.md`, sem acoplamento com detalhes internos de implementação.

### 1.1 Princípios Arquiteturais
1. **Independência de Execução:** Cada suíte e caso de teste é auto-contido. Usuários e entidades de teste utilizam sufixos temporais únicos (`timestamp + random`), evitando colisão de dados e permitindo execuções repetidas sem necessidade de reset manual do banco.
2. **Isolamento de Sessão:** O cliente HTTP gerencia cookies em memória (`CookieJar`) individual por instância, permitindo simular com fidelidade múltiplos navegadores simultâneos e testar concorrência e autorização multilocatária estrita.
3. **Dual-Mode Runner:**
   - **Modo Vitest Integrado:** Compatível com o pipeline padrão de CI/CD e com o comando `npx vitest run tests/e2e` configurado em `tests/e2e/vitest.config.ts`.
   - **Modo Autônomo Nativo (Node 24):** Executável diretamente via `node --experimental-strip-types tests/e2e/runner.ts`, com zero dependências externas requeridas para inicialização imediata.
4. **Respeito aos Idiomas:** Validação de mensagens de erro emitidas em português e identificadores de banco/API em inglês, conforme R3.

---

## 2. Estrutura de Arquivos da Suíte E2E

```text
tests/e2e/
├── helpers/
│   ├── api-client.ts       # Cliente HTTP com gerenciamento de sessão, cookies e métodos de domínio
│   ├── test-runner.ts      # Harness universal de testes (describe, it, expect, matchers, runner)
│   └── db-helper.ts        # Utilitário para injeção direta de sessões de estudo (regra de proteção de exclusão)
├── tier1-feature-coverage.test.ts          # Tier 1: Cobertura de funcionalidades isoladas (happy path)
├── tier2-boundary-corner-cases.test.ts      # Tier 2: Casos de fronteira, validações Zod e prevenção de ciclos
├── tier3-cross-feature-combinations.test.ts # Tier 3: Movimentações complexas, reparenting e cascata profunda
├── tier4-real-world-scenarios.test.ts       # Tier 4: Fluxo de estudante real e multilocação estrita (2 usuários)
├── runner.ts               # Ponto de entrada do executor autônomo com sumário visual
└── vitest.config.ts        # Configuração oficial do Vitest para execução E2E
```

---

## 3. Matriz de Rastreabilidade e Cobertura de Funcionalidades

A tabela abaixo mapeia cada funcionalidade do inventário (`PROJECT.md`) para os arquivos e suítes de teste correspondentes:

| # | Funcionalidade (PROJECT.md) | Nível / Tier | Arquivo de Teste | Casos Cobertos |
|---|-----------------------------|--------------|------------------|----------------|
| **5** | Cadastro de Usuário | Tier 1, 2, 4 | `tier1-feature-coverage.test.ts`<br>`tier2-boundary-corner-cases.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Criação com nome, email, senha, fuso horário; emissão de cookie httpOnly; rejeição de email duplicado ou vazio. |
| **6** | Login & Sessão | Tier 1, 4 | `tier1-feature-coverage.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Autenticação com credenciais válidas, renovação/emissão de sessão httpOnly, rejeição de credenciais inválidas (401). |
| **7** | Logout | Tier 1 | `tier1-feature-coverage.test.ts` | Invalidação de sessão, limpeza de cookie e bloqueio imediato a rotas protegidas subsequentes. |
| **8** | Quem Sou Eu (`GET /api/auth/me`) | Tier 1, 4 | `tier1-feature-coverage.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Recuperação dos dados do usuário autenticado (`id`, `name`, `email`, `timezone`, `week_starts_on`). |
| **9** | Middleware de Autenticação | Tier 1 | `tier1-feature-coverage.test.ts` | Bloqueio sistemático com HTTP 401 para requisições anônimas em rotas protegidas. |
| **11** | CRUD de Matérias | Tier 1, 2, 4 | `tier1-feature-coverage.test.ts`<br>`tier2-boundary-corner-cases.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Criação (nome + cor), listagem filtrada (`include_archived`), atualização e arquivamento. |
| **12** | CRUD de Assuntos (Hierarquia Livre) | Tier 1, 2, 4 | `tier1-feature-coverage.test.ts`<br>`tier2-boundary-corner-cases.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Assunto raiz (`parent_id: null`), filhos com profundidade arbitrária (níveis 1 a 5+), listagem por `subject_id`. |
| **13** | Prevenção de Ciclos na Árvore | Tier 2 | `tier2-boundary-corner-cases.test.ts` | Rejeição de auto-ciclo direto (`parent_id = topic.id`) e ciclos indiretos (ancestrais virando filhos) com HTTP 400. |
| **14** | Mover Assunto (Mesma Matéria) | Tier 1, 3, 4 | `tier1-feature-coverage.test.ts`<br>`tier3-cross-feature-combinations.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Reparenting preservando integridade de todos os filhos e descendentes da subárvore. |
| **15** | Mover Assunto (Outra Matéria) | Tier 1, 3 | `tier1-feature-coverage.test.ts`<br>`tier3-cross-feature-combinations.test.ts` | Transferência para nova matéria com atualização recursiva de `subject_id` em todos os descendentes. |
| **16** | Arquivamento em Cascata | Tier 1, 3, 4 | `tier1-feature-coverage.test.ts`<br>`tier3-cross-feature-combinations.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Arquivar matéria cascateia para tópicos; arquivar assunto cascateia para subárvore; desarquivamento restaura em cascata. |
| **17** | Proteção de Exclusão (Sessões) | Tier 1, 4 | `tier1-feature-coverage.test.ts`<br>`tier4-real-world-scenarios.test.ts` | Exclusão limpa (204) quando sem sessões; rejeição (400/409) com orientação de arquivar quando há sessões vinculadas. |
| **18** | Isolamento Multilocatário Estrito | Tier 4 | `tier4-real-world-scenarios.test.ts` | Usuário 2 não pode listar, visualizar, alterar, mover, arquivar ou excluir matérias e assuntos do Usuário 1. |
| **21** | Testes E2E Completos (Tiers 1-4) | Todos | Todos os arquivos | 100% dos requisitos de negócio validados de ponta a ponta. |

---

## 4. Detalhamento dos Níveis de Teste (Tiers)

### Tier 1: Cobertura de Funcionalidades Isoladas (Feature Coverage)
- **Foco:** Caminho feliz isolado e comportamento individual das APIs de autenticação, matérias, assuntos, movimentação básica e deleção desimpedida.
- **Validações:** Status HTTP 201, 200, 204 e 401; integridade do formato de resposta JSON.

### Tier 2: Casos de Fronteira e Validações Adversárias (Boundary & Corner Cases)
- **Foco:** Resiliência contra dados maliciosos ou corrompidos e validação rígida via Zod.
- **Validações:**
  - Campos em branco ou compostos apenas por espaços (`""`, `"   "`).
  - Emails sem formato RFC válido.
  - Títulos extensos (150+ caracteres) e suporte a acentuação em português (`á, é, í, ó, ú, ç, ã`), símbolos matemáticos e emojis.
  - Árvores profundas com 5 níveis hierárquicos (Raiz -> Filho -> Neto -> Bisneto -> Trineto).
  - IDs sintéticos inexistentes (UUIDs aleatórios) retornando 404/400.
  - Detecção e bloqueio de auto-ciclos e ciclos transitivos na árvore de assuntos.

### Tier 3: Combinações Cruzadas de Funcionalidades (Cross-Feature Combinations)
- **Foco:** Operações compostas em lote que envolvem múltiplos conceitos simultâneos.
- **Validações:**
  - Alteração de matéria e reparenting de nó intermediário em uma única chamada `PATCH`.
  - Migração de nó filho para raiz de outra matéria (`parent_id: null` + novo `subject_id`).
  - Restauração e desarquivamento em cascata reversa em árvores profundas.

### Tier 4: Cenários do Mundo Real (Real-World Scenarios)
- **Cenário 4.1 (Fluxo do Estudante ENEM):**
  - Registro com timezone `America/Sao_Paulo`.
  - Construção do currículo com Matemática (3 níveis) e Física (2 níveis).
  - Reparenting estrutural.
  - Bloqueio de exclusão por sessão de estudo vinculada e verificação de mensagem amigável orientando arquivamento.
  - Execução de arquivamento da matéria/assunto com cascata completa.
- **Cenário 4.2 (Multilocação Estrita com 2 Usuários):**
  - Usuária Alice vs Usuário Bob com sessões independentes.
  - Verificação de que Bob não enxerga matérias nem tópicos de Alice.
  - Bloqueio com 404/403 em tentativas de Bob de alterar, arquivar, excluir ou criar tópicos nas matérias de Alice.
  - Bloqueio de tentativa de Bob de associar um tópico seu como filho de um tópico de Alice.

---

## 5. Semântica de Sucesso e Falha (Pass/Fail Semantics)

1. **Códigos de Status HTTP:**
   - `201 Created`: Criação com sucesso de usuários, matérias e tópicos.
   - `200 OK`: Consultas, atualizações parciais (`PATCH`) e logout.
   - `204 No Content`: Exclusão física autorizada (sem sessões vinculadas).
   - `400 Bad Request`: Violação de validação Zod, campos vazios, ou tentativa de ciclo na hierarquia.
   - `401 Unauthorized`: Tentativa de acesso sem sessão ou com credenciais inválidas.
   - `403 Forbidden` ou `404 Not Found`: Tentativa de acesso ou modificação em recursos pertencentes a outro usuário.
   - `400 Bad Request` ou `409 Conflict`: Tentativa de exclusão de tópico/matéria com sessões vinculadas.

2. **Formato Padrão de Resposta de Erro:**
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | CONFLICT | DOMAIN_RULE_VIOLATION",
       "message": "Mensagem descritiva em português",
       "details": [
         { "field": "nome_do_campo", "message": "Mensagem detalhada em português" }
       ]
     }
   }
   ```

3. **Mensagens em Português:**
   Todas as respostas de erro emitidas pelo backend devem ser validadas em língua portuguesa, confirmando os requisitos R1, R2 e R3 do projeto.

---

## 6. Como Executar os Testes

### Pré-requisitos
1. Servidor de API em execução (`apps/api`), por padrão em `http://localhost:3001` (ou configurado via variável de ambiente `API_URL`).
2. Banco de dados PostgreSQL ativo via Docker Compose:
   ```bash
   docker compose up -d
   ```

### Execução via Runner Autônomo (Node 24)
Sem necessidade de compilação ou instalação prévia de pacotes de teste:
```powershell
node --experimental-strip-types tests/e2e/runner.ts
```

### Execução via Vitest
Quando as dependências npm estiverem instaladas na raiz do projeto:
```powershell
npx vitest run --config tests/e2e/vitest.config.ts
# ou através do script raiz:
npm run test:e2e
```
