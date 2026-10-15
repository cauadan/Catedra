/**
 * Planejamento de sessões (Fase 3): constantes, validação de etapas (PlannedBlock),
 * presets de distribuição e esquemas Zod estritos dos endpoints da agenda.
 * Funções puras — sem banco, sem I/O.
 */

import { z } from 'zod';
import { isValidLocalDate, isValidLocalDateTime } from './calendar.js';

// ==============================================================================
// CONSTANTES E ENUMS
// ==============================================================================

export const PLANNED_MINUTES_MIN = 5;
export const PLANNED_MINUTES_MAX = 480;
export const NOTES_MAX_LENGTH = 2000;

/** Ordem canônica das etapas — idêntica ao enum `BlockKind` do Prisma. */
export const BLOCK_KINDS = ['REVIEW', 'NEW_CONTENT', 'PRACTICE'] as const;
export type BlockKindDTO = (typeof BLOCK_KINDS)[number];

/** Status da sessão planejada — idêntico ao enum `PlannedSessionStatus` do Prisma. */
export const PLANNED_SESSION_STATUSES = ['PLANNED', 'DONE', 'SKIPPED', 'RESCHEDULED'] as const;
export type PlannedSessionStatusDTO = (typeof PLANNED_SESSION_STATUSES)[number];

/** `priority` é `String` no schema; os valores aceitos são fixados aqui. */
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type PlannedSessionPriority = (typeof PRIORITIES)[number];

/** `activity_type` é `String?` no schema; os valores aceitos são fixados aqui. */
export const ACTIVITY_TYPES = ['THEORY', 'PRACTICE', 'REVIEW', 'OTHER', 'NEW_CONTENT', 'EXERCISES'] as const;
export type PlannedActivityType = (typeof ACTIVITY_TYPES)[number];

export const BLOCK_KIND_LABELS: Record<BlockKindDTO, string> = {
  REVIEW: 'Revisão',
  NEW_CONTENT: 'Conteúdo novo',
  PRACTICE: 'Prática',
};

export const PRIORITY_LABELS: Record<PlannedSessionPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

export const ACTIVITY_TYPE_LABELS: Record<PlannedActivityType, string> = {
  THEORY: 'Teoria',
  PRACTICE: 'Prática',
  REVIEW: 'Revisão',
  OTHER: 'Outro',
  NEW_CONTENT: 'Conteúdo novo',
  EXERCISES: 'Exercícios',
};

export const PLANNED_SESSION_STATUS_LABELS: Record<PlannedSessionStatusDTO, string> = {
  PLANNED: 'Planejada',
  DONE: 'Concluída',
  SKIPPED: 'Pulada',
  RESCHEDULED: 'Remarcada',
};

// ==============================================================================
// VALIDAÇÃO DE ETAPAS
// ==============================================================================

export interface PlannedBlockInput {
  kind: BlockKindDTO;
  planned_minutes: number;
}

export interface NormalizedPlannedBlock {
  kind: BlockKindDTO;
  planned_minutes: number;
  position: number;
}

export type BlockValidationResult =
  | { ok: true; blocks: NormalizedPlannedBlock[] }
  | { ok: false; message: string };

function isValidSessionMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= PLANNED_MINUTES_MIN && n <= PLANNED_MINUTES_MAX;
}

/**
 * Valida e normaliza as etapas de uma sessão planejada:
 * - duração da sessão inteira entre 5 e 480;
 * - etapas com 0 minutos são descartadas; demais devem ser inteiras ≥ 1;
 * - ao menos 1 etapa; cada `kind` no máximo uma vez;
 * - soma estritamente igual à duração;
 * - saída na ordem canônica REVIEW → NEW_CONTENT → PRACTICE com `position` 1..n.
 */
export function validatePlannedBlocks(
  plannedMinutes: number,
  blocks: ReadonlyArray<PlannedBlockInput>,
  minMinutes: number = PLANNED_MINUTES_MIN
): BlockValidationResult {
  if (!Number.isInteger(plannedMinutes) || plannedMinutes < minMinutes || plannedMinutes > PLANNED_MINUTES_MAX) {
    return {
      ok: false,
      message: `A duração da sessão deve ser um número inteiro entre ${minMinutes} e ${PLANNED_MINUTES_MAX} minutos.`,
    };
  }

  for (const b of blocks) {
    if (!Number.isInteger(b.planned_minutes) || b.planned_minutes < 0) {
      return { ok: false, message: 'Os minutos de cada etapa devem ser números inteiros maiores ou iguais a zero.' };
    }
  }

  const ativos = blocks.filter((b) => b.planned_minutes > 0);
  if (ativos.length === 0) {
    return { ok: false, message: 'Informe ao menos uma etapa com minutos planejados.' };
  }

  const vistos = new Set<BlockKindDTO>();
  for (const b of ativos) {
    if (vistos.has(b.kind)) {
      return { ok: false, message: `A etapa "${BLOCK_KIND_LABELS[b.kind]}" aparece mais de uma vez.` };
    }
    vistos.add(b.kind);
  }

  const soma = ativos.reduce((s, b) => s + b.planned_minutes, 0);
  if (soma !== plannedMinutes) {
    return {
      ok: false,
      message: `A soma das etapas (${soma} min) deve ser igual à duração da sessão (${plannedMinutes} min).`,
    };
  }

  const ordenados = [...ativos].sort((a, b) => BLOCK_KINDS.indexOf(a.kind) - BLOCK_KINDS.indexOf(b.kind));
  return {
    ok: true,
    blocks: ordenados.map((b, i) => ({ kind: b.kind, planned_minutes: b.planned_minutes, position: i + 1 })),
  };
}

export type BlockPreset = 'BALANCED' | 'PRACTICE_FOCUS' | 'NEW_ONLY';

/**
 * Distribuição de 1 clique (minutos inteiros, soma exata):
 * - BALANCED: revisão = round(25%), prática = round(25%), novo = restante;
 * - PRACTICE_FOCUS: revisão = round(20%), prática = restante;
 * - NEW_ONLY: novo = total.
 * Etapas com 0 minutos são omitidas; `position` sequencial.
 */
export function calculateBlockPreset(plannedMinutes: number, preset: BlockPreset): NormalizedPlannedBlock[] {
  const total = plannedMinutes;
  let draft: PlannedBlockInput[];
  switch (preset) {
    case 'BALANCED': {
      const review = Math.round(total * 0.25);
      const practice = Math.round(total * 0.25);
      draft = [
        { kind: 'REVIEW', planned_minutes: review },
        { kind: 'NEW_CONTENT', planned_minutes: total - review - practice },
        { kind: 'PRACTICE', planned_minutes: practice },
      ];
      break;
    }
    case 'PRACTICE_FOCUS': {
      const review = Math.round(total * 0.2);
      draft = [
        { kind: 'REVIEW', planned_minutes: review },
        { kind: 'PRACTICE', planned_minutes: total - review },
      ];
      break;
    }
    case 'NEW_ONLY':
      draft = [{ kind: 'NEW_CONTENT', planned_minutes: total }];
      break;
  }
  return draft
    .filter((b) => b.planned_minutes > 0)
    .map((b, i) => ({ ...b, position: i + 1 }));
}

// ==============================================================================
// ESQUEMAS ZOD (todos estritos)
// ==============================================================================

const CAMPO_NAO_PERMITIDO = 'Campo não permitido na requisição.';
const MSG_REMARCAR =
  'O horário não pode ser alterado pela edição. Use a remarcação (POST /api/planned-sessions/:id/reschedule).';

const idSchema = (nome: string) =>
  z
    .string({ required_error: `O campo "${nome}" é obrigatório.`, invalid_type_error: `O campo "${nome}" deve ser texto.` })
    .min(1, { message: `O campo "${nome}" é obrigatório.` });

const localDateTimeSchema = z
  .string({
    required_error: 'O horário de início é obrigatório.',
    invalid_type_error: 'O horário de início deve ser texto.',
  })
  .refine(isValidLocalDateTime, { message: 'Horário de início inválido. Use YYYY-MM-DDTHH:mm com uma data real.' });

const plannedMinutesSchema = z
  .number({ required_error: 'A duração é obrigatória.', invalid_type_error: 'A duração deve ser um número.' })
  .int({ message: 'A duração deve ser um número inteiro de minutos.' })
  .min(PLANNED_MINUTES_MIN, { message: `A duração mínima é de ${PLANNED_MINUTES_MIN} minutos.` })
  .max(PLANNED_MINUTES_MAX, { message: `A duração máxima é de ${PLANNED_MINUTES_MAX} minutos.` });

const prioritySchema = z.enum(PRIORITIES, {
  errorMap: () => ({ message: `Prioridade inválida. Valores aceitos: ${PRIORITIES.join(', ')}.` }),
});

const activityTypeSchema = z.enum(ACTIVITY_TYPES, {
  errorMap: () => ({ message: `Tipo de atividade inválido. Valores aceitos: ${ACTIVITY_TYPES.join(', ')}.` }),
});

const notesSchema = z
  .string({ invalid_type_error: 'As notas devem ser texto.' })
  .trim()
  .max(NOTES_MAX_LENGTH, { message: `As notas devem ter no máximo ${NOTES_MAX_LENGTH} caracteres.` })
  .nullable();

const blockInputSchema = z
  .object({
    kind: z.enum(BLOCK_KINDS, {
      errorMap: () => ({ message: `Etapa inválida. Valores aceitos: ${BLOCK_KINDS.join(', ')}.` }),
    }),
    planned_minutes: z
      .number({ required_error: 'Os minutos da etapa são obrigatórios.', invalid_type_error: 'Os minutos da etapa devem ser um número.' })
      .int({ message: 'Os minutos da etapa devem ser inteiros.' })
      .min(0, { message: 'Os minutos da etapa não podem ser negativos.' })
      .max(PLANNED_MINUTES_MAX, { message: `Uma etapa não pode passar de ${PLANNED_MINUTES_MAX} minutos.` }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

const blocksSchema = z.array(blockInputSchema, {
  required_error: 'As etapas são obrigatórias.',
  invalid_type_error: 'As etapas devem ser uma lista.',
});

/** Aplica `validatePlannedBlocks` e troca `blocks` pela versão normalizada. */
function withNormalizedBlocks<T extends { planned_minutes?: number; blocks?: PlannedBlockInput[] }>(
  data: T,
  ctx: z.RefinementCtx
): Omit<T, 'blocks'> & { blocks?: NormalizedPlannedBlock[] } {
  const { blocks, planned_minutes } = data;
  if (blocks === undefined && planned_minutes === undefined) {
    return data as Omit<T, 'blocks'>;
  }
  if (blocks === undefined || planned_minutes === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [blocks === undefined ? 'blocks' : 'planned_minutes'],
      message: 'Envie "planned_minutes" e "blocks" juntos, ou nenhum dos dois.',
    });
    return z.NEVER;
  }
  const r = validatePlannedBlocks(planned_minutes, blocks);
  if (!r.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['blocks'], message: r.message });
    return z.NEVER;
  }
  return { ...data, blocks: r.blocks };
}

/** POST /api/planned-sessions */
export const plannedSessionCreateSchema = z
  .object({
    subject_id: idSchema('subject_id'),
    topic_id: idSchema('topic_id'),
    scheduled_start_local: localDateTimeSchema,
    planned_minutes: plannedMinutesSchema,
    priority: prioritySchema.default('MEDIUM'),
    activity_type: activityTypeSchema,
    notes: notesSchema.optional(),
    blocks: blocksSchema,
  })
  .strict(CAMPO_NAO_PERMITIDO)
  .transform((data, ctx) => withNormalizedBlocks(data, ctx) as Omit<typeof data, 'blocks'> & { blocks: NormalizedPlannedBlock[] });

export type PlannedSessionCreateInput = z.infer<typeof plannedSessionCreateSchema>;

/**
 * PATCH /api/planned-sessions/:id — parcial. `scheduled_start`/`scheduled_start_local`
 * são declarados apenas para devolver uma mensagem que orienta a usar a remarcação.
 */
export const plannedSessionUpdateSchema = z
  .object({
    subject_id: idSchema('subject_id').optional(),
    topic_id: idSchema('topic_id').optional(),
    priority: prioritySchema.optional(),
    activity_type: activityTypeSchema.optional(),
    notes: notesSchema.optional(),
    planned_minutes: plannedMinutesSchema.optional(),
    blocks: blocksSchema.optional(),
    scheduled_start: z.unknown().optional(),
    scheduled_start_local: z.unknown().optional(),
  })
  .strict(CAMPO_NAO_PERMITIDO)
  .superRefine((data, ctx) => {
    for (const campo of ['scheduled_start', 'scheduled_start_local'] as const) {
      if (campo in data) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: MSG_REMARCAR });
      }
    }
    const { scheduled_start: _a, scheduled_start_local: _b, ...resto } = data;
    if (Object.keys(resto).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe ao menos um campo para atualizar.' });
    }
  })
  .transform((data, ctx) => {
    const { scheduled_start: _a, scheduled_start_local: _b, ...resto } = data;
    return withNormalizedBlocks(resto, ctx);
  });

export type PlannedSessionUpdateInput = z.infer<typeof plannedSessionUpdateSchema>;

/** POST /api/planned-sessions/:id/reschedule */
export const plannedSessionRescheduleSchema = z
  .object({
    scheduled_start_local: localDateTimeSchema,
    planned_minutes: plannedMinutesSchema.optional(),
    blocks: blocksSchema.optional(),
  })
  .strict(CAMPO_NAO_PERMITIDO)
  .transform((data, ctx) => withNormalizedBlocks(data, ctx));

export type PlannedSessionRescheduleInput = z.infer<typeof plannedSessionRescheduleSchema>;

/** PATCH /api/planned-sessions/:id/status — apenas SKIPPED na Fase 3. */
export const plannedSessionStatusUpdateSchema = z
  .object({
    status: z.literal('SKIPPED', {
      errorMap: () => ({ message: 'Somente o status "SKIPPED" pode ser definido manualmente.' }),
    }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export type PlannedSessionStatusUpdateInput = z.infer<typeof plannedSessionStatusUpdateSchema>;

/** GET /api/planned-sessions?view=day|week&date=YYYY-MM-DD */
export const plannedSessionQuerySchema = z
  .object({
    view: z.enum(['day', 'week'], { errorMap: () => ({ message: 'Visão inválida. Use "day" ou "week".' }) }),
    date: z
      .string({ required_error: 'A data é obrigatória.', invalid_type_error: 'A data deve ser texto.' })
      .refine(isValidLocalDate, { message: 'Data inválida. Use YYYY-MM-DD com uma data real.' }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export type PlannedSessionQueryInput = z.infer<typeof plannedSessionQuerySchema>;
