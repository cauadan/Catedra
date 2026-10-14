import { describe, it, expect, beforeAll, afterAll } from './helpers/test-runner.ts';
import { ApiClient } from './helpers/api-client.ts';
import { DbHelper } from './helpers/db-helper.ts';

describe('Tier 1: Feature Coverage (Isolated Happy Path)', () => {
  const client = new ApiClient();
  const dbHelper = new DbHelper();

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const testUser = {
    name: `Estudante Tier 1 ${uniqueSuffix}`,
    email: `tier1_${uniqueSuffix}@estudos.test`,
    password: 'SenhaForte123!',
    timezone: 'America/Sao_Paulo',
  };

  let createdUserId: string;
  let subjectMatematicaId: string;
  let topicAlgebraId: string;
  let topicFuncoesId: string;
  let topicSubFuncaoAfimId: string;

  beforeAll(async () => {
    // Check if server is running
    const healthy = await client.isHealthy();
    if (!healthy) {
      console.warn(`[Tier 1] Notice: API server at ${client.baseUrl} is not currently responding. Tests will execute HTTP calls and verify expected responses when server is running.`);
    }
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  // --- Sub-suite 1: Authentication & Session Management ---
  describe('1.1 Autenticação e Sessão (R1, Features 5-9)', () => {
    it('deve registrar um novo usuário com timezone e receber cookie httpOnly', async () => {
      const res = await client.register(testUser);

      // Status 201 Created
      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();
      expect(res.data.user).toBeDefined();
      expect(res.data.user.email).toBe(testUser.email);
      expect(res.data.user.name).toBe(testUser.name);
      expect(res.data.user.timezone).toBe(testUser.timezone);
      expect(res.data.user.week_starts_on).toBeDefined();
      createdUserId = res.data.user.id;

      // Session cookie must be set
      const cookies = client.getCookies();
      const hasSessionCookie = Object.keys(cookies).some(
        k => k.toLowerCase().includes('session') || k.toLowerCase().includes('token') || k.toLowerCase().includes('sid')
      );
      expect(hasSessionCookie).toBe(true);
    });

    it('deve acessar rota protegida /api/auth/me com a sessão ativa', async () => {
      const res = await client.me();

      expect(res.status).toBe(200);
      expect(res.data.user).toBeDefined();
      expect(res.data.user.id).toBe(createdUserId);
      expect(res.data.user.email).toBe(testUser.email);
    });

    it('deve rejeitar acesso a rota protegida com 401 quando não autenticado', async () => {
      const unauthClient = new ApiClient(client.baseUrl);
      const res = await unauthClient.me();

      expect(res.status).toBe(401);
      if (res.data?.error) {
        expect(res.data.error.code).toBeDefined();
      }
    });

    it('deve realizar logout com sucesso e limpar o cookie de sessão', async () => {
      const res = await client.logout();
      expect(res.status).toBe(200);

      // After logout, accessing /me should fail with 401
      const meRes = await client.me();
      expect(meRes.status).toBe(401);
    });

    it('deve realizar login novamente com email e senha corretos', async () => {
      const res = await client.login({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.data.user).toBeDefined();
      expect(res.data.user.email).toBe(testUser.email);

      // Verify authenticated again
      const meRes = await client.me();
      expect(meRes.status).toBe(200);
    });
  });

  // --- Sub-suite 2: Subjects CRUD ---
  describe('1.2 Matérias CRUD (R2, Feature 11)', () => {
    it('deve criar uma nova matéria com nome e cor', async () => {
      const res = await client.createSubject({
        name: 'Matemática Básica',
        color: '#3B82F6',
      });

      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();
      expect(res.data.id).toBeDefined();
      expect(res.data.name).toBe('Matemática Básica');
      expect(res.data.color).toBe('#3B82F6');
      expect(res.data.archived).toBe(false);

      subjectMatematicaId = res.data.id;
    });

    it('deve listar matérias contendo a matéria recém-criada', async () => {
      const res = await client.getSubjects();

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      const found = res.data.find(s => s.id === subjectMatematicaId);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Matemática Básica');
    });

    it('deve atualizar nome e cor de uma matéria existente', async () => {
      const res = await client.updateSubject(subjectMatematicaId, {
        name: 'Matemática e Suas Tecnologias',
        color: '#2563EB',
      });

      expect(res.status).toBe(200);
      expect(res.data.name).toBe('Matemática e Suas Tecnologias');
      expect(res.data.color).toBe('#2563EB');
    });

    it('deve permitir arquivar matéria e filtrar por include_archived', async () => {
      // Archive subject
      const archiveRes = await client.updateSubject(subjectMatematicaId, {
        archived: true,
      });
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.data.archived).toBe(true);

      // By default, archived subjects should not be included
      const activeListRes = await client.getSubjects({ include_archived: false });
      expect(activeListRes.status).toBe(200);
      const foundInActive = activeListRes.data.find(s => s.id === subjectMatematicaId);
      expect(foundInActive).toBeUndefined();

      // With include_archived=true, it must be returned
      const allListRes = await client.getSubjects({ include_archived: true });
      expect(allListRes.status).toBe(200);
      const foundInAll = allListRes.data.find(s => s.id === subjectMatematicaId);
      expect(foundInAll).toBeDefined();
      expect(foundInAll?.archived).toBe(true);

      // Restore subject to unarchived for subsequent tests
      await client.updateSubject(subjectMatematicaId, { archived: false });
    });
  });

  // --- Sub-suite 3: Topics CRUD & Hierarchy ---
  describe('1.3 Assuntos e Hierarquia Livre (R2, Feature 12)', () => {
    it('deve criar um assunto raiz (parent_id: null)', async () => {
      const res = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Álgebra',
        parent_id: null,
      });

      expect(res.status).toBe(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.subject_id).toBe(subjectMatematicaId);
      expect(res.data.name).toBe('Álgebra');
      expect(res.data.parent_id).toBeNull();
      expect(res.data.archived).toBe(false);

      topicAlgebraId = res.data.id;
    });

    it('deve criar um assunto filho (nível 2) vinculado ao assunto raiz', async () => {
      const res = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Funções',
        parent_id: topicAlgebraId,
      });

      expect(res.status).toBe(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.subject_id).toBe(subjectMatematicaId);
      expect(res.data.name).toBe('Funções');
      expect(res.data.parent_id).toBe(topicAlgebraId);

      topicFuncoesId = res.data.id;
    });

    it('deve criar um assunto neto (nível 3) vinculado ao assunto filho', async () => {
      const res = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Função Afim',
        parent_id: topicFuncoesId,
      });

      expect(res.status).toBe(201);
      expect(res.data.id).toBeDefined();
      expect(res.data.name).toBe('Função Afim');
      expect(res.data.parent_id).toBe(topicFuncoesId);

      topicSubFuncaoAfimId = res.data.id;
    });

    it('deve listar assuntos filtrando por subject_id', async () => {
      const res = await client.getTopics({ subject_id: subjectMatematicaId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(3);

      const ids = res.data.map(t => t.id);
      expect(ids).toContain(topicAlgebraId);
      expect(ids).toContain(topicFuncoesId);
      expect(ids).toContain(topicSubFuncaoAfimId);
    });

    it('deve renomear um assunto existente', async () => {
      const res = await client.updateTopic(topicSubFuncaoAfimId, {
        name: 'Função Polinomial do 1º Grau (Afim)',
      });

      expect(res.status).toBe(200);
      expect(res.data.name).toBe('Função Polinomial do 1º Grau (Afim)');
    });
  });

  // --- Sub-suite 4: Tree Moves & Reparenting ---
  describe('1.4 Movimentação de Assuntos (Features 14, 15)', () => {
    it('deve mover assunto para outro pai preservando seus descendentes (mesma matéria)', async () => {
      // Create another root topic
      const geomRes = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Geometria',
        parent_id: null,
      });
      expect(geomRes.status).toBe(201);
      const geomId = geomRes.data.id;

      // Move Funções (which has child Função Afim) from Álgebra to Geometria
      const moveRes = await client.updateTopic(topicFuncoesId, {
        parent_id: geomId,
      });
      expect(moveRes.status).toBe(200);
      expect(moveRes.data.parent_id).toBe(geomId);

      // Verify that its child (Função Afim) still has Funções as parent
      const topicsRes = await client.getTopics({ subject_id: subjectMatematicaId });
      const child = topicsRes.data.find(t => t.id === topicSubFuncaoAfimId);
      expect(child).toBeDefined();
      expect(child?.parent_id).toBe(topicFuncoesId);

      // Move back to Álgebra for consistency
      await client.updateTopic(topicFuncoesId, { parent_id: topicAlgebraId });
    });

    it('deve mover assunto para outra matéria e atualizar subject_id recursivamente em todos os descendentes', async () => {
      // Create new subject: Física
      const fisicaRes = await client.createSubject({
        name: 'Física',
        color: '#EF4444',
      });
      expect(fisicaRes.status).toBe(201);
      const fisicaId = fisicaRes.data.id;

      // Create topic hierarchy in Matemática to transfer
      const calculusRes = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Cálculo Aplicado',
        parent_id: null,
      });
      const derivativeRes = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Derivadas e Taxa de Variação',
        parent_id: calculusRes.data.id,
      });
      const kinematicsRes = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Velocidade Instantânea',
        parent_id: derivativeRes.data.id,
      });

      // Transfer 'Cálculo Aplicado' to 'Física'
      const transferRes = await client.updateTopic(calculusRes.data.id, {
        subject_id: fisicaId,
        parent_id: null,
      });
      expect(transferRes.status).toBe(200);
      expect(transferRes.data.subject_id).toBe(fisicaId);

      // Verify that children in Física now have subject_id = fisicaId
      const fisicaTopicsRes = await client.getTopics({ subject_id: fisicaId });
      expect(fisicaTopicsRes.status).toBe(200);

      const transferredDerivative = fisicaTopicsRes.data.find(t => t.id === derivativeRes.data.id);
      expect(transferredDerivative).toBeDefined();
      expect(transferredDerivative?.subject_id).toBe(fisicaId);

      const transferredKinematics = fisicaTopicsRes.data.find(t => t.id === kinematicsRes.data.id);
      expect(transferredKinematics).toBeDefined();
      expect(transferredKinematics?.subject_id).toBe(fisicaId);
    });
  });

  // --- Sub-suite 5: Cascading Archive & Unarchive ---
  describe('1.5 Arquivamento em Cascata (Feature 16)', () => {
    it('deve arquivar matéria e propagar status arquivado em cascata para todos os tópicos', async () => {
      // Create subject with topics
      const subRes = await client.createSubject({ name: 'Química', color: '#10B981' });
      const subId = subRes.data.id;

      const top1Res = await client.createTopic({ subject_id: subId, name: 'Química Geral', parent_id: null });
      const top2Res = await client.createTopic({ subject_id: subId, name: 'Atomística', parent_id: top1Res.data.id });

      // Archive subject
      const archSubRes = await client.updateSubject(subId, { archived: true });
      expect(archSubRes.status).toBe(200);
      expect(archSubRes.data.archived).toBe(true);

      // Verify topics with include_archived=true are archived
      const topicsRes = await client.getTopics({ subject_id: subId, include_archived: true });
      expect(topicsRes.status).toBe(200);
      const top1 = topicsRes.data.find(t => t.id === top1Res.data.id);
      const top2 = topicsRes.data.find(t => t.id === top2Res.data.id);
      expect(top1?.archived).toBe(true);
      expect(top2?.archived).toBe(true);

      // Unarchive subject restores them
      await client.updateSubject(subId, { archived: false });
      const restoredTopics = await client.getTopics({ subject_id: subId, include_archived: false });
      expect(restoredTopics.data.some(t => t.id === top1Res.data.id)).toBe(true);
    });

    it('deve arquivar assunto pai e propagar arquivamento para seus descendentes', async () => {
      // Archive topicFuncoesId (which has child topicSubFuncaoAfimId)
      const archTopicRes = await client.updateTopic(topicFuncoesId, { archived: true });
      expect(archTopicRes.status).toBe(200);
      expect(archTopicRes.data.archived).toBe(true);

      // Descendant topicSubFuncaoAfimId must be archived
      const topicsRes = await client.getTopics({ subject_id: subjectMatematicaId, include_archived: true });
      const childTopic = topicsRes.data.find(t => t.id === topicSubFuncaoAfimId);
      expect(childTopic?.archived).toBe(true);

      // Unarchive topicFuncoesId restores child
      const unarchRes = await client.updateTopic(topicFuncoesId, { archived: false });
      expect(unarchRes.status).toBe(200);
      const activeTopics = await client.getTopics({ subject_id: subjectMatematicaId, include_archived: false });
      expect(activeTopics.data.some(t => t.id === topicSubFuncaoAfimId)).toBe(true);
    });
  });

  // --- Sub-suite 6: Delete Protection ---
  describe('1.6 Proteção de Exclusão e Deleção Limpa (Feature 17)', () => {
    it('deve permitir excluir definitivamente tópico sem sessões vinculadas', async () => {
      // Create isolated topic without any sessions
      const tempTopicRes = await client.createTopic({
        subject_id: subjectMatematicaId,
        name: 'Tópico Temporário para Exclusão',
        parent_id: null,
      });
      expect(tempTopicRes.status).toBe(201);
      const tempId = tempTopicRes.data.id;

      // Delete topic
      const delRes = await client.deleteTopic(tempId);
      expect(delRes.status).toBe(204);

      // Verify it no longer exists
      const listRes = await client.getTopics({ subject_id: subjectMatematicaId, include_archived: true });
      expect(listRes.data.some(t => t.id === tempId)).toBe(false);
    });

    it('deve permitir excluir definitivamente matéria sem tópicos e sem sessões', async () => {
      const tempSubjectRes = await client.createSubject({
        name: 'Matéria Temporária Sem Assuntos',
        color: '#6B7280',
      });
      expect(tempSubjectRes.status).toBe(201);
      const tempSubId = tempSubjectRes.data.id;

      const delRes = await client.deleteSubject(tempSubId);
      expect(delRes.status).toBe(204);

      const subjectsRes = await client.getSubjects({ include_archived: true });
      expect(subjectsRes.data.some(s => s.id === tempSubId)).toBe(false);
    });
  });
});
