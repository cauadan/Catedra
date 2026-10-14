import { describe, it, expect, beforeAll } from './helpers/test-runner.ts';
import { ApiClient } from './helpers/api-client.ts';

describe('Tier 2: Boundary & Corner Cases (Limites e Casos Adversários)', () => {
  const client = new ApiClient();

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const validUser = {
    name: `Estudante Tier 2 ${uniqueSuffix}`,
    email: `tier2_${uniqueSuffix}@estudos.test`,
    password: 'SenhaForte123!',
    timezone: 'America/Sao_Paulo',
  };

  let validSubjectId: string;

  beforeAll(async () => {
    // Setup authenticated session for tier 2 tests
    try {
      const reg = await client.register(validUser);
      if (reg.status !== 201) {
        await client.login({ email: validUser.email, password: validUser.password });
      }

      const subRes = await client.createSubject({
        name: 'Matéria de Fronteira',
        color: '#8B5CF6',
      });
      if (subRes.data?.id) {
        validSubjectId = subRes.data.id;
      }
    } catch (err) {
      console.warn(`[Tier 2] Setup warning: ${err}`);
    }
  });

  // --- Sub-suite 1: Validação de Entradas Vazias e Inválidas ---
  describe('2.1 Validação de Entradas Vazias e Malformadas (R3, Zod)', () => {
    it('deve rejeitar cadastro com email vazio ou malformado com 400 e erro em português', async () => {
      const unauthClient = new ApiClient(client.baseUrl);

      // Empty email
      const emptyRes = await unauthClient.register({
        name: 'Usuário Teste',
        email: '',
        password: 'Senha123Valida',
      });
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.data?.error).toBeDefined();

      // Malformed email
      const malformedRes = await unauthClient.register({
        name: 'Usuário Teste',
        email: 'email-invalido-sem-arroba',
        password: 'Senha123Valida',
      });
      expect(malformedRes.status).toBe(400);
      expect(malformedRes.data?.error).toBeDefined();
    });

    it('deve rejeitar cadastro com senha vazia ou curta com 400', async () => {
      const unauthClient = new ApiClient(client.baseUrl);
      const res = await unauthClient.register({
        name: 'Usuário Sem Senha',
        email: `sem_senha_${uniqueSuffix}@estudos.test`,
        password: '',
      });
      expect(res.status).toBe(400);
      expect(res.data?.error).toBeDefined();
    });

    it('deve rejeitar criação de matéria com nome vazio ou apenas espaços', async () => {
      const emptyNameRes = await client.createSubject({
        name: '',
        color: '#EF4444',
      });
      expect(emptyNameRes.status).toBe(400);
      expect(emptyNameRes.data?.error).toBeDefined();

      const spacesNameRes = await client.createSubject({
        name: '     ',
        color: '#EF4444',
      });
      expect(spacesNameRes.status).toBe(400);
    });

    it('deve rejeitar criação de tópico com nome vazio ou apenas espaços', async () => {
      const emptyTopicRes = await client.createTopic({
        subject_id: validSubjectId,
        name: '',
        parent_id: null,
      });
      expect(emptyTopicRes.status).toBe(400);
      expect(emptyTopicRes.data?.error).toBeDefined();
    });
  });

  // --- Sub-suite 2: Nomes Extensos e Fidelidade Unicode / Acentuação ---
  describe('2.2 Nomes Extensos e Caracteres Especiais / Unicode', () => {
    it('deve aceitar nomes longos de matéria e tópico até o limite permitido', async () => {
      const longName = 'História Geral da Civilização Contemporânea e Suas Ramificações Sociológicas na Era Pós-Moderna ' +
        'com Análise Comparativa dos Impactos Geopolíticos Globais ' + uniqueSuffix;

      const subRes = await client.createSubject({
        name: longName.substring(0, 150),
        color: '#F59E0B',
      });
      expect(subRes.status).toBe(201);
      expect(subRes.data.name).toBe(longName.substring(0, 150));

      const topicRes = await client.createTopic({
        subject_id: subRes.data.id,
        name: longName.substring(0, 150),
        parent_id: null,
      });
      expect(topicRes.status).toBe(201);
      expect(topicRes.data.name).toBe(longName.substring(0, 150));
    });

    it('deve preservar acentuação em português, símbolos matemáticos e emojis', async () => {
      const richTitle = 'Cálculo Diferencial: Derivadas Parciais, Frações & Limites 📐 ∑_{i=1}^{n} (x_i) ≥ 0';

      const topicRes = await client.createTopic({
        subject_id: validSubjectId,
        name: richTitle,
        parent_id: null,
      });
      expect(topicRes.status).toBe(201);
      expect(topicRes.data.name).toBe(richTitle);

      // Verify retrieval has identical string
      const getRes = await client.getTopics({ subject_id: validSubjectId });
      const found = getRes.data.find(t => t.id === topicRes.data.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(richTitle);
    });
  });

  // --- Sub-suite 3: Hierarquia Profunda (Depth >= 4) ---
  describe('2.3 Árvore com Profundidade Livre (Profundidade >= 4)', () => {
    it('deve suportar criação e consulta de árvore com 4+ níveis de profundidade', async () => {
      // Level 1: Raiz
      const l1Res = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Nível 1 - Biologia Celular',
        parent_id: null,
      });
      expect(l1Res.status).toBe(201);
      const l1Id = l1Res.data.id;

      // Level 2: Filho
      const l2Res = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Nível 2 - Organelas Citoplasmáticas',
        parent_id: l1Id,
      });
      expect(l2Res.status).toBe(201);
      const l2Id = l2Res.data.id;

      // Level 3: Neto
      const l3Res = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Nível 3 - Mitocôndria e Bioenergética',
        parent_id: l2Id,
      });
      expect(l3Res.status).toBe(201);
      const l3Id = l3Res.data.id;

      // Level 4: Bisneto
      const l4Res = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Nível 4 - Cadeia Transportadora de Elétrons',
        parent_id: l3Id,
      });
      expect(l4Res.status).toBe(201);
      const l4Id = l4Res.data.id;

      // Level 5: Trineto
      const l5Res = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Nível 5 - ATP Sintase e Fosforilação Oxidativa',
        parent_id: l4Id,
      });
      expect(l5Res.status).toBe(201);
      const l5Id = l5Res.data.id;

      // Verify tree integrity
      const allTopicsRes = await client.getTopics({ subject_id: validSubjectId });
      expect(allTopicsRes.status).toBe(200);

      const t5 = allTopicsRes.data.find(t => t.id === l5Id);
      expect(t5?.parent_id).toBe(l4Id);

      const t4 = allTopicsRes.data.find(t => t.id === l4Id);
      expect(t4?.parent_id).toBe(l3Id);

      const t3 = allTopicsRes.data.find(t => t.id === l3Id);
      expect(t3?.parent_id).toBe(l2Id);

      const t2 = allTopicsRes.data.find(t => t.id === l2Id);
      expect(t2?.parent_id).toBe(l1Id);

      const t1 = allTopicsRes.data.find(t => t.id === l1Id);
      expect(t1?.parent_id).toBeNull();
    });
  });

  // --- Sub-suite 4: IDs Inválidos e Inexistentes ---
  describe('2.4 Tratamento de IDs Inexistentes e Malformados', () => {
    it('deve retornar 404 para matéria com ID inexistente', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await client.updateSubject(nonExistentId, { name: 'Inexistente' });
      expect(res.status === 404 || res.status === 400).toBe(true);
    });

    it('deve rejeitar criação de tópico apontando para subject_id inexistente', async () => {
      const res = await client.createTopic({
        subject_id: '00000000-0000-0000-0000-000000000000',
        name: 'Tópico Órfão',
        parent_id: null,
      });
      expect(res.status === 404 || res.status === 400).toBe(true);
    });

    it('deve rejeitar criação de tópico com parent_id inexistente', async () => {
      const res = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Tópico Sem Pai Real',
        parent_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(res.status === 404 || res.status === 400).toBe(true);
    });
  });

  // --- Sub-suite 5: Prevenção Rigorosa de Ciclos ---
  describe('2.5 Prevenção Rigorosa de Ciclos na Árvore (Feature 13, R2)', () => {
    let topicAId: string;
    let topicBId: string;
    let topicCId: string;

    beforeAll(async () => {
      // Build linear chain: A -> B -> C
      const resA = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Ciclo Teste - Assunto A',
        parent_id: null,
      });
      if (resA.data?.id) topicAId = resA.data.id;

      const resB = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Ciclo Teste - Assunto B',
        parent_id: topicAId,
      });
      if (resB.data?.id) topicBId = resB.data.id;

      const resC = await client.createTopic({
        subject_id: validSubjectId,
        name: 'Ciclo Teste - Assunto C',
        parent_id: topicBId,
      });
      if (resC.data?.id) topicCId = resC.data.id;
    });

    it('deve impedir que um tópico seja pai de si mesmo (auto-ciclo direto)', async () => {
      // Attempt to set A's parent_id to A itself
      const selfCycleRes = await client.updateTopic(topicAId, {
        parent_id: topicAId,
      });

      expect(selfCycleRes.status).toBe(400);
      expect(selfCycleRes.data?.error).toBeDefined();
      if (selfCycleRes.data?.error?.message) {
        // Message must be descriptive and in Portuguese
        const msg = selfCycleRes.data.error.message.toLowerCase();
        expect(
          msg.includes('ciclo') || msg.includes('próprio') || msg.includes('pai') || msg.includes('inválid')
        ).toBe(true);
      }

      // Verify A's parent is still null
      const checkA = await client.getTopics({ subject_id: validSubjectId });
      const currentA = checkA.data.find(t => t.id === topicAId);
      expect(currentA?.parent_id).toBeNull();
    });

    it('deve impedir ciclo indireto (definir como pai um de seus próprios descendentes)', async () => {
      // A -> B -> C. Attempting to set A's parent to C would create cycle A -> B -> C -> A
      const indirectCycleRes = await client.updateTopic(topicAId, {
        parent_id: topicCId,
      });

      expect(indirectCycleRes.status).toBe(400);
      expect(indirectCycleRes.data?.error).toBeDefined();

      // Verify chain A -> B -> C remains intact
      const checkTopics = await client.getTopics({ subject_id: validSubjectId });
      const currentA = checkTopics.data.find(t => t.id === topicAId);
      const currentB = checkTopics.data.find(t => t.id === topicBId);
      const currentC = checkTopics.data.find(t => t.id === topicCId);

      expect(currentA?.parent_id).toBeNull();
      expect(currentB?.parent_id).toBe(topicAId);
      expect(currentC?.parent_id).toBe(topicBId);
    });

    it('deve impedir ciclo indireto de 2 níveis (definir pai como B quando B é filho direto de A)', async () => {
      const cycleRes = await client.updateTopic(topicAId, {
        parent_id: topicBId,
      });

      expect(cycleRes.status).toBe(400);
      expect(cycleRes.data?.error).toBeDefined();
    });
  });
});
