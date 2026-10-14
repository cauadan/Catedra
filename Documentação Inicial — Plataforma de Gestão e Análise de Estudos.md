# Plataforma de Gestão e Análise de Estudos

## 1. Visão geral

O projeto será uma plataforma web de estudos voltada inicialmente para uso pessoal e para um pequeno grupo de usuários.

O objetivo não é criar apenas um calendário, Pomodoro ou lista de tarefas.

A plataforma deverá acompanhar o ciclo completo de estudo:

**Planejar → Estudar → Registrar → Avaliar → Analisar → Revisar → Replanejar**

O sistema deverá utilizar os dados registrados pelo próprio usuário para identificar:

- pontos fortes;
- pontos fracos;
- assuntos que precisam de revisão;
- assuntos que precisam de mais prática;
- evolução ao longo do tempo;
- consistência de estudos;
- diferença entre tempo planejado e tempo efetivamente estudado;
- desempenho em exercícios;
- assuntos que estão sendo esquecidos com o passar do tempo.

Inicialmente, o projeto NÃO terá uma infraestrutura própria de Inteligência Artificial.

A primeira versão deverá funcionar principalmente com regras, cálculos, métricas e algoritmos determinísticos.

Caso o projeto cresça, uma API de IA gratuita poderá ser adicionada posteriormente.

---

# 2. Objetivo principal

A plataforma deverá responder continuamente a três perguntas:

### 1. O que eu deveria estudar?

Baseado no planejamento, metas, revisões e prioridades.

### 2. Como está sendo meu estudo?

Baseado em tempo efetivo, concentração, pausas, distrações, exercícios, acertos e autoavaliação.

### 3. O que eu deveria estudar/revisar depois?

Baseado no desempenho histórico e nos assuntos que apresentam maior necessidade de atenção.

---

# 3. Público inicial

O público inicial será:

- o próprio desenvolvedor;
- pequenos grupos de estudantes;
- estudantes que estudam para provas, concursos, faculdade ou aprendizado pessoal.

O sistema deve ser construído pensando em possibilidade de crescimento futuro, mas sem complexidade desnecessária na primeira versão.

---

# 4. Conceito principal

O sistema será dividido em módulos.

## Módulos principais

1. Dashboard
2. Planejador / Agenda
3. Sessão de estudo / Timer
4. Metas
5. Desempenho
6. Observatório
7. Banco de matérias e assuntos

---

# 5. Módulo 1 — Dashboard

O Dashboard será a tela inicial.

Deverá apresentar uma visão resumida do estado atual dos estudos.

## Informações principais

- estudos programados para hoje;
- próxima sessão;
- tempo planejado para hoje;
- tempo efetivo estudado;
- metas do dia;
- progresso das metas;
- assuntos que precisam de atenção;
- revisões pendentes;
- desempenho recente;
- resumo da semana.

Exemplo:

```text
BOM DIA!

Próximo estudo
19:00 — Matemática
Funções quadráticas

Tempo planejado: 60 min

Revisão:
15 min — revisão de funções

Prática:
20 min — exercícios

Novo conteúdo:
25 min — funções quadráticas
```

---

# 6. Módulo 2 — Planejador / Agenda

O usuário poderá criar um planejamento de estudos.

## Cadastro de estudo

Cada planejamento deverá permitir:

- matéria;
- assunto;
- data;
- horário;
- duração;
- prioridade;
- tipo de atividade;
- observações.

Tipos de atividade:

- revisão;
- conteúdo novo;
- prática;
- exercícios;
- simulado;
- teste de memória.

---

# 7. Estrutura de uma sessão

Uma sessão poderá ser dividida em etapas.

Exemplo:

```text
Matemática — Funções quadráticas

15 min → Revisão
25 min → Conteúdo novo
20 min → Prática
-------------------
60 min → Sessão
```

A revisão deverá acontecer ANTES do conteúdo novo quando o usuário configurar essa opção.

O sistema deverá permitir que o usuário defina quanto tempo será destinado à revisão.

---

# 8. Revisão antes do conteúdo novo

Antes de iniciar um assunto novo, o sistema poderá reservar automaticamente um período para revisão.

Exemplo:

```text
Sessão: 60 minutos

Revisão:       15 min
Conteúdo novo: 30 min
Prática:       15 min
```

O usuário poderá alterar essas proporções.

A revisão poderá utilizar:

- assuntos estudados anteriormente;
- erros recentes;
- assuntos com baixo desempenho;
- revisões programadas;
- conteúdos que estão há muito tempo sem serem revisitados.

---

# 9. Prática

A prática será uma parte importante da sessão.

O usuário poderá registrar atividades como:

- exercícios;
- questões;
- problemas;
- programação;
- redação;
- flashcards;
- simulados.

O sistema deverá registrar, quando aplicável:

- quantidade de questões;
- quantidade de acertos;
- quantidade de erros;
- percentual de acerto.

Exemplo:

```text
20 questões
14 acertos
6 erros

Aproveitamento: 70%
```

---

# 10. Módulo 3 — Timer / Sessão de estudo

O sistema deverá possuir um timer próprio.

O usuário poderá:

- iniciar;
- pausar;
- continuar;
- finalizar;
- cancelar a sessão.

O timer deverá diferenciar:

### Tempo planejado

Quanto tempo o usuário pretendia estudar.

### Tempo decorrido

Quanto tempo passou desde o início.

### Pausas

Tempo em que o usuário pausou deliberadamente o estudo.

### Distrações

Tempo ou eventos em que o usuário reconhece que deixou de estudar por distração.

### Tempo efetivo

Tempo realmente dedicado ao estudo.

---

# 11. Tempo efetivo

A plataforma deverá calcular:

```text
Tempo efetivo =
Tempo total da sessão
- pausas
- distrações
```

Exemplo:

```text
Tempo planejado: 60 min
Tempo total: 72 min
Pausas: 7 min
Distrações: 5 min

Tempo efetivo: 60 min
```

O sistema também poderá calcular:

```text
Efetividade =
Tempo efetivo / Tempo planejado × 100
```

Exemplo:

```text
60 / 60 × 100 = 100%
```

---

# 12. Avaliação pós-sessão

Ao finalizar uma sessão, o usuário deverá informar como foi o estudo.

Campos sugeridos:

### Entendimento

- Não entendi;
- Entendi parcialmente;
- Entendi;
- Dominei.

### Concentração

- baixa;
- média;
- alta.

### Dificuldade

- fácil;
- normal;
- difícil.

### Prática

Quando aplicável:

- questões realizadas;
- acertos;
- erros.

### Observação

Campo livre:

> "Tenho dificuldade em interpretar questões de crase."

Essas informações deverão alimentar o sistema de análise.

---

# 13. Módulo 4 — Metas

O usuário poderá criar metas em diferentes períodos.

## Metas diárias

Exemplos:

- estudar 3 horas;
- realizar 40 questões;
- revisar 2 assuntos.

## Metas semanais

Exemplos:

- estudar 18 horas;
- realizar 200 questões;
- concluir 5 assuntos.

## Metas mensais

Exemplos:

- estudar 80 horas;
- realizar 800 questões;
- concluir determinado conteúdo.

## Metas de 30 dias

Deverá existir uma visão específica de aproximadamente 30 dias para acompanhar evolução e consistência.

---

# 14. Metas de esforço e resultado

O sistema deverá diferenciar dois tipos de meta.

## Meta de esforço

Exemplo:

> Estudar 20 horas esta semana.

## Meta de resultado

Exemplo:

> Conseguir pelo menos 80% de acertos em Redes.

Outros exemplos:

> Fazer 300 questões.

> Concluir Funções.

> Alcançar 85% de acertos em Português.

O usuário deverá conseguir acompanhar ambos os tipos.

---

# 15. Módulo 5 — Desempenho

O sistema deverá registrar o desempenho por:

- matéria;
- assunto;
- período;
- sessão;
- quantidade de questões;
- taxa de acertos;
- tempo estudado;
- tempo efetivo.

Exemplo:

```text
MATEMÁTICA

Equações       91%
Funções        56%
Porcentagem    73%
Geometria      88%
```

O objetivo é descobrir onde o usuário realmente apresenta dificuldade.

---

# 16. Módulo 6 — Observatório

O Observatório será um dos principais diferenciais da plataforma.

Ele deverá analisar os dados coletados e apresentar uma interpretação simples para o usuário.

## Visão semanal

Deverá mostrar:

### Pontos fortes

Assuntos com bom desempenho.

### Pontos fracos

Assuntos com baixo desempenho.

### Evolução

Comparação com períodos anteriores.

### Revisões necessárias

Assuntos que precisam ser revisitados.

### Prática necessária

Assuntos que precisam de mais exercícios.

### Alertas

Mudanças negativas ou problemas de consistência.

---

# 17. Exemplo do Observatório semanal

```text
OBSERVATÓRIO
Semana: 05/10 → 11/10

🟢 PONTOS FORTES

Informática — Redes
87% de acertos
4h20 estudadas

Português — Interpretação
84% de acertos
+12% em relação à semana anterior


🔴 PONTOS FRACOS

Matemática — Funções
56% de acertos

Português — Crase
61% de acertos


⚠️ ATENÇÃO

Seu desempenho em Funções caiu
de 68% para 56%.

Recomendação:
Revisar conceitos básicos e realizar
mais exercícios.
```

---

# 18. Análises de diferentes períodos

O Observatório deverá permitir análise por:

- dia;
- semana;
- 30 dias;
- mês;
- períodos maiores no futuro.

A análise semanal deverá mostrar o comportamento recente.

A análise de 30 dias deverá mostrar tendências.

A análise mensal deverá mostrar evolução mais ampla.

---

# 19. Sistema de revisão de longo prazo

O sistema deverá acompanhar quando determinado assunto foi estudado.

Depois de determinado período, o sistema poderá solicitar uma nova avaliação.

Exemplo:

```text
Você estudou:
Funções quadráticas

Há 30 dias.

Vamos testar sua memória?
```

O sistema poderá apresentar perguntas ou exercícios relacionados ao assunto.

Objetivo:

> verificar se o usuário ainda consegue lembrar e aplicar o conteúdo.

---

# 20. Testes de retenção

Depois de algum tempo, o sistema deverá poder testar novamente o conhecimento.

O teste poderá ocorrer após:

- alguns dias;
- uma semana;
- 30 dias;
- períodos configuráveis futuramente.

O sistema deverá comparar:

```text
Primeiro desempenho:
82%

Teste após 30 dias:
61%
```

Nesse caso:

> o assunto pode precisar de uma nova revisão.

---

# 21. Banco de matérias e assuntos

O sistema deverá possuir uma estrutura hierárquica.

Exemplo:

```text
MATEMÁTICA
│
├── Álgebra
│   ├── Equações
│   ├── Inequações
│   └── Funções
│
├── Geometria
│   ├── Área
│   ├── Volume
│   └── Triângulos
│
└── Estatística
    ├── Média
    ├── Mediana
    └── Probabilidade
```

Isso é importante porque o sistema não deve analisar apenas:

> "Matemática está ruim."

Ele deve conseguir identificar:

> "Funções quadráticas estão apresentando desempenho abaixo da média."

---

# 22. Sistema de recomendação

A primeira versão NÃO precisa utilizar Inteligência Artificial.

As recomendações poderão ser produzidas por regras.

Exemplo:

```text
SE desempenho < 60%
→ recomendar revisão

SE desempenho < 70%
→ recomendar prática

SE assunto não é revisado há 30 dias
→ recomendar teste de retenção

SE erros aumentaram
→ aumentar prioridade

SE desempenho melhorou
→ reduzir frequência de revisão
```

Essas regras poderão evoluir posteriormente.

---

# 23. "O que estudar agora?"

O sistema deverá futuramente apresentar uma recomendação baseada nos dados.

Exemplo:

```text
PRÓXIMO ESTUDO

Matemática
Funções quadráticas

Por quê?

• 56% de aproveitamento
• 3 erros recorrentes
• Última revisão há 8 dias
• Desempenho abaixo da média
```

Isso deverá ajudar o usuário a decidir o próximo passo sem precisar analisar todos os gráficos manualmente.

---

# 24. Saúde dos estudos

O sistema poderá apresentar um indicador geral da rotina de estudos.

Exemplo:

```text
SAÚDE DOS ESTUDOS

82/100

Consistência       🟢
Efetividade        🟢
Metas              🟡
Revisões           🔴
Desempenho         🟢
```

Esse indicador deverá ser explicável.

O sistema não deve simplesmente mostrar "82/100" sem explicar de onde veio o resultado.

---

# 25. Evolução

A plataforma deverá permitir visualizar a evolução.

Possíveis métricas:

- horas planejadas;
- horas efetivas;
- efetividade;
- quantidade de sessões;
- questões realizadas;
- taxa de acerto;
- metas cumpridas;
- assuntos concluídos;
- revisões realizadas.

Exemplo:

```text
Últimos 30 dias

Horas efetivas:
████████████████ 82%

Taxa de acerto:
██████████████ 76%

Efetividade:
█████████████████ 87%
```

---

# 26. Princípio importante do produto

O sistema não deve incentivar simplesmente:

> "Estude mais horas."

Ele deve incentivar:

> "Estude melhor e identifique onde seu estudo está falhando."

Exemplo:

O usuário estudou 40 horas.

Porém:

- efetividade = 62%;
- taxa de acerto = 55%;
- muitas pausas;
- pouca revisão.

O sistema deverá identificar isso.

Da mesma forma, alguém que estudou 25 horas com:

- 90% de efetividade;
- 85% de acertos;
- boa retenção;

poderá estar tendo uma rotina mais eficiente.

---

# 27. Inteligência Artificial

## Primeira versão

NÃO utilizar uma infraestrutura própria de IA.

A lógica principal deverá funcionar sem IA.

Prioridade:

1. Banco de dados
2. Registro correto das informações
3. Cálculos
4. Regras de recomendação
5. Estatísticas
6. Interface

## Futuro

Caso o projeto cresça, poderá ser adicionada uma API gratuita ou de baixo custo.

Possíveis usos futuros:

- análise textual das observações;
- geração de explicações;
- geração de perguntas;
- criação de exercícios;
- análise mais avançada dos hábitos;
- recomendações personalizadas.

A IA deverá ser uma camada adicional, e não uma dependência obrigatória do sistema.

---

# 28. Princípio de escalabilidade

Embora o projeto inicialmente seja pequeno, sua arquitetura deverá evitar decisões que impeçam crescimento futuro.

A aplicação deverá ser construída de forma que futuramente possa suportar:

- mais usuários;
- autenticação;
- sincronização entre dispositivos;
- banco de dados em nuvem;
- APIs externas;
- IA;
- notificações;
- sistema de questões;
- aplicativo mobile.

Porém, nenhuma dessas funcionalidades deve ser implementada prematuramente.

---

# 29. MVP — primeira versão

A primeira versão deve priorizar:

### Obrigatório

- cadastro de matérias;
- cadastro de assuntos;
- agenda;
- planejamento de sessões;
- revisão antes do conteúdo novo;
- prática;
- timer;
- pausas;
- registro de distrações;
- cálculo de tempo efetivo;
- avaliação pós-sessão;
- metas diárias;
- metas semanais;
- metas mensais;
- metas de 30 dias;
- registro de questões;
- acertos e erros;
- dashboard;
- estatísticas básicas;
- observatório semanal;
- pontos fortes;
- pontos fracos;
- recomendações básicas de revisão.

### Segunda etapa

- testes de retenção;
- revisão após 30 dias;
- recomendações automáticas mais avançadas;
- gráficos mais completos;
- histórico detalhado;
- sistema de saúde dos estudos.

### Futuro

- IA;
- geração automática de questões;
- integração com bancos de questões;
- notificações;
- aplicativo mobile;
- sincronização avançada;
- recursos sociais;
- gamificação;
- inteligência adaptativa mais avançada.

---

# 30. Fluxo principal do usuário

O fluxo ideal deverá ser:

```text
CADASTRAR MATÉRIAS
        ↓
CADASTRAR ASSUNTOS
        ↓
CRIAR PLANEJAMENTO
        ↓
DEFINIR METAS
        ↓
INICIAR SESSÃO
        ↓
REVISÃO
        ↓
CONTEÚDO NOVO
        ↓
PRÁTICA
        ↓
FINALIZAR TIMER
        ↓
REGISTRAR PAUSAS/DISTRAÇÕES
        ↓
AVALIAR SESSÃO
        ↓
REGISTRAR QUESTÕES/ACERTOS
        ↓
SALVAR DADOS
        ↓
OBSERVATÓRIO
        ↓
IDENTIFICAR FRAQUEZAS
        ↓
RECOMENDAR REVISÕES
        ↓
NOVO PLANEJAMENTO
```

Esse ciclo deverá ser o coração da aplicação.

---

# 31. Filosofia do produto

O software deverá ser:

### Simples para registrar

O estudante não deve gastar 10 minutos preenchendo uma sessão de estudo de 1 hora.

### Detalhado nos bastidores

O sistema deve coletar dados suficientes para produzir análises úteis.

### Visual

O usuário deve conseguir entender sua situação rapidamente.

### Orientado a ação

O sistema não deve apenas mostrar gráficos.

Deve responder:

> "O que devo fazer agora?"

### Progressivo

O sistema deve começar simples e ganhar inteligência conforme mais dados são registrados.

---

# 32. Regra fundamental

Toda informação coletada deverá ter uma finalidade.

Exemplo:

Não registrar "hora de término" apenas porque é possível.

Registrar porque isso permite calcular:

- duração;
- atrasos;
- efetividade;
- consistência;
- evolução.

O objetivo é evitar excesso de informações sem utilidade.

---

# 33. Resultado esperado

Ao abrir a plataforma, o estudante deverá conseguir responder rapidamente:

**O que devo estudar hoje?**

**Quanto tempo tenho para estudar?**

**O que preciso revisar?**

**Onde estou tendo dificuldade?**

**Em que estou melhorando?**

**O que estou esquecendo?**

**Minha rotina está funcionando?**

**Qual deve ser minha próxima sessão?**

A plataforma deve transformar essas respostas em uma experiência simples e visual.