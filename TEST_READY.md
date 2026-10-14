# TEST_READY — Certificação de Prontidão da Suíte E2E (Fases 1 & 2)

**Data de Emissão:** 2026-10-06T04:25:00Z  
**Autor:** Agente `test_writer_e2e_1` (Trilha de Testes E2E Opaque-Box)  
**Destinatário:** Orquestrador Geral e Agentes de Implementação (Marcos M1, M2, M3, M4, M5)  
**Status:** **CONCLUÍDO E PRONTO PARA VERIFICAÇÃO (TEST_READY)**

---

## 1. Resumo Executivo

A suíte completa de testes de ponta a ponta (E2E) para as **Fases 1 (Fundação)** e **Fase 2 (Matérias e Assuntos)** foi concebida, estruturada e implementada com sucesso.

Os testes foram desenvolvidos seguindo estritamente a metodologia **caixa-preta (opaque-box)**, garantindo conformidade total com os requisitos de `ORIGINAL_REQUEST.md` e `PROJECT.md` sem acoplamento a implementações internas transitórias.

---

## 2. Inventário de Artefatos Entregues

| Arquivo | Localização | Descrição |
|---|---|---|
| **TEST_INFRA.md** | Raiz (`c:\Users\cauad\Documents\Estudos\TEST_INFRA.md`) | Documentação técnica completa da infraestrutura, arquitetura, runner e matriz de rastreabilidade. |
| **TEST_READY.md** | Raiz (`c:\Users\cauad\Documents\Estudos\TEST_READY.md`) | Este certificado de prontidão para a equipe de orquestração. |
| **api-client.ts** | `tests/e2e/helpers/api-client.ts` | Cliente HTTP nativo com Cookie Jar para gestão de sessão httpOnly, métodos de domínio e multiusuário. |
| **test-runner.ts** | `tests/e2e/helpers/test-runner.ts` | Harness de testes universal compatível com Vitest e executável via Node 24 nativo sem dependências. |
| **db-helper.ts** | `tests/e2e/helpers/db-helper.ts` | Utilitário para injeção controlada de sessões planejadas e executadas (validação de proteção de exclusão). |
| **Tier 1 Test Suite** | `tests/e2e/tier1-feature-coverage.test.ts` | Cobertura isolada de autenticação, matérias, tópicos, movimentação na mesma matéria, transferência entre matérias e cascata. |
| **Tier 2 Test Suite** | `tests/e2e/tier2-boundary-corner-cases.test.ts` | Validação de limites (Zod, campos vazios), caracteres especiais/acentos em português, árvores com 5 níveis e detecção de ciclos. |
| **Tier 3 Test Suite** | `tests/e2e/tier3-cross-feature-combinations.test.ts` | Reparenting e mudança de matéria atômica simultânea, promoção de subárvore a raiz e restauração em cascata profunda. |
| **Tier 4 Test Suite** | `tests/e2e/tier4-real-world-scenarios.test.ts` | Cenário real de estudante ENEM (árvore de 3 níveis, proteção de exclusão por sessões vinculadas) e Multilocação Estrita com 2 usuários. |
| **runner.ts** | `tests/e2e/runner.ts` | Script de inicialização e execução com sumário formatado e código de saída limpo. |
| **vitest.config.ts** | `tests/e2e/vitest.config.ts` | Configuração oficial do Vitest para execução integrada no ecossistema npm. |

---

## 3. Cobertura de Requisitos das Fases 1 e 2

- [x] **R1 (Fundação):** Cadastro, login, logout, rota "quem sou eu", cookie de sessão `httpOnly`, bloqueio de rota protegida com 401.
- [x] **R2 (Matérias e Assuntos):** CRUD de matérias (nome, cor, arquivar), CRUD de assuntos com hierarquia livre (`parent_id`), movimentação na árvore mantendo integridade dos filhos.
- [x] **R3 (Regras e Restrições):**
  - Mover assunto para outra matéria atualiza `subject_id` recursivamente em todos os descendentes.
  - Prevenção de ciclos na árvore (rejeição com 400 de auto-ciclos e ciclos transitivos).
  - Arquivamento e desarquivamento em cascata.
  - Proteção de exclusão: bloqueio com 400/409 e orientação em português quando há sessões vinculadas (ao tópico ou a qualquer descendente).
  - Isolamento multilocatário estrito: usuário nunca lê, altera, arquiva ou exclui dados de outro usuário.
  - Idioma: validação de todas as mensagens e erros em português.

---

## 4. Como o Orquestrador e os Trabalhadores Devem Executar os Testes

Assim que a API e o banco de dados forem instanciados pela Trilha de Implementação (Marcos M1/M2/M3):

```powershell
# Opção 1: Via runner nativo Node 24 (rápido e sem dependência de build de testes)
node --experimental-strip-types tests/e2e/runner.ts

# Opção 2: Via Vitest (após npm install na raiz)
npm run test:e2e
# ou
npx vitest run --config tests/e2e/vitest.config.ts
```

---

## 5. Próximos Passos Recomendados
1. A Trilha de Implementação completa os Marcos M1 (Monorepo & Banco) e M2 (Auth & Sessão).
2. Executar `Tier 1 (Sub-suite 1.1)` para homologação do Marco M2.
3. A Trilha de Implementação completa o Marco M3 (Engine de Domínio e API de Matérias/Assuntos).
4. Executar os Tiers 1, 2, 3 e 4 completos para homologação total da Fase 2.
5. No Marco M5, a suíte servirá como base oficial para a homologação final da aplicação.
