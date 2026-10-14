# Contexto do Projeto — Plataforma de Gestão e Análise de Estudos

> Este arquivo deve ser enviado **junto com cada prompt de fase**. Ele contém as decisões já fechadas, o modelo de dados e as fórmulas. Em caso de conflito entre este arquivo e a documentação inicial, **este arquivo prevalece**.

---

## 1. Visão geral

Plataforma web de estudos para uso pessoal e de um pequeno grupo. Acompanha o ciclo completo:

**Planejar → Estudar → Registrar → Avaliar → Analisar → Revisar → Replanejar**

A primeira versão **não usa IA**. Toda recomendação vem de regras, cálculos e estatísticas determinísticas.

Princípios:
- **Simples para registrar:** o usuário não deve gastar mais que 1 ou 2 minutos preenchendo uma sessão.
- **Toda informação coletada precisa ter finalidade** (cálculo, análise ou recomendação).
- **Orientado a ação:** o sistema responde "o que devo estudar agora?", e não apenas exibe gráficos.
- **Explicável:** nenhum indicador aparece sem mostrar de onde veio.

---

## 2. Regras de trabalho para a IA (obrigatórias)

1. Implemente **somente a fase solicitada**. Não antecipe funcionalidades de fases futuras.
2. Se algo não estiver definido, **pergunte antes de presumir**. Liste as dúvidas antes de escrever código.
3. Todo cálculo (tempo efetivo, aproveitamento, classificação, metas) deve ficar em **funções puras** no pacote `domain`, sem acesso a banco ou interface, **com testes automatizados**.
4. Não altere o schema do banco sem avisar e explicar o motivo.
5. Valide todas as entradas no backend (Zod). Nunca confie apenas na validação do frontend.
6. Toda consulta deve filtrar por `user_id`. Nenhum usuário pode ler ou alterar dados de outro.
7. Ao terminar, entregue: resumo do que foi feito, arquivos criados ou alterados, como rodar e testar, e o que ficou de fora.
8. Não adicione bibliotecas sem justificar.

---

## 3. Stack (definida)

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind + shadcn/ui |
| Dados no frontend | TanStack Query |
| Gráficos | Recharts |
| Backend | Node + Express + TypeScript |
| ORM e banco | Prisma + PostgreSQL |
| Validação | Zod (esquemas compartilhados) |
| Datas | date-fns-tz (ou Luxon) |
| Testes | Vitest |
| Autenticação | E-mail e senha (hash com argon2 ou bcrypt), sessão por cookie httpOnly |

Estrutura sugerida (monorepo com npm workspaces):

```text
apps/web        → interface
apps/api        → rotas, controladores, acesso a dados
packages/domain → cálculos e regras puras (compartilhado e testado)
```

---

## 4. Decisões fechadas

1. **Um timer por etapa.** Uma sessão tem etapas (revisão, conteúdo novo, prática). Cada etapa tem seu próprio tempo efetivo.
2. **Mínimo de questões.** Um assunto só é classificado como ponto forte ou fraco com pelo menos **10 questões** no período analisado (constante configurável `MIN_QUESTIONS`). Abaixo disso, o estado é "dados insuficientes".
3. **`user_id` em todas as tabelas** desde o início, com login simples.
4. **Guardar eventos, não totais.** O timer grava eventos com horário e o tempo é **calculado** a partir deles. Recarregar ou fechar a página não pode perder nada.
5. **Distração declarada no final.** Além da distração registrada em tempo real, o usuário pode, ao finalizar, **informar quanto tempo ficou distraído** (por etapa). Esse valor é guardado como evento próprio, nunca sobrescreve os eventos originais.
6. **Planejado ≠ executado.** A sessão planejada tem status: `PLANNED`, `DONE`, `SKIPPED` ou `RESCHEDULED`. A sessão executada é outra entidade, vinculada à planejada quando houver.
7. **Datas em UTC.** O banco guarda tudo em UTC. A conversão para o fuso do usuário ocorre na exibição e no cálculo de "dia", "semana" e "mês" das metas.

---

## 5. Decisões pendentes (padrão provisório)

Usar o padrão abaixo até que seja confirmado ou alterado. **Qualquer mudança afeta apenas o pacote `domain` e as constantes**, por isso o código deve isolá-los.

| Tema | Padrão provisório |
|---|---|
| Efetividade | `tempo efetivo ÷ tempo total` (mede foco). A **aderência ao plano** é outra métrica: `tempo efetivo ÷ tempo planejado`. |
| Nota do assunto | 70% aproveitamento em questões + 30% autoavaliação. Autoavaliação normalizada: Não entendi = 0, Parcialmente = 33, Entendi = 67, Dominei = 100. |
| Classificação | Forte: nota ≥ 80. Regular: 60 a 79. Fraco: < 60. Sempre sujeita a `MIN_QUESTIONS`. |
| Recomendação | Nota < 60 → revisão + prática. Nota 60 a 79 → prática. Nota ≥ 80 → manter. |
| Revisão antes do conteúdo novo | No MVP o usuário define os minutos de cada etapa manualmente. A sugestão automática fica para a segunda etapa. |
| Meta de 30 dias | Visão com janela móvel dos últimos 30 dias, e não um tipo de meta. |
| Hierarquia de assuntos | `parent_id`, com profundidade livre. |
| Início da semana | Segunda-feira. |
| Erros recorrentes | Fora do MVP. |
| Testes de retenção | Segunda etapa, autodeclarados: o usuário faz questões por conta própria e registra o resultado. |

---

## 6. Modelo de dados

Todas as tabelas têm `id`, `user_id` (exceto `User`), `created_at` e `updated_at`. Datas e horários em UTC.

**User** — `email`, `name`, `password_hash`, `timezone` (ex.: `America/Rio_Branco`), `week_starts_on`.

**Subject (matéria)** — `name`, `color`, `archived`.

**Topic (assunto)** — `subject_id`, `parent_id` (nulo para o nível superior), `name`, `archived`.

**PlannedSession** — `subject_id`, `topic_id`, `scheduled_start`, `planned_minutes`, `priority`, `activity_type`, `notes`, `status` (`PLANNED | DONE | SKIPPED | RESCHEDULED`), `rescheduled_from_id`.

**PlannedBlock** — `planned_session_id`, `kind` (`REVIEW | NEW_CONTENT | PRACTICE`), `planned_minutes`, `position`.

**StudySession** — `planned_session_id` (opcional), `topic_id`, `started_at`, `ended_at`, `status` (`IN_PROGRESS | FINISHED | CANCELLED`).

**SessionBlock** — `study_session_id`, `kind`, `planned_minutes`, `position`.

**SessionEvent** — `study_session_id`, `block_id`, `type`, `occurred_at`, `declared_seconds` (apenas para `DISTRACTION_DECLARED`).
Tipos: `BLOCK_START`, `PAUSE`, `RESUME`, `DISTRACTION_START`, `DISTRACTION_END`, `DISTRACTION_DECLARED`, `BLOCK_FINISH`, `SESSION_FINISH`, `SESSION_CANCEL`.

**PracticeRecord** — `study_session_id`, `block_id`, `topic_id`, `questions`, `correct`. Os erros são `questions - correct` e **não são armazenados**. Restrição: `0 ≤ correct ≤ questions`.

**SessionEvaluation** — `study_session_id`, `understanding` (`NONE | PARTIAL | GOOD | MASTERED`), `focus` (`LOW | MEDIUM | HIGH`), `difficulty` (`EASY | NORMAL | HARD`), `notes`.

**Goal** — `kind` (`EFFORT | RESULT`), `metric` (`EFFECTIVE_MINUTES | QUESTIONS | TOPICS_COMPLETED | REVIEWS | ACCURACY`), `period` (`DAY | WEEK | MONTH`), `period_start_local_date`, `target_value`, `subject_id` (opcional), `topic_id` (opcional). O progresso é **calculado**, não armazenado.

---

## 7. Máquina de estados do timer

```text
(início da etapa) → ESTUDANDO ⇄ PAUSADO
                         ⇅
                     DISTRAÍDO
(fim da etapa) ← qualquer estado
```

- Apenas um estado ativo por vez.
- O estado atual é sempre **derivado do último evento** da etapa. Nada fica apenas na memória do navegador.
- Ao recarregar a página, o timer é reconstruído a partir dos eventos.

---

## 8. Fórmulas

Para cada etapa:

```text
tempo_total        = BLOCK_FINISH − BLOCK_START
tempo_pausado      = soma dos intervalos PAUSE → RESUME
tempo_distraido_rt = soma dos intervalos DISTRACTION_START → DISTRACTION_END
tempo_distraido_dc = soma dos DISTRACTION_DECLARED.declared_seconds
tempo_efetivo      = max(0, tempo_total − tempo_pausado − tempo_distraido_rt − tempo_distraido_dc)
```

Regras de consistência:
- Pausas e distrações em tempo real **não se sobrepõem**.
- `pausado + distraído_rt + distraído_dc` não pode ultrapassar `tempo_total`. Se ultrapassar, rejeitar a declaração com mensagem clara.
- Se um intervalo ficar aberto (página fechada), o cálculo usa o último evento conhecido e sinaliza a etapa como "incompleta" para o usuário corrigir.

Sessão:
```text
tempo_efetivo_sessao = soma do tempo efetivo das etapas
efetividade          = tempo_efetivo ÷ tempo_total          (foco)
aderencia            = tempo_efetivo ÷ tempo_planejado       (cumprimento do plano)
atraso               = início real − início planejado
aproveitamento       = correct ÷ questions × 100
```

Cada uma dessas fórmulas deve ter testes cobrindo: caso normal, pausas múltiplas, distração declarada, intervalo aberto, resultado zero e valores inválidos.

---

## 9. Fases de construção

| Fase | Entrega |
|---|---|
| 1 | Fundação: projeto, banco, autenticação |
| 2 | Matérias e assuntos |
| 3 | Agenda e planejamento |
| 4 | Timer por etapa |
| 5 | Avaliação pós-sessão e prática |
| 6 | Metas |
| 7 | Estatísticas e Dashboard |
| 8 | Observatório semanal |

Os prompts de cada fase estão em `02-prompts-por-fase.md`.

---

## 10. Fora do escopo do MVP

Testes de retenção, revisão automática, indicador de saúde dos estudos, erros recorrentes, notificações, IA, banco de questões, aplicativo móvel, recursos sociais e gamificação.
