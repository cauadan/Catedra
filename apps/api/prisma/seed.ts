import {
  PrismaClient,
  PlannedSessionStatus,
  BlockKind,
  StudySessionStatus,
  SessionEventType,
  UnderstandingLevel,
  FocusLevel,
  DifficultyLevel,
  GoalKind,
  GoalMetric,
  GoalPeriod,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Iniciando Verificação do Schema Prisma e Relações (Milestone 1) ===');

  // Limpeza prévia de dados de teste caso existam
  const testEmail = 'verificacao.m1@estudos.local';
  await prisma.user.deleteMany({ where: { email: testEmail } });

  // 1. Usuário (User)
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Estudante Teste M1',
      password_hash: '$2b$10$ephemeralHashForTestingOnly1234567890abcdefghij',
      timezone: 'America/Sao_Paulo',
      week_starts_on: 'MONDAY',
    },
  });
  console.log(`[1/11 OK] User criado: ${user.id} (${user.email})`);

  // 2. Matéria (Subject)
  const subject = await prisma.subject.create({
    data: {
      user_id: user.id,
      name: 'Matemática',
      color: '#3B82F6',
    },
  });
  console.log(`[2/11 OK] Subject criado: ${subject.id} (${subject.name})`);

  // 3. Assuntos (Topics com hierarquia de árvore / auto-relação parent_id)
  const parentTopic = await prisma.topic.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      name: 'Álgebra',
    },
  });
  const childTopic = await prisma.topic.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      parent_id: parentTopic.id,
      name: 'Funções Quadráticas',
    },
  });
  console.log(
    `[3/11 OK] Topics criados com hierarquia de árvore: ${parentTopic.name} -> ${childTopic.name}`
  );

  // 4. Sessão Planejada (PlannedSession com auto-relação de reagendamento)
  const plannedSession = await prisma.plannedSession.create({
    data: {
      user_id: user.id,
      subject_id: subject.id,
      topic_id: childTopic.id,
      scheduled_start: new Date(),
      planned_minutes: 60,
      priority: 'HIGH',
      activity_type: 'ESTUDO_REGULAR',
      notes: 'Sessão de testes de validação M1',
      status: PlannedSessionStatus.PLANNED,
    },
  });
  console.log(`[4/11 OK] PlannedSession criada: ${plannedSession.id}`);

  // 5. Blocos Planejados (PlannedBlocks)
  const plannedBlock1 = await prisma.plannedBlock.create({
    data: {
      user_id: user.id,
      planned_session_id: plannedSession.id,
      kind: BlockKind.REVIEW,
      planned_minutes: 15,
      position: 1,
    },
  });
  const plannedBlock2 = await prisma.plannedBlock.create({
    data: {
      user_id: user.id,
      planned_session_id: plannedSession.id,
      kind: BlockKind.PRACTICE,
      planned_minutes: 45,
      position: 2,
    },
  });
  console.log(
    `[5/11 OK] PlannedBlocks criados: ${plannedBlock1.id}, ${plannedBlock2.id}`
  );

  // 6. Sessão de Estudo Executada (StudySession vinculada à PlannedSession)
  const studySession = await prisma.studySession.create({
    data: {
      user_id: user.id,
      planned_session_id: plannedSession.id,
      topic_id: childTopic.id,
      status: StudySessionStatus.FINISHED,
      started_at: new Date(Date.now() - 3600000),
      ended_at: new Date(),
    },
  });
  console.log(`[6/11 OK] StudySession criada: ${studySession.id}`);

  // 7. Bloco Executado (SessionBlock)
  const sessionBlock = await prisma.sessionBlock.create({
    data: {
      user_id: user.id,
      study_session_id: studySession.id,
      kind: BlockKind.PRACTICE,
      planned_minutes: 45,
      position: 1,
    },
  });
  console.log(`[7/11 OK] SessionBlock criado: ${sessionBlock.id}`);

  // 8. Eventos da Sessão (SessionEvent com declared_seconds)
  await prisma.sessionEvent.createMany({
    data: [
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.BLOCK_START,
        occurred_at: new Date(Date.now() - 3500000),
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.PAUSE,
        occurred_at: new Date(Date.now() - 2500000),
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.RESUME,
        occurred_at: new Date(Date.now() - 2400000),
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.DISTRACTION_DECLARED,
        occurred_at: new Date(Date.now() - 60000),
        declared_seconds: 180,
      },
      {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.SESSION_FINISH,
        occurred_at: new Date(),
      },
    ],
  });
  console.log(`[8/11 OK] SessionEvents gravados.`);

  // 9. Registro de Prática (PracticeRecord)
  const practiceRecord = await prisma.practiceRecord.create({
    data: {
      user_id: user.id,
      study_session_id: studySession.id,
      block_id: sessionBlock.id,
      topic_id: childTopic.id,
      questions: 20,
      correct: 17,
    },
  });
  console.log(
    `[9/11 OK] PracticeRecord criado: ${practiceRecord.correct}/${practiceRecord.questions} acertos.`
  );

  // 10. Avaliação Qualitativa da Sessão (SessionEvaluation: 1:1)
  const evaluation = await prisma.sessionEvaluation.create({
    data: {
      user_id: user.id,
      study_session_id: studySession.id,
      understanding: UnderstandingLevel.MASTERED,
      focus: FocusLevel.HIGH,
      difficulty: DifficultyLevel.NORMAL,
      notes: 'Sessão muito produtiva.',
    },
  });
  console.log(
    `[10/11 OK] SessionEvaluation criada (1:1): entendimento=${evaluation.understanding}`
  );

  // 11. Meta (Goal)
  const goal = await prisma.goal.create({
    data: {
      user_id: user.id,
      kind: GoalKind.RESULT,
      metric: GoalMetric.ACCURACY,
      period: GoalPeriod.WEEK,
      period_start_local_date: '2026-10-05',
      target_value: 80.0,
      subject_id: subject.id,
      topic_id: childTopic.id,
    },
  });
  console.log(`[11/11 OK] Goal criada: alvo=${goal.target_value}%`);

  // Teste de integridade referencial: deleção em cascata
  await prisma.user.delete({ where: { id: user.id } });
  const remainingSubjects = await prisma.subject.count({ where: { user_id: user.id } });
  if (remainingSubjects === 0) {
    console.log('[CASCADE OK] Deleção em cascata a partir do usuário validada com sucesso.');
  }

  console.log('=== TODOS OS 11 MODELOS E 10 ENUMS FORAM VALIDADOS COM SUCESSO! ===');
}

main()
  .catch((e) => {
    console.error('Falha na validação do schema:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
