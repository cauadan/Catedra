import { describe, it, expect, beforeAll } from './helpers/test-runner.ts';
import { ApiClient } from './helpers/api-client.ts';

describe('Tier 3: Cross-Feature Combinations (Combinações Entre Funcionalidades)', () => {
  const client = new ApiClient();

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const testUser = {
    name: `Estudante Tier 3 ${uniqueSuffix}`,
    email: `tier3_${uniqueSuffix}@estudos.test`,
    password: 'SenhaForte123!',
    timezone: 'America/Sao_Paulo',
  };

  let subjectHistoriaId: string;
  let subjectSociologiaId: string;

  beforeAll(async () => {
    try {
      await client.register(testUser);

      // Create two subjects
      const hRes = await client.createSubject({ name: `História ${uniqueSuffix}`, color: '#D97706' });
      if (hRes.data?.id) subjectHistoriaId = hRes.data.id;

      const sRes = await client.createSubject({ name: `Sociologia ${uniqueSuffix}`, color: '#4F46E5' });
      if (sRes.data?.id) subjectSociologiaId = sRes.data.id;
    } catch (err) {
      console.warn(`[Tier 3] Setup warning: ${err}`);
    }
  });

  // --- Sub-suite 1: Mudar de Matéria e Reparentar Simultaneamente com Subárvore Completa ---
  describe('3.1 Mudar de Matéria e Reparentar Simultaneamente (Features 14, 15)', () => {
    it('deve transferir tópico e seus descendentes para outra matéria com novo pai em única requisição', async () => {
      // In História:
      // H_Root ("História Moderna")
      //   -> H_Child ("Iluminismo")
      //        -> H_Grandchild ("Divisão dos Três Poderes - Montesquieu")
      const hRoot = await client.createTopic({
        subject_id: subjectHistoriaId,
        name: 'História Moderna',
        parent_id: null,
      });

      const hChild = await client.createTopic({
        subject_id: subjectHistoriaId,
        name: 'Iluminismo',
        parent_id: hRoot.data.id,
      });

      const hGrandchild = await client.createTopic({
        subject_id: subjectHistoriaId,
        name: 'Divisão dos Três Poderes - Montesquieu',
        parent_id: hChild.data.id,
      });

      // In Sociologia:
      // S_Root ("Pensamento Político e Social")
      const sRoot = await client.createTopic({
        subject_id: subjectSociologiaId,
        name: 'Pensamento Político e Social',
        parent_id: null,
      });

      // Move H_Child ("Iluminismo") to Sociologia AND reparent under S_Root
      const patchRes = await client.updateTopic(hChild.data.id, {
        subject_id: subjectSociologiaId,
        parent_id: sRoot.data.id,
      });

      expect(patchRes.status).toBe(200);
      expect(patchRes.data.subject_id).toBe(subjectSociologiaId);
      expect(patchRes.data.parent_id).toBe(sRoot.data.id);

      // Verify that H_Child is in Sociologia
      const sTopicsRes = await client.getTopics({ subject_id: subjectSociologiaId });
      expect(sTopicsRes.status).toBe(200);

      const movedChild = sTopicsRes.data.find(t => t.id === hChild.data.id);
      expect(movedChild).toBeDefined();
      expect(movedChild?.subject_id).toBe(subjectSociologiaId);
      expect(movedChild?.parent_id).toBe(sRoot.data.id);

      // Verify that H_Grandchild ALSO was moved to Sociologia with subject_id updated
      const movedGrandchild = sTopicsRes.data.find(t => t.id === hGrandchild.data.id);
      expect(movedGrandchild).toBeDefined();
      expect(movedGrandchild?.subject_id).toBe(subjectSociologiaId);
      expect(movedGrandchild?.parent_id).toBe(hChild.data.id);

      // Verify that História now only has H_Root
      const hTopicsRes = await client.getTopics({ subject_id: subjectHistoriaId });
      expect(hTopicsRes.status).toBe(200);
      expect(hTopicsRes.data.some(t => t.id === hChild.data.id)).toBe(false);
      expect(hTopicsRes.data.some(t => t.id === hGrandchild.data.id)).toBe(false);
      expect(hTopicsRes.data.some(t => t.id === hRoot.data.id)).toBe(true);
    });

    it('deve transferir uma subárvore aninhada para outra matéria tornando-se tópico raiz (parent_id: null)', async () => {
      // In Sociologia: create nested topic to make root in História
      const parentInSoc = await client.createTopic({
        subject_id: subjectSociologiaId,
        name: 'Estratificação Social',
        parent_id: null,
      });

      const childInSoc = await client.createTopic({
        subject_id: subjectSociologiaId,
        name: 'Classes Sociais e Desigualdade',
        parent_id: parentInSoc.data.id,
      });

      const subChildInSoc = await client.createTopic({
        subject_id: subjectSociologiaId,
        name: 'Mobilidade Social',
        parent_id: childInSoc.data.id,
      });

      // Transfer childInSoc to História as root (parent_id: null)
      const transferRes = await client.updateTopic(childInSoc.data.id, {
        subject_id: subjectHistoriaId,
        parent_id: null,
      });

      expect(transferRes.status).toBe(200);
      expect(transferRes.data.subject_id).toBe(subjectHistoriaId);
      expect(transferRes.data.parent_id).toBeNull();

      // Check História topics: childInSoc is root and subChildInSoc followed
      const hList = await client.getTopics({ subject_id: subjectHistoriaId });
      const foundRoot = hList.data.find(t => t.id === childInSoc.data.id);
      expect(foundRoot).toBeDefined();
      expect(foundRoot?.parent_id).toBeNull();

      const foundFollower = hList.data.find(t => t.id === subChildInSoc.data.id);
      expect(foundFollower).toBeDefined();
      expect(foundFollower?.subject_id).toBe(subjectHistoriaId);
      expect(foundFollower?.parent_id).toBe(childInSoc.data.id);
    });
  });

  // --- Sub-suite 2: Arquivamento e Restauração em Cascata Profunda ---
  describe('3.2 Desarquivamento e Restauração em Árvores Profundas (Feature 16)', () => {
    it('deve arquivar e desarquivar subárvore de 4 níveis restaurando todos os descendentes', async () => {
      // Create dedicated subject
      const sub = await client.createSubject({ name: 'Filosofia', color: '#6366F1' });
      const subId = sub.data.id;

      // Build 4-level chain: L0 -> L1 -> L2 -> L3
      const l0 = await client.createTopic({ subject_id: subId, name: 'Filosofia Antiga', parent_id: null });
      const l1 = await client.createTopic({ subject_id: subId, name: 'Período Clássico', parent_id: l0.data.id });
      const l2 = await client.createTopic({ subject_id: subId, name: 'Platão', parent_id: l1.data.id });
      const l3 = await client.createTopic({ subject_id: subId, name: 'Mito da Caverna', parent_id: l2.data.id });

      // Archive at L1 ("Período Clássico")
      const archL1Res = await client.updateTopic(l1.data.id, { archived: true });
      expect(archL1Res.status).toBe(200);

      // Active topics check: L0 must be active; L1, L2, L3 must NOT appear in active list
      const activeList = await client.getTopics({ subject_id: subId, include_archived: false });
      expect(activeList.data.some(t => t.id === l0.data.id)).toBe(true);
      expect(activeList.data.some(t => t.id === l1.data.id)).toBe(false);
      expect(activeList.data.some(t => t.id === l2.data.id)).toBe(false);
      expect(activeList.data.some(t => t.id === l3.data.id)).toBe(false);

      // All topics check: L1, L2, L3 must have archived: true
      const allList = await client.getTopics({ subject_id: subId, include_archived: true });
      const t1 = allList.data.find(t => t.id === l1.data.id);
      const t2 = allList.data.find(t => t.id === l2.data.id);
      const t3 = allList.data.find(t => t.id === l3.data.id);
      expect(t1?.archived).toBe(true);
      expect(t2?.archived).toBe(true);
      expect(t3?.archived).toBe(true);

      // Now unarchive L1: should restore L1, L2, L3 in cascade
      const unarchL1Res = await client.updateTopic(l1.data.id, { archived: false });
      expect(unarchL1Res.status).toBe(200);

      const restoredList = await client.getTopics({ subject_id: subId, include_archived: false });
      expect(restoredList.data.some(t => t.id === l0.data.id)).toBe(true);
      expect(restoredList.data.some(t => t.id === l1.data.id)).toBe(true);
      expect(restoredList.data.some(t => t.id === l2.data.id)).toBe(true);
      expect(restoredList.data.some(t => t.id === l3.data.id)).toBe(true);
    });
  });
});
