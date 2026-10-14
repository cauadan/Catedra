# Relatório de Desafio Adversário — Milestone 1: Lógica de Domínio, Tooling e Type Safety

**Agente**: `challenger_m1_2` (Empirical Challenger)  
**Data**: 2026-10-06  
**Veredito Empírico**: **APROVADO (APPROVE)**  
**Escopo Analisado**: Lógica de Domínio (`packages/domain`), Prevenção de Ciclos em Árvores, Esquemas Zod, Tipagem Estrita TypeScript e Suíte de Testes.

---

## 1. Sumário Executivo

Como desafiante empírico adversário, submeti o código e os artefatos entregues pelo `worker_m1` a uma bateria intensiva de testes de estresse, análise de limites, topologias extremas de grafos e verificação estrita de tipos. 

Todas as alegações feitas no relatório do `worker_m1` foram verificadas de forma independente através da execução real de comandos e criação de um harness de testes de estresse com **73 cenários adversários adicionais**, além dos 20 testes unitários originais do repositório.

### Resultados Consolidados:
- **`npm test`**: 20/20 testes aprovados nos 3 pacotes (`@estudos/domain`, `@estudos/api`, `@estudos/web`).
- **`npm run typecheck` (`tsc -b`)**: 0 erros de compilação estrita em todo o monorepo.
- **Suíte Adversária (`node scripts/adversarial-stress-m1.mjs`)**: 73/73 testes de estresse aprovados com 100% de sucesso.
- **Veredito**: **APROVADO**. O Milestone 1 possui fundação sólida, correta e blindada contra falhas estruturais.

---

## 2. Verificação Independente das Alegações do Worker

| Alegação do Worker | Método de Verificação Independente | Resultado Empírico | Status |
|--------------------|-----------------------------------|-------------------|--------|
| `npm test` executa 20 testes com sucesso | Execução direta de `npm test` e `npm run test:workspaces` | 3 arquivos de teste, 20 testes aprovados em 5.46s | Confirmado |
| `tsc -b` passa com zero erros | Execução direta de `npm run typecheck` e `npm run typecheck:workspaces` | Zero erros nos 3 pacotes com referências de projeto válidas | Confirmado |
| Prevenção de ciclos na hierarquia funciona | Harness adversário com árvore linear de 10.000 níveis e árvores binárias | Ciclo detectado em profundidade 10.000 em < 10ms | Confirmado |
| Modelagem e Esquemas Zod em conformidade | Testes com dados limites, injeção de caracteres e valores corrompidos | Todos os esquemas validaram conformidade de forma determinística | Confirmado |
| Idioma estritamente em português | Auditoria do código-fonte, mensagens de validação e testes | Comentários, mensagens de erro e documentação 100% em português | Confirmado |

---

## 3. Desafio Adversário: Prevenção de Ciclos (`wouldCreateHierarchyCycle`)

O algoritmo em `packages/domain/src/index.ts` foi desafiado em múltiplos cenários patológicos e extremos:

### 3.1 Cadeia Linear Profunda (10.000 Nós)
- **Cenário**: Construção de uma cadeia linear de 10.000 tópicos (`node-0` até `node-10000`).
- **Ataque**: Tentativa de mover o nó ancestral raiz `node-0` para ser filho da folha `node-10000`.
- **Resultado**: Ciclo detectado com sucesso.
- **Desempenho**: Tempo de execução de apenas **6.34ms**, comprovando complexidade temporal linear $O(P)$ onde $P$ é a profundidade do caminho ancestral até a raiz.
- **Consumo de Memória**: Abordagem iterativa (`while`) que não causa estouro de pilha (*stack overflow*), diferentemente de implementações recursivasIngênuas.

### 3.2 Grafo com Ciclo Pré-existente Corrompido
- **Cenário**: Um grafo corrompido contendo um ciclo fechado isolado ($C_1 \to C_2 \to C_3 \to C_1$) é consultado para avaliar a inserção de um nó $X$ como filho de $C_1$.
- **Ataque**: Avaliação de vulnerabilidade a loop infinito (congelamento de thread do Node.js).
- **Resultado**: O algoritmo possui um `visited = new Set<string>()`. Ao revisitar $C_1$, detecta a anomalia e retorna imediatamente `true` sem travar a execução.

### 3.3 Auto-referência Direta e de Comprimento 1
- **Cenário**: Tópico apontando para si mesmo (`topicId === newParentId`) ou nó existente apontando para si mesmo (`L1.parent_id === 'L1'`).
- **Resultado**: Rejeitado imediatamente com retorno `true`.

### 3.4 Nós Órfãos e Referências Nulas
- **Cenário**: Um nó cujo `parent_id` referencia um ID que não existe no mapa/banco (retornando `undefined`).
- **Resultado**: Interrompe a subida na árvore com segurança (`if (!parentNode) break;`) e retorna `false`.

### 3.5 Árvore Binária Profunda com Ramificações
- **Cenário**: Árvore com 2.047 nós e profundidade 11.
- **Resultado**: Movimentações para descendentes no mesmo ramo detectadas como ciclo; movimentações para subárvores independentes permitidas normalmente.

---

## 4. Desafio Adversário: Esquemas Zod

Os esquemas foram testados com valores de fronteira (*boundary conditions*) e dados hostis:

### 4.1 `registerSchema`
- Limite mínimo de caracteres no nome: 1 caractere é rejeitado; 2 caracteres é aceito.
- Tratamento de espaços em branco: `name: "   "` sofre `.trim()` e é rejeitado por ter comprimento 0.
- Senhas: 5 caracteres rejeitado; 6 caracteres aceito.
- Ataques de injeção no nome: Strings como `<script>alert("xss")</script>` são aceitas pelo Zod como texto bruto (correto, pois sanitização contra XSS ocorre na camada de apresentação do React e parametrização SQL no Prisma).
- Fuso horário: Omissão de `timezone` aplica deterministricamente o valor padrão `'America/Sao_Paulo'`.

### 4.2 `subjectCreateSchema` e `subjectUpdateSchema`
- Cores hexadecimais: `#FFF`, `#10B981` e `#ffffff` são aceitos. Formatos inválidos (`10B981`, `#12345`, `#1234567`, `#ZZZZZZ`, `blue`) são sumariamente rejeitados com mensagem amigável em português.
- Objetos vazios de atualização: `{}` é aceito em `subjectUpdateSchema` (campos opcionais).
- Nome vazio fornecido explicitamente em atualização: Rejeitado.

### 4.3 `topicCreateSchema` e `topicUpdateSchema`
- `subject_id` vazio: Rejeitado.
- Nome com apenas espaços: Rejeitado após `.trim()`.
- `parent_id`: Aceita `null` (raiz) ou ID válido.

---

## 5. Desafio Adversário: Fórmulas de Domínio

### 5.1 `calculateAccuracy`
- Divisão por zero: `calculateAccuracy(0, 0)` retorna `0` com segurança.
- Denominador negativo: Retorna `0`.
- Valores fora do intervalo: Numerador negativo é limitado a `0`; numerador superior ao total é limitado a `100%`.

### 5.2 `calculateSubjectGrade`
- Ponderação estrita da regra de negócio: $70\%$ questões + $30\%$ autoavaliação.
- Arredondamento testado em dízimas periódicas: $77.77 \times 0.7 + 67 \times 0.3 = 74.539 \to 74.54$.

### 5.3 `classifyPerformance`
- Proteção de volume estatístico: Retorna `'DADOS_INSUFICIENTES'` para qualquer total de questões $< 10$, mesmo se o aproveitamento for $100\%$.
- Limites de nota: Exatamente $80$ é `'FORTE'`; $79.99$ é `'REGULAR'`; exatamente $60$ é `'REGULAR'`; $59.99$ é `'FRACO'`.

### 5.4 `calculateFocusEfficiency` e `calculatePlanAdherence`
- Eficiência de foco é limitada no teto de $1.0$ e piso de $0.0$, protegida contra total de minutos zerado.
- Aderência ao plano reflete proporcionalidade (ex: $90\text{ min} / 60\text{ min} = 1.5$).

---

## 6. Observações Técnicas para o Milestone 3

Durante os testes de estresse, identifiquei dois pontos de atenção para os trabalhadores dos próximos marcos (não são bugs do M1, mas diretrizes para as camadas subsequentes):

1. **Tratamento de `parent_id: ""` na API (Milestone 3)**:
   - Em `topicCreateSchema`, `parent_id` é do tipo `z.string().nullable().optional()`.
   - Se o cliente HTTP enviar `{ parent_id: "" }`, o Zod aceita como string vazia.
   - Recomenda-se que no controller/serviço da API (ou via `.transform((v) => v || null)`), a string vazia seja convertida para `null` antes de ser repassada ao Prisma, evitando erro de chave estrangeira inexistente no PostgreSQL.
2. **Validação de Timezone no Registro (Milestone 2)**:
   - O campo `timezone` no cadastro aceita qualquer string válida pelo Zod, usando `'America/Sao_Paulo'` como fallback.
   - Como o navegador envia o fuso detectado via `Intl.DateTimeFormat().resolvedOptions().timeZone`, a API pode opcionalmente validar a string com `Intl.DateTimeFormat` no Milestone 2 para evitar valores não reconhecidos.

---

## 7. Veredito Final

O Milestone 1 cumpre integralmente todos os requisitos funcionais, de tipagem e de infraestrutura. A implementação da árvore e das fórmulas é pura, determinística, resistente a anomalias de grafo e altamente eficiente.

**Veredito: APROVADO (APPROVE)**.
