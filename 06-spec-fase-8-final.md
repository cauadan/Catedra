# Fase 8 — Finalização do MVP: Classificação, Observatório e Dashboard

Leia integralmente o arquivo `01-contexto-do-projeto.md` anexado. Ele é a fonte de verdade para as decisões do produto e prevalece sobre qualquer suposição. Use também `02-prompts-por-fase.md` apenas como contexto histórico, caso esteja disponível.

Implemente SOMENTE a **Fase 8 — Classificação de Assuntos, Observatório Semanal e Restauração Completa do Dashboard**, neste repositório existente. Não recrie a aplicação, não substitua a arquitetura e não antecipe funcionalidades fora do escopo.

## Regras gerais de execução
- Trabalhe sobre o código real do repositório. Não presuma que arquivos, branches, scripts, dependências, rotas ou assinaturas existem: confirme-os antes de usá-los.
- Preserve alterações locais preexistentes. Antes de qualquer operação Git que possa alterar ou descartar trabalho, inspecione `git status` e não descarte alterações do usuário.
- Não altere o banco de dados nem `schema.prisma`.
- Não declare uma tarefa, teste ou critério como concluído sem evidência observada.
- Se uma exigência não puder ser atendida por causa do estado real do repositório, explique a evidência e proponha a menor alternativa segura. Não invente compatibilidade, saídas de comandos nem resultados.
- Quando houver conflito entre este prompt e o contexto do projeto, interrompa a implementação do ponto conflitante e explique a divergência antes de decidir.

### ⚙️ 1. CONTROLE DE WORKFLOW, SKILLS E INSPEÇÃO INICIAL (OBRIGATÓRIO)
1. **Idioma e Nomenclatura:**
   - Identificadores de código (funções, variáveis, rotas, tipos) em **inglês**.
   - Interface, mensagens de erro da API/Zod, validações, comentários, commits, `README.md` e relatório final estritamente em **Português do Brasil (pt-BR)** (usando "você").
2. **Protocolo de execução e aprovação (sem código antes da aprovação):**
   - **NÃO** use `subagent-driven-development` e **NÃO** abra ciclos de `brainstorming`.
   - Use `graphify` / `trail-code` somente se já estiverem disponíveis no ambiente; não gaste tempo instalando ferramentas para esta tarefa. Caso contrário, faça buscas direcionadas nos pontos de entrada e confirme as assinaturas lendo os arquivos reais.
   - Não use resultados de busca isolados como prova de uma assinatura: abra o arquivo relevante e confira o tipo, os chamadores e os testes existentes.
   - **Passo 1 — inspeção obrigatória antes do plano:** inspecione o repositório e registre evidências concisas para os seis itens abaixo. Não altere arquivos nem execute formatação automática nesta etapa. Inclua no plano:
     1. O estado real das branches Git (`master` e `fase-6-7-metas-estatisticas`), incluindo a branch atual, o estado da árvore de trabalho e se a branch da Fase 6–7 está contida em `master`. Confirme também a presença de `packages/domain/src/statistics.ts` e `apps/api/src/services/dashboard.service.ts`. Se a branch da Fase 6–7 existir, mas não estiver integrada em `master`, proponha trabalhar em `fase-8-observatorio-final` criada a partir dela; só crie/troque de branch após a aprovação do plano e depois de verificar que isso não sobrescreve trabalho local. Se a branch necessária não existir, ou `statistics.ts` estiver ausente, trate como bloqueio e pergunte antes de improvisar.
     2. Onde `MIN_QUESTIONS` está realmente definido e importado hoje. Planeje centralizá-lo em `packages/domain/src/thresholds.ts` e reexportá-lo por `goals.ts` e `index.ts`, preservando compatibilidade com todos os imports existentes; não presuma que a estrutura descrita ainda corresponde ao repositório.
     3. Os campos e tipos exatos retornados pela função real de cálculo dos tempos de bloco (por exemplo, `calculateBlockTimes` ou implementação em `timer.ts`) e a assinatura/semântica de `parseWeekStartsOn` em `calendar.ts`; identifique como reutilizá-los sem duplicar fórmulas.
     4. A relação real entre `SessionEvaluation` e `StudySession`, os campos disponíveis em `Subject` — especialmente `created_at` — e a versão/configuração instalada do Prisma. Confirme a compatibilidade de `relationLoadStrategy: 'join'` na versão efetivamente instalada e se o seu uso exige alterar `schema.prisma` (por exemplo, habilitar `previewFeatures`). Use `'join'` somente se estiver disponível **e** não exigir nenhuma alteração no schema; caso contrário, use `include` padrão e registre a decisão. Não altere `schema.prisma`.
     5. A rota e o comportamento de navegação existentes no `Shell.tsx` e `App.tsx`, incluindo se já existe página real ou placeholder do Observatório.
     6. O fluxo condicional exato em `Dashboard.tsx` que faz o usuário sem sessões/metas ver apenas o banner verde, sem o restante do painel e sem a grade de Módulos da Plataforma. Cite o retorno antecipado/condição e o trecho responsável, se confirmado.
   - Entregue somente: (a) resumo das evidências dos seis itens; (b) dúvidas realmente bloqueantes, sem perguntas de preferência já resolvidas pelo contexto; e (c) plano de até seis tarefas, com objetivo, arquivos prováveis a inspecionar/alterar e testes/critério de conclusão por tarefa. Os caminhos são provisórios até a inspeção confirmar os arquivos.
   - **PARE ao final do Passo 1. Não escreva nem altere código, não crie arquivos, não instale dependências e não faça commits antes da aprovação explícita do usuário ao plano.** Se houver bloqueio, aguarde a resposta.
   - **Após aprovação explícita:** execute na sessão atual, em etapas pequenas e verificáveis, usando `executing-plans` → `test-driven-development` → `verification-before-completion` → `finishing-a-development-branch`, se essas skills estiverem disponíveis. Caso alguma não esteja disponível, siga o processo equivalente sem alegar que a skill foi executada.
   - Depois de cada tarefa, rode os testes direcionados relevantes e relate falhas antes de prosseguir se elas alterarem o plano ou revelarem regressões. Não faça merge, push, deploy, migração, reset, rebase destrutivo nem descarte de alterações sem autorização explícita.
3. **Integridade do schema e dos dados:**
   - Não altere `schema.prisma`, não crie migrações e não modifique dados persistidos. Toda classificação e diagnóstico são calculados em tempo de execução.
   - Não introduza campos persistidos novos para armazenar notas, totais derivados, classificações ou recomendações.
   - Preserve contratos e imports públicos existentes sempre que possível; se uma alteração de contrato for inevitável, identifique todos os consumidores e cubra a migração com testes.

---

### 🧠 2. PACOTE `packages/domain` (Funções Puras + TDD com Vitest)

1. **Centralização Estrita de Limites e Constantes (`packages/domain/src/thresholds.ts`):**
   - Crie `packages/domain/src/thresholds.ts` exportando `DEFAULT_STUDY_THRESHOLDS` e constantes individuais (e faça `goals.ts` importar e reexportar `MIN_QUESTIONS` daqui). **Proibição de literais mágicos:** nenhum número de limiar (`0.7`, `0.3`, `80`, `60`, `75`, `70`, `10`, `50`) pode ser escrito literalmente em `observatory.ts`, `statistics.ts` ou nos componentes de `apps/web` — todos (inclusive textos da UI como `< ${MIN_QUESTIONS} questões` ou `de ${WEAK_THRESHOLD} a menos de ${STRONG_THRESHOLD}`) devem consumir as constantes de `@estudos/domain`:
     - `MIN_QUESTIONS = 10`;
     - `SCORE_WEIGHT_ACCURACY = 0.7`;
     - `SCORE_WEIGHT_UNDERSTANDING = 0.3`;
     - `STRONG_THRESHOLD = 80` (Seção 5 do contexto: `nota >= 80` → `'STRONG'` / `"Ponto forte"`);
     - `WEAK_THRESHOLD = 60` (`nota < 60` → `'WEAK'` / `"Ponto fraco"`; `60 <= nota < 80` → `'REGULAR'` / `"Regular"`);
     - `CLASSIFICATION_EPSILON = 1e-9` (tolerância para comparações de ponto flutuante IEEE 754 nas fronteiras);
     - `LOW_UNDERSTANDING_THRESHOLD = 50` (sinal complementar quando a média de entendimento `< 50` e `evaluationsCount > 0`);
     - `MAX_TOPIC_RECOMMENDATIONS = 5` (máximo de recomendações individuais de assuntos por categoria para evitar poluição visual);
     - `CLASSIFICATION_WINDOW_DAYS = 30` (janela móvel de 30 dias para classificação);
     - `NEGLECT_DAYS = 7` (dias sem estudo efetivo para considerar matéria ativa negligenciada);
     - `MIN_DISTRACTION_ANALYSIS_SECONDS = 1800` (30 minutos de tempo total mínimo de sessões no recorte para apontar maior índice de distração e para disparar alertas de aderência, foco e queda de desempenho);
     - `ADHERENCE_ALERT_THRESHOLD = 70`;
     - `PLANNING_GAP_ALERT_MINUTES = 60`;
     - `EFFECTIVENESS_ALERT_THRESHOLD = 75`;
     - `ACCURACY_DROP_ALERT_POINTS = 10`;
     - `CONSISTENCY_ALERT_MIN_DAYS = 3`.
   - **Injeção de Configuração (`thresholds = DEFAULT_STUDY_THRESHOLDS`):**
     - Todas as funções de classificação e do observatório aceitam `thresholds: StudyThresholds = DEFAULT_STUDY_THRESHOLDS`. Um teste unitário deve provar que alterar `STRONG_THRESHOLD` na config injetada muda a classificação.

2. **Janela Unificada de Classificação e Nota Consolidada (`packages/domain/src/observatory.ts`):**
   - **Janela de Classificação Consistente entre Dashboard, Estatísticas e Observatório:**
     - Para que o mesmo assunto nunca tenha notas diferentes ao alternar entre Dashboard, Estatísticas e Observatório, defina:
       - `todayLocalDate = utcToLocalDate(referenceNow, timezone)`
       - `classificationEndLocalDate = periodEndLocalDate < todayLocalDate ? periodEndLocalDate : todayLocalDate` (ou seja, `min(último dia local do período consultado, hoje local)`)
       - A janela de classificação é sempre os **30 dias locais terminando em `classificationEndLocalDate` inclusive**: `windowStartLocalDate = addDaysToLocalDate(classificationEndLocalDate, -(thresholds.CLASSIFICATION_WINDOW_DAYS - 1))` e `windowEndLocalDate = classificationEndLocalDate` (usando `getRolling30DaysWindowUtc(classificationEndLocalDate, timezone)`).
     - Exporte o cálculo acima como um **helper único** `getClassificationWindow(periodEndLocalDate, referenceNow, timezone, thresholds = DEFAULT_STUDY_THRESHOLDS)`, retornando `{ classificationEndLocalDate, windowStartLocalDate, windowEndLocalDate, startUtc, endUtc }`. `/api/statistics`, `/api/dashboard` e `/api/observatory` devem usar exclusivamente esse helper (nenhum serviço recalcula a janela por conta própria), garantindo a consistência entre as três telas.
     - Todo objeto `classification` retornado deve incluir `windowStartLocalDate`, `windowEndLocalDate`, `questionsInWindow` (`totalQuestions` nos 30 dias) e `correctInWindow` (`totalCorrect` nos 30 dias), para que a tabela na UI exiba `"Classificação (30 dias até DD/MM)"` e mostre `X/10 questões` da janela de 30 dias (não das questões do período curto filtrado na tabela).
   - **Regras de Atribuição na Janela de 30 Dias:**
     - **Questões e Acertos:** vêm de `PracticeRecord.topic_id` (em sessões `FINISHED` cujo `started_at` caia na janela de 30 dias da classificação).
     - **Entendimento (`understanding`):** vem de `StudySession.topic_id` apenas de sessões `FINISHED` que possuam `SessionEvaluation` na janela de 30 dias da classificação, calculando a **média aritmética simples** dos scores (`NONE = 0`, `PARTIAL = 33`, `GOOD = 67`, `MASTERED = 100`).
     - **Assunto (`byTopic`):** cálculo **direto** por `topic_id`, sem somar descendentes.
     - **Matéria (`bySubject`):** soma todas as questões e acertos de todos os assuntos da matéria e tira a média simples de todas as avaliações (`SessionEvaluation`) das sessões da matéria (nunca faz média das notas dos assuntos).
     - **Inclusão nas listas e contagens:** um assunto (ou matéria) só entra em `topicClassification`, `subjectClassification` e `classificationSummary` se tiver **atividade na janela de 30 dias** (ao menos uma sessão `FINISHED` ou um `PracticeRecord`). Assuntos nunca estudados não aparecem como `INSUFFICIENT_DATA`, para que as listas e as contagens não sejam dominadas por itens sem histórico. A lista `neglectedSubjects` é a exceção: parte das matérias ativas sem estudo (regras abaixo).
   - **Fórmula 70/30, Tolerância `CLASSIFICATION_EPSILON` e `lowUnderstandingSignal` (`calculateTopicClassification`):**
     - `lowUnderstandingSignal`: `evaluationsCount > 0 && understandingAvgScore !== null && (understandingAvgScore + thresholds.CLASSIFICATION_EPSILON) < thresholds.LOW_UNDERSTANDING_THRESHOLD` (`< 50`), calculado de forma **independente** da classificação de questões.
     - **Caso 1 (`totalQuestions < thresholds.MIN_QUESTIONS`):**
       - `classification: 'INSUFFICIENT_DATA'`, `label: 'Dados insuficientes'`, `finalScore: null`, `displayScore: null`, `usedFallback: false`, `weightsUsed: null`, `recommendedAction: 'COLLECT_MORE_DATA'`.
     - **Caso 2 (`totalQuestions >= thresholds.MIN_QUESTIONS` e `evaluationsCount > 0`):**
       - `accuracyScore = (totalCorrect / totalQuestions) * 100`.
       - `finalScore = (thresholds.SCORE_WEIGHT_ACCURACY * accuracyScore) + (thresholds.SCORE_WEIGHT_UNDERSTANDING * understandingAvgScore)`.
       - `usedFallback = false`, `weightsUsed = { accuracy: thresholds.SCORE_WEIGHT_ACCURACY, understanding: thresholds.SCORE_WEIGHT_UNDERSTANDING }`.
     - **Caso 3 (`totalQuestions >= thresholds.MIN_QUESTIONS` e `evaluationsCount === 0` — Fallback):**
       - `accuracyScore = (totalCorrect / totalQuestions) * 100`.
       - `finalScore = accuracyScore`, `usedFallback = true`, `weightsUsed = { accuracy: 1, understanding: 0 }`.
     - **Comparação com `CLASSIFICATION_EPSILON` e Truncamento:**
       - `adjustedScore = finalScore + thresholds.CLASSIFICATION_EPSILON`:
         - Se `adjustedScore >= thresholds.STRONG_THRESHOLD` (`80`) → `classification: 'STRONG'`, `label: 'Ponto forte'`, `recommendedAction: 'MAINTAIN'` (`"Manter ritmo"`)
         - Senão, se `adjustedScore >= thresholds.WEAK_THRESHOLD` (`60`) → `classification: 'REGULAR'`, `label: 'Regular'`, `recommendedAction: 'MORE_PRACTICE'` (`"Mais prática"`)
         - Senão (`< 60`) → `classification: 'WEAK'`, `label: 'Ponto fraco'`, `recommendedAction: 'REVIEW_AND_PRACTICE'` (`"Revisão + prática"`)
       - `displayScore = Math.floor((finalScore + thresholds.CLASSIFICATION_EPSILON) * 10) / 10`.
     - **Teste obrigatório de varredura de ponto flutuante:** Inclua em `observatory.test.ts` um teste que varra combinações de `accuracyScore` e `understandingAvgScore` cujos produtos `0.7 * A + 0.3 * U` equivalham algebricamente a `60` ou `80` (mas que em IEEE 754 gerem `59.99999999999999` ou `79.99999999999999`), provando que `CLASSIFICATION_EPSILON` garante a classificação correta em `60` (`REGULAR`, `displayScore: 60`) e `80` (`STRONG`, `displayScore: 80`), além das fronteiras `59`, `60`, `79`, `80` e `79.96` (`REGULAR`, `displayScore: 79.9`).

3. **Contrato Explícito e Regras do Motor do Observatório Semanal (`calculateWeeklyObservatory`):**
   - Recebe `referenceNow: Date` como parâmetro obrigatório e respeita `parseWeekStartsOn(user.week_starts_on)` para determinar o início e o fim da semana.
   - **Terminologia (para evitar ambiguidade):** `selectedWeek` é a semana consultada (parâmetro `date`), `previousWeek` é a semana imediatamente anterior a ela e "semana atual" é apenas a semana que contém hoje no fuso do usuário (usada na validação de semana futura). Use `selectedWeekEndUtc` onde se falar do fim da semana consultada.
   - **Instante de avaliação (`evaluationInstant`):** `evaluationInstant = new Date(Math.min(referenceNow.getTime(), selectedWeekEndUtc.getTime()))`. Ao consultar uma semana passada, as regras de matérias negligenciadas e de planejado até agora descrevem o estado ao fim daquela semana, e não o de hoje.
   - **Tipo de Retorno Explícito (`WeeklyObservatoryReport`):**
     - `weekStartLocalDate: string`
     - `weekEndLocalDate: string`
     - `classificationWindow: { windowStartLocalDate: string; windowEndLocalDate: string }`
     - `isPartialWeek: boolean`
     - `elapsedDaysCount: number` (1 a 7)
     - `hasAnyData: boolean` (`true` se houver qualquer sessão concluída, planejada ou questão registrada na semana selecionada, na semana anterior ou nos 30 dias; `false` para usuário novo sem histórico)
     - `weekComparison`: métricas da semana selecionada vs. recorte equivalente da semana anterior;
     - `pauseAndDistractionAnalysis`: totais de tempo efetivo, pausado, distraído em tempo real e declarado, mais a matéria e o dia com maior índice de distração (exigindo `totalSessionSeconds >= thresholds.MIN_DISTRACTION_ANALYSIS_SECONDS`);
     - `topicClassification`: `{ weak: TopicObservatoryItem[], regular: TopicObservatoryItem[], strong: TopicObservatoryItem[], insufficient: TopicObservatoryItem[] }` (contendo apenas assuntos ativos `!archived` **com atividade na janela de 30 dias** nas listas de ação, com tempo e questões da semana + objeto `classification` dos 30 dias);
     - `subjectClassification`: lista de matérias ativas **com atividade na janela de 30 dias**, com tempo/questões da semana + objeto `classification` dos 30 dias;
     - `neglectedSubjects`: lista de matérias ativas negligenciadas;
     - `insightsAndRecommendations`: lista ordenada e determinística de alertas e recomendações.
   - **Comparação com Períodos Equivalentes e Planejado "Até Agora":**
     - Se a semana selecionada estiver em andamento (`referenceNow < selectedWeekEndUtc`): `isPartialWeek = true` e `elapsedDaysCount` = número de dias locais desde `weekStartLocalDate` até `todayLocalDate` inclusive. Compara os `elapsedDaysCount` dias locais da semana selecionada contra os mesmos `elapsedDaysCount` primeiros dias locais da semana anterior. *(Documente no README que a comparação usa dias locais inteiros, portanto o dia de hoje em andamento é comparado contra o dia correspondente completo da semana anterior).*
     - **Planejado até agora (`agendaPlannedElapsedMinutes`):** Soma `planned_minutes` das `PlannedSession`s com status `PLANNED` ou `DONE` na semana selecionada cujo `scheduled_start < evaluationInstant`. `planningGapMinutes = Math.max(0, agendaPlannedElapsedMinutes - currentEffectiveMinutes)`. *(Documente no README que sessões avulsas aumentam `currentEffectiveMinutes` sem adicionar `PlannedSession` prévia, reduzindo `planningGapMinutes`).*
     - Se a semana anterior não tiver dados, variações percentuais retornam `null`. `deltaAccuracy` exige `>= thresholds.MIN_QUESTIONS` questões em ambas as semanas no recorte comparado.
   - **Matérias Negligenciadas (`neglectedSubjects` — Proteção para Matéria Recém-Criada):**
     - Considera apenas matérias ativas (`!archived`) que:
       1. Tiveram **`0` segundos de estudo efetivo nos últimos `thresholds.NEGLECT_DAYS` (7) dias** até o `evaluationInstant`; **E**
       2. Foram criadas há **pelo menos `thresholds.NEGLECT_DAYS` (7) dias** antes do `evaluationInstant` (`subject.created_at <= evaluationInstant - thresholds.NEGLECT_DAYS dias`), evitando marcar matérias recém-cadastradas por um usuário novo como negligenciadas.
     - Informa `daysSinceLastStudy: number | null` (`null` se sem estudo nos últimos 30 dias).
   - **Determinismo Estrito de Alertas e Recomendações (`insightsAndRecommendations`):**
     - **Filtro de Arquivados:** Matérias e assuntos arquivados (`archived === true`) **nunca** geram recomendações ou alertas e não entram nas listas de ação do Observatório (continuam consultáveis apenas em Estatísticas).
     - **Amostra Mínima (`>= thresholds.MIN_DISTRACTION_ANALYSIS_SECONDS` = 1800s):** Alertas de **queda de desempenho**, **baixa aderência** e **baixo foco/efetividade** só são disparados quando o recorte da semana selecionada tiver pelo menos `1800` segundos (30 min) de sessões concluídas (`totalSessionSeconds >= thresholds.MIN_DISTRACTION_ANALYSIS_SECONDS`).
     - **Consistência Proporcional:** Em semana encerrada, o mínimo de dias ativos é `thresholds.CONSISTENCY_ALERT_MIN_DAYS` (`3`); em semana parcial (apenas quando `elapsedDaysCount >= 4` e `totalSessionSeconds > 0` ou houver agenda no período), o mínimo esperado é `Math.ceil((thresholds.CONSISTENCY_ALERT_MIN_DAYS * elapsedDaysCount) / 7)`.
     - **Severidades, IDs Determinísticos, Limite e Ordenação:**
       - `HIGH`:
         - Queda de desempenho (`id: 'alert:accuracy-drop'`, `deltaAccuracy <= -thresholds.ACCURACY_DROP_ALERT_POINTS`);
         - Assunto ponto fraco (`id: 'weak-topic:<topicId>'`, limitado aos `thresholds.MAX_TOPIC_RECOMMENDATIONS` = 5 assuntos com menores `finalScore`, ação `"Revisão + prática"`).
       - `MEDIUM`:
         - Baixa consistência semanal (`id: 'alert:low-consistency'`);
         - Baixa aderência nas sessões (`id: 'alert:low-adherence'`, `< thresholds.ADHERENCE_ALERT_THRESHOLD`);
         - Baixo foco / alto índice de distração (`id: 'alert:low-effectiveness'`, `< thresholds.EFFECTIVENESS_ALERT_THRESHOLD`);
         - Matéria negligenciada (`id: 'neglected-subject:<subjectId>'`).
       - `LOW`:
         - Excesso de planejamento não executado (`id: 'alert:planning-gap'`, `planningGapMinutes >= thresholds.PLANNING_GAP_ALERT_MINUTES`);
         - Assunto regular (`id: 'regular-topic:<topicId>'`, limitado aos `thresholds.MAX_TOPIC_RECOMMENDATIONS` = 5 assuntos com menores `finalScore`, ação `"Mais prática"`).
       - `INFO`:
         - Assunto ponto forte (`id: 'strong-topic:<topicId>'`, limitado aos `thresholds.MAX_TOPIC_RECOMMENDATIONS` = 5 assuntos com maiores `finalScore`, ação `"Manter ritmo"`).
       - **Ordenação Determinística:** Ordenar a lista final por severidade (`HIGH` → `MEDIUM` → `LOW` → `INFO`). Dentro de cada severidade: `HIGH`, `MEDIUM` e `LOW` por **menor** `finalScore`; `INFO` (pontos fortes) por **maior** `finalScore`; itens sem `finalScore` (alertas gerais) vêm depois dos que têm nota; o desempate final é o `id` em ordem alfabética.
       - Cada item traz obrigatoriamente `evidence: Array<{ label: string; value: string; threshold: string }>`.

---

### 🔌 3. BACKEND `apps/api` (Endpoints e Carga Única Sem N+1)

1. **Enriquecer `/api/statistics` e `/api/dashboard` (Janela União + Invariância de Escala):**
   - Em `statistics.service.ts` (`GET /api/statistics`):
     - Calcula a janela do período filtrado `[periodStartUtc, periodEndUtc)` e a janela de classificação de 30 dias `[classStartUtc, classEndUtc)` terminando em `classificationEndLocalDate = min(periodEndLocalDate, todayLocalDate)` (calculada exclusivamente pelo helper `getClassificationWindow`).
     - Faz **uma única carga em lote** cobrindo a união `[min(periodStartUtc, classStartUtc), max(periodEndUtc, classEndUtc))` (mesmo quando `range=day`), incluindo `evaluation` (`SessionEvaluation`) nas sessões (usando `relationLoadStrategy: 'join'` somente se suportado pela versão do Prisma **e** sem exigir alteração no `schema.prisma`; caso contrário, `include` padrão).
     - Fatie em memória os dados do período filtrado para as métricas da tabela/gráficos e os dados da janela de 30 dias para o objeto `classification` de cada item em `bySubject` e `byTopic`.
   - Em `dashboard.service.ts` (`GET /api/dashboard`):
     - Reaproveita os 30 dias já carregados em memória (janela obtida por `getClassificationWindow`) para incluir `classification` em cada matéria de `subjectProgress` e adiciona `classificationSummary: { strongCount, regularCount, weakCount, insufficientCount }` contando **apenas os assuntos ativos (`byTopic`) com atividade na janela de 30 dias**, sem contar assuntos nunca estudados.
   - **Regra do Teste Anti-N+1 (`statistics-performance.test.ts`):**
     - Incluir `evaluation` no Prisma pode somar um número fixo e constante de queries (ex.: +1 query para `SessionEvaluation`). Atualize o teto folgado se necessário, mas mantenha a asserção estrita de invariância de escala: **`queries(10d) === queries(180d)`** tanto para `/api/statistics`, quanto para `/api/dashboard` e `/api/observatory`.

2. **Novo Endpoint `GET /api/observatory` (`apps/api/src/services/observatory.service.ts`):**
   - Protegido por `authMiddleware` (`401` sem sessão) e isolado estritamente por `user_id`.
   - Query params validados com Zod `.strict()`: `?date=YYYY-MM-DD` (opcional; padrão = "Hoje" no `User.timezone`).
   - Usa `parseWeekStartsOn(user.week_starts_on)` para calcular o início da semana selecionada e da semana atual. Se a semana selecionada começar após a semana que contém hoje no fuso do usuário, retorna **`400 Bad Request`** (`"Não é possível consultar o Observatório para semanas futuras."`).
   - Faz carga única da união `[min(prevWeekStartUtc, classStartUtc), selectedWeekEndUtc)` (com `classStartUtc` obtido de `getClassificationWindow`) e chama `calculateWeeklyObservatory(..., referenceNow = new Date())`.

---

### 🖥️ 4. FRONTEND `apps/web` (Dashboard Restaurado, Estatísticas e Observatório)

1. **CORREÇÃO CRÍTICA NO `Dashboard.tsx` (Sempre Exibir o Painel Completo + Grade de Módulos):**
   - Remova o retorno condicional precoce que esconde o Dashboard quando o usuário não tem sessões/metas no dia.
   - A página `/dashboard` deve **sempre** renderizar:
     1. O card de ação imediata **"O que estudar agora?"** (ou boas-vindas com botões rápidos se não houver sessão agendada);
     2. Os cards de indicadores do dia e dos 30 dias (`Planejado Hoje`, `Tempo Efetivo Hoje`, `Aproveitamento Hoje`, `Consistência 30d`);
     3. As seções de **Metas Ativas**, **Resumo da Semana** e **Progresso por Matéria** (com a classificação de cada matéria e estados vazios internos amigáveis quando as listas estiverem vazias);
     4. A seção **"Módulos da Plataforma"** com os 6 cards mantendo exatamente os títulos originais, links e o badge padronizado **`"Disponível"`** em todos os 6 cards.

2. **Atualização de `Statistics.tsx` (Consumo de `thresholds.ts` e Rótulo da Janela de 30 Dias):**
   - Importe as constantes de `@estudos/domain` (`MIN_QUESTIONS`, `WEAK_THRESHOLD`, `STRONG_THRESHOLD`) para compor os textos estáticos da UI (cabeçalhos e faixas "de X a menos de Y") sem números mágicos fixos; os pesos exibidos vêm de `classification.weightsUsed`.
   - Nas tabelas **Por Matéria** e **Por Assunto**, rotule o cabeçalho da coluna como **`"Classificação (30 dias até DD/MM)"`** (usando `windowEndLocalDate` retornado pela API).
   - Exiba `displayScore`, o badge (`"Ponto forte"`, `"Regular"`, `"Ponto fraco"`, ou `"Dados insuficientes (${questionsInWindow}/${MIN_QUESTIONS} questões)"` usando as questões da janela de 30 dias), a ação recomendada e o tooltip de composição, **montado a partir de `classification.weightsUsed` retornado pela API** (nunca das constantes importadas), exibindo `"100% acerto (sem autoavaliação)"` quando `usedFallback === true`, ou `"70% acerto + 30% entendimento"` (percentuais calculados com `Math.round(peso * 100)`).

3. **Nova Página `Observatory.tsx` (Com Estado Vazio e Invalidação de Cache):**
   - Conecte na rota real do `Shell.tsx` / `App.tsx`, removendo o último placeholder do sistema.
   - **Seletor de Semana:** Botões `Semana Anterior`, `Semana Atual` e `Avançar Semana` (`disabled` quando já estiver na semana atual). Se `isPartialWeek === true`, exiba banner informativo: *"Comparando os X primeiros dias desta semana com os mesmos X dias da semana anterior"*.
   - **Estado Vazio (`hasAnyData === false`):** Quando o usuário for novo e não possuir sessões nem planejamentos, exiba estado vazio amigável (sem `NaN` e sem quebrar o layout) com CTAs para `"Planejar na Agenda"` (`/agenda`) e `"Iniciar Estudo Agora"` (`/timer`), mantendo o cabeçalho e o seletor visíveis.
   - **Seções quando `hasAnyData === true`:**
     1. *Comparativo Semana Selecionada vs. Semana Anterior*;
     2. *Análise de Foco, Pausas e Distrações*;
     3. *Classificação de Assuntos (30 dias até DD/MM)* agrupada em **Pontos Fracos**, **Regulares**, **Pontos Fortes** e **Dados Insuficientes**, exibindo sinal de baixo entendimento quando `lowUnderstandingSignal === true` e botão `"Agendar Revisão"` (`/agenda`);
     4. *Revisões e Práticas Recomendadas* (exigência da Fase 8): lista os assuntos com ação `REVIEW_AND_PRACTICE` ("Revisão + prática") e `MORE_PRACTICE` ("Mais prática"), ordenados por menor nota, com os chips de `evidence` e o botão `"Agendar Revisão"` ou `"Agendar Prática"` (`/agenda`);
     5. *Matérias Negligenciadas* e *Alertas / Recomendações Acionáveis* com chips de `evidence` (`label: value (limite: threshold)`).
   - **Invalidação de Cache:** Invalide `['observatory']` nas mutações de Timer, Avaliação, Agenda, Metas e ao criar/editar/arquivar/desarquivar Matérias e Assuntos (`Subjects.tsx`).

---

### 🚫 5. FORA DO ESCOPO DO MVP (PROIBIDO IMPLEMENTAR — SEÇÃO 10 DO CONTEXTO)
- Testes formais de retenção; revisão espaçada automática; indicador global de "saúde dos estudos"; detecção de padrões de erro recorrentes; notificações externas; uso de IA generativa.

---

### 📌 Decisões Complementares Consolidadas (Rodadas 1 a 3)

Estas decisões complementam os requisitos acima. Em caso de conflito entre seções deste prompt, não escolha silenciosamente: exponha o conflito e peça orientação antes de implementar o ponto afetado.
- `thresholds.ts` exporta todas as constantes, incluindo `CLASSIFICATION_EPSILON = 1e-9`, `LOW_UNDERSTANDING_THRESHOLD = 50` e `MAX_TOPIC_RECOMMENDATIONS = 5`. Comparações usam `finalScore + epsilon`; `displayScore = Math.floor((finalScore + epsilon) * 10) / 10`.
- `calculateWeeklyObservatory` recebe `referenceNow` e retorna contrato explícito com `hasAnyData`, `topicClassification: { weak, regular, strong, insufficient }`, `subjectClassification`, `neglectedSubjects` e `insightsAndRecommendations`. `Observatory.tsx` trata `hasAnyData = false` com estado vazio e teste.
- Janela de classificação nas três telas: `classificationEndLocalDate = min(último dia do período, hoje)`; janela `[end - 29 dias, end]`. `/api/statistics` carrega a união (período + 30 dias) em carga única. `classification` retorna `windowStartLocalDate`, `windowEndLocalDate` e `questionsInWindow`; a UI rotula `"Classificação (30 dias até DD/MM)"`.
- Anti-N+1: incluir `evaluation` pode somar um número fixo de queries; exigir `queries(10d) === queries(180d)` nas 3 rotas analíticas e ajustar o teto.
- Semana por `parseWeekStartsOn(user.week_starts_on)`; testes com `vi.useFakeTimers()` e `vi.setSystemTime(...)`; teste de sessão às `23:50` locais (`America/Rio_Branco`) na virada de semana.
- Severidades: `HIGH` (queda de desempenho, ponto fraco), `MEDIUM` (consistência, aderência, foco, negligenciada), `LOW` (excesso de planejamento, regular), `INFO` (ponto forte). `id` determinístico; ordem por severidade e nota crescente; no máximo `MAX_TOPIC_RECOMMENDATIONS` por tipo. Alertas de aderência, foco e queda exigem `>= 1800s` de sessões no recorte. Consistência proporcional = `ceil(3 * elapsedDays / 7)`. Arquivados não geram recomendações. Matérias criadas há menos de `NEGLECT_DAYS` dias não são negligenciadas.
- `lowUnderstandingSignal` = média de entendimento `< LOW_UNDERSTANDING_THRESHOLD` com `evaluationsCount > 0`. `classificationSummary` conta apenas assuntos ativos. Planejado até agora = `PLANNED`/`DONE` com `scheduled_start < evaluationInstant`. Badges dos 6 módulos no Dashboard: `"Disponível"`.
- (Rodada 3) `relationLoadStrategy: 'join'` só é usado se não exigir alterar `schema.prisma` (`previewFeatures`); caso contrário, `include` padrão, registrando a decisão.
- (Rodada 3) Inclusão em listas e contagens: assunto/matéria só entra em `topicClassification`, `subjectClassification` e `classificationSummary` com atividade na janela de 30 dias; `neglectedSubjects` parte das matérias ativas sem estudo.
- (Rodada 3) Terminologia `selectedWeek`/`previousWeek`; "semana atual" = semana de hoje. `evaluationInstant = min(referenceNow, fim da selectedWeek)` em `neglectedSubjects` e no planejado até agora.
- (Rodada 3) Helper único `getClassificationWindow` no `domain`, usado pelos três serviços.
- (Rodada 3) `Observatory.tsx` ganha a seção "Revisões e Práticas Recomendadas".
- (Rodada 3) Ordenação: `HIGH`/`MEDIUM`/`LOW` por menor `finalScore`; `INFO` por maior; itens sem nota depois; desempate por `id`.
- (Rodada 3) Tooltip de pesos vem de `classification.weightsUsed`; percentuais com `Math.round(peso * 100)`; faixas de texto montadas com as constantes ("de X a menos de Y").

---

### 5.1. Regras de consistência, segurança e interpretação

- **Uma única fonte de verdade:** os cálculos e as regras ficam em `packages/domain`; API e interface apenas fornecem dados, chamam as funções e apresentam resultados. Não replique a fórmula 70/30, os limites ou a lógica de classificação no frontend.
- **Dados e intervalos:** documente explicitamente se cada intervalo é inclusivo ou exclusivo e converta datas locais/UTC com as funções já adotadas pelo projeto. Não use `new Date('YYYY-MM-DD')` como substituto de uma conversão de data local sem confirmar a semântica.
- **Fuso horário:** use o `timezone` do usuário para definir “hoje”, semana e janela de classificação. Não use o fuso da máquina/servidor como substituto. Cubra as bordas de dia e semana nos testes.
- **Sem dados não significa zero em todos os casos:** métricas percentuais sem denominador ou comparação válida devem ser `null`/estado indisponível, nunca `NaN`, `Infinity` ou uma variação inventada de zero.
- **Consultas e isolamento:** toda consulta de dados do usuário deve estar limitada por `user_id`, inclusive consultas auxiliares e relações. Prefira consultas em lote e processamento em memória; não faça uma consulta por matéria/assunto.
- **Arquivamento:** itens arquivados não aparecem nas listas de ação nem geram alertas/recomendações, mas não devem ser apagados nem excluídos das Estatísticas se a regra atual permitir consultá-los.
- **Compatibilidade:** antes de adicionar uma dependência, verifique se a funcionalidade já existe na stack instalada. Não atualize versões de pacotes como efeito colateral.
- **Interface:** reutilize os componentes, padrões visuais, hooks de consulta e tratamento de erros existentes. Não redesenhe telas fora do necessário para cumprir esta fase.
- **Cache:** identifique os `queryKey` reais e os pontos de mutação reais antes de invalidar consultas. Não crie chaves paralelas que deixem dados obsoletos.
- **Escopo:** não implementar recursos fora da seção 5, nem “melhorias extras” não solicitadas.
- **Dúvidas descobertas durante a implementação:** se uma ambiguidade mudar regras de negócio, persistência, segurança ou contrato público, pare e pergunte. Para decisões internas reversíveis e já cobertas pelo contexto, escolha a opção mais compatível com o projeto e documente-a.

---

### ✅ 6. CRITÉRIOS DE ACEITE E EVIDÊNCIAS DE ENTREGA FINAL

Antes de concluir a branch, execute e comprove com a **saída real dos comandos** no relatório final:
- [ ] **Fronteiras, Ponto Flutuante (`CLASSIFICATION_EPSILON`) e Injeção de Limiares (`domain`):** Testes unitários provando as fronteiras `59` (`WEAK`), `60` (`REGULAR`), `79` (`REGULAR`), `80` (`STRONG`), `79.96` (`REGULAR`, `displayScore: 79.9`), varredura de pares `0.7 * A + 0.3 * U` com imprecisão de ponto flutuante em `60` e `80`, amostra com `9` vs `10` questões, fallback sem avaliação (`usedFallback: true`) e override de config injetada.
- [ ] **Segurança, Fixture Calculada à Mão e Fuso em `/api/observatory` (`api`):**
  - `401` sem sessão e isolamento estrito entre usuários;
  - Nota 70/30 validada por **fixture calculada à mão** (ex.: 20 questões, 15 acertos = `75%`; avaliações `GOOD` (`67`) e `MASTERED` (`100`) = média `83.5`; `0.7 * 75 + 0.3 * 83.5 = 77.55` → `REGULAR`, `displayScore: 77.5`);
  - Sessão iniciada às `23:50` locais (`America/Rio_Branco`) na virada de semana (`parseWeekStartsOn`) atribuída à semana correta;
  - Semana parcial (`isPartialWeek: true` com `vi.setSystemTime`), semana encerrada, ausência de dados na semana anterior (`null` sem `NaN`) e `400` para semana futura.
- [ ] **Anti-N+1 (`queries(10d) === queries(180d)`):** Comprovado para `/api/observatory`, `/api/statistics` e `/api/dashboard`.
- [ ] **Estados Vazios, Dashboard Restaurado e Zero Placeholders (`web`):**
  - Teste provando que o Dashboard vazio renderiza banner, indicadores, seções e os 6 cards de Módulos da Plataforma com badge `"Disponível"`;
  - Teste provando que `Observatory.tsx` renderiza sem erros no estado vazio (`hasAnyData = false`) e com dados completos (incluindo a seção "Revisões e Práticas Recomendadas");
  - Todos os itens do menu lateral (`Shell.tsx`) abrem páginas reais (zero placeholders).
- [ ] **Consistência entre as Três Telas:** Teste de integração provando que, para o mesmo usuário e um período em que `classificationEndLocalDate` coincide (semana que contém hoje em `GET /api/statistics?range=week`, `GET /api/dashboard` e `GET /api/observatory`), o objeto `classification` do mesmo assunto é idêntico (`deep equal`) nas três respostas.
- [ ] **Testes de Domínio do Motor de Alertas:** Cobrir: disparo e não disparo de cada alerta nos limites; ausência de alerta quando a métrica é `null`; amostra mínima de `MIN_DISTRACTION_ANALYSIS_SECONDS`; consistência proporcional (`ceil(CONSISTENCY_ALERT_MIN_DAYS * elapsedDaysCount / 7)`); limite de `MAX_TOPIC_RECOMMENDATIONS` por categoria; exclusão de arquivados; proteção de matéria recém-criada; assuntos sem atividade na janela fora das listas; ordenação e `id` determinísticos; semana passada usando `evaluationInstant`.
- [ ] **Verificação de Literais de Limiar (`rg`):** Executar `rg` com padrões específicos (`0\.7`, `0\.3` e os valores de limiar usados em comparações) em `packages/domain/src/observatory.ts`, `packages/domain/src/statistics.ts` e `apps/web/src`, listar as ocorrências no relatório e justificar cada uma como não sendo limiar duplicado (por exemplo, arredondamento ou conversão de unidade). Não é exigido "zero ocorrências" de números genéricos como `100` ou `60` segundos.
- [ ] **Não-Regressão e Build (Com Saída Real no Relatório):**
  - `npm run typecheck` (0 erros).
  - `npm test` (100% passando em todos os pacotes).
  - `npm run test:tz` (100% passando).
- [ ] **`README.md` e Relatório Final Completo:** Documentar a Fase 8, `thresholds.ts`, regra 70/30 e fallback 100%, truncamento com `CLASSIFICATION_EPSILON`, comparativo de semanas parciais (dias inteiros e impacto de sessões avulsas no `planningGapMinutes`) e checklist manual.

**Formato obrigatório do relatório final:**
1. Resumo das entregas e decisões técnicas relevantes.
2. Lista de arquivos criados/alterados, com uma frase sobre cada mudança.
3. Tabela dos critérios de aceite: `Aprovado`, `Falhou` ou `Não executado`, sempre com evidência.
4. Comandos executados e suas saídas reais relevantes. Não resuma uma execução que falhou como se tivesse passado; se a saída for extensa, informe o comando, o resultado e os erros relevantes.
5. Testes que falharam, limitações ambientais e pendências — sem omitir falhas.
6. Confirmação de que `schema.prisma`, migrações, merge e push não foram alterados/executados sem autorização.
7. Passos manuais para validar o Dashboard, o Observatório e a navegação.
8. O que ficou fora do escopo.

Só marque um critério como aprovado quando houver evidência direta. Se um comando não puder ser executado, marque-o como `Não executado` e explique por quê.

## Instrução de início — executar somente agora

Faça a inspeção enxuta do repositório e confirme os seis itens obrigatórios da seção 1.2 com evidências reais. Liste apenas dúvidas estritamente bloqueantes e apresente o plano de até seis tarefas, com os arquivos envolvidos e os testes de cada tarefa.

**Não implemente nada nesta primeira resposta. Aguarde minha aprovação explícita do plano.**