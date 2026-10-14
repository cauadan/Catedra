import {
  registerSchema,
  loginSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
  topicCreateSchema,
  topicUpdateSchema,
  userProfileSchema,
  wouldCreateHierarchyCycle,
  calculateAccuracy,
  mapUnderstandingToScore,
  calculateSubjectGrade,
  classifyPerformance,
  calculateFocusEfficiency,
  calculatePlanAdherence,
  MIN_QUESTIONS_FOR_RATING,
} from '../packages/domain/dist/index.js';

console.log('================================================================');
console.log('SUÍTE ADVERSÁRIA EXPANDIDA DE ESTRESSE — MILESTONE 1');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName} - ${details}`);
    findings.push({ testName, details });
  }
}

// ------------------------------------------------------------------------------
// 1. ESTRESSE DO ALGORITMO DE PREVENÇÃO DE CICLOS (wouldCreateHierarchyCycle)
// ------------------------------------------------------------------------------
console.log('\n--- 1. ESTRESSE: PREVENÇÃO DE CICLOS NA HIERARQUIA ---');

// Cenário 1.1: Auto-referência direta
assert(
  wouldCreateHierarchyCycle('node-A', 'node-A', () => undefined) === true,
  'Auto-referência direta (topicId === newParentId) deve retornar true'
);

// Cenário 1.2: newParentId nulo, indefinido ou vazio
assert(
  wouldCreateHierarchyCycle('node-A', null, () => undefined) === false,
  'Mover para raiz (null) deve retornar false'
);
assert(
  wouldCreateHierarchyCycle('node-A', undefined, () => undefined) === false,
  'Mover para raiz (undefined) deve retornar false'
);
assert(
  wouldCreateHierarchyCycle('node-A', '', () => undefined) === false,
  'Mover com string vazia como newParentId retorna false (tratado como raiz)'
);

// Cenário 1.3: Árvore Linear Profunda (10.000 nós)
console.log('Testando cadeia linear de 10.000 nós...');
const linearNodes = new Map();
const CHAIN_DEPTH = 10000;
linearNodes.set('node-0', { id: 'node-0', parent_id: null, subject_id: 'sub-1' });
for (let i = 1; i <= CHAIN_DEPTH; i++) {
  linearNodes.set(`node-${i}`, {
    id: `node-${i}`,
    parent_id: `node-${i - 1}`,
    subject_id: 'sub-1',
  });
}
const getLinearNode = (id) => linearNodes.get(id);

const t0 = performance.now();
const deepCycleDetected = wouldCreateHierarchyCycle('node-0', `node-${CHAIN_DEPTH}`, getLinearNode);
const t1 = performance.now();
assert(
  deepCycleDetected === true,
  `Ciclo detectado em cadeia linear de ${CHAIN_DEPTH} níveis`,
  `Tempo: ${(t1 - t0).toFixed(2)}ms`
);
assert(
  (t1 - t0) < 100,
  `Desempenho em 10.000 nós aceitável (< 100ms)`,
  `Tempo real: ${(t1 - t0).toFixed(2)}ms`
);

// Mover folha para raiz em cadeia profunda (válido)
assert(
  wouldCreateHierarchyCycle(`node-${CHAIN_DEPTH}`, null, getLinearNode) === false,
  'Mover folha de cadeia de 10.000 nós para raiz é válido'
);

// Mover nó intermediário 'node-5000' para folha 'node-10000' (ciclo)
assert(
  wouldCreateHierarchyCycle('node-5000', `node-${CHAIN_DEPTH}`, getLinearNode) === true,
  'Mover nó mediano para folha descendente é ciclo'
);

// Mover folha 'node-10000' para nó intermediário 'node-5000' (válido, já é descendente)
assert(
  wouldCreateHierarchyCycle(`node-${CHAIN_DEPTH}`, 'node-5000', getLinearNode) === false,
  'Mover folha para nó ascendente não cria ciclo (apenas encurta caminho)'
);

// Cenário 1.4: Grafo com Ciclo Pré-existente Corrompido
console.log('Testando comportamento diante de grafo com ciclo pré-existente...');
// Ciclo isolado: C1 -> C2 -> C3 -> C1
const corruptedNodes = new Map([
  ['C1', { id: 'C1', parent_id: 'C3', subject_id: 'sub-1' }],
  ['C2', { id: 'C2', parent_id: 'C1', subject_id: 'sub-1' }],
  ['C3', { id: 'C3', parent_id: 'C2', subject_id: 'sub-1' }],
  ['X', { id: 'X', parent_id: null, subject_id: 'sub-1' }],
]);
const getCorruptedNode = (id) => corruptedNodes.get(id);

const cycleInChainDetected = wouldCreateHierarchyCycle('X', 'C1', getCorruptedNode);
assert(
  cycleInChainDetected === true,
  'Detecção de ciclo pré-existente na cadeia ancestral sem travamento (loop infinito)'
);

// Cenário 1.5: Auto-ciclo pré-existente de tamanho 1 (nó pai de si mesmo)
const selfLoopNodes = new Map([
  ['L1', { id: 'L1', parent_id: 'L1', subject_id: 'sub-1' }],
]);
assert(
  wouldCreateHierarchyCycle('Y', 'L1', (id) => selfLoopNodes.get(id)) === true,
  'Auto-ciclo pré-existente (pai de si mesmo) detectado'
);

// Cenário 1.6: Nós órfãos / referências nulas / ID desconhecido
const partialNodes = new Map([
  ['P1', { id: 'P1', parent_id: 'MISSING_PARENT', subject_id: 'sub-1' }],
]);
assert(
  wouldCreateHierarchyCycle('A', 'P1', (id) => partialNodes.get(id)) === false,
  'Cadeia que termina em nó desconhecido/órfão termina com segurança (false)'
);

// Cenário 1.7: Estrutura em Estrela (1 raiz, 5.000 filhos)
const starNodes = new Map();
starNodes.set('root', { id: 'root', parent_id: null, subject_id: 'sub-1' });
for (let i = 1; i <= 5000; i++) {
  starNodes.set(`star-${i}`, { id: `star-${i}`, parent_id: 'root', subject_id: 'sub-1' });
}
assert(
  wouldCreateHierarchyCycle('star-1', 'star-2', (id) => starNodes.get(id)) === false,
  'Mover entre irmãos em topologia estrela é válido'
);
assert(
  wouldCreateHierarchyCycle('root', 'star-1000', (id) => starNodes.get(id)) === true,
  'Mover raiz para qualquer filho em estrela é ciclo'
);

// Cenário 1.8: Árvore Binária Profunda com Bifurcações
console.log('Testando árvore binária com 2047 nós (profundidade 11)...');
const binaryNodes = new Map();
binaryNodes.set('bin-1', { id: 'bin-1', parent_id: null, subject_id: 'sub-1' });
for (let i = 2; i <= 2047; i++) {
  const parentIdx = Math.floor(i / 2);
  binaryNodes.set(`bin-${i}`, {
    id: `bin-${i}`,
    parent_id: `bin-${parentIdx}`,
    subject_id: 'sub-1',
  });
}
const getBinNode = (id) => binaryNodes.get(id);

// Mover nó 2 (ancestral de 4, 8, 16...) para o nó 1024 (que é 2^10, descendente de 2)
assert(
  wouldCreateHierarchyCycle('bin-2', 'bin-1024', getBinNode) === true,
  'Árvore binária: ciclo detectado entre ancestral e descendente em ramificação profunda'
);
// Mover nó 2 para o nó 1025 (que é filho de 512, subárvore direita de 2)
assert(
  wouldCreateHierarchyCycle('bin-2', 'bin-1025', getBinNode) === true,
  'Árvore binária: ciclo detectado para nó em subárvore alternativa do mesmo ramo'
);
// Mover nó 2 para nó 3 (ramo completamente independente)
assert(
  wouldCreateHierarchyCycle('bin-2', 'bin-3', getBinNode) === false,
  'Árvore binária: movimentação para ramo independente é permitida'
);

// ------------------------------------------------------------------------------
// 2. ESTRESSE DE ESQUEMAS ZOD (packages/domain)
// ------------------------------------------------------------------------------
console.log('\n--- 2. ESTRESSE: ESQUEMAS ZOD ---');

// 2.1 registerSchema
console.log('Testando registerSchema...');
assert(
  registerSchema.safeParse({
    name: 'Jo',
    email: 'jo@teste.com',
    password: '123456',
  }).success === true,
  'registerSchema: limite inferior de nome (2 caracteres) e senha (6 caracteres)'
);

assert(
  registerSchema.safeParse({
    name: 'J',
    email: 'jo@teste.com',
    password: '123456',
  }).success === false,
  'registerSchema: rejeição de nome com 1 caractere'
);

assert(
  registerSchema.safeParse({
    name: '   ',
    email: 'jo@teste.com',
    password: '123456',
  }).success === false,
  'registerSchema: rejeição de nome contendo apenas espaços em branco'
);

assert(
  registerSchema.safeParse({
    name: 'José da Silva',
    email: 'jo@teste.com',
    password: '12345',
  }).success === false,
  'registerSchema: rejeição de senha com 5 caracteres'
);

assert(
  registerSchema.safeParse({
    name: 'José da Silva',
    email: 'jo@teste.com',
    password: '      ',
  }).success === true,
  'registerSchema [OBSERVAÇÃO]: aceita senha com 6 espaços (senhas não sofrem trim para permitir passphrases)'
);

// Injeção de caracteres / XSS / SQLi no nome
assert(
  registerSchema.safeParse({
    name: '<script>alert("xss")</script>',
    email: 'xss@teste.com',
    password: 'senhaForte123',
  }).success === true,
  'registerSchema: aceita caracteres especiais como texto bruto válido (sanitização cabe à renderização)'
);

// Formatos de e-mail adversários
assert(
  registerSchema.safeParse({
    name: 'Usuario',
    email: 'usuario+alias@sub.dominio.com.br',
    password: 'senhaForte123',
  }).success === true,
  'registerSchema: aceita e-mail complexo válido com subdomínio e alias'
);

assert(
  registerSchema.safeParse({
    name: 'Usuario',
    email: 'sem-arroba.com',
    password: 'senhaForte123',
  }).success === false,
  'registerSchema: rejeita e-mail sem @'
);

assert(
  registerSchema.safeParse({
    name: 'Usuario',
    email: '@dominio.com',
    password: 'senhaForte123',
  }).success === false,
  'registerSchema: rejeita e-mail sem usuário'
);

assert(
  registerSchema.safeParse({
    name: 'Usuario',
    email: 'usuario@',
    password: 'senhaForte123',
  }).success === false,
  'registerSchema: rejeita e-mail sem domínio'
);

// Fuso horário default e customizado
const defaultTz = registerSchema.parse({
  name: 'Maria',
  email: 'maria@teste.com',
  password: 'senhaForte123',
});
assert(
  defaultTz.timezone === 'America/Sao_Paulo',
  'registerSchema: fuso padrão é America/Sao_Paulo quando omitido'
);

// 2.2 userProfileSchema
console.log('Testando userProfileSchema...');
assert(
  userProfileSchema.safeParse({
    id: 'usr-1',
    name: 'Ana',
    email: 'ana@teste.com',
    timezone: 'America/Sao_Paulo',
    week_starts_on: 'MONDAY',
  }).success === true,
  'userProfileSchema: objeto de perfil completo válido'
);

assert(
  userProfileSchema.safeParse({
    id: 'usr-1',
    name: 'Ana',
    email: 'email-invalido',
    timezone: 'America/Sao_Paulo',
    week_starts_on: 'MONDAY',
  }).success === false,
  'userProfileSchema: rejeição de e-mail malformado no perfil'
);

// 2.3 subjectCreateSchema e subjectUpdateSchema
console.log('Testando subjectCreateSchema e subjectUpdateSchema...');
assert(
  subjectCreateSchema.safeParse({ name: 'Matemática', color: '#10B981' }).success === true,
  'subjectCreateSchema: formato hexadecimal 6 dígitos válido'
);
assert(
  subjectCreateSchema.safeParse({ name: 'Física', color: '#FFF' }).success === true,
  'subjectCreateSchema: formato hexadecimal 3 dígitos válido'
);
assert(
  subjectCreateSchema.safeParse({ name: 'Química', color: '#10b981' }).success === true,
  'subjectCreateSchema: formato hexadecimal minúsculo válido'
);
assert(
  subjectCreateSchema.safeParse({ name: 'História', color: '10B981' }).success === false,
  'subjectCreateSchema: rejeição de cor sem cerquilha (#)'
);
assert(
  subjectCreateSchema.safeParse({ name: 'História', color: '#12345' }).success === false,
  'subjectCreateSchema: rejeição de cor com 5 dígitos hexadecimais'
);
assert(
  subjectCreateSchema.safeParse({ name: 'História', color: '#1234567' }).success === false,
  'subjectCreateSchema: rejeição de cor com 7 dígitos hexadecimais'
);
assert(
  subjectCreateSchema.safeParse({ name: 'História', color: '#ZZZZZZ' }).success === false,
  'subjectCreateSchema: rejeição de cor com caracteres hexadecimais inválidos'
);
assert(
  subjectCreateSchema.safeParse({ name: '   ', color: '#10B981' }).success === false,
  'subjectCreateSchema: rejeição de nome de matéria vazio/apenas espaços'
);

assert(
  subjectUpdateSchema.safeParse({}).success === true,
  'subjectUpdateSchema: objeto vazio é válido (todos opcionais)'
);
assert(
  subjectUpdateSchema.safeParse({ archived: true }).success === true,
  'subjectUpdateSchema: arquivamento booleano isolado é válido'
);
assert(
  subjectUpdateSchema.safeParse({ name: '' }).success === false,
  'subjectUpdateSchema: nome vazio fornecido explicitamente deve ser rejeitado'
);

// 2.4 topicCreateSchema e topicUpdateSchema
console.log('Testando topicCreateSchema e topicUpdateSchema...');
assert(
  topicCreateSchema.safeParse({
    subject_id: 'sub-uuid-1',
    name: 'Trigonometria',
    parent_id: null,
  }).success === true,
  'topicCreateSchema: tópico raiz com parent_id null'
);

assert(
  topicCreateSchema.safeParse({
    subject_id: 'sub-uuid-1',
    name: 'Seno e Cosseno',
    parent_id: 'topic-uuid-parent',
  }).success === true,
  'topicCreateSchema: subtópico com parent_id preenchido'
);

assert(
  topicCreateSchema.safeParse({
    subject_id: '',
    name: 'Trigonometria',
  }).success === false,
  'topicCreateSchema: subject_id vazio é rejeitado'
);

assert(
  topicCreateSchema.safeParse({
    subject_id: 'sub-uuid-1',
    name: '   ',
  }).success === false,
  'topicCreateSchema: nome de tópico com apenas espaços é rejeitado'
);

// Observação empírica: parent_id string vazia ""
const topicWithEmptyParent = topicCreateSchema.safeParse({
  subject_id: 'sub-uuid-1',
  name: 'Tópico Teste',
  parent_id: '',
});
assert(
  topicWithEmptyParent.success === true,
  'topicCreateSchema [OBSERVAÇÃO]: aceita parent_id: "" (camada de serviço/API deve converter "" em null para o Prisma)'
);

// ------------------------------------------------------------------------------
// 3. ESTRESSE DAS FÓRMULAS E REGRAS DETERMINÍSTICAS
// ------------------------------------------------------------------------------
console.log('\n--- 3. ESTRESSE: FÓRMULAS DETERMINÍSTICAS ---');

// 3.1 calculateAccuracy
assert(calculateAccuracy(10, 20) === 50, 'calculateAccuracy: 10/20 = 50%');
assert(calculateAccuracy(0, 0) === 0, 'calculateAccuracy: divisão por zero protegida (retorna 0)');
assert(calculateAccuracy(0, -5) === 0, 'calculateAccuracy: total negativo protegido (retorna 0)');
assert(calculateAccuracy(-5, 10) === 0, 'calculateAccuracy: acertos negativos limitados a 0');
assert(calculateAccuracy(25, 20) === 100, 'calculateAccuracy: acertos maiores que total limitados a 100%');

// 3.2 mapUnderstandingToScore
assert(mapUnderstandingToScore('NONE') === 0, 'mapUnderstandingToScore: NONE = 0');
assert(mapUnderstandingToScore('PARTIAL') === 33, 'mapUnderstandingToScore: PARTIAL = 33');
assert(mapUnderstandingToScore('GOOD') === 67, 'mapUnderstandingToScore: GOOD = 67');
assert(mapUnderstandingToScore('MASTERED') === 100, 'mapUnderstandingToScore: MASTERED = 100');

// 3.3 calculateSubjectGrade
assert(calculateSubjectGrade(80, 100) === 86, 'calculateSubjectGrade: 80% acertos + 100 autoavaliação = 86');
assert(calculateSubjectGrade(0, 0) === 0, 'calculateSubjectGrade: 0 e 0 = 0');
assert(calculateSubjectGrade(100, 100) === 100, 'calculateSubjectGrade: 100 e 100 = 100');
const gradePonderada = calculateSubjectGrade(77.77, 67);
assert(gradePonderada === 74.54, `calculateSubjectGrade: arredondamento com duas casas decimais (${gradePonderada} === 74.54)`);

// 3.4 classifyPerformance
assert(
  classifyPerformance(95, 9, 10) === 'DADOS_INSUFICIENTES',
  'classifyPerformance: < 10 questões retorna DADOS_INSUFICIENTES mesmo com nota 95'
);
assert(
  classifyPerformance(95, 0, 10) === 'DADOS_INSUFICIENTES',
  'classifyPerformance: 0 questões retorna DADOS_INSUFICIENTES'
);
assert(
  classifyPerformance(80, 10, 10) === 'FORTE',
  'classifyPerformance: limite exato >= 80 com 10 questões é FORTE'
);
assert(
  classifyPerformance(79.99, 10, 10) === 'REGULAR',
  'classifyPerformance: 79.99 com 10 questões é REGULAR'
);
assert(
  classifyPerformance(60, 10, 10) === 'REGULAR',
  'classifyPerformance: limite exato >= 60 com 10 questões é REGULAR'
);
assert(
  classifyPerformance(59.99, 10, 10) === 'FRACO',
  'classifyPerformance: 59.99 com 10 questões é FRACO'
);
assert(
  classifyPerformance(0, 10, 10) === 'FRACO',
  'classifyPerformance: nota 0 com 10 questões é FRACO'
);

// 3.5 calculateFocusEfficiency e calculatePlanAdherence
assert(
  calculateFocusEfficiency(50, 60) === 50 / 60,
  'calculateFocusEfficiency: cálculo proporcional'
);
assert(
  calculateFocusEfficiency(70, 60) === 1,
  'calculateFocusEfficiency: tempo efetivo > total limitado a 1.0 (100%)'
);
assert(
  calculateFocusEfficiency(-10, 60) === 0,
  'calculateFocusEfficiency: tempo efetivo negativo limitado a 0'
);
assert(
  calculateFocusEfficiency(30, 0) === 0,
  'calculateFocusEfficiency: total de minutos zero retorna 0'
);

assert(
  calculatePlanAdherence(60, 60) === 1,
  'calculatePlanAdherence: 100% de aderência'
);
assert(
  calculatePlanAdherence(90, 60) === 1.5,
  'calculatePlanAdherence: 150% de aderência (superou planejado)'
);
assert(
  calculatePlanAdherence(30, 0) === 0,
  'calculatePlanAdherence: tempo planejado zero retorna 0'
);

// ------------------------------------------------------------------------------
// RESUMO DA EXECUÇÃO
// ------------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL DE TESTES EXECUTADOS: ${totalTests}`);
console.log(`PASSARAM: ${passedTests}`);
console.log(`FALHARAM: ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  console.error('FALHAS DETECTADAS:');
  findings.forEach((f) => console.error(`- ${f.testName}: ${f.details}`));
  process.exit(1);
} else {
  console.log('TODOS OS TESTES ADVERSÁRIOS PASSARAM COM SUCESSO!');
  process.exit(0);
}
