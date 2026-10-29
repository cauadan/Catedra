import { prisma } from '../lib/prisma.js';
import {
  NATIVE_CATALOG,
  QuestionBatchRequest,
  QuestionAnswerRequest,
  QuestionBatchResponse,
  QuestionAnswerResponse,
  CatalogInfoResponse,
  QuestionItemDTO,
} from '@estudos/domain';
import { SEED_QUESTIONS } from './question-seed-data.js';
import { GeminiQuestionService } from './gemini-question.service.js';
import { QuizApiQuestionService } from './quizapi-question.service.js';

export class QuestionService {
  /**
   * Garante que o acervo nativo de questões esteja carregado no Supabase.
   */
  public static async ensureSeedLoaded(): Promise<number> {
    const count = await prisma.question.count();
    if (count > 0) {
      return count;
    }

    console.log('[QuestionService] Acervo vazio detectado. Populando acervo nativo inicial...');
    return this.forceSeed();
  }

  /**
   * Força a carga do seed curado de questões.
   */
  public static async forceSeed(): Promise<number> {
    let inserted = 0;
    for (const q of SEED_QUESTIONS) {
      await prisma.question.create({
        data: {
          subjectName: q.subjectName,
          topicName: q.topicName,
          type: q.type,
          difficulty: q.difficulty,
          source: q.source,
          statement: q.statement,
          codeSnippet: q.codeSnippet || null,
          explanation: q.explanation,
          options: {
            create: q.options.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
            })),
          },
        },
      });
      inserted++;
    }
    console.log(`[QuestionService] ${inserted} questões inseridas com sucesso no banco.`);
    return inserted;
  }

  /**
   * Retorna os tópicos e matérias cobertos nativamente pelo acervo
   * e o status das chaves de API opcionais.
   */
  public static async getCatalogInfo(): Promise<CatalogInfoResponse> {
    await this.ensureSeedLoaded();
    const totalInBank = await prisma.question.count();

    return {
      catalog: NATIVE_CATALOG,
      totalInBank,
      integrations: {
        geminiActive: GeminiQuestionService.isConfigured(),
        quizApiActive: QuizApiQuestionService.isConfigured(),
      },
    };
  }

  /**
   * Gera um lote de questões (5 ou 10) usando a cascata Cache-First:
   * 1. Supabase Banco Local (priorizando não respondidas ou erradas pelo usuário).
   * 2. QuizAPI (se ativa e compatível com T.I.).
   * 3. Google Gemini Free Tier (se ativo e faltar questão).
   * 4. Fallback para questões adicionais do banco local se APIs externas não estiverem ativas.
   */
  public static async generateBatch(
    userId: string,
    params: QuestionBatchRequest
  ): Promise<QuestionBatchResponse> {
    await this.ensureSeedLoaded();

    let subjectName = params.subjectName?.trim() || '';
    let topicName = params.topicName?.trim() || '';

    // Se veio topicId ou subjectId, busca os nomes reais no banco do usuário
    if (params.topicId) {
      const topic = await prisma.topic.findUnique({
        where: { id: params.topicId },
        include: { subject: true },
      });
      if (topic) {
        topicName = topic.name;
        subjectName = topic.subject.name;
      }
    } else if (params.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: params.subjectId },
      });
      if (subject) {
        subjectName = subject.name;
      }
    }

    const count = params.count || 5;
    const format = params.format || 'MIXED';

    // Monta filtro Prisma
    const typeFilter = format !== 'MIXED' ? { type: format } : {};

    // 1. Busca questões locais compatíveis
    const candidateQuestions = await prisma.question.findMany({
      where: {
        ...typeFilter,
        ...(subjectName
          ? {
              OR: [
                { subjectName: { contains: subjectName, mode: 'insensitive' } },
                { topicName: { contains: topicName || subjectName, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        options: true,
      },
    });

    // Busca histórico de tentativas do usuário para priorizar:
    // Nunca respondidas > Respondidas com erro > Já acertadas
    const attempts = await prisma.questionAttempt.findMany({
      where: { userId },
      select: { questionId: true, isCorrect: true },
    });

    const correctIds = new Set(attempts.filter((a) => a.isCorrect).map((a) => a.questionId));
    const failedIds = new Set(attempts.filter((a) => !a.isCorrect && !correctIds.has(a.questionId)).map((a) => a.questionId));

    const scoredQuestions = candidateQuestions.map((q) => {
      let priority = 0; // 0 = Nunca feita (prioridade máxima)
      if (failedIds.has(q.id)) priority = 1; // 1 = Errada anteriormente
      if (correctIds.has(q.id)) priority = 2; // 2 = Já dominada
      return { question: q, priority, random: Math.random() };
    });

    // Ordena por prioridade e depois aleatoriamente para variar as sessões
    scoredQuestions.sort((a, b) => a.priority - b.priority || a.random - b.random);

    const selectedFromDb = scoredQuestions.slice(0, count).map((item) => item.question);
    let fromCache = selectedFromDb.length;
    let fromExternal = 0;

    // Se faltarem questões para atingir a quantidade solicitada (ex.: 5 ou 10), busca de fontes externas gratuitas
    if (selectedFromDb.length < count) {
      const missingCount = count - selectedFromDb.length;
      let externalGenerated: any[] = [];

      // Passo 2a: QuizAPI (se configurada e T.I.)
      if (QuizApiQuestionService.isConfigured()) {
        const fromQuiz = await QuizApiQuestionService.fetchQuestions({
          subjectName: subjectName || 'Tecnologia da Informação',
          topicName: topicName || 'Geral',
          count: missingCount,
        });
        externalGenerated.push(...fromQuiz);
      }

      // Passo 2b: Gemini Free Tier (se faltar e estiver configurado)
      const remainingNeeded = missingCount - externalGenerated.length;
      if (remainingNeeded > 0 && GeminiQuestionService.isConfigured()) {
        const fromGemini = await GeminiQuestionService.generateQuestions({
          subjectName: subjectName || 'Conhecimentos Gerais',
          topicName: topicName || 'Prática',
          format,
          count: remainingNeeded,
        });
        externalGenerated.push(...fromGemini);
      }

      // Persiste no Supabase qualquer questão gerada externamente para alimentar o acervo (Cache permanente)
      for (const ext of externalGenerated) {
        try {
          const saved = await prisma.question.create({
            data: {
              subjectName: ext.subjectName,
              topicName: ext.topicName,
              type: ext.type,
              difficulty: ext.difficulty,
              source: ext.source,
              statement: ext.statement,
              codeSnippet: ext.codeSnippet,
              explanation: ext.explanation,
              options: {
                create: ext.options.map((opt: any) => ({
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                })),
              },
            },
            include: { options: true },
          });
          selectedFromDb.push(saved);
          fromExternal++;
          if (selectedFromDb.length >= count) break;
        } catch (err) {
          console.warn('[QuestionService] Erro ao salvar questão externa no banco:', err);
        }
      }

      // Se ainda faltar e não tiver APIs externas ativas, busca outras questões locais do banco
      if (selectedFromDb.length < count) {
        const existingIds = new Set(selectedFromDb.map((q) => q.id));
        const fallbackQuestions = await prisma.question.findMany({
          where: {
            id: { notIn: Array.from(existingIds) },
            ...typeFilter,
          },
          include: { options: true },
          take: count - selectedFromDb.length,
        });
        for (const fb of fallbackQuestions) {
          selectedFromDb.push(fb);
          fromCache++;
        }
      }
    }

    // Mapeia para DTO ocultando estritamente isCorrect nas opções para segurança
    const questions: QuestionItemDTO[] = selectedFromDb.map((q) => ({
      id: q.id,
      topicId: q.topicId,
      subjectName: q.subjectName,
      topicName: q.topicName,
      type: q.type,
      difficulty: q.difficulty,
      source: q.source,
      statement: q.statement,
      codeSnippet: q.codeSnippet,
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
      })),
    }));

    const totalAvailable = await prisma.question.count();

    return {
      questions,
      totalAvailable,
      providerSummary: {
        fromCache,
        fromExternal,
        isExternalAvailable: GeminiQuestionService.isConfigured() || QuizApiQuestionService.isConfigured(),
      },
    };
  }

  /**
   * Registra a tentativa do usuário e retorna a correção com gabarito comentado.
   */
  public static async answerQuestion(
    userId: string,
    params: QuestionAnswerRequest
  ): Promise<QuestionAnswerResponse> {
    const question = await prisma.question.findUnique({
      where: { id: params.questionId },
      include: { options: true },
    });

    if (!question) {
      throw new Error('Questão não encontrada.');
    }

    let isCorrect = false;

    if (params.selectedOptionId) {
      const selected = question.options.find((o) => o.id === params.selectedOptionId);
      isCorrect = Boolean(selected?.isCorrect);
    } else if (params.isHonestCorrect !== undefined) {
      isCorrect = Boolean(params.isHonestCorrect);
    }

    // Registra tentativa no banco
    await prisma.questionAttempt.create({
      data: {
        userId,
        questionId: question.id,
        selectedOptionId: params.selectedOptionId || null,
        isCorrect,
      },
    });

    const correctOption = question.options.find((o) => o.isCorrect);

    return {
      isCorrect,
      correctOptionId: correctOption?.id || null,
      explanation: question.explanation,
    };
  }

  /**
   * Converte o resultado de um lote de prática em uma sessão de estudo executada com registro de prática.
   */
  public static async logPracticeSession(
    userId: string,
    params: {
      topicId?: string;
      subjectName?: string;
      topicName?: string;
      minutes?: number;
      questionsCount: number;
      correctCount: number;
      notes?: string;
    }
  ) {
    let topicId = params.topicId;

    // Se não tiver topicId, localiza ou cria a matéria e o tópico para o usuário
    if (!topicId) {
      const subjectName = params.subjectName || 'Prática Geral';
      let subject = await prisma.subject.findFirst({
        where: { user_id: userId, name: { equals: subjectName, mode: 'insensitive' } },
      });

      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            user_id: userId,
            name: subjectName,
            color: '#10B981',
          },
        });
      }

      const topicName = params.topicName || 'Questões Resolvidas';
      let topic = await prisma.topic.findFirst({
        where: { user_id: userId, subject_id: subject.id, name: { equals: topicName, mode: 'insensitive' } },
      });

      if (!topic) {
        topic = await prisma.topic.create({
          data: {
            user_id: userId,
            subject_id: subject.id,
            name: topicName,
          },
        });
      }

      topicId = topic.id;
    }

    const minutes = Math.max(1, params.minutes || 15);
    const startedAt = new Date(Date.now() - minutes * 60 * 1000);
    const endedAt = new Date();
    const accuracy = params.questionsCount > 0 ? (params.correctCount / params.questionsCount) * 100 : 0;

    const session = await prisma.studySession.create({
      data: {
        user_id: userId,
        topic_id: topicId,
        started_at: startedAt,
        ended_at: endedAt,
        status: 'FINISHED',
        session_blocks: {
          create: [
            {
              user_id: userId,
              kind: 'PRACTICE',
              planned_minutes: minutes,
              position: 1,
            },
          ],
        },
        session_events: {
          create: [
            {
              user_id: userId,
              type: 'BLOCK_START',
              occurred_at: startedAt,
            },
            {
              user_id: userId,
              type: 'SESSION_FINISH',
              occurred_at: endedAt,
            },
          ],
        },
        evaluation: {
          create: {
            user_id: userId,
            understanding: 'GOOD',
            focus: 'HIGH',
            difficulty: 'NORMAL',
            notes:
              params.notes ||
              `Sessão de prática com ${params.questionsCount} questões resolvidas (${params.correctCount} acertos, ${accuracy.toFixed(0)}%).`,
          },
        },
        practice_records: {
          create: [
            {
              user_id: userId,
              topic_id: topicId,
              questions: params.questionsCount,
              correct: params.correctCount,
            },
          ],
        },
      },
      include: {
        topic: { include: { subject: true } },
        session_blocks: true,
        practice_records: true,
      },
    });

    return session;
  }
}
