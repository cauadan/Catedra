import { describe, it, expect } from 'vitest';
import {
  TopicTreeNode,
  buildTopicTree,
  collectAncestorIds,
  collectDescendantIds,
  resolveTopicMove,
  listQuerySchema,
  subjectUpdateSchema,
  topicUpdateSchema,
  topicCreateSchema,
  MAX_NAME_LENGTH,
} from '../src/index.js';

// Árvore de exemplo (matéria M1):
// A
// ├── B
// │   └── C
// │       └── D
// └── E
// F (matéria M2)
const nodes: TopicTreeNode[] = [
  { id: 'A', parent_id: null, subject_id: 'M1' },
  { id: 'B', parent_id: 'A', subject_id: 'M1' },
  { id: 'C', parent_id: 'B', subject_id: 'M1' },
  { id: 'D', parent_id: 'C', subject_id: 'M1' },
  { id: 'E', parent_id: 'A', subject_id: 'M1' },
  { id: 'F', parent_id: null, subject_id: 'M2' },
];
const byId = new Map(nodes.map((n) => [n.id, n]));
const getNode = (id: string) => byId.get(id);

describe('Árvore de assuntos (funções puras)', () => {
  describe('collectDescendantIds', () => {
    it('retorna todos os descendentes em qualquer profundidade', () => {
      expect(collectDescendantIds('A', nodes).sort()).toEqual(['B', 'C', 'D', 'E']);
      expect(collectDescendantIds('B', nodes)).toEqual(['C', 'D']);
    });

    it('retorna lista vazia para folhas e IDs inexistentes', () => {
      expect(collectDescendantIds('D', nodes)).toEqual([]);
      expect(collectDescendantIds('X', nodes)).toEqual([]);
    });

    it('não entra em laço infinito com ciclo pré-existente', () => {
      const cyclic = [
        { id: 'P', parent_id: 'Q' },
        { id: 'Q', parent_id: 'P' },
      ];
      expect(collectDescendantIds('P', cyclic)).toEqual(['Q']);
    });
  });

  describe('collectAncestorIds', () => {
    it('retorna os ancestrais do pai até a raiz', () => {
      expect(collectAncestorIds('D', getNode)).toEqual(['C', 'B', 'A']);
      expect(collectAncestorIds('A', getNode)).toEqual([]);
    });
  });

  describe('buildTopicTree', () => {
    it('monta a hierarquia preservando a ordem dos irmãos', () => {
      const tree = buildTopicTree(nodes);
      expect(tree.map((n) => n.id)).toEqual(['A', 'F']);
      const a = tree[0];
      expect(a.children.map((n) => n.id)).toEqual(['B', 'E']);
      expect(a.children[0].children[0].children[0].id).toBe('D');
    });

    it('trata como raiz um nó cujo pai não está na lista', () => {
      const tree = buildTopicTree(nodes.filter((n) => n.id !== 'B'));
      expect(tree.map((n) => n.id)).toEqual(['A', 'C', 'F']);
      expect(tree[1].children.map((n) => n.id)).toEqual(['D']);
    });
  });

  describe('resolveTopicMove', () => {
    it('rejeita tornar o assunto pai de si mesmo', () => {
      const r = resolveTopicMove(byId.get('A')!, { parent_id: 'A' }, getNode);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('CYCLE');
    });

    it('rejeita mover para baixo de um descendente (ciclo indireto)', () => {
      const r = resolveTopicMove(byId.get('B')!, { parent_id: 'D' }, getNode);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe('CYCLE');
        expect(r.message).toMatch(/ciclo/);
      }
    });

    it('mover para outro pai adota a matéria do novo pai', () => {
      const r = resolveTopicMove(byId.get('B')!, { parent_id: 'F' }, getNode);
      expect(r).toEqual({ ok: true, subjectId: 'M2', parentId: 'F' });
    });

    it('rejeita pai inexistente', () => {
      const r = resolveTopicMove(byId.get('B')!, { parent_id: 'ZZZ' }, getNode);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('PARENT_NOT_FOUND');
    });

    it('rejeita subject_id diferente da matéria do novo pai', () => {
      const r = resolveTopicMove(byId.get('B')!, { parent_id: 'F', subject_id: 'M1' }, getNode);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('SUBJECT_MISMATCH');
    });

    it('parent_id null torna o assunto nível superior (opcionalmente em outra matéria)', () => {
      expect(resolveTopicMove(byId.get('C')!, { parent_id: null }, getNode)).toEqual({
        ok: true,
        subjectId: 'M1',
        parentId: null,
      });
      expect(resolveTopicMove(byId.get('C')!, { parent_id: null, subject_id: 'M2' }, getNode)).toEqual({
        ok: true,
        subjectId: 'M2',
        parentId: null,
      });
    });

    it('apenas subject_id troca de matéria e vira nível superior', () => {
      expect(resolveTopicMove(byId.get('C')!, { subject_id: 'M2' }, getNode)).toEqual({
        ok: true,
        subjectId: 'M2',
        parentId: null,
      });
    });

    it('sem campos de movimento mantém a posição atual', () => {
      expect(resolveTopicMove(byId.get('C')!, {}, getNode)).toEqual({
        ok: true,
        subjectId: 'M1',
        parentId: 'B',
      });
    });
  });
});

describe('Contrato da Fase 2 (schemas Zod)', () => {
  it('listQuerySchema converte include_archived vindo da query string', () => {
    expect(listQuerySchema.parse({}).include_archived).toBe(false);
    expect(listQuerySchema.parse({ include_archived: 'true' }).include_archived).toBe(true);
    expect(listQuerySchema.parse({ include_archived: 'false' }).include_archived).toBe(false);
  });

  it('atualizações vazias são rejeitadas com mensagem em português', () => {
    const r = subjectUpdateSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/ao menos um campo/);
    expect(topicUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('nomes acima do limite são rejeitados', () => {
    const r = topicCreateSchema.safeParse({ subject_id: 'M1', name: 'x'.repeat(MAX_NAME_LENGTH + 1) });
    expect(r.success).toBe(false);
  });

  it('nome só com espaços é rejeitado', () => {
    expect(topicCreateSchema.safeParse({ subject_id: 'M1', name: '   ' }).success).toBe(false);
  });
});
