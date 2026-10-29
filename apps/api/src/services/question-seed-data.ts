import { QuestionType, QuestionDifficulty } from '@prisma/client';

export interface SeedQuestion {
  subjectName: string;
  topicName: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  source: string;
  statement: string;
  codeSnippet?: string;
  explanation: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
}

export const SEED_QUESTIONS: SeedQuestion[] = [
  // ============================================================================
  // T.I. - Banco de Dados & SQL
  // ============================================================================
  {
    subjectName: 'Banco de Dados & SQL',
    topicName: 'Consultas SELECT, JOIN e GROUP BY',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'Acervo Nativo',
    statement: 'Considere duas tabelas: `pedidos` (id, cliente_id, valor) e `clientes` (id, nome). Deseja-se listar todos os clientes cadastrados e seus respectivos valores de pedidos, inclusive os clientes que ainda não realizaram nenhum pedido. Qual cláusula JOIN deve ser utilizada partindo de `clientes`?',
    explanation: 'O LEFT JOIN (ou LEFT OUTER JOIN) retorna todos os registros da tabela à esquerda (clientes), preenchendo com NULL os campos da tabela à direita (pedidos) quando não houver correspondência.',
    options: [
      { text: 'INNER JOIN', isCorrect: false },
      { text: 'LEFT JOIN', isCorrect: true },
      { text: 'RIGHT JOIN', isCorrect: false },
      { text: 'CROSS JOIN', isCorrect: false },
    ],
  },
  {
    subjectName: 'Banco de Dados & SQL',
    topicName: 'Consultas SELECT, JOIN e GROUP BY',
    type: 'TRUE_FALSE',
    difficulty: 'EASY',
    source: 'Cebraspe',
    statement: 'A cláusula WHERE pode ser utilizada diretamente para filtrar resultados agregados produzidos por funções como SUM(), COUNT() ou AVG().',
    explanation: 'ERRADO. A cláusula WHERE filtra linhas antes do agrupamento. Para filtrar resultados calculados por funções de agregação, é obrigatório utilizar a cláusula HAVING.',
    options: [
      { text: 'Certo', isCorrect: false },
      { text: 'Errado', isCorrect: true },
    ],
  },
  {
    subjectName: 'Banco de Dados & SQL',
    topicName: 'Transações ACID e Índices',
    type: 'CODE_CHALLENGE',
    difficulty: 'HARD',
    source: 'Desafio T.I.',
    statement: 'No comando SQL a seguir, o desenvolvedor deseja calcular o total gasto apenas por clientes que gastaram mais de R$ 1.000,00 no total. Qual correção no snippet soluciona a falha de sintaxe?',
    codeSnippet: `-- Código com falha de sintaxe:\nSELECT cliente_id, SUM(valor) as total\nFROM pedidos\nWHERE SUM(valor) > 1000\nGROUP BY cliente_id;`,
    explanation: 'Funções de agregação não podem constar no WHERE. A condição deve ser transferida para a cláusula HAVING: GROUP BY cliente_id HAVING SUM(valor) > 1000;',
    options: [
      { text: 'Substituir WHERE SUM(valor) > 1000 por HAVING SUM(valor) > 1000 após o GROUP BY', isCorrect: true },
      { text: 'Adicionar ORDER BY SUM(valor) antes do WHERE', isCorrect: false },
      { text: 'Substituir GROUP BY cliente_id por DISTINCT cliente_id', isCorrect: false },
      { text: 'Usar WHERE total > 1000 sem alterar mais nada', isCorrect: false },
    ],
  },
  {
    subjectName: 'Banco de Dados & SQL',
    topicName: 'Modelagem Relacional e Normalização',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'FGV',
    statement: 'Uma tabela relacional está na Segunda Forma Normal (2FN) se e somente se estiver na 1FN e:',
    explanation: 'A 2FN exige que a tabela esteja na 1FN e que nenhum atributo não chave dependa parcialmente de qualquer chave candidata composta (ausência de dependência funcional parcial).',
    options: [
      { text: 'Todos os atributos não chave forem mutuamente independentes.', isCorrect: false },
      { text: 'Não contiver dependências funcionais transitivas em relação à chave primária.', isCorrect: false },
      { text: 'Todos os atributos não chave dependerem da totalidade de cada chave candidata, e não apenas de parte dela.', isCorrect: true },
      { text: 'Possuir apenas chaves estrangeiras com integridade referencial em cascata.', isCorrect: false },
    ],
  },

  // ============================================================================
  // T.I. - Estrutura de Dados & Algoritmos
  // ============================================================================
  {
    subjectName: 'Estrutura de Dados & Algoritmos',
    topicName: 'Filas, Pilhas e Listas Encadeadas',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    source: 'Acervo Nativo',
    statement: 'Qual estrutura de dados opera sob o princípio LIFO (Last In, First Out), onde o último elemento inserido é obrigatoriamente o primeiro a ser removido?',
    explanation: 'A Pilha (Stack) opera segundo o modelo LIFO (Last-In, First-Out). Já a Fila opera segundo o modelo FIFO (First-In, First-Out).',
    options: [
      { text: 'Fila (Queue)', isCorrect: false },
      { text: 'Pilha (Stack)', isCorrect: true },
      { text: 'Grafo (Graph)', isCorrect: false },
      { text: 'Tabela Hash (Hash Table)', isCorrect: false },
    ],
  },
  {
    subjectName: 'Estrutura de Dados & Algoritmos',
    topicName: 'Complexidade Big-O e Algoritmos de Ordenação',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'O algoritmo Merge Sort possui complexidade de tempo de O(n log n) no pior caso, enquanto o Quick Sort clássico pode degradar para O(n²) no pior caso se o pivô for mal escolhido.',
    explanation: 'CERTO. Merge Sort garante divisão e conquista com complexidade estável O(n log n) no melhor, médio e pior casos. O Quick Sort tem caso médio O(n log n), mas degrada para O(n²) quando particionado assimetricamente (ex: lista já ordenada com pivô na ponta).',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Estrutura de Dados & Algoritmos',
    topicName: 'Árvores Binárias e Grafos',
    type: 'CODE_CHALLENGE',
    difficulty: 'HARD',
    source: 'Desafio T.I.',
    statement: 'Analise a função recursiva de busca binária a seguir. Qual é a correção necessária para evitar um loop infinito ou estouro de pilha quando o elemento não existir no array?',
    codeSnippet: `function binarySearch(arr, target, left = 0, right = arr.length - 1) {\n  if (left > right) return -1;\n  const mid = Math.floor((left + right) / 2);\n  if (arr[mid] === target) return mid;\n  if (arr[mid] > target) {\n    return binarySearch(arr, target, left, mid); // linha com falha\n  }\n  return binarySearch(arr, target, mid + 1, right);\n}`,
    explanation: 'Ao buscar na metade esquerda quando arr[mid] > target, o limite superior deve ser mid - 1 (e não mid), pois o elemento mid já foi verificado e não é o alvo.',
    options: [
      { text: 'Trocar "left, mid" por "left, mid - 1"', isCorrect: true },
      { text: 'Trocar "mid + 1, right" por "mid, right"', isCorrect: false },
      { text: 'Mudar a condição base para "if (left === right) return -1"', isCorrect: false },
      { text: 'Inverter os sinais de maior e menor', isCorrect: false },
    ],
  },

  // ============================================================================
  // T.I. - Redes de Computadores
  // ============================================================================
  {
    subjectName: 'Redes de Computadores',
    topicName: 'Modelo OSI e Pilha TCP/IP',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'FGV',
    statement: 'No Modelo OSI, em qual camada atuam os protocolos TCP e UDP, responsáveis pelo controle de fluxo, multiplexação via portas e entrega orientada (ou não) à conexão?',
    explanation: 'TCP e UDP pertencem à Camada 4 - Transporte no Modelo OSI. O IP atua na Camada 3 (Rede).',
    options: [
      { text: 'Camada de Rede (Camada 3)', isCorrect: false },
      { text: 'Camada de Transporte (Camada 4)', isCorrect: true },
      { text: 'Camada de Aplicação (Camada 7)', isCorrect: false },
      { text: 'Camada de Enlace (Camada 2)', isCorrect: false },
    ],
  },
  {
    subjectName: 'Redes de Computadores',
    topicName: 'Protocolos HTTP, DNS e TLS/SSL',
    type: 'TRUE_FALSE',
    difficulty: 'EASY',
    source: 'Cebraspe',
    statement: 'O protocolo DNS (Domain Name System) utiliza prioritariamente a porta UDP 53 para consultas de resolução de nomes padrão devido à menor sobrecarga (overhead) e velocidade.',
    explanation: 'CERTO. As consultas comuns de resolução de nomes DNS são feitas via UDP na porta 53. O TCP 53 é reservado prioritariamente para transferência de zonas (zone transfers) e respostas superiores a 512 bytes sem suporte a EDNS.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Redes de Computadores',
    topicName: 'Roteamento, Máscaras e Subredes',
    type: 'CODE_CHALLENGE',
    difficulty: 'MEDIUM',
    source: 'Desafio T.I.',
    statement: 'Analise a configuração de CIDR no comando a seguir. Quantos endereços IP utilizáveis para hosts estão disponíveis nessa sub-rede?',
    codeSnippet: `# Configuração de interface no Linux:\nip addr add 192.168.10.1/28 dev eth0`,
    explanation: 'Um prefixo /28 deixa 32 - 28 = 4 bits para hosts. 2^4 = 16 endereços totais. Descontando o endereço de rede (.0) e o endereço de broadcast (.15), restam 14 endereços utilizáveis para hosts.',
    options: [
      { text: '14 hosts utilizáveis', isCorrect: true },
      { text: '16 hosts utilizáveis', isCorrect: false },
      { text: '30 hosts utilizáveis', isCorrect: false },
      { text: '6 hosts utilizáveis', isCorrect: false },
    ],
  },

  // ============================================================================
  // T.I. - Segurança da Informação
  // ============================================================================
  {
    subjectName: 'Segurança da Informação',
    topicName: 'Ataques Web (SQLi, XSS, CSRF)',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'Acervo Nativo',
    statement: 'Qual vulnerabilidade de segurança ocorre quando uma aplicação web inclui dados não confiáveis em uma página web sem a devida sanitização ou escape, permitindo a execução de scripts maliciosos no navegador de outro usuário?',
    explanation: 'Cross-Site Scripting (XSS) consiste na injeção de scripts maliciosos (geralmente JavaScript) que são executados no contexto da sessão da vítima no cliente.',
    options: [
      { text: 'SQL Injection (SQLi)', isCorrect: false },
      { text: 'Cross-Site Scripting (XSS)', isCorrect: true },
      { text: 'Cross-Site Request Forgery (CSRF)', isCorrect: false },
      { text: 'Server-Side Request Forgery (SSRF)', isCorrect: false },
    ],
  },
  {
    subjectName: 'Segurança da Informação',
    topicName: 'Criptografia Simétrica e Assimétrica',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'Na criptografia assimétrica (como RSA ou curvas elípticas), uma mensagem criptografada com a chave pública de um destinatário só pode ser descriptografada por meio da chave privada desse mesmo destinatário.',
    explanation: 'CERTO. Na criptografia de chave pública (assimétrica), o emissor utiliza a chave pública do destinatário para cifrar a mensagem, e apenas o detentor da respectiva chave privada correspondente é capaz de decifrá-la.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Segurança da Informação',
    topicName: 'Autenticação, JWT e RBAC',
    type: 'CODE_CHALLENGE',
    difficulty: 'HARD',
    source: 'Desafio T.I.',
    statement: 'O trecho de código Node.js a seguir contém uma vulnerabilidade crítica de SQL Injection. Qual alteração elimina a vulnerabilidade adotando Prepared Statements (Parameterized Queries)?',
    codeSnippet: `// Rota vulnerável:\napp.get('/users', async (req, res) => {\n  const username = req.query.username;\n  const query = \`SELECT * FROM users WHERE name = '\${username}'\`;\n  const result = await db.query(query);\n  res.json(result.rows);\n});`,
    explanation: 'Concatenar parâmetros diretamente na string SQL permite que o atacante injete comandos arbitrários. A solução é usar parâmetros vinculados: db.query("SELECT * FROM users WHERE name = $1", [username]).',
    options: [
      { text: 'Utilizar parâmetros vinculados: db.query("SELECT * FROM users WHERE name = $1", [username])', isCorrect: true },
      { text: 'Usar username.trim() antes de concatenar na query', isCorrect: false },
      { text: 'Substituir app.get por app.post para ocultar os parâmetros da URL', isCorrect: false },
      { text: 'Fazer encodeURIComponent no valor de username', isCorrect: false },
    ],
  },

  // ============================================================================
  // T.I. - Desenvolvimento Web & JavaScript
  // ============================================================================
  {
    subjectName: 'Desenvolvimento Web & JavaScript',
    topicName: 'Promises, Async/Await e Fetch API',
    type: 'CODE_CHALLENGE',
    difficulty: 'MEDIUM',
    source: 'Desafio T.I.',
    statement: 'Qual será a ordem de saída no console ao executar o seguinte código JavaScript baseado no Event Loop?',
    codeSnippet: `console.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => console.log('3'));\nconsole.log('4');`,
    explanation: '1 e 4 são executados no stack síncrono. Em seguida, a microtask queue (Promise.then) é drenada exibindo 3. Por fim, a macrotask queue (setTimeout) é executada exibindo 2.',
    options: [
      { text: '1, 4, 3, 2', isCorrect: true },
      { text: '1, 2, 3, 4', isCorrect: false },
      { text: '1, 4, 2, 3', isCorrect: false },
      { text: '1, 3, 4, 2', isCorrect: false },
    ],
  },
  {
    subjectName: 'Desenvolvimento Web & JavaScript',
    topicName: 'JavaScript ES6+, Closures e Event Loop',
    type: 'TRUE_FALSE',
    difficulty: 'EASY',
    source: 'Acervo Nativo',
    statement: 'Em JavaScript moderno, constantes declaradas com `const` possuem escopo de bloco e não podem ser redeclaradas nem ter seus identificadores reatribuídos.',
    explanation: 'CERTO. Variáveis com let e const possuem escopo de bloco (block scope). Uma variável const impede a reatribuição da referência, embora propriedades de objetos atribuídos a ela ainda possam ser mutadas.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Desenvolvimento Web & JavaScript',
    topicName: 'TypeScript e Manipulação do DOM',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'Acervo Nativo',
    statement: 'No TypeScript, qual operador é utilizado para criar um tipo cujos valores são as chavesLiterais de outro tipo ou interface (ex.: type Chaves = keyof Usuario)?',
    explanation: 'O operador `keyof` recebe um tipo de objeto e produz uma união de strings ou literais numéricos com as suas chaves.',
    options: [
      { text: 'typeof', isCorrect: false },
      { text: 'keyof', isCorrect: true },
      { text: 'in', isCorrect: false },
      { text: 'infer', isCorrect: false },
    ],
  },

  // ============================================================================
  // T.I. - Linux & Git
  // ============================================================================
  {
    subjectName: 'Linux & Git',
    topicName: 'Comandos Fundamentais e Bash',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    source: 'Acervo Nativo',
    statement: 'No terminal Linux, qual comando altera as permissões de acesso de um arquivo ou diretório (ex.: leitura, escrita e execução)?',
    explanation: 'O comando `chmod` (change mode) altera as permissões de arquivos e diretórios. `chown` altera o proprietário e grupo.',
    options: [
      { text: 'chown', isCorrect: false },
      { text: 'chmod', isCorrect: true },
      { text: 'chgrp', isCorrect: false },
      { text: 'ps', isCorrect: false },
    ],
  },
  {
    subjectName: 'Linux & Git',
    topicName: 'Git Flow, Branches e Rebase',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'O comando `git rebase` reaplica commits de uma branch sobre a ponta de outra branch, reescrevendo o histórico de commits com novos hashes SHA-1.',
    explanation: 'CERTO. O rebase move a base da branch de trabalho criando novos commits com novos SHAs correspondentes às mesmas alterações, resultando em um histórico linear.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Linux & Git',
    topicName: 'Permissões e Processos no Linux',
    type: 'CODE_CHALLENGE',
    difficulty: 'MEDIUM',
    source: 'Desafio T.I.',
    statement: 'Observe a linha de comando Bash a seguir. O que a combinação `2>&1` realiza?',
    codeSnippet: `$ ./backup_script.sh > output.log 2>&1`,
    explanation: 'O descritor de arquivo 1 representa stdout (saída padrão) e o 2 representa stderr (saída de erros). A sintaxe 2>&1 redireciona o fluxo de erros para o mesmo destino para onde a saída padrão está apontando.',
    options: [
      { text: 'Redireciona a saída de erro padrão (stderr - descritor 2) para a saída padrão (stdout - descritor 1)', isCorrect: true },
      { text: 'Executa o processo em segundo plano (background) duas vezes', isCorrect: false },
      { text: 'Descarta todos os logs e mensagens de erro', isCorrect: false },
      { text: 'Converte a saída em formato JSON estruturado', isCorrect: false },
    ],
  },

  // ============================================================================
  // CONCURSOS - Direito Constitucional
  // ============================================================================
  {
    subjectName: 'Direito Constitucional',
    topicName: 'Princípios Fundamentais e Direitos e Garantias',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    source: 'FGV',
    statement: 'Segundo a Constituição Federal de 1988 (Art. 5º, LXVIII), qual ação constitucional é cabível sempre que alguém sofrer ou se achar ameaçado de sofrer violência ou coação em sua liberdade de locomoção, por ilegalidade ou abuso de poder?',
    explanation: 'O Habeas Corpus tutela a liberdade de locomoção (direito de ir, vir e permanecer). O Habeas Data protege o acesso e retificação de informações pessoais.',
    options: [
      { text: 'Mandado de Segurança', isCorrect: false },
      { text: 'Habeas Corpus', isCorrect: true },
      { text: 'Habeas Data', isCorrect: false },
      { text: 'Ação Popular', isCorrect: false },
    ],
  },
  {
    subjectName: 'Direito Constitucional',
    topicName: 'Controle de Constitucionalidade',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'No ordenamento jurídico brasileiro, qualquer juiz ou tribunal possui competência para exercer o controle difuso de constitucionalidade no julgamento de um caso concreto posto sob sua apreciação.',
    explanation: 'CERTO. O controle difuso (ou por via de exceção/aberta) pode ser exercido por qualquer órgão do Poder Judiciário (juiz singular ou tribunal) na análise incidental de uma lide concreta.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Direito Constitucional',
    topicName: 'Organização dos Poderes',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'HARD',
    source: 'Cebraspe',
    statement: 'A CPI (Comissão Parlamentar de Inquérito), no exercício de seus poderes instrutórios de investigação próprios de autoridades judiciais, NÃO tem competência constitucional para determinar diretamente:',
    explanation: 'A CPI pode determinar quebra de sigilo bancário, fiscal e telefônico, mas NÃO pode determinar quebra de sigilo de comunicações telefônicas (interceptação/escuta telefônica nem busca e apreensão domiciliar), pois tais medidas sujeitam-se à estrita cláusula de reserva de jurisdição.',
    options: [
      { text: 'Quebra de sigilo bancário do investigado', isCorrect: false },
      { text: 'Quebra de sigilo fiscal do investigado', isCorrect: false },
      { text: 'Interceptação telefônica (escuta das conversas em tempo real)', isCorrect: true },
      { text: 'Oitiva de testemunhas sob compromisso legal', isCorrect: false },
    ],
  },

  // ============================================================================
  // CONCURSOS - Direito Administrativo
  // ============================================================================
  {
    subjectName: 'Direito Administrativo',
    topicName: 'Princípios da Administração Pública (LIMPE)',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'EASY',
    source: 'FGV',
    statement: 'O Art. 37 da Constituição Federal estabelece os princípios expressos da Administração Pública direta e indireta. Qual mnemônico clássico sintetiza esses cinco princípios?',
    explanation: 'LIMPE: Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência (esta última acrescentada pela Emenda Constitucional nº 19/1998).',
    options: [
      { text: 'LIMPE (Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência)', isCorrect: true },
      { text: 'PROER (Probidade, Razoabilidade, Ordem, Eficácia, Respeito)', isCorrect: false },
      { text: 'VALOR (Veracidade, Ampla defesa, Legalidade, Oficialidade, Razoabilidade)', isCorrect: false },
      { text: 'MORAL (Motivação, Ordem, Razoabilidade, Autotutela, Legalidade)', isCorrect: false },
    ],
  },
  {
    subjectName: 'Direito Administrativo',
    topicName: 'Atos e Poderes Administrativos',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'O Poder de Polícia confere à Administração Pública a prerrogativa de condicionar e restringir o uso de bens, o exercício de atividades e direitos individuais em prol do interesse da coletividade.',
    explanation: 'CERTO. É a definição clássica do poder de polícia administrativa estabelecida no art. 78 do Código Tributário Nacional e amplamente adotada pela doutrina e jurisprudência.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
  {
    subjectName: 'Direito Administrativo',
    topicName: 'Licitações e Contratos (Lei 14.133)',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'HARD',
    source: 'Cebraspe',
    statement: 'De acordo com a Nova Lei de Licitações (Lei nº 14.133/2021), qual é a modalidade de licitação voltada para a contratação de obras, serviços e compras em que a Administração realiza diálogos com licitantes previamente selecionados para desenvolver uma ou mais alternativas capazes de atender às suas necessidades?',
    explanation: 'O Diálogo Competitivo é a nova modalidade introduzida pela Lei 14.133/2021 para inovações tecnológicas ou complexidades técnicas onde a administração precisa dialogar antes de formular o edital final.',
    options: [
      { text: 'Pregão', isCorrect: false },
      { text: 'Concorrência', isCorrect: false },
      { text: 'Diálogo Competitivo', isCorrect: true },
      { text: 'Tomada de Preços', isCorrect: false },
    ],
  },

  // ============================================================================
  // CONCURSOS - Língua Portuguesa
  // ============================================================================
  {
    subjectName: 'Língua Portuguesa',
    topicName: 'Regência e Emprego da Crase',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'FGV',
    statement: 'Assinale a frase em que o acento grave indicativo de crase está empregado em conformidade com a norma-padrão da Língua Portuguesa:',
    explanation: 'Em "Entregou o relatório à diretora", o verbo entregar é transitivo direto e indireto ("entregar algo a alguém"), exigindo a preposição "a", que se funde com o artigo feminino "a" de "diretora". Não ocorre crase antes de verbo ("a partir"), nem antes de palavra masculina ("a pé"), nem antes de pronome indefinido ("a todas").',
    options: [
      { text: 'Ele começou à estudar para o concurso ontem.', isCorrect: false },
      { text: 'Entregou o relatório à diretora da instituição.', isCorrect: true },
      { text: 'Fomos até a praia à pé para fazer exercício.', isCorrect: false },
      { text: 'Desejou felicidades à todas as concorrentes.', isCorrect: false },
    ],
  },
  {
    subjectName: 'Língua Portuguesa',
    topicName: 'Concordância Verbal e Nominal',
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'Na frase "Haviam muitas pessoas aguardando o início da prova", o emprego do verbo "haver" está correto de acordo com a norma culta.',
    explanation: 'ERRADO. O verbo "haver" no sentido de existir ou ocorrer é impessoal e não possui sujeito, devendo permanecer obrigatoriamente na 3ª pessoa do singular: "Havia muitas pessoas aguardando...".',
    options: [
      { text: 'Certo', isCorrect: false },
      { text: 'Errado', isCorrect: true },
    ],
  },

  // ============================================================================
  // CONCURSOS - Raciocínio Lógico & Matemática
  // ============================================================================
  {
    subjectName: 'Raciocínio Lógico & Matemática',
    topicName: 'Equivalências e Negações Lógicas',
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    source: 'Cebraspe',
    statement: 'Qual é a negação lógica da proposição condicional: "Se eu estudar com disciplina, então serei aprovado"?',
    explanation: 'Pela regra clássica do MANÉ (Mantém a primeira E Nega a segunda), a negação de p -> q é p ^ ~q: "Eu estudo com disciplina E não sou aprovado".',
    options: [
      { text: 'Se eu não estudar com disciplina, não serei aprovado.', isCorrect: false },
      { text: 'Eu estudo com disciplina e não sou aprovado.', isCorrect: true },
      { text: 'Eu não estudo com disciplina ou sou aprovado.', isCorrect: false },
      { text: 'Se eu for aprovado, então estudei com disciplina.', isCorrect: false },
    ],
  },
  {
    subjectName: 'Raciocínio Lógico & Matemática',
    topicName: 'Proposições e Tabela Verdade',
    type: 'TRUE_FALSE',
    difficulty: 'EASY',
    source: 'Cebraspe',
    statement: 'A proposição condicional "Se P, então Q" (P -> Q) só é falsa em um único caso: quando o antecedente (P) é verdadeiro e o consequente (Q) é falso (V -> F = F).',
    explanation: 'CERTO. É a regra da Vera Fischer (V -> F = F). Em todas as outras três combinações de valores lógicos (V->V, F->V, F->F), a condicional é sempre verdadeira.',
    options: [
      { text: 'Certo', isCorrect: true },
      { text: 'Errado', isCorrect: false },
    ],
  },
];
