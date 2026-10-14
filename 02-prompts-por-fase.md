# Prompts por Fase

> **Como usar:** envie sempre o arquivo `01-contexto-do-projeto.md` junto com **um** prompt de fase. Só passe para a fase seguinte depois de validar os critérios de aceite da atual.

Início padrão de todos os prompts:

```text
Leia o arquivo de contexto anexo. Ele prevalece sobre qualquer suposição.
Implemente SOMENTE a fase descrita abaixo.
Antes de escrever código, liste suas dúvidas e o plano de arquivos.
Ao final, entregue: resumo, arquivos criados/alterados, como rodar e testar, e o que ficou de fora.
```

---

## Fase 1 — Fundação

**Objetivo:** projeto funcionando com banco, autenticação e estrutura de pastas.

**Escopo**
- Monorepo com `apps/web`, `apps/api` e `packages/domain`.
- Prisma com PostgreSQL; schema completo conforme a seção 6 do contexto, com migração inicial.
- Cadastro, login, logout e rota "quem sou eu", com senha em hash e sessão por cookie httpOnly.
- Middleware que injeta o `user_id` e bloqueia rotas sem sessão.
- Configuração de testes (Vitest) e de validação (Zod).
- Tela de login/cadastro e layout base com navegação vazia para os módulos.

**Fora do escopo:** qualquer CRUD de estudo, timer, metas e gráficos.

**Critérios de aceite**
- É possível criar conta, entrar, sair e acessar uma rota protegida.
- Usuário sem sessão recebe 401.
- Migração roda do zero sem erro.
- Existe pelo menos um teste automatizado executando.

---

## Fase 2 — Matérias e assuntos

**Objetivo:** cadastrar a estrutura que sustenta todo o resto.

**Escopo**
- CRUD de matérias (nome, cor, arquivar).
- CRUD de assuntos com hierarquia por `parent_id`, profundidade livre.
- Tela em árvore para visualizar, criar, renomear, mover e arquivar.
- Arquivar em vez de excluir quando houver sessões vinculadas.

**Fora do escopo:** agenda, sessões, estatísticas.

**Critérios de aceite**
- Um usuário nunca vê matérias ou assuntos de outro.
- Não é possível criar ciclo na hierarquia (assunto pai de si mesmo ou de um ancestral).
- Mover um assunto preserva seus filhos.
- Testes de API cobrindo isolamento por `user_id` e a regra de ciclo.

---

## Fase 3 — Agenda e planejamento

**Objetivo:** planejar sessões e acompanhar planejado × executado.

**Escopo**
- Criar, editar e excluir `PlannedSession` com matéria, assunto, data, horário, duração, prioridade, tipo de atividade e observações.
- Definir etapas (`PlannedBlock`) com minutos manuais para revisão, conteúdo novo e prática; a soma deve ser igual à duração planejada.
- Status `PLANNED`, `DONE`, `SKIPPED`, `RESCHEDULED`. Remarcar cria nova sessão ligada à original por `rescheduled_from_id`.
- Visões de dia e de semana, exibidas no fuso horário do usuário.

**Fora do escopo:** execução do timer, sugestão automática de revisão.

**Critérios de aceite**
- Datas são gravadas em UTC e exibidas no fuso configurado.
- Uma sessão às 23h30 no horário local aparece no dia correto.
- Soma das etapas diferente da duração é rejeitada.
- Remarcar mantém o histórico da original.
- Testes de conversão de fuso nas bordas do dia e da semana.

---

## Fase 4 — Timer por etapa

**Objetivo:** registrar o estudo real com precisão, sem perder dados.

**Escopo**
- Pacote `domain` com as funções puras da seção 8 do contexto (tempo total, pausas, distrações, tempo efetivo) e a máquina de estados da seção 7.
- Endpoints para registrar cada tipo de evento.
- Interface do timer: iniciar etapa, pausar, retomar, marcar distração, finalizar etapa e finalizar ou cancelar sessão.
- Reconstrução do timer ao recarregar a página, a partir dos eventos.
- Ao finalizar, campo opcional para o usuário **declarar o tempo de distração** de cada etapa (`DISTRACTION_DECLARED`).
- Sessão iniciada a partir de uma planejada marca a original como `DONE`.
- Sessão avulsa (sem planejamento) também deve ser possível.

**Fora do escopo:** avaliação pós-sessão, questões, metas.

**Critérios de aceite**
- Recarregar a página durante a sessão mantém o tempo correto.
- O tempo efetivo é sempre calculado, nunca armazenado.
- A declaração de distração não apaga nem altera eventos anteriores.
- Declarações que excedem o tempo total da etapa são rejeitadas.
- Intervalo aberto (página fechada) é sinalizado como "incompleto".
- Testes de `domain` cobrindo: caso normal, várias pausas, distração em tempo real, distração declarada, intervalo aberto, resultado zero e valores inválidos.

---

## Fase 5 — Avaliação pós-sessão e prática

**Objetivo:** capturar o resultado qualitativo e as questões.

**Escopo**
- Tela de avaliação ao finalizar: entendimento, concentração, dificuldade e observação livre.
- Registro de questões na etapa de prática: total e acertos (os erros são derivados).
- Validação `0 ≤ correct ≤ questions`.
- Função pura de aproveitamento no `domain`.
- Fluxo rápido: o usuário deve conseguir concluir tudo em poucos toques.

**Fora do escopo:** metas, estatísticas, classificação de assuntos.

**Critérios de aceite**
- Uma sessão finalizada tem exatamente uma avaliação.
- Aproveitamento é calculado corretamente, inclusive com 0 questões.
- Registro de questões aceita mais de um assunto na mesma sessão.
- Testes de validação e de cálculo.

---

## Fase 6 — Metas

**Objetivo:** definir metas e acompanhar o progresso.

**Escopo**
- CRUD de metas diárias, semanais e mensais, de esforço e de resultado, com métricas da seção 6.
- Progresso calculado a partir de sessões, tempo efetivo e questões, nunca armazenado.
- Cálculo de períodos pelo fuso do usuário, com semana iniciando na segunda-feira.
- Visão de janela móvel dos últimos 30 dias (não é um tipo de meta).
- Meta de resultado (ex.: aproveitamento) respeita `MIN_QUESTIONS`.

**Fora do escopo:** notificações, dashboard completo.

**Critérios de aceite**
- Sessão feita às 23h50 conta no dia local correto.
- A virada de mês e de semana é tratada corretamente.
- Meta de aproveitamento com poucas questões exibe "dados insuficientes".
- Testes de borda de período e de fuso.

---

## Fase 7 — Estatísticas e Dashboard

**Objetivo:** mostrar a situação atual de forma rápida.

**Escopo**
- Estatísticas por matéria, assunto e período: tempo planejado, tempo efetivo, efetividade, aderência, sessões, questões e aproveitamento.
- Dashboard com: sessões de hoje, próxima sessão, tempo planejado × efetivo, progresso das metas e resumo da semana.
- Gráficos simples (Recharts) para evolução.
- Todo número exibido deve poder ser rastreado até sua fórmula.

**Fora do escopo:** classificação de pontos fortes e fracos, recomendações.

**Critérios de aceite**
- Os números do dashboard coincidem com os testes de `domain`.
- Estados vazios são tratados (usuário novo, sem dados).
- Desempenho aceitável com pelo menos 6 meses de dados de exemplo (incluir um script de dados de exemplo).

---

## Fase 8 — Observatório semanal

**Objetivo:** transformar dados em orientação.

**Escopo**
- Funções puras no `domain`: nota do assunto (padrão provisório da seção 5), classificação (forte, regular, fraco, dados insuficientes) e recomendação.
- Tela do Observatório semanal: pontos fortes, pontos fracos, evolução em relação à semana anterior, revisões e práticas necessárias e alertas (queda de desempenho, baixa consistência).
- Cada recomendação mostra o **motivo** (números que a originaram).
- Constantes e limites centralizados em um único arquivo.

**Fora do escopo:** testes de retenção, revisão automática, indicador de saúde, IA.

**Critérios de aceite**
- Assunto com menos de `MIN_QUESTIONS` aparece como "dados insuficientes".
- A comparação com a semana anterior usa períodos equivalentes.
- Alterar um limite em um único lugar altera a classificação em todo o sistema.
- Testes cobrindo fronteiras (59, 60, 79, 80), poucos dados e ausência de semana anterior.
