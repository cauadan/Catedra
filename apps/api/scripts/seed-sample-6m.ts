import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma.js';
import {
  addDaysToLocalDate,
  localDateTimeToUtc,
  normalizeGoalPeriodStart,
  utcToLocalDate,
} from '@estudos/domain';

export const DEMO_USER_EMAIL = 'demo@estudos.local';
export const DEMO_USER_PASSWORD = 'Demo@123456';
export const DEMO_TIMEZONE = 'America/Sao_Paulo';

/**
 * PRNG determinístico (Mulberry32) com semente fixa.
 */
function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return {
    nextFloat(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, maxInclusive: number): number {
      return Math.floor(this.nextFloat() * (maxInclusive - min + 1)) + min;
    },
    nextUuid(): string {
      const hex = () => this.nextInt(0, 15).toString(16);
      const seg = (len: number) => Array.from({ length: len }, hex).join('');
      const variant = ['8', '9', 'a', 'b'][this.nextInt(0, 3)];
      return `${seg(8)}-${seg(4)}-4${seg(3)}-${variant}${seg(3)}-${seg(12)}`;
    },
  };
}

export interface SeedDemoOptions {
  days?: number;
  anchorDate?: string;
}

export interface SeedDemoResult {
  userId: string;
  email: string;
  password: string;
  days: number;
  anchorDate: string;
  subjectsCount: number;
  topicsCount: number;
  plannedSessionsCount: number;
  sessionsCount: number;
  goalsCount: number;
}

/**
 * Gera dados determinísticos de demonstração em lote (`createMany`) para `demo@estudos.local`.
 * Ordem de limpeza: `deleteMany` no `User` (Cascade em todas as tabelas filhas) + limpeza explícita reversa por segurança.
 * Ordem de inserção respeitando chaves estrangeiras:
 * 1. User -> 2. Subject -> 3. Topic (raízes -> filhos) -> 4. PlannedSession -> 5. PlannedBlock
 * -> 6. StudySession -> 7. SessionBlock -> 8. SessionEvent -> 9. PracticeRecord -> 10. SessionEvaluation -> 11. Goal.
 */
export async function seedDemoData(options: SeedDemoOptions = {}): Promise<SeedDemoResult> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SEED BLOQUEADO]: Não é permitido executar seed-sample-6m em ambiente de produção.');
    process.exit(1);
  }

  const days = options.days ?? 180;
  const anchorDate = options.anchorDate ?? utcToLocalDate(new Date(), DEMO_TIMEZONE);
  const rng = createSeededRng(20261020);

  // Limpeza isolada apenas do usuário demo
  const existingUser = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  if (existingUser) {
    await prisma.practiceRecord.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.sessionEvaluation.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.sessionEvent.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.sessionBlock.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.studySession.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.plannedBlock.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.plannedSession.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.goal.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.topic.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.subject.deleteMany({ where: { user_id: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  const userId = rng.nextUuid();
  const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 8);

  await prisma.user.create({
    data: {
      id: userId,
      email: DEMO_USER_EMAIL,
      name: 'Estudante Demo (6 Meses)',
      password_hash: passwordHash,
      timezone: DEMO_TIMEZONE,
      week_starts_on: 'MONDAY',
    },
  });

  // 2. Matérias
  const subjectDefs = [
    { id: rng.nextUuid(), name: 'Matemática e Raciocínio Lógico', color: '#3B82F6', archived: false },
    { id: rng.nextUuid(), name: 'Direito Constitucional', color: '#10B981', archived: false },
    { id: rng.nextUuid(), name: 'Língua Portuguesa', color: '#8B5CF6', archived: false },
    { id: rng.nextUuid(), name: 'Informática e Dados', color: '#F59E0B', archived: false },
  ];

  await prisma.subject.createMany({
    data: subjectDefs.map((s) => ({
      id: s.id,
      user_id: userId,
      name: s.name,
      color: s.color,
      archived: s.archived,
    })),
  });

  // 3. Tópicos (raízes e subassuntos)
  const rootTopics: Array<{ id: string; subject_id: string; parent_id: string | null; name: string; archived: boolean }> = [];
  const childTopics: Array<{ id: string; subject_id: string; parent_id: string | null; name: string; archived: boolean }> = [];

  const topicCatalog = [
    {
      subjectIdx: 0,
      roots: [
        { name: 'Álgebra e Funções', children: ['Funções do 1º e 2º Grau', 'Logaritmos e Exponenciais'] },
        { name: 'Probabilidade e Estatística', children: ['Análise Combinatória', 'Distribuição Binomial'] },
      ],
    },
    {
      subjectIdx: 1,
      roots: [
        { name: 'Direitos e Garantias Fundamentais', children: ['Direitos Individuais (Art. 5º)', 'Remédios Constitucionais'] },
        { name: 'Organização do Estado', children: ['Repartição de Competências', 'Administração Pública'] },
      ],
    },
    {
      subjectIdx: 2,
      roots: [
        { name: 'Sintaxe e Pontuação', children: ['Período Composto', 'Regência Verbal e Nominal'] },
        { name: 'Interpretação e Semântica', children: ['Coesão e Coerência', 'Tipologia Textual'] },
      ],
    },
    {
      subjectIdx: 3,
      roots: [
        { name: 'Banco de Dados e SQL', children: ['Modelagem Relacional', 'Consultas e Agregações SQL'] },
        { name: 'Redes e Segurança', children: ['Protocolos TCP/IP', 'Criptografia e Assinatura Digital'] },
      ],
    },
  ];

  for (const group of topicCatalog) {
    const subj = subjectDefs[group.subjectIdx];
    for (const r of group.roots) {
      const rootId = rng.nextUuid();
      rootTopics.push({
        id: rootId,
        subject_id: subj.id,
        parent_id: null,
        name: r.name,
        archived: false,
      });
      for (const cName of r.children) {
        childTopics.push({
          id: rng.nextUuid(),
          subject_id: subj.id,
          parent_id: rootId,
          name: cName,
          archived: false,
        });
      }
    }
  }

  await prisma.topic.createMany({
    data: rootTopics.map((t) => ({ ...t, user_id: userId })),
  });
  await prisma.topic.createMany({
    data: childTopics.map((t) => ({ ...t, user_id: userId })),
  });

  const allStudyTopics = [...childTopics, ...rootTopics];

  // 4 a 10. Histórico de `days` dias até `anchorDate`
  const plannedSessionsBatch: any[] = [];
  const plannedBlocksBatch: any[] = [];
  const studySessionsBatch: any[] = [];
  const sessionBlocksBatch: any[] = [];
  const sessionEventsBatch: any[] = [];
  const practiceRecordsBatch: any[] = [];
  const evaluationsBatch: any[] = [];

  const startLocalDate = addDaysToLocalDate(anchorDate, -(days - 1));

  for (let i = 0; i < days; i++) {
    const dayStr = addDaysToLocalDate(startLocalDate, i);
    // ~75% dos dias possuem estudo
    const isStudyDay = i === days - 1 || rng.nextFloat() < 0.75;
    if (!isStudyDay) continue;

    const sessionsInDay = rng.nextInt(1, 2);

    for (let sIdx = 0; sIdx < sessionsInDay; sIdx++) {
      const pickedTopic = allStudyTopics[(i * 3 + sIdx) % allStudyTopics.length];
      const hourStr = sIdx === 0 ? '09:00' : '19:00';
      const scheduledStart = localDateTimeToUtc(`${dayStr}T${hourStr}`, DEMO_TIMEZONE);

      const revMin = 15;
      const newMin = 30;
      const pracMin = 15;
      const totalPlannedMin = revMin + newMin + pracMin; // 60 min

      const plannedSessionId = rng.nextUuid();
      const isSkipped = i < days - 1 && sIdx === 1 && rng.nextFloat() < 0.12;

      plannedSessionsBatch.push({
        id: plannedSessionId,
        user_id: userId,
        subject_id: pickedTopic.subject_id,
        topic_id: pickedTopic.id,
        scheduled_start: scheduledStart,
        planned_minutes: totalPlannedMin,
        priority: sIdx === 0 ? 'HIGH' : 'MEDIUM',
        activity_type: 'PRACTICE',
        notes: 'Sessão gerada pelo seed de 6 meses.',
        status: isSkipped ? 'SKIPPED' : 'DONE',
      });

      const blockKinds: Array<{ kind: 'REVIEW' | 'NEW_CONTENT' | 'PRACTICE'; min: number }> = [
        { kind: 'REVIEW', min: revMin },
        { kind: 'NEW_CONTENT', min: newMin },
        { kind: 'PRACTICE', min: pracMin },
      ];

      blockKinds.forEach((bk, pos) => {
        plannedBlocksBatch.push({
          id: rng.nextUuid(),
          user_id: userId,
          planned_session_id: plannedSessionId,
          kind: bk.kind,
          planned_minutes: bk.min,
          position: pos,
        });
      });

      if (isSkipped) continue;

      // Cria StudySession FINISHED com máquina de estados válida
      const studySessionId = rng.nextUuid();
      const sessionStart = new Date(scheduledStart.getTime() + rng.nextInt(0, 5) * 60 * 1000);
      let cursorMs = sessionStart.getTime();

      for (let pos = 0; pos < blockKinds.length; pos++) {
        const bk = blockKinds[pos];
        const blockId = rng.nextUuid();
        const blockStart = new Date(cursorMs);
        const studyDurationSec = bk.min * 60 + rng.nextInt(-120, 180);
        const pauseSec = pos === 1 ? 180 : 0;

        sessionBlocksBatch.push({
          id: blockId,
          user_id: userId,
          study_session_id: studySessionId,
          kind: bk.kind,
          planned_minutes: bk.min,
          position: pos,
        });

        sessionEventsBatch.push({
          id: rng.nextUuid(),
          user_id: userId,
          study_session_id: studySessionId,
          block_id: blockId,
          type: 'BLOCK_START',
          occurred_at: blockStart,
          declared_seconds: null,
        });

        if (pauseSec > 0) {
          const pauseAt = new Date(cursorMs + 600 * 1000);
          const resumeAt = new Date(pauseAt.getTime() + pauseSec * 1000);
          sessionEventsBatch.push(
            {
              id: rng.nextUuid(),
              user_id: userId,
              study_session_id: studySessionId,
              block_id: blockId,
              type: 'PAUSE',
              occurred_at: pauseAt,
              declared_seconds: null,
            },
            {
              id: rng.nextUuid(),
              user_id: userId,
              study_session_id: studySessionId,
              block_id: blockId,
              type: 'RESUME',
              occurred_at: resumeAt,
              declared_seconds: null,
            }
          );
        }

        cursorMs += (studyDurationSec + pauseSec) * 1000;
        const blockFinish = new Date(cursorMs);

        sessionEventsBatch.push({
          id: rng.nextUuid(),
          user_id: userId,
          study_session_id: studySessionId,
          block_id: blockId,
          type: 'BLOCK_FINISH',
          occurred_at: blockFinish,
          declared_seconds: null,
        });

        if (bk.kind === 'PRACTICE') {
          const qCount = rng.nextInt(10, 25);
          const correctCount = Math.min(qCount, Math.max(4, Math.round(qCount * (0.65 + rng.nextFloat() * 0.3))));
          practiceRecordsBatch.push({
            id: rng.nextUuid(),
            user_id: userId,
            study_session_id: studySessionId,
            block_id: blockId,
            topic_id: pickedTopic.id,
            questions: qCount,
            correct: correctCount,
          });
        }

        cursorMs += 1000;
      }

      const sessionEnd = new Date(cursorMs);
      sessionEventsBatch.push({
        id: rng.nextUuid(),
        user_id: userId,
        study_session_id: studySessionId,
        block_id: null,
        type: 'SESSION_FINISH',
        occurred_at: sessionEnd,
        declared_seconds: null,
      });

      studySessionsBatch.push({
        id: studySessionId,
        user_id: userId,
        planned_session_id: plannedSessionId,
        topic_id: pickedTopic.id,
        started_at: sessionStart,
        ended_at: sessionEnd,
        status: 'FINISHED',
      });

      const levels = ['PARTIAL', 'GOOD', 'MASTERED'] as const;
      const focuses = ['MEDIUM', 'HIGH'] as const;
      const diffs = ['EASY', 'NORMAL', 'HARD'] as const;

      evaluationsBatch.push({
        id: rng.nextUuid(),
        user_id: userId,
        study_session_id: studySessionId,
        understanding: levels[i % levels.length],
        focus: focuses[i % focuses.length],
        difficulty: diffs[i % diffs.length],
        notes: 'Avaliação pós-sessão registrada.',
      });
    }
  }

  // Adiciona 1 sessão PLANNED hoje (às 22:30) e 1 amanhã (às 10:00) para ter próxima ação consistente no Dashboard
  const nextTodayId = rng.nextUuid();
  plannedSessionsBatch.push({
    id: nextTodayId,
    user_id: userId,
    subject_id: subjectDefs[0].id,
    topic_id: allStudyTopics[0].id,
    scheduled_start: localDateTimeToUtc(`${anchorDate}T22:30`, DEMO_TIMEZONE),
    planned_minutes: 60,
    priority: 'HIGH',
    activity_type: 'REVIEW',
    notes: 'Próxima sessão planejada de hoje.',
    status: 'PLANNED',
  });
  plannedBlocksBatch.push({
    id: rng.nextUuid(),
    user_id: userId,
    planned_session_id: nextTodayId,
    kind: 'REVIEW',
    planned_minutes: 60,
    position: 0,
  });

  const tomorrowDate = addDaysToLocalDate(anchorDate, 1);
  const nextTomorrowId = rng.nextUuid();
  plannedSessionsBatch.push({
    id: nextTomorrowId,
    user_id: userId,
    subject_id: subjectDefs[1].id,
    topic_id: allStudyTopics[2].id,
    scheduled_start: localDateTimeToUtc(`${tomorrowDate}T10:00`, DEMO_TIMEZONE),
    planned_minutes: 60,
    priority: 'MEDIUM',
    activity_type: 'NEW_CONTENT',
    notes: 'Sessão planejada para amanhã.',
    status: 'PLANNED',
  });
  plannedBlocksBatch.push({
    id: rng.nextUuid(),
    user_id: userId,
    planned_session_id: nextTomorrowId,
    kind: 'NEW_CONTENT',
    planned_minutes: 60,
    position: 0,
  });

  // 11. Metas (Diária, Semanal e Mensal ancoradas em anchorDate)
  const dayStart = normalizeGoalPeriodStart(anchorDate, 'DAY', 1);
  const weekStart = normalizeGoalPeriodStart(anchorDate, 'WEEK', 1);
  const monthStart = normalizeGoalPeriodStart(anchorDate, 'MONTH', 1);

  const goalsBatch = [
    {
      id: rng.nextUuid(),
      user_id: userId,
      kind: 'EFFORT' as const,
      metric: 'EFFECTIVE_MINUTES' as const,
      period: 'DAY' as const,
      period_start_local_date: dayStart,
      target_value: 90,
      subject_id: null,
      topic_id: null,
    },
    {
      id: rng.nextUuid(),
      user_id: userId,
      kind: 'EFFORT' as const,
      metric: 'EFFECTIVE_MINUTES' as const,
      period: 'WEEK' as const,
      period_start_local_date: weekStart,
      target_value: 360,
      subject_id: null,
      topic_id: null,
    },
    {
      id: rng.nextUuid(),
      user_id: userId,
      kind: 'EFFORT' as const,
      metric: 'QUESTIONS' as const,
      period: 'WEEK' as const,
      period_start_local_date: weekStart,
      target_value: 80,
      subject_id: subjectDefs[0].id,
      topic_id: null,
    },
    {
      id: rng.nextUuid(),
      user_id: userId,
      kind: 'RESULT' as const,
      metric: 'ACCURACY' as const,
      period: 'MONTH' as const,
      period_start_local_date: monthStart,
      target_value: 75,
      subject_id: null,
      topic_id: null,
    },
  ];

  // Inserções em lote na ordem estrita das FKs
  await prisma.plannedSession.createMany({ data: plannedSessionsBatch });
  await prisma.plannedBlock.createMany({ data: plannedBlocksBatch });
  await prisma.studySession.createMany({ data: studySessionsBatch });
  await prisma.sessionBlock.createMany({ data: sessionBlocksBatch });
  await prisma.sessionEvent.createMany({ data: sessionEventsBatch });
  await prisma.practiceRecord.createMany({ data: practiceRecordsBatch });
  await prisma.sessionEvaluation.createMany({ data: evaluationsBatch });
  await prisma.goal.createMany({ data: goalsBatch });

  return {
    userId,
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    days,
    anchorDate,
    subjectsCount: subjectDefs.length,
    topicsCount: allStudyTopics.length,
    plannedSessionsCount: plannedSessionsBatch.length,
    sessionsCount: studySessionsBatch.length,
    goalsCount: goalsBatch.length,
  };
}

// Execução direta via CLI (`npm run seed:sample-6m`)
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && currentFilePath.endsWith(process.argv[1].replace(/^.*[\\/]/, ''))) {
  seedDemoData({ days: 180 })
    .then((res) => {
      console.log(
        `[SEED 6 MESES CONCLUÍDO]: Usuário ${res.email} (senha: ${res.password}) populado com ${res.sessionsCount} sessões em ${res.days} dias (âncora: ${res.anchorDate}).`
      );
    })
    .catch((err) => {
      console.error('[ERRO NO SEED 6 MESES]:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
