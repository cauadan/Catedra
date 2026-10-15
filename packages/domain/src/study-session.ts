/**
 * Esquemas Zod para a execução de sessões de estudo (Fases 4 e 5).
 * Validação rigorosa e estrita (.strict()) em todas as entradas.
 */

import { z } from 'zod';
import {
  BLOCK_KINDS,
  BlockKindDTO,
  NormalizedPlannedBlock,
  validatePlannedBlocks,
} from './planning.js';
import {
  DIFFICULTY_LEVELS,
  DifficultyLevelDTO,
  FOCUS_LEVELS,
  FocusLevelDTO,
  UNDERSTANDING_LEVELS,
  UnderstandingLevelDTO,
} from './practice.js';

const CAMPO_NAO_PERMITIDO = 'Campo não permitido na requisição.';

// ==============================================================================
// 1. CRIAÇÃO DE SESSÃO (POST /api/study-sessions)
// ==============================================================================

const modo1Schema = z
  .object({
    planned_session_id: z
      .string({
        required_error: 'O campo "planned_session_id" é obrigatório.',
        invalid_type_error: 'O campo "planned_session_id" deve ser texto.',
      })
      .min(1, { message: 'O campo "planned_session_id" é obrigatório.' }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

const modo2BlockSchema = z
  .object({
    kind: z.enum(BLOCK_KINDS, {
      errorMap: () => ({ message: `Etapa inválida. Valores aceitos: ${BLOCK_KINDS.join(', ')}.` }),
    }),
    planned_minutes: z
      .number({
        required_error: 'Os minutos da etapa são obrigatórios.',
        invalid_type_error: 'Os minutos da etapa devem ser um número.',
      })
      .int({ message: 'Os minutos da etapa devem ser inteiros.' })
      .min(1, { message: 'Os minutos de cada etapa devem ser maiores ou iguais a 1.' }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

const modo2Schema = z
  .object({
    topic_id: z
      .string({
        required_error: 'O assunto é obrigatório.',
        invalid_type_error: 'O assunto deve ser texto.',
      })
      .min(1, { message: 'O assunto é obrigatório.' }),
    blocks: z
      .array(modo2BlockSchema, {
        required_error: 'As etapas são obrigatórias.',
        invalid_type_error: 'As etapas devem ser uma lista.',
      })
      .min(1, { message: 'Informe ao menos uma etapa com minutos planejados.' }),
  })
  .strict(CAMPO_NAO_PERMITIDO)
  .superRefine((data, ctx) => {
    const total = data.blocks.reduce((acc, b) => acc + b.planned_minutes, 0);
    const r = validatePlannedBlocks(total, data.blocks, 1);
    if (!r.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocks'],
        message: r.message,
      });
    }
  });

export type StudySessionCreateRawInput =
  | { planned_session_id: string }
  | { topic_id: string; blocks: Array<{ kind: BlockKindDTO; planned_minutes: number }> };

export type StudySessionCreateInput =
  | { mode: 'FROM_PLANNED'; planned_session_id: string }
  | {
      mode: 'ADHOC';
      topic_id: string;
      total_planned_minutes: number;
      blocks: NormalizedPlannedBlock[];
    };

export const studySessionCreateSchema = z
  .union([modo1Schema, modo2Schema], {
    errorMap: () => ({
      message: 'Informe "planned_session_id" para iniciar a partir de uma sessão planejada ou "topic_id" e "blocks" para uma sessão avulsa.',
    }),
  })
  .transform((data): StudySessionCreateInput => {
    if ('planned_session_id' in data) {
      return {
        mode: 'FROM_PLANNED',
        planned_session_id: data.planned_session_id,
      };
    }
    const total = data.blocks.reduce((acc, b) => acc + b.planned_minutes, 0);
    const r = validatePlannedBlocks(total, data.blocks, 1);
    if (!r.ok) {
      throw new Error(r.message);
    }
    return {
      mode: 'ADHOC',
      topic_id: data.topic_id,
      total_planned_minutes: total,
      blocks: r.blocks,
    };
  });

export const studySessionBlocksUpdateSchema = z
  .object({
    blocks: z
      .array(
        z
          .object({
            id: z.string().min(1, { message: 'O ID da etapa é obrigatório.' }),
            planned_minutes: z
              .number({ invalid_type_error: 'Os minutos da etapa devem ser um número.' })
              .int({ message: 'Os minutos da etapa devem ser inteiros.' })
              .min(1, { message: 'Os minutos de cada etapa devem ser de no mínimo 1 minuto.' })
              .max(480, { message: 'Os minutos da etapa não podem exceder 480 minutos.' }),
          })
          .strict(CAMPO_NAO_PERMITIDO)
      )
      .min(1, { message: 'Informe ao menos uma etapa para atualização.' }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export type StudySessionBlocksUpdateInput = z.infer<typeof studySessionBlocksUpdateSchema>;

// ==============================================================================
// 2. EVENTOS DO TIMER (POST /api/study-sessions/:id/events)
// ==============================================================================

export const studySessionEventSchema = z
  .object({
    type: z.enum(['PAUSE', 'RESUME', 'DISTRACTION_START', 'DISTRACTION_END'], {
      errorMap: () => ({
        message: 'Tipo de evento inválido. Valores aceitos: PAUSE, RESUME, DISTRACTION_START, DISTRACTION_END.',
      }),
    }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export type StudySessionEventInput = z.infer<typeof studySessionEventSchema>;

// ==============================================================================
// 3. FINALIZAÇÃO DE BLOCO E SESSÃO (POST .../blocks/:id/finish e POST .../finish)
// ==============================================================================

export const declaredDistractionSchema = z
  .object({
    declared_minutes: z
      .number({
        invalid_type_error: 'Os minutos de distração devem ser um número.',
      })
      .int({ message: 'Os minutos de distração devem ser um número inteiro.' })
      .min(0, { message: 'Os minutos de distração não podem ser negativos.' })
      .optional(),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export type DeclaredDistractionInput = z.infer<typeof declaredDistractionSchema>;

// ==============================================================================
// 4. AVALIAÇÃO QUALITATIVA (POST /api/study-sessions/:id/evaluation)
// ==============================================================================

const practiceRecordInputSchema = z
  .object({
    block_id: z.string().min(1).optional(),
    topic_id: z
      .string({
        required_error: 'O assunto é obrigatório.',
        invalid_type_error: 'O assunto deve ser texto.',
      })
      .min(1, { message: 'O assunto é obrigatório.' }),
    questions: z
      .number({
        required_error: 'O total de questões é obrigatório.',
        invalid_type_error: 'O total de questões deve ser um número.',
      })
      .int({ message: 'O total de questões deve ser um número inteiro.' })
      .min(0, { message: 'O total de questões não pode ser negativo.' }),
    correct: z
      .number({
        required_error: 'O total de acertos é obrigatório.',
        invalid_type_error: 'O total de acertos deve ser um número.',
      })
      .int({ message: 'O total de acertos deve ser um número inteiro.' })
      .min(0, { message: 'O total de acertos não pode ser negativo.' }),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export const sessionEvaluationSchema = z
  .object({
    understanding: z.enum(UNDERSTANDING_LEVELS, {
      errorMap: () => ({
        message: `Nível de entendimento inválido. Valores aceitos: ${UNDERSTANDING_LEVELS.join(', ')}.`,
      }),
    }),
    focus: z.enum(FOCUS_LEVELS, {
      errorMap: () => ({
        message: `Nível de foco inválido. Valores aceitos: ${FOCUS_LEVELS.join(', ')}.`,
      }),
    }),
    difficulty: z.enum(DIFFICULTY_LEVELS, {
      errorMap: () => ({
        message: `Nível de dificuldade inválido. Valores aceitos: ${DIFFICULTY_LEVELS.join(', ')}.`,
      }),
    }),
    notes: z
      .string({ invalid_type_error: 'As observações devem ser texto.' })
      .trim()
      .max(1000, { message: 'As observações devem ter no máximo 1000 caracteres.' })
      .nullable()
      .optional(),
    practice_records: z.array(practiceRecordInputSchema).optional(),
  })
  .strict(CAMPO_NAO_PERMITIDO);

export type SessionEvaluationInput = z.infer<typeof sessionEvaluationSchema>;
