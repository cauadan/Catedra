import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { GeminiQuestionService } from '../src/services/gemini-question.service.js';

const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const isolatedSubjectName = `Direito Administrativo Isolado ${uniqueSuffix}`;

const testUser = {
  name: `Estudante Questoes ${uniqueSuffix}`,
  email: `questoes_iso_${uniqueSuffix}@estudos.test`,
  password: 'SenhaForte123!',
  timezone: 'America/Sao_Paulo',
};

let sessionCookie = '';
const originalGeminiKey = process.env.GEMINI_API_KEY;

function extractSessionCookie(setCookieHeaders: string[] | string | undefined): string {
  if (!setCookieHeaders) return '';
  const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const sessionHeader = cookies.find((c) => c.includes('session_id='));
  if (!sessionHeader) return '';
  return sessionHeader.split(';')[0].trim();
}

describe('Isolamento Estrito de Matérias e Fallback no QuestionService (/api/questions)', () => {
  beforeAll(async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    expect(regRes.status).toBe(201);
    sessionCookie = extractSessionCookie(regRes.headers['set-cookie']);
    expect(sessionCookie).toContain('session_id=');
  });

  afterAll(async () => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    vi.restoreAllMocks();

    await prisma.question.deleteMany({
      where: { subjectName: isolatedSubjectName },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  it('1. sem GEMINI_API_KEY: solicitar 5 questões de Direito Administrativo retorna apenas questões de Direito Administrativo (sem vazar T.I.) e aviso de acervo concluído', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await request(app)
      .post('/api/questions/generate-batch')
      .set('Cookie', sessionCookie)
      .send({
        subjectName: 'Direito Administrativo',
        format: 'MIXED',
        count: 5,
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    expect(res.body.questions.length).toBeLessThanOrEqual(5);

    // Isolamento absoluto: TODAS as questões devem ser estritamente de Direito Administrativo
    for (const q of res.body.questions) {
      expect(q.subjectName.toLowerCase()).toBe('direito administrativo');
      expect(q.subjectName.toLowerCase()).not.toContain('segurança');
      expect(q.subjectName.toLowerCase()).not.toContain('banco de dados');
      for (const opt of q.options) {
        expect(opt).not.toHaveProperty('isCorrect');
      }
    }

    if (res.body.questions.length < 5) {
      expect(res.body.actualCount).toBe(res.body.questions.length);
      expect(res.body.requestedCount).toBe(5);
      expect(typeof res.body.notice).toBe('string');
      expect(res.body.notice).toContain('Acervo local concluído');
    }
  });

  it('2. sem GEMINI_API_KEY: filtrar por topicId específico prioriza o subtópico e completa o lote com outras questões do mesmo subjectName (sem cair para 1 e sem vazar outras matérias)', async () => {
    delete process.env.GEMINI_API_KEY;

    const subRes = await request(app)
      .post('/api/subjects')
      .set('Cookie', sessionCookie)
      .send({ name: 'Direito Administrativo', color: '#EC4899' });
    expect(subRes.status).toBe(201);

    const topRes = await request(app)
      .post('/api/topics')
      .set('Cookie', sessionCookie)
      .send({
        subject_id: subRes.body.id,
        name: 'Licitações e Contratos (Lei 14.133)',
      });
    expect(topRes.status).toBe(201);

    const res = await request(app)
      .post('/api/questions/generate-batch')
      .set('Cookie', sessionCookie)
      .send({
        topicId: topRes.body.id,
        format: 'MIXED',
        count: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBeGreaterThan(1);
    expect(res.body.questions.length).toBeLessThanOrEqual(5);
    expect(res.body.actualCount).toBe(res.body.questions.length);
    expect(res.body.requestedCount).toBe(5);
    expect(res.body.questions[0].topicName).toContain('Licitações');

    for (const q of res.body.questions) {
      expect(q.subjectName.toLowerCase()).toBe('direito administrativo');
    }
  });

  it('3. com GEMINI_API_KEY configurada: solicita apenas a quantidade faltante (2 de 5) no tema exato, salva no Supabase com mesmo subjectName e retorna lote completo de 5', async () => {
    // Insere exatamente 3 questões locais para a matéria isolada de teste
    for (let i = 1; i <= 3; i++) {
      await prisma.question.create({
        data: {
          subjectName: isolatedSubjectName,
          topicName: 'Licitações',
          type: 'MULTIPLE_CHOICE',
          difficulty: 'MEDIUM',
          source: 'Acervo Nativo',
          statement: `Questão local ${i} sobre Licitações`,
          explanation: `Explicação local ${i}`,
          options: {
            create: [
              { text: 'Alternativa Correta', isCorrect: true },
              { text: 'Alternativa Incorreta', isCorrect: false },
            ],
          },
        },
      });
    }

    process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test';

    const geminiSpy = vi
      .spyOn(GeminiQuestionService, 'generateQuestions')
      .mockResolvedValueOnce([
        {
          subjectName: isolatedSubjectName,
          topicName: 'Licitações',
          type: 'MULTIPLE_CHOICE',
          difficulty: 'MEDIUM',
          source: 'IA Simulado (Gemini)',
          statement: 'Questão gerada 1 sobre Diálogo Competitivo na Lei 14.133',
          codeSnippet: null,
          explanation: 'Gabarito comentado 1',
          options: [
            { text: 'Opção A', isCorrect: true },
            { text: 'Opção B', isCorrect: false },
          ],
        },
        {
          subjectName: isolatedSubjectName,
          topicName: 'Licitações',
          type: 'TRUE_FALSE',
          difficulty: 'HARD',
          source: 'IA Simulado (Gemini)',
          statement: 'Questão gerada 2 sobre dispensa de licitação',
          codeSnippet: null,
          explanation: 'Gabarito comentado 2',
          options: [
            { text: 'Certo', isCorrect: true },
            { text: 'Errado', isCorrect: false },
          ],
        },
      ]);

    const res = await request(app)
      .post('/api/questions/generate-batch')
      .set('Cookie', sessionCookie)
      .send({
        subjectName: isolatedSubjectName,
        topicName: 'Licitações',
        format: 'MIXED',
        count: 5,
      });

    expect(res.status).toBe(200);
    expect(geminiSpy).toHaveBeenCalledTimes(1);
    expect(geminiSpy).toHaveBeenCalledWith({
      subjectName: isolatedSubjectName,
      topicName: 'Licitações',
      format: 'MIXED',
      count: 2,
    });

    expect(res.body.questions.length).toBe(5);
    expect(res.body.actualCount).toBe(5);
    expect(res.body.notice).toBeNull();
    expect(res.body.providerSummary.fromCache).toBe(3);
    expect(res.body.providerSummary.fromExternal).toBe(2);

    for (const q of res.body.questions) {
      expect(q.subjectName).toBe(isolatedSubjectName);
    }

    // Verifica que as 2 novas questões foram gravadas permanentemente no Supabase com o mesmo subjectName
    const savedCount = await prisma.question.count({
      where: { subjectName: isolatedSubjectName },
    });
    expect(savedCount).toBe(5);
  });

  it('4. com GEMINI_API_KEY configurada mas falha na API externa: retorna apenas as 5 questões existentes da matéria sem completar com outras matérias', async () => {
    process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test';
    const geminiFailSpy = vi
      .spyOn(GeminiQuestionService, 'generateQuestions')
      .mockRejectedValueOnce(new Error('Gemini HTTP 429: Quota exceeded'));

    const res = await request(app)
      .post('/api/questions/generate-batch')
      .set('Cookie', sessionCookie)
      .send({
        subjectName: isolatedSubjectName,
        topicName: 'Licitações',
        format: 'MIXED',
        count: 10,
      });

    expect(res.status).toBe(200);
    expect(geminiFailSpy).toHaveBeenCalledWith({
      subjectName: isolatedSubjectName,
      topicName: 'Licitações',
      format: 'MIXED',
      count: 5,
    });

    expect(res.body.questions.length).toBe(5);
    expect(res.body.actualCount).toBe(5);
    expect(res.body.requestedCount).toBe(10);
    expect(res.body.notice).toContain('Acervo local concluído');

    for (const q of res.body.questions) {
      expect(q.subjectName).toBe(isolatedSubjectName);
    }
    geminiFailSpy.mockRestore();
  });

  it('5. falha externa em subtópico com apenas 1 questão completa o lote até 5 com outras questões salvas do mesmo subjectName', async () => {
    await prisma.question.create({
      data: {
        subjectName: isolatedSubjectName,
        topicName: 'Atos Administrativos',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'EASY',
        source: 'Acervo Nativo',
        statement: 'Questão única sobre atributos do Ato Administrativo',
        explanation: 'Explicação sobre presunção de legitimidade',
        options: {
          create: [
            { text: 'Correta', isCorrect: true },
            { text: 'Incorreta', isCorrect: false },
          ],
        },
      },
    });

    process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test';
    const subtopicFailSpy = vi
      .spyOn(GeminiQuestionService, 'generateQuestions')
      .mockRejectedValueOnce(new Error('Modelo indisponível'));

    const res = await request(app)
      .post('/api/questions/generate-batch')
      .set('Cookie', sessionCookie)
      .send({
        subjectName: isolatedSubjectName,
        topicName: 'Atos Administrativos',
        format: 'MIXED',
        count: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBe(5);
    expect(res.body.questions[0].topicName).toBe('Atos Administrativos');
    expect(res.body.providerSummary.fromCache).toBe(5);
    expect(res.body.providerSummary.fromExternal).toBe(0);
    for (const q of res.body.questions) {
      expect(q.subjectName).toBe(isolatedSubjectName);
    }

    subtopicFailSpy.mockRestore();
  });

  it('6. GeminiQuestionService tenta gemini-3.8-flash primeiro e faz fallback em 404 para gemini-2.5-flash e gemini-flash-latest', async () => {
    vi.restoreAllMocks();
    process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test';

    const calledUrls: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      calledUrls.push(url);

      if (url.includes('models/gemini-3.8-flash:generateContent')) {
        return new Response('Not Found 3.8', { status: 404 });
      }
      if (url.includes('models/gemini-2.5-flash:generateContent')) {
        return new Response('Not Found 2.5', { status: 404 });
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        statement: 'Questão via fallback gemini-flash-latest',
                        type: 'MULTIPLE_CHOICE',
                        difficulty: 'MEDIUM',
                        topicName: 'Licitações',
                        explanation: 'Gabarito oficial.',
                        options: [
                          { text: 'Opção A', isCorrect: true },
                          { text: 'Opção B', isCorrect: false },
                        ],
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const generated = await GeminiQuestionService.generateQuestions({
      subjectName: isolatedSubjectName,
      topicName: 'Licitações',
      format: 'MIXED',
      count: 1,
    });

    expect(calledUrls.length).toBe(3);
    expect(calledUrls[0]).toContain('models/gemini-3.8-flash:generateContent');
    expect(calledUrls[1]).toContain('models/gemini-2.5-flash:generateContent');
    expect(calledUrls[2]).toContain('models/gemini-flash-latest:generateContent');
    expect(generated.length).toBe(1);
    expect(generated[0].statement).toContain('gemini-flash-latest');

    fetchSpy.mockRestore();
  });
});
