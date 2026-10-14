/**
 * @estudos/domain
 * Biblioteca de tipos, esquemas de validação Zod e funções puras de regras de negócio.
 * Não possui dependências de I/O, banco de dados ou frameworks visuais.
 */

import { z } from 'zod';

export * from './calendar.js';

// ==============================================================================
// 1. ESQUEMAS DE AUTENTICAÇÃO E USUÁRIO
// ==============================================================================

export const registerSchema = z.object({
  name: z.string().trim().min(2, { message: 'O nome deve conter ao menos 2 caracteres.' }),
  email: z.string().trim().email({ message: 'Formato de e-mail inválido.' }),
  password: z.string().min(6, { message: 'A senha deve conter ao menos 6 caracteres.' }),
  timezone: z.string().optional().default('America/Sao_Paulo'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Formato de e-mail inválido.' }),
  password: z.string().min(1, { message: 'A senha é obrigatória.' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  timezone: z.string(),
  week_starts_on: z.string(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// ==============================================================================
// 2. ESQUEMAS DE MATÉRIAS (SUBJECTS)
// ==============================================================================

/** Tamanho máximo aceito para nomes de matérias e assuntos. */
export const MAX_NAME_LENGTH = 200;

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'A cor deve estar no formato hexadecimal válido (ex: #3B82F6).',
  });

export const subjectCreateSchema = z.object({
  name: z
    .string({ required_error: 'O nome da matéria é obrigatório.' })
    .trim()
    .min(1, { message: 'O nome da matéria é obrigatório.' })
    .max(MAX_NAME_LENGTH, { message: `O nome da matéria deve ter no máximo ${MAX_NAME_LENGTH} caracteres.` }),
  color: hexColorSchema,
});

export type SubjectCreateInput = z.infer<typeof subjectCreateSchema>;

export const subjectUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'O nome da matéria não pode ser vazio.' })
      .max(MAX_NAME_LENGTH, { message: `O nome da matéria deve ter no máximo ${MAX_NAME_LENGTH} caracteres.` })
      .optional(),
    color: hexColorSchema.optional(),
    archived: z.boolean({ invalid_type_error: 'O campo "archived" deve ser verdadeiro ou falso.' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export type SubjectUpdateInput = z.infer<typeof subjectUpdateSchema>;

/** Matéria como retornada pela API. */
export interface SubjectDTO {
  id: string;
  user_id: string;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// ==============================================================================
// 3. ESQUEMAS DE ASSUNTOS (TOPICS)
// ==============================================================================

export const topicCreateSchema = z.object({
  subject_id: z
    .string({ required_error: 'O ID da matéria é obrigatório.' })
    .min(1, { message: 'O ID da matéria é obrigatório.' }),
  name: z
    .string({ required_error: 'O nome do assunto é obrigatório.' })
    .trim()
    .min(1, { message: 'O nome do assunto é obrigatório.' })
    .max(MAX_NAME_LENGTH, { message: `O nome do assunto deve ter no máximo ${MAX_NAME_LENGTH} caracteres.` }),
  parent_id: z.string().min(1, { message: 'O ID do assunto pai é inválido.' }).nullable().optional(),
});

export type TopicCreateInput = z.infer<typeof topicCreateSchema>;

/**
 * Atualização de assunto. Também é usada para MOVER o assunto:
 * - `parent_id` muda o pai (null = nível superior da matéria);
 * - `subject_id` muda a matéria (todos os descendentes acompanham).
 */
export const topicUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'O nome do assunto não pode ser vazio.' })
      .max(MAX_NAME_LENGTH, { message: `O nome do assunto deve ter no máximo ${MAX_NAME_LENGTH} caracteres.` })
      .optional(),
    subject_id: z.string().min(1, { message: 'O ID da matéria não pode ser vazio.' }).optional(),
    parent_id: z.string().min(1, { message: 'O ID do assunto pai é inválido.' }).nullable().optional(),
    archived: z.boolean({ invalid_type_error: 'O campo "archived" deve ser verdadeiro ou falso.' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export type TopicUpdateInput = z.infer<typeof topicUpdateSchema>;

/** Assunto como retornado pela API. */
export interface TopicDTO {
  id: string;
  user_id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Parâmetros de consulta das listagens (`GET /api/subjects` e `GET /api/topics`). */
export const listQuerySchema = z.object({
  subject_id: z.string().min(1).optional(),
  include_archived: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;

/**
 * Contrato das rotas da Fase 2 (todas exigem sessão; respostas de erro seguem o envelope
 * `{ error: { code, message, details? } }`, sempre em português):
 *
 * - GET    /api/subjects?include_archived=true|false      → 200 SubjectDTO[]
 * - POST   /api/subjects                                   → 201 SubjectDTO
 * - PATCH  /api/subjects/:id  (nome, cor, archived)        → 200 SubjectDTO
 * - DELETE /api/subjects/:id                               → 204 | 409 (há sessões vinculadas)
 * - GET    /api/topics?subject_id=&include_archived=       → 200 TopicDTO[]
 * - POST   /api/topics                                     → 201 TopicDTO
 * - PATCH  /api/topics/:id  (nome, mover, archived)        → 200 TopicDTO | 400 (ciclo)
 * - DELETE /api/topics/:id                                 → 204 | 409 (há sessões vinculadas)
 *
 * Recursos de outro usuário respondem 404, como se não existissem.
 */
export const PHASE2_ROUTES = {
  subjects: '/api/subjects',
  topics: '/api/topics',
} as const;

// ==============================================================================
// 4. VALIDAÇÃO DE INVARIANTES DA ÁRVORE DE ASSUNTOS
// ==============================================================================

/**
 * Interface mínima de nó da árvore de tópicos para análise de ciclos.
 */
export interface TopicTreeNode {
  id: string;
  parent_id: string | null;
  subject_id: string;
}

/**
 * Verifica se atribuir `newParentId` ao tópico `topicId` geraria um ciclo.
 * Um ciclo ocorre se:
 * 1. topicId for igual a newParentId (auto-dependência direta);
 * 2. newParentId for um dos descendentes atuais de topicId.
 *
 * @param topicId ID do assunto que está sendo movido
 * @param newParentId Novo ID de pai proposto (null se raiz)
 * @param getNode Função para obter nó pelo ID
 * @returns true se formaria um ciclo, false caso seja válido
 */
export function wouldCreateHierarchyCycle(
  topicId: string,
  newParentId: string | null | undefined,
  getNode: (id: string) => TopicTreeNode | undefined
): boolean {
  if (!newParentId) {
    return false;
  }

  if (topicId === newParentId) {
    return true;
  }

  // Percorre a cadeia de ancestrais de newParentId para cima
  let currentParentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (currentParentId === topicId) {
      return true;
    }

    if (visited.has(currentParentId)) {
      // Ciclo pré-existente detectado na cadeia
      return true;
    }
    visited.add(currentParentId);

    const parentNode = getNode(currentParentId);
    if (!parentNode) {
      break;
    }
    currentParentId = parentNode.parent_id;
  }

  return false;
}

/**
 * Retorna os IDs de todos os descendentes de `rootId` (sem incluir o próprio `rootId`),
 * em ordem de largura (filhos, netos, ...). Tolera ciclos pré-existentes.
 */
export function collectDescendantIds(
  rootId: string,
  nodes: ReadonlyArray<Pick<TopicTreeNode, 'id' | 'parent_id'>>
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    const list = childrenByParent.get(node.parent_id) ?? [];
    list.push(node.id);
    childrenByParent.set(node.parent_id, list);
  }

  const result: string[] = [];
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      result.push(childId);
      queue.push(childId);
    }
  }
  return result;
}

/**
 * Retorna os IDs dos ancestrais de `topicId` (do pai até a raiz).
 */
export function collectAncestorIds(
  topicId: string,
  getNode: (id: string) => Pick<TopicTreeNode, 'id' | 'parent_id'> | undefined
): string[] {
  const result: string[] = [];
  const visited = new Set<string>([topicId]);
  let current = getNode(topicId)?.parent_id ?? null;
  while (current && !visited.has(current)) {
    visited.add(current);
    result.push(current);
    current = getNode(current)?.parent_id ?? null;
  }
  return result;
}

/** Nó da árvore montada para exibição. */
export type TopicTree<T extends Pick<TopicTreeNode, 'id' | 'parent_id'>> = T & {
  children: TopicTree<T>[];
};

/**
 * Monta a árvore a partir de uma lista plana. Nós cujo pai não está na lista
 * (ex.: pai arquivado e filtrado) são tratados como raízes, para nunca sumirem da tela.
 * A ordem dos irmãos segue a ordem da lista recebida.
 */
export function buildTopicTree<T extends Pick<TopicTreeNode, 'id' | 'parent_id'>>(
  nodes: ReadonlyArray<T>
): TopicTree<T>[] {
  const byId = new Map<string, TopicTree<T>>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  const roots: TopicTree<T>[] = [];
  for (const node of nodes) {
    const treeNode = byId.get(node.id) as TopicTree<T>;
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent && parent !== treeNode) {
      parent.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }
  return roots;
}

/** Resultado da validação de um movimento de assunto. */
export type TopicMoveResolution =
  | { ok: true; subjectId: string; parentId: string | null }
  | { ok: false; reason: 'CYCLE' | 'PARENT_NOT_FOUND' | 'SUBJECT_MISMATCH'; message: string };

/**
 * Decide para onde um assunto vai ao ser movido, sem acessar banco.
 *
 * Regras:
 * - `parent_id` informado: o assunto passa a ser filho dele e adota a matéria do novo pai.
 *   Se `subject_id` também for informado, deve ser igual à matéria do novo pai.
 * - `parent_id: null`: vira nível superior da matéria (`subject_id` informado ou a atual).
 * - Apenas `subject_id` (sem `parent_id`): troca de matéria e vira nível superior nela,
 *   pois o pai antigo pertence à matéria anterior.
 * - Nunca pode virar filho de si mesmo ou de um descendente (ciclo).
 */
export function resolveTopicMove(
  topic: TopicTreeNode,
  input: { subject_id?: string; parent_id?: string | null },
  getNode: (id: string) => TopicTreeNode | undefined
): TopicMoveResolution {
  const hasParent = input.parent_id !== undefined;
  const hasSubject = input.subject_id !== undefined;

  if (hasParent && input.parent_id) {
    const parentId = input.parent_id;
    if (wouldCreateHierarchyCycle(topic.id, parentId, getNode)) {
      return {
        ok: false,
        reason: 'CYCLE',
        message:
          'Movimento inválido: um assunto não pode ser pai de si mesmo nem de um de seus descendentes (ciclo na hierarquia).',
      };
    }
    const parent = getNode(parentId);
    if (!parent) {
      return { ok: false, reason: 'PARENT_NOT_FOUND', message: 'Assunto pai não encontrado.' };
    }
    if (hasSubject && input.subject_id !== parent.subject_id) {
      return {
        ok: false,
        reason: 'SUBJECT_MISMATCH',
        message: 'O assunto pai informado pertence a outra matéria.',
      };
    }
    return { ok: true, subjectId: parent.subject_id, parentId };
  }

  if (hasParent) {
    // parent_id: null → nível superior
    return { ok: true, subjectId: input.subject_id ?? topic.subject_id, parentId: null };
  }

  if (hasSubject && input.subject_id !== topic.subject_id) {
    return { ok: true, subjectId: input.subject_id as string, parentId: null };
  }

  return { ok: true, subjectId: topic.subject_id, parentId: topic.parent_id };
}

// ==============================================================================
// 5. FÓRMULAS E CÁLCULOS DETERMINÍSTICOS (CONFORME SEÇÃO 5 DO CONTEXTO)
// ==============================================================================

export const MIN_QUESTIONS_FOR_RATING = 10;

/**
 * Calcula a taxa de acerto (aproveitamento) em questões como porcentagem (0 a 100).
 */
export function calculateAccuracy(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (correct / total) * 100));
}

/**
 * Converte o nível de autoavaliação qualitativo para valor numérico (0 a 100).
 * Não entendi = 0, Parcialmente = 33, Entendi = 67, Dominei = 100.
 */
export function mapUnderstandingToScore(level: 'NONE' | 'PARTIAL' | 'GOOD' | 'MASTERED'): number {
  switch (level) {
    case 'NONE':
      return 0;
    case 'PARTIAL':
      return 33;
    case 'GOOD':
      return 67;
    case 'MASTERED':
      return 100;
  }
}

/**
 * Calcula a nota final do assunto:
 * 70% aproveitamento em questões + 30% autoavaliação qualitativa.
 */
export function calculateSubjectGrade(accuracyPercentage: number, selfEvaluationScore: number): number {
  const grade = accuracyPercentage * 0.7 + selfEvaluationScore * 0.3;
  return Math.round(grade * 100) / 100;
}

export type PerformanceClassification = 'FORTE' | 'REGULAR' | 'FRACO' | 'DADOS_INSUFICIENTES';

/**
 * Classifica o desempenho em um assunto baseado na nota e no volume mínimo de questões:
 * Forte: nota >= 80
 * Regular: 60 a 79
 * Fraco: < 60
 * Abaixo de MIN_QUESTIONS: DADOS_INSUFICIENTES
 */
export function classifyPerformance(
  grade: number,
  totalQuestions: number,
  minQuestions = MIN_QUESTIONS_FOR_RATING
): PerformanceClassification {
  if (totalQuestions < minQuestions) {
    return 'DADOS_INSUFICIENTES';
  }
  if (grade >= 80) {
    return 'FORTE';
  }
  if (grade >= 60) {
    return 'REGULAR';
  }
  return 'FRACO';
}

/**
 * Calcula a efetividade do tempo (foco): tempo efetivo / tempo total.
 */
export function calculateFocusEfficiency(effectiveMinutes: number, totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return Math.min(1, Math.max(0, effectiveMinutes / totalMinutes));
}

/**
 * Calcula a aderência ao planejado: tempo efetivo / tempo planejado.
 */
export function calculatePlanAdherence(effectiveMinutes: number, plannedMinutes: number): number {
  if (plannedMinutes <= 0) return 0;
  return effectiveMinutes / plannedMinutes;
}
