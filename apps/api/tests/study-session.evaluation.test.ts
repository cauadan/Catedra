import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createStudyUser } from './helpers/study-fixtures.js';

describe('Study Session API: Post-Session Evaluation and Practice Records (@estudos/api)', () => {
  let user: Awaited<ReturnType<typeof createStudyUser>>;
  let otherUser: Awaited<ReturnType<typeof createStudyUser>>;
  let topic2: any;

  beforeAll(async () => {
    user = await createStudyUser('EvalUser');
    otherUser = await createStudyUser('EvalOtherUser');

    topic2 = await prisma.topic.create({
      data: {
        user_id: user.user.id,
        subject_id: user.subject.id,
        name: 'Segundo Assunto Prática',
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [user.user.id, otherUser.user.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deve rejeitar avaliação se a sessão estiver IN_PROGRESS com 409 SESSION_NOT_FINISHED', async () => {
    const resCreate = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user.cookie)
      .send({
        topic_id: user.topic.id,
        blocks: [{ kind: 'REVIEW', planned_minutes: 10 }],
      });
    const sessionId = resCreate.body.data.id;

    const resEval = await request(app)
      .post(`/api/study-sessions/${sessionId}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
      });

    expect(resEval.status).toBe(409);
    expect(resEval.body.error.code).toBe('SESSION_NOT_FINISHED');

    // Cancelar para liberar o usuário para os próximos testes
    await request(app)
      .post(`/api/study-sessions/${sessionId}/cancel`)
      .set('Cookie', user.cookie);
  });

  it('deve avaliar com sucesso sessão FINISHED com bloco PRACTICE, descartar questions === 0 e associar block_id', async () => {
    // 1. Criar sessão com REVIEW e PRACTICE
    const resCreate = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user.cookie)
      .send({
        topic_id: user.topic.id,
        blocks: [
          { kind: 'REVIEW', planned_minutes: 10 },
          { kind: 'PRACTICE', planned_minutes: 20 },
        ],
      });
    const session = resCreate.body.data;
    const practiceBlock = session.session_blocks.find((b: any) => b.kind === 'PRACTICE');

    // 2. Concluir a sessão
    await request(app)
      .post(`/api/study-sessions/${session.id}/finish`)
      .set('Cookie', user.cookie);

    // 3. Avaliar enviando 3 registros de prática:
    // - um válido para topic 1 (10 questões, 8 acertos) sem block_id
    // - um com questions === 0 para topic 2 (deve ser descartado)
    // - um válido para topic 2 (5 questões, 5 acertos) sem block_id
    const resEval = await request(app)
      .post(`/api/study-sessions/${session.id}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'MASTERED',
        focus: 'HIGH',
        difficulty: 'EASY',
        notes: 'Excelente sessão de revisão e exercícios.',
        practice_records: [
          { topic_id: user.topic.id, questions: 10, correct: 8 },
          { topic_id: topic2.id, questions: 0, correct: 0 },
          { topic_id: topic2.id, questions: 5, correct: 5 },
        ],
      });

    expect(resEval.status).toBe(201);
    const updated = resEval.body.data;
    expect(updated.evaluation).toBeDefined();
    expect(updated.evaluation.understanding).toBe('MASTERED');

    // Apenas 2 registros devem ter sido persistidos no banco
    expect(updated.practice_records).toHaveLength(2);
    for (const pr of updated.practice_records) {
      expect(pr.block_id).toBe(practiceBlock.id);
      expect(pr.questions).toBeGreaterThan(0);
    }

    // GET /pending-evaluation não deve mais retornar esta sessão
    const resPending = await request(app)
      .get('/api/study-sessions/pending-evaluation')
      .set('Cookie', user.cookie);
    expect(resPending.body.data).toBeNull();
  });

  it('deve aplicar fallback para o último SessionBlock por position caso a sessão não possua bloco PRACTICE', async () => {
    // Criar sessão apenas com REVIEW e NEW_CONTENT
    const resCreate = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user.cookie)
      .send({
        topic_id: user.topic.id,
        blocks: [
          { kind: 'REVIEW', planned_minutes: 10 },
          { kind: 'NEW_CONTENT', planned_minutes: 20 },
        ],
      });
    const session = resCreate.body.data;
    const lastBlock = session.session_blocks[1]; // NEW_CONTENT (position 2)

    await request(app)
      .post(`/api/study-sessions/${session.id}/finish`)
      .set('Cookie', user.cookie);

    const resEval = await request(app)
      .post(`/api/study-sessions/${session.id}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'GOOD',
        focus: 'MEDIUM',
        difficulty: 'NORMAL',
        practice_records: [{ topic_id: user.topic.id, questions: 4, correct: 3 }],
      });

    expect(resEval.status).toBe(201);
    expect(resEval.body.data.practice_records).toHaveLength(1);
    expect(resEval.body.data.practice_records[0].block_id).toBe(lastBlock.id);
  });

  it('deve rejeitar avaliação duplicada com 409 EVALUATION_ALREADY_EXISTS', async () => {
    // Pegar a última sessão avaliada de user
    const evalSession = await prisma.studySession.findFirst({
      where: { user_id: user.user.id, evaluation: { isNot: null } },
    });

    const resEval = await request(app)
      .post(`/api/study-sessions/${evalSession!.id}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'NONE',
        focus: 'LOW',
        difficulty: 'HARD',
      });

    expect(resEval.status).toBe(409);
    expect(resEval.body.error.code).toBe('EVALUATION_ALREADY_EXISTS');
  });

  it('deve validar prática: rejeitar correct > questions (400), topic de outro usuário (404) ou block de outra sessão (404)', async () => {
    // Criar sessão FINISHED
    const resCreate = await request(app)
      .post('/api/study-sessions')
      .set('Cookie', user.cookie)
      .send({
        topic_id: user.topic.id,
        blocks: [{ kind: 'REVIEW', planned_minutes: 10 }],
      });
    const session = resCreate.body.data;
    await request(app)
      .post(`/api/study-sessions/${session.id}/finish`)
      .set('Cookie', user.cookie);

    // 1. correct > questions -> 400
    const resInvalidCorrect = await request(app)
      .post(`/api/study-sessions/${session.id}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
        practice_records: [{ topic_id: user.topic.id, questions: 5, correct: 6 }],
      });
    expect(resInvalidCorrect.status).toBe(400);

    // 2. topic_id de outro usuário -> 404
    const resOtherTopic = await request(app)
      .post(`/api/study-sessions/${session.id}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
        practice_records: [{ topic_id: otherUser.topic.id, questions: 5, correct: 5 }],
      });
    expect(resOtherTopic.status).toBe(404);

    // 3. block_id de outra sessão -> 404
    const resOtherBlock = await request(app)
      .post(`/api/study-sessions/${session.id}/evaluation`)
      .set('Cookie', user.cookie)
      .send({
        understanding: 'GOOD',
        focus: 'HIGH',
        difficulty: 'NORMAL',
        practice_records: [{ block_id: '00000000-0000-0000-0000-000000000000', topic_id: user.topic.id, questions: 5, correct: 5 }],
      });
    expect(resOtherBlock.status).toBe(404);
  });
});
