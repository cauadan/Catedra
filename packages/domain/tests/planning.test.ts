import { describe, it, expect } from 'vitest';
import {
  PLANNED_MINUTES_MIN,
  PLANNED_MINUTES_MAX,
  BLOCK_KINDS,
  PRIORITIES,
  ACTIVITY_TYPES,
  validatePlannedBlocks,
  calculateBlockPreset,
  plannedSessionCreateSchema,
  plannedSessionUpdateSchema,
  plannedSessionRescheduleSchema,
  plannedSessionStatusUpdateSchema,
  plannedSessionQuerySchema,
} from '../src/planning';

describe('Constantes', () => {
  it('limites de duração 5..480 e enums aprovados', () => {
    expect(PLANNED_MINUTES_MIN).toBe(5);
    expect(PLANNED_MINUTES_MAX).toBe(480);
    expect(BLOCK_KINDS).toEqual(['REVIEW', 'NEW_CONTENT', 'PRACTICE']);
    expect(PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(ACTIVITY_TYPES).toEqual(['THEORY', 'PRACTICE', 'REVIEW', 'OTHER', 'NEW_CONTENT', 'EXERCISES']);
  });
});

describe('validatePlannedBlocks', () => {
  it('normaliza para a ordem canônica REVIEW → NEW_CONTENT → PRACTICE com position 1..n', () => {
    const r = validatePlannedBlocks(60, [
      { kind: 'PRACTICE', planned_minutes: 15 },
      { kind: 'REVIEW', planned_minutes: 15 },
      { kind: 'NEW_CONTENT', planned_minutes: 30 },
    ]);
    expect(r).toEqual({
      ok: true,
      blocks: [
        { kind: 'REVIEW', planned_minutes: 15, position: 1 },
        { kind: 'NEW_CONTENT', planned_minutes: 30, position: 2 },
        { kind: 'PRACTICE', planned_minutes: 15, position: 3 },
      ],
    });
  });

  it('descarta blocos com 0 minutos e renumera position', () => {
    const r = validatePlannedBlocks(45, [
      { kind: 'REVIEW', planned_minutes: 0 },
      { kind: 'NEW_CONTENT', planned_minutes: 30 },
      { kind: 'PRACTICE', planned_minutes: 15 },
    ]);
    expect(r).toEqual({
      ok: true,
      blocks: [
        { kind: 'NEW_CONTENT', planned_minutes: 30, position: 1 },
        { kind: 'PRACTICE', planned_minutes: 15, position: 2 },
      ],
    });
  });

  it('exige ao menos 1 bloco com minutos', () => {
    expect(validatePlannedBlocks(30, []).ok).toBe(false);
    expect(validatePlannedBlocks(30, [{ kind: 'REVIEW', planned_minutes: 0 }]).ok).toBe(false);
  });

  it('rejeita kind repetido', () => {
    const r = validatePlannedBlocks(30, [
      { kind: 'REVIEW', planned_minutes: 15 },
      { kind: 'REVIEW', planned_minutes: 15 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/mais de uma vez/);
  });

  it('rejeita soma diferente da duração (faltando e excedendo)', () => {
    const falta = validatePlannedBlocks(60, [{ kind: 'NEW_CONTENT', planned_minutes: 50 }]);
    const excede = validatePlannedBlocks(60, [{ kind: 'NEW_CONTENT', planned_minutes: 70 }]);
    expect(falta.ok).toBe(false);
    expect(excede.ok).toBe(false);
    if (!falta.ok) expect(falta.message).toMatch(/50.*60/);
  });

  it('rejeita minutos negativos ou fracionários', () => {
    expect(validatePlannedBlocks(30, [{ kind: 'REVIEW', planned_minutes: -5 }, { kind: 'PRACTICE', planned_minutes: 35 }]).ok).toBe(false);
    expect(validatePlannedBlocks(30, [{ kind: 'REVIEW', planned_minutes: 29.5 }, { kind: 'PRACTICE', planned_minutes: 0.5 }]).ok).toBe(false);
  });

  it('rejeita duração da sessão fora de 5..480 ou fracionária', () => {
    expect(validatePlannedBlocks(4, [{ kind: 'REVIEW', planned_minutes: 4 }]).ok).toBe(false);
    expect(validatePlannedBlocks(481, [{ kind: 'REVIEW', planned_minutes: 481 }]).ok).toBe(false);
    expect(validatePlannedBlocks(30.5, [{ kind: 'REVIEW', planned_minutes: 30.5 }]).ok).toBe(false);
    expect(validatePlannedBlocks(5, [{ kind: 'REVIEW', planned_minutes: 5 }]).ok).toBe(true);
    expect(validatePlannedBlocks(480, [{ kind: 'REVIEW', planned_minutes: 480 }]).ok).toBe(true);
  });
});

describe('calculateBlockPreset', () => {
  it('BALANCED 60 → 15 / 30 / 15', () => {
    expect(calculateBlockPreset(60, 'BALANCED')).toEqual([
      { kind: 'REVIEW', planned_minutes: 15, position: 1 },
      { kind: 'NEW_CONTENT', planned_minutes: 30, position: 2 },
      { kind: 'PRACTICE', planned_minutes: 15, position: 3 },
    ]);
  });

  it('BALANCED 45 → round(11.25)=11, round(11.25)=11, novo = 23 (soma exata)', () => {
    expect(calculateBlockPreset(45, 'BALANCED')).toEqual([
      { kind: 'REVIEW', planned_minutes: 11, position: 1 },
      { kind: 'NEW_CONTENT', planned_minutes: 23, position: 2 },
      { kind: 'PRACTICE', planned_minutes: 11, position: 3 },
    ]);
  });

  it('BALANCED 5 → round(1.25)=1, 1, novo = 3', () => {
    expect(calculateBlockPreset(5, 'BALANCED').map((b) => b.planned_minutes)).toEqual([1, 3, 1]);
  });

  it('PRACTICE_FOCUS 60 → 12 revisão / 48 prática, sem NEW_CONTENT', () => {
    expect(calculateBlockPreset(60, 'PRACTICE_FOCUS')).toEqual([
      { kind: 'REVIEW', planned_minutes: 12, position: 1 },
      { kind: 'PRACTICE', planned_minutes: 48, position: 2 },
    ]);
  });

  it('NEW_ONLY 90 → 90 de conteúdo novo', () => {
    expect(calculateBlockPreset(90, 'NEW_ONLY')).toEqual([{ kind: 'NEW_CONTENT', planned_minutes: 90, position: 1 }]);
  });

  it('todo preset soma exatamente a duração e passa em validatePlannedBlocks para 5..480', () => {
    for (const preset of ['BALANCED', 'PRACTICE_FOCUS', 'NEW_ONLY'] as const) {
      for (let total = 5; total <= 480; total++) {
        const blocks = calculateBlockPreset(total, preset);
        expect(blocks.reduce((s, b) => s + b.planned_minutes, 0)).toBe(total);
        expect(blocks.every((b) => b.planned_minutes >= 1)).toBe(true);
        expect(validatePlannedBlocks(total, blocks).ok).toBe(true);
      }
    }
  });
});

const createValido = {
  subject_id: 's1',
  topic_id: 't1',
  scheduled_start_local: '2026-10-14T19:00',
  planned_minutes: 60,
  priority: 'HIGH',
  activity_type: 'THEORY',
  notes: 'Capítulo 3',
  blocks: [
    { kind: 'PRACTICE', planned_minutes: 15 },
    { kind: 'REVIEW', planned_minutes: 15 },
    { kind: 'NEW_CONTENT', planned_minutes: 30 },
  ],
};

describe('plannedSessionCreateSchema', () => {
  it('aceita payload válido e devolve blocos normalizados', () => {
    const r = plannedSessionCreateSchema.safeParse(createValido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.blocks.map((b) => [b.kind, b.position])).toEqual([
        ['REVIEW', 1], ['NEW_CONTENT', 2], ['PRACTICE', 3],
      ]);
    }
  });

  it('priority assume MEDIUM quando omitida', () => {
    const { priority: _p, ...semPrioridade } = createValido;
    const r = plannedSessionCreateSchema.safeParse(semPrioridade);
    expect(r.success && r.data.priority).toBe('MEDIUM');
  });

  it.each([
    ['user_id', { user_id: 'outro' }],
    ['status', { status: 'DONE' }],
    ['rescheduled_from_id', { rescheduled_from_id: 'x' }],
  ])('rejeita campo não permitido %s', (_n, extra) => {
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, ...extra }).success).toBe(false);
  });

  it('rejeita data/hora inexistente (2026-02-30)', () => {
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, scheduled_start_local: '2026-02-30T10:00' }).success).toBe(false);
  });

  it('rejeita priority e activity_type fora do enum', () => {
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, priority: 'URGENT' }).success).toBe(false);
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, activity_type: 'SLEEP' }).success).toBe(false);
  });

  it('aceita os activity_type extras NEW_CONTENT e EXERCISES', () => {
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, activity_type: 'NEW_CONTENT' }).success).toBe(true);
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, activity_type: 'EXERCISES' }).success).toBe(true);
  });

  it('rejeita kind de bloco inválido e campo extra dentro do bloco', () => {
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, planned_minutes: 15, blocks: [{ kind: 'SLEEP', planned_minutes: 15 }] }).success).toBe(false);
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, planned_minutes: 15, blocks: [{ kind: 'REVIEW', planned_minutes: 15, position: 9 }] }).success).toBe(false);
  });

  it('exige blocks e rejeita soma incorreta', () => {
    const { blocks: _b, ...semBlocos } = createValido;
    expect(plannedSessionCreateSchema.safeParse(semBlocos).success).toBe(false);
    expect(plannedSessionCreateSchema.safeParse({ ...createValido, planned_minutes: 90 }).success).toBe(false);
  });

  it('mensagens de erro em português', () => {
    const r = plannedSessionCreateSchema.safeParse({ ...createValido, user_id: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/não permitido/i);
  });
});

describe('plannedSessionUpdateSchema', () => {
  it('aceita atualização parcial de notas', () => {
    expect(plannedSessionUpdateSchema.safeParse({ notes: 'nova' }).success).toBe(true);
    expect(plannedSessionUpdateSchema.safeParse({ notes: null }).success).toBe(true);
  });

  it('rejeita corpo vazio', () => {
    expect(plannedSessionUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('rejeita planned_minutes sem blocks e blocks sem planned_minutes', () => {
    expect(plannedSessionUpdateSchema.safeParse({ planned_minutes: 30 }).success).toBe(false);
    expect(plannedSessionUpdateSchema.safeParse({ blocks: [{ kind: 'REVIEW', planned_minutes: 30 }] }).success).toBe(false);
  });

  it('aceita planned_minutes + blocks juntos e normaliza', () => {
    const r = plannedSessionUpdateSchema.safeParse({ planned_minutes: 30, blocks: [{ kind: 'PRACTICE', planned_minutes: 30 }] });
    expect(r.success && r.data.blocks).toEqual([{ kind: 'PRACTICE', planned_minutes: 30, position: 1 }]);
  });

  it.each(['scheduled_start_local', 'scheduled_start'])('rejeita %s orientando a usar /reschedule', (campo) => {
    const r = plannedSessionUpdateSchema.safeParse({ notes: 'x', [campo]: '2026-10-14T19:00' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join(' ')).toMatch(/remarca/i);
  });

  it.each([['status', 'SKIPPED'], ['user_id', 'x'], ['rescheduled_from_id', 'x']])('rejeita %s', (campo, valor) => {
    expect(plannedSessionUpdateSchema.safeParse({ notes: 'x', [campo]: valor }).success).toBe(false);
  });
});

describe('plannedSessionRescheduleSchema', () => {
  it('aceita apenas scheduled_start_local', () => {
    expect(plannedSessionRescheduleSchema.safeParse({ scheduled_start_local: '2026-10-15T08:00' }).success).toBe(true);
  });

  it('exige scheduled_start_local válido', () => {
    expect(plannedSessionRescheduleSchema.safeParse({}).success).toBe(false);
    expect(plannedSessionRescheduleSchema.safeParse({ scheduled_start_local: '2026-04-31T08:00' }).success).toBe(false);
  });

  it('planned_minutes e blocks: ambos ou nenhum', () => {
    expect(plannedSessionRescheduleSchema.safeParse({ scheduled_start_local: '2026-10-15T08:00', planned_minutes: 30 }).success).toBe(false);
    expect(plannedSessionRescheduleSchema.safeParse({
      scheduled_start_local: '2026-10-15T08:00', planned_minutes: 30, blocks: [{ kind: 'REVIEW', planned_minutes: 30 }],
    }).success).toBe(true);
  });

  it('rejeita campos copiados da original (subject_id, notes)', () => {
    expect(plannedSessionRescheduleSchema.safeParse({ scheduled_start_local: '2026-10-15T08:00', subject_id: 's' }).success).toBe(false);
    expect(plannedSessionRescheduleSchema.safeParse({ scheduled_start_local: '2026-10-15T08:00', notes: 'x' }).success).toBe(false);
  });
});

describe('plannedSessionStatusUpdateSchema', () => {
  it('aceita somente SKIPPED', () => {
    expect(plannedSessionStatusUpdateSchema.safeParse({ status: 'SKIPPED' }).success).toBe(true);
    for (const s of ['DONE', 'PLANNED', 'RESCHEDULED', 'skipped']) {
      expect(plannedSessionStatusUpdateSchema.safeParse({ status: s }).success).toBe(false);
    }
    expect(plannedSessionStatusUpdateSchema.safeParse({ status: 'SKIPPED', notes: 'x' }).success).toBe(false);
  });
});

describe('plannedSessionQuerySchema', () => {
  it('valida view e date real', () => {
    expect(plannedSessionQuerySchema.safeParse({ view: 'week', date: '2026-10-14' }).success).toBe(true);
    expect(plannedSessionQuerySchema.safeParse({ view: 'day', date: '2026-02-30' }).success).toBe(false);
    expect(plannedSessionQuerySchema.safeParse({ view: 'month', date: '2026-10-14' }).success).toBe(false);
    expect(plannedSessionQuerySchema.safeParse({ view: 'day', date: '2026-10-14', user_id: 'x' }).success).toBe(false);
  });
});
