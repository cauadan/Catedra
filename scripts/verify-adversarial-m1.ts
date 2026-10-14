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
  Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      details: 'Passou com sucesso',
      durationMs: Date.now() - start,
    });
    console.log(`[PASS] ${name} (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      details: error?.message || String(error),
      durationMs: Date.now() - start,
    });
    console.error(`[FAIL] ${name} (${Date.now() - start}ms):`, error?.message || error);
  }
}

async function main() {
  console.log('================================================================');
  console.log('BATERIA DE TESTES ADVERSARIAIS - MARCO 1 (BANCO DE DADOS & PRISMA)');
  console.log('================================================================\n');

  // Prefixo único para isolar e limpar dados de teste
  const runId = Math.random().toString(36).substring(2, 8);
  const testEmailPrefix = `adv_${runId}_`;

  // Limpeza preventiva
  await prisma.user.deleteMany({
    where: { email: { startsWith: 'adv_' } },
  });

  // TESTE 1: Validação do formato e unicidade de UUIDs gerados automaticamente
  await runTest('1. Validação de formato UUID v4 em modelos do schema', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}uuid@teste.local`,
        name: 'Usuário Teste UUID',
        password_hash: 'hash_uuid_teste',
      },
    });

    if (!UUID_REGEX.test(user.id)) {
      throw new Error(`User ID inválido como UUID v4: ${user.id}`);
    }

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria UUID',
        color: '#10B981',
      },
    });

    if (!UUID_REGEX.test(subject.id)) {
      throw new Error(`Subject ID inválido como UUID v4: ${subject.id}`);
    }

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico UUID',
      },
    });

    if (!UUID_REGEX.test(topic.id)) {
      throw new Error(`Topic ID inválido como UUID v4: ${topic.id}`);
    }

    const plannedSession = await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start: new Date(),
        planned_minutes: 45,
      },
    });

    if (!UUID_REGEX.test(plannedSession.id)) {
      throw new Error(`PlannedSession ID inválido como UUID v4: ${plannedSession.id}`);
    }

    const studySession = await prisma.studySession.create({
      data: {
        user_id: user.id,
        topic_id: topic.id,
      },
    });

    if (!UUID_REGEX.test(studySession.id)) {
      throw new Error(`StudySession ID inválido como UUID v4: ${studySession.id}`);
    }

    const sessionEval = await prisma.sessionEvaluation.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        understanding: UnderstandingLevel.GOOD,
        focus: FocusLevel.MEDIUM,
        difficulty: DifficultyLevel.NORMAL,
      },
    });

    if (!UUID_REGEX.test(sessionEval.id)) {
      throw new Error(`SessionEvaluation ID inválido como UUID v4: ${sessionEval.id}`);
    }

    // Limpeza
    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 2: Restrição onDelete: Restrict com PlannedSession vinculada ao Topic
  await runTest('2. onDelete: Restrict impede exclusão de Topic com PlannedSession vinculada', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}restrict1@teste.local`,
        name: 'Usuário Restrict 1',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria Restrict 1',
        color: '#EF4444',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico com Sessão Planejada',
      },
    });

    await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start: new Date(),
        planned_minutes: 60,
      },
    });

    let failedAsExpected = false;
    try {
      await prisma.topic.delete({ where: { id: topic.id } });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        failedAsExpected = true;
      } else if (String(err).includes('Foreign key constraint failed') || String(err).includes('violates foreign key constraint')) {
        failedAsExpected = true;
      } else {
        throw new Error(`Erro inesperado ao tentar deletar: ${err.message}`);
      }
    }

    if (!failedAsExpected) {
      throw new Error('Falha de segurança relacional: o Topic com PlannedSession foi deletado indevidamente!');
    }

    // Verificar se o Topic continua intacto no banco
    const topicStillExists = await prisma.topic.findUnique({ where: { id: topic.id } });
    if (!topicStillExists) {
      throw new Error('O Topic desapareceu do banco de dados após a tentativa de exclusão!');
    }

    // Limpeza em cascata pelo User
    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 3: Restrição onDelete: Restrict com StudySession vinculada ao Topic
  await runTest('3. onDelete: Restrict impede exclusão de Topic com StudySession vinculada', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}restrict2@teste.local`,
        name: 'Usuário Restrict 2',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria Restrict 2',
        color: '#3B82F6',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico com StudySession',
      },
    });

    await prisma.studySession.create({
      data: {
        user_id: user.id,
        topic_id: topic.id,
      },
    });

    let failedAsExpected = false;
    try {
      await prisma.topic.delete({ where: { id: topic.id } });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        failedAsExpected = true;
      } else if (String(err).includes('violates foreign key constraint')) {
        failedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!failedAsExpected) {
      throw new Error('Falha de segurança relacional: o Topic com StudySession foi excluído indevidamente!');
    }

    // Limpeza
    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 4: Restrição onDelete: Restrict com PracticeRecord vinculado ao Topic
  await runTest('4. onDelete: Restrict impede exclusão de Topic com PracticeRecord vinculado', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}restrict3@teste.local`,
        name: 'Usuário Restrict 3',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria Restrict 3',
        color: '#F59E0B',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico com Questões',
      },
    });

    const studySession = await prisma.studySession.create({
      data: {
        user_id: user.id,
        topic_id: topic.id,
      },
    });

    await prisma.practiceRecord.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        topic_id: topic.id,
        questions: 10,
        correct: 8,
      },
    });

    let failedAsExpected = false;
    try {
      await prisma.topic.delete({ where: { id: topic.id } });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        failedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!failedAsExpected) {
      throw new Error('Falha de segurança: Topic com PracticeRecord foi excluído!');
    }

    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 5: Proteção de árvore hierárquica (tentar excluir pai quando filho possui sessão)
  await runTest('5. Exclusão de Tópico Pai falha quando Tópico Filho possui sessão vinculada', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}tree_restrict@teste.local`,
        name: 'Usuário Hierarquia',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria Hierarquia',
        color: '#8B5CF6',
      },
    });

    const parentTopic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico Pai (Raiz)',
      },
    });

    const childTopic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        parent_id: parentTopic.id,
        name: 'Tópico Filho',
      },
    });

    // Vincula StudySession ao filho
    await prisma.studySession.create({
      data: {
        user_id: user.id,
        topic_id: childTopic.id,
      },
    });

    // Tentar deletar o pai: como pai faria cascade para o filho, e o filho está bloqueado por Restrict,
    // a operação inteira no banco de dados deve ser abortada pelo PostgreSQL!
    let failedAsExpected = false;
    try {
      await prisma.topic.delete({ where: { id: parentTopic.id } });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        failedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!failedAsExpected) {
      throw new Error('Falha crítica: Exclusão do pai apagou ou causou inconsistência com o filho que possuía sessões!');
    }

    // Confirmar que ambos pai e filho continuam íntegros no banco
    const parentStillExists = await prisma.topic.findUnique({ where: { id: parentTopic.id } });
    const childStillExists = await prisma.topic.findUnique({ where: { id: childTopic.id } });
    if (!parentStillExists || !childStillExists) {
      throw new Error('Inconsistência: pai ou filho foi deletado parcialmente!');
    }

    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 6: Tentativa de exclusão de Subject quando tópicos possuem StudySession
  await runTest('6. Exclusão de Subject falha quando tópicos possuem StudySession', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}subject_restrict@teste.local`,
        name: 'Usuário Subject Restrict',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria Protegida',
        color: '#EC4899',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico com Sessão',
      },
    });

    await prisma.studySession.create({
      data: {
        user_id: user.id,
        topic_id: topic.id,
      },
    });

    // Tentar excluir a matéria: como a matéria faria cascade para o tópico,
    // e o tópico é referenciado com Restrict pela StudySession, o PostgreSQL deve abortar!
    let failedAsExpected = false;
    try {
      await prisma.subject.delete({ where: { id: subject.id } });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        failedAsExpected = true;
      } else {
        throw err;
      }
    }

    if (!failedAsExpected) {
      throw new Error('Falha crítica: Exclusão de Subject apagou tópicos que tinham StudySession!');
    }

    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 7: Verificação de onDelete: SetNull (reschedule, planned_session_id, block_id, goals)
  await runTest('7. onDelete: SetNull em relações opcionais', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}setnull@teste.local`,
        name: 'Usuário SetNull',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'Matéria SetNull',
        color: '#6366F1',
      },
    });

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico SetNull',
      },
    });

    // 7A: Reagendamento de PlannedSession (rescheduled_from_id)
    const sessionOriginal = await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start: new Date(),
        planned_minutes: 30,
        status: PlannedSessionStatus.RESCHEDULED,
      },
    });

    const sessionNova = await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start: new Date(Date.now() + 86400000),
        planned_minutes: 30,
        rescheduled_from_id: sessionOriginal.id,
      },
    });

    // Ao deletar a sessão original, o rescheduled_from_id da nova sessão deve virar null
    await prisma.plannedSession.delete({ where: { id: sessionOriginal.id } });
    const sessionNovaAtualizada = await prisma.plannedSession.findUnique({
      where: { id: sessionNova.id },
    });

    if (sessionNovaAtualizada?.rescheduled_from_id !== null) {
      throw new Error(`Esperado null em rescheduled_from_id, obtido: ${sessionNovaAtualizada?.rescheduled_from_id}`);
    }

    // 7B: StudySession vinculada a PlannedSession
    const plannedParaStudy = await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start: new Date(),
        planned_minutes: 40,
      },
    });

    const studySession = await prisma.studySession.create({
      data: {
        user_id: user.id,
        topic_id: topic.id,
        planned_session_id: plannedParaStudy.id,
      },
    });

    // Deleta a planned session
    await prisma.plannedSession.delete({ where: { id: plannedParaStudy.id } });
    const studyAtualizada = await prisma.studySession.findUnique({
      where: { id: studySession.id },
    });

    if (studyAtualizada?.planned_session_id !== null) {
      throw new Error(`Esperado null em planned_session_id, obtido: ${studyAtualizada?.planned_session_id}`);
    }

    // 7C: SessionBlock deletado -> block_id em SessionEvent e PracticeRecord deve virar null
    const sessionBlock = await prisma.sessionBlock.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        kind: BlockKind.REVIEW,
        planned_minutes: 20,
        position: 1,
      },
    });

    const event = await prisma.sessionEvent.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.BLOCK_START,
      },
    });

    const practice = await prisma.practiceRecord.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        topic_id: topic.id,
        questions: 5,
        correct: 4,
      },
    });

    // Deletar o bloco
    await prisma.sessionBlock.delete({ where: { id: sessionBlock.id } });

    const eventAtualizado = await prisma.sessionEvent.findUnique({ where: { id: event.id } });
    const practiceAtualizado = await prisma.practiceRecord.findUnique({ where: { id: practice.id } });

    if (eventAtualizado?.block_id !== null) {
      throw new Error(`Esperado null em event.block_id, obtido: ${eventAtualizado?.block_id}`);
    }
    if (practiceAtualizado?.block_id !== null) {
      throw new Error(`Esperado null em practice.block_id, obtido: ${practiceAtualizado?.block_id}`);
    }

    // 7D: Goal com subject_id e topic_id -> quando topic ou subject são deletados (sem restrição), goal mantém registro com null
    const topicLivre = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Tópico Livre Sem Sessões',
      },
    });

    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        kind: GoalKind.EFFORT,
        metric: GoalMetric.EFFECTIVE_MINUTES,
        period: GoalPeriod.DAY,
        period_start_local_date: '2026-10-06',
        target_value: 120,
        subject_id: subject.id,
        topic_id: topicLivre.id,
      },
    });

    // Deleta o topic livre
    await prisma.topic.delete({ where: { id: topicLivre.id } });
    const goalAposTopic = await prisma.goal.findUnique({ where: { id: goal.id } });
    if (goalAposTopic?.topic_id !== null) {
      throw new Error(`Esperado null em goal.topic_id, obtido: ${goalAposTopic?.topic_id}`);
    }

    await prisma.user.delete({ where: { id: user.id } });
  });

  // TESTE 8: Validação de Unicidade (Unique Constraints)
  await runTest('8. Restrições de unicidade (@unique) no banco', async () => {
    const user1 = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}unique@teste.local`,
        name: 'Usuário Unique 1',
        password_hash: 'hash',
      },
    });

    // 8A: E-mail duplicado
    let duplicateEmailFailed = false;
    try {
      await prisma.user.create({
        data: {
          email: `${testEmailPrefix}unique@teste.local`,
          name: 'Usuário Unique Duplicado',
          password_hash: 'hash',
        },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        duplicateEmailFailed = true;
      }
    }

    if (!duplicateEmailFailed) {
      throw new Error('Falha: Inserção de e-mail duplicado foi permitida!');
    }

    // 8B: SessionEvaluation 1:1 duplicada (mesmo study_session_id)
    const subject = await prisma.subject.create({
      data: { user_id: user1.id, name: 'Matéria Unicidade', color: '#14B8A6' },
    });
    const topic = await prisma.topic.create({
      data: { user_id: user1.id, subject_id: subject.id, name: 'Tópico Unicidade' },
    });
    const studySession = await prisma.studySession.create({
      data: { user_id: user1.id, topic_id: topic.id },
    });

    await prisma.sessionEvaluation.create({
      data: {
        user_id: user1.id,
        study_session_id: studySession.id,
        understanding: UnderstandingLevel.GOOD,
        focus: FocusLevel.HIGH,
        difficulty: DifficultyLevel.NORMAL,
      },
    });

    let duplicateEvalFailed = false;
    try {
      await prisma.sessionEvaluation.create({
        data: {
          user_id: user1.id,
          study_session_id: studySession.id,
          understanding: UnderstandingLevel.NONE,
          focus: FocusLevel.LOW,
          difficulty: DifficultyLevel.HARD,
        },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        duplicateEvalFailed = true;
      }
    }

    if (!duplicateEvalFailed) {
      throw new Error('Falha: Inserção de avaliação duplicada (violação da relação 1:1) foi permitida!');
    }

    await prisma.user.delete({ where: { id: user1.id } });
  });

  // TESTE 9: Deleção em cascata total a partir do User (11 tabelas)
  await runTest('9. Deleção em cascata total (onDelete: Cascade) em todos os 11 modelos', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}full_cascade@teste.local`,
        name: 'Usuário Cascata Total',
        password_hash: 'hash',
      },
    });

    const subject = await prisma.subject.create({
      data: { user_id: user.id, name: 'Matemática', color: '#3B82F6' },
    });
    const parentTopic = await prisma.topic.create({
      data: { user_id: user.id, subject_id: subject.id, name: 'Álgebra' },
    });
    const childTopic = await prisma.topic.create({
      data: { user_id: user.id, subject_id: subject.id, parent_id: parentTopic.id, name: 'Matrizes' },
    });

    const plannedSession = await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: childTopic.id,
        scheduled_start: new Date(),
        planned_minutes: 60,
      },
    });

    const plannedBlock = await prisma.plannedBlock.create({
      data: {
        user_id: user.id,
        planned_session_id: plannedSession.id,
        kind: BlockKind.NEW_CONTENT,
        planned_minutes: 30,
        position: 1,
      },
    });

    const studySession = await prisma.studySession.create({
      data: {
        user_id: user.id,
        planned_session_id: plannedSession.id,
        topic_id: childTopic.id,
      },
    });

    const sessionBlock = await prisma.sessionBlock.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        kind: BlockKind.NEW_CONTENT,
        planned_minutes: 30,
        position: 1,
      },
    });

    const sessionEvent = await prisma.sessionEvent.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        type: SessionEventType.BLOCK_START,
      },
    });

    const practiceRecord = await prisma.practiceRecord.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        block_id: sessionBlock.id,
        topic_id: childTopic.id,
        questions: 15,
        correct: 13,
      },
    });

    const sessionEval = await prisma.sessionEvaluation.create({
      data: {
        user_id: user.id,
        study_session_id: studySession.id,
        understanding: UnderstandingLevel.MASTERED,
        focus: FocusLevel.HIGH,
        difficulty: DifficultyLevel.EASY,
      },
    });

    const goal = await prisma.goal.create({
      data: {
        user_id: user.id,
        kind: GoalKind.EFFORT,
        metric: GoalMetric.EFFECTIVE_MINUTES,
        period: GoalPeriod.WEEK,
        period_start_local_date: '2026-10-05',
        target_value: 300,
        subject_id: subject.id,
        topic_id: childTopic.id,
      },
    });

    // Deletar o usuário raiz
    await prisma.user.delete({ where: { id: user.id } });

    // Verificar se sobrou QUALQUER registro nas 11 tabelas para este user_id
    const counts = await Promise.all([
      prisma.subject.count({ where: { user_id: user.id } }),
      prisma.topic.count({ where: { user_id: user.id } }),
      prisma.plannedSession.count({ where: { user_id: user.id } }),
      prisma.plannedBlock.count({ where: { user_id: user.id } }),
      prisma.studySession.count({ where: { user_id: user.id } }),
      prisma.sessionBlock.count({ where: { user_id: user.id } }),
      prisma.sessionEvent.count({ where: { user_id: user.id } }),
      prisma.practiceRecord.count({ where: { user_id: user.id } }),
      prisma.sessionEvaluation.count({ where: { user_id: user.id } }),
      prisma.goal.count({ where: { user_id: user.id } }),
    ]);

    const totalRemaining = counts.reduce((acc, c) => acc + c, 0);
    if (totalRemaining > 0) {
      throw new Error(`Sobraram ${totalRemaining} registros vinculados ao usuário após deleção em cascata! Contagens: ${counts.join(', ')}`);
    }
  });

  // TESTE 10: Integridade de Enums e valores padrão
  await runTest('10. Valores padrão de fuso horário, semana e enums', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testEmailPrefix}defaults@teste.local`,
        name: 'Usuário Padrões',
        password_hash: 'hash',
      },
    });

    if (user.timezone !== 'America/Sao_Paulo') {
      throw new Error(`Padrão de timezone incorreto: esperado America/Sao_Paulo, obtido ${user.timezone}`);
    }
    if (user.week_starts_on !== 'MONDAY') {
      throw new Error(`Padrão de week_starts_on incorreto: esperado MONDAY, obtido ${user.week_starts_on}`);
    }

    const subject = await prisma.subject.create({
      data: {
        user_id: user.id,
        name: 'História',
        color: '#F97316',
      },
    });
    if (subject.archived !== false) {
      throw new Error(`Padrão de subject.archived incorreto: esperado false, obtido ${subject.archived}`);
    }

    const topic = await prisma.topic.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        name: 'Idade Antiga',
      },
    });
    if (topic.archived !== false) {
      throw new Error(`Padrão de topic.archived incorreto: esperado false, obtido ${topic.archived}`);
    }

    const plannedSession = await prisma.plannedSession.create({
      data: {
        user_id: user.id,
        subject_id: subject.id,
        topic_id: topic.id,
        scheduled_start: new Date(),
        planned_minutes: 50,
      },
    });
    if (plannedSession.priority !== 'MEDIUM') {
      throw new Error(`Padrão de priority incorreto: esperado MEDIUM, obtido ${plannedSession.priority}`);
    }
    if (plannedSession.status !== PlannedSessionStatus.PLANNED) {
      throw new Error(`Padrão de status incorreto: esperado PLANNED, obtido ${plannedSession.status}`);
    }

    await prisma.user.delete({ where: { id: user.id } });
  });

  console.log('\n================================================================');
  console.log('RESUMO DOS RESULTADOS:');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'APROVADO' : 'FALHOU'}] ${r.name} (${r.durationMs}ms)`);
    if (!r.passed) {
      console.log(`   Detalhes: ${r.details}`);
    }
  });
  console.log('================================================================');
  console.log(`STATUS FINAL: ${allPassed ? 'TODOS OS TESTES PASSARAM COM SUCESSO' : 'EXISTEM FALHAS'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Erro fatal durante execução:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
