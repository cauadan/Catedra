import { Prisma } from '@prisma/client';
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
import { AppError } from '../utils/errors.js';
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
   * Gera um lote de questões (5 ou 10) com isolamento estrito por matéria/tópico:
   * 1. Supabase Banco Local restrito estritamente ao subjectName / topicId solicitado.
   * 2. Se faltar questão e GEMINI_API_KEY estiver ativa: solicita apenas o complemento exato no mesmo tema e salva no Supabase.
   * 3. Se GEMINI_API_KEY não estiver ativa ou falhar: retorna apenas as questões existentes daquela matéria/tópico com aviso, sem jamais vazar conteúdo de outras matérias.
   */
  public static async generateBatch(
    userId: string,
    params: QuestionBatchRequest
  ): Promise<QuestionBatchResponse> {
    await this.ensureSeedLoaded();

    let resolvedTopicId: string | undefined;
    let subjectName = params.subjectName?.trim() || '';
    let topicName = params.topicName?.trim() || '';

    // Se veio topicId ou subjectId, valida propriedade do usuário e obtém os nomes exatos
    if (params.topicId) {
      const topic = await prisma.topic.findFirst({
        where: { id: params.topicId, user_id: userId },
        include: { subject: true },
      });
      if (!topic) {
        throw new AppError(404, 'NOT_FOUND', 'Assunto não encontrado.');
      }
      resolvedTopicId = topic.id;
      topicName = topic.name.trim();
      subjectName = topic.subject.name.trim();
    } else if (params.subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: params.subjectId, user_id: userId },
      });
      if (!subject) {
        throw new AppError(404, 'NOT_FOUND', 'Matéria não encontrada.');
      }
      subjectName = subject.name.trim();
    }

    if (!resolvedTopicId && !subjectName && !topicName) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Informe uma matéria ou assunto para gerar o lote de questões.'
      );
    }

    const count = params.count || 5;
    const format = params.format || 'MIXED';
    const typeFilter: Prisma.QuestionWhereInput = format !== 'MIXED' ? { type: format } : {};

    const isGenericTopic =
      !topicName ||
      ['geral', 'todos', 'todas', 'todos os assuntos'].includes(topicName.toLowerCase());

    // Filtro estrito: NUNCA permite que questões de outras matérias entrem na consulta
    let strictWhere: Prisma.QuestionWhereInput;
    if (resolvedTopicId) {
      strictWhere = {
        ...typeFilter,
        OR: [
          { topicId: resolvedTopicId },
          {
            subjectName: { equals: subjectName, mode: 'insensitive' },
            ...(!isGenericTopic
              ? { topicName: { contains: topicName, mode: 'insensitive' } }
              : {}),
          },
        ],
      };
    } else if (subjectName) {
      strictWhere = {
        ...typeFilter,
        subjectName: { equals: subjectName, mode: 'insensitive' },
        ...(!isGenericTopic
          ? { topicName: { contains: topicName, mode: 'insensitive' } }
          : {}),
      };
    } else {
      strictWhere = {
        ...typeFilter,
        topicName: { contains: topicName, mode: 'insensitive' },
      };
    }

    // 1. Busca questões locais estritamente restritas à matéria/tópico solicitado
    const candidateQuestions = await prisma.question.findMany({
      where: strictWhere,
      include: {
        options: true,
      },
    });

    // Busca histórico de tentativas do usuário nas questões candidatas para priorizar:
    // 0 = Nunca respondidas > 1 = Respondidas com erro > 2 = Já acertadas
    const candidateIds = candidateQuestions.map((q) => q.id);
    const attempts =
      candidateIds.length > 0
        ? await prisma.questionAttempt.findMany({
            where: { userId, questionId: { in: candidateIds } },
            select: { questionId: true, isCorrect: true },
          })
        : [];

    const correctIds = new Set(attempts.filter((a) => a.isCorrect).map((a) => a.questionId));
    const failedIds = new Set(
      attempts.filter((a) => !a.isCorrect && !correctIds.has(a.questionId)).map((a) => a.questionId)
    );

    const scoredQuestions = candidateQuestions.map((q) => {
      let priority = 0;
      if (failedIds.has(q.id)) priority = 1;
      if (correctIds.has(q.id)) priority = 2;
      return { question: q, priority, random: Math.random() };
    });

    scoredQuestions.sort((a, b) => a.priority - b.priority || a.random - b.random);

    const selectedFromDb = scoredQuestions.slice(0, count).map((item) => item.question);
    const fromCache = selectedFromDb.length;
    let fromExternal = 0;

    // 2. Se faltarem questões no banco local para atingir a quantidade solicitada
    if (selectedFromDb.length < count && GeminiQuestionService.isConfigured()) {
      const missingCount = count - selectedFromDb.length;
      const targetSubject = subjectName || topicName;
      const targetTopic = !isGenericTopic ? topicName : '';

      const fromGemini = await GeminiQuestionService.generateQuestions({
        subjectName: targetSubject,
        topicName: targetTopic,
        format,
        count: missingCount,
      });

      for (const ext of fromGemini.slice(0, missingCount)) {
        try {
          const saved = await prisma.question.create({
            data: {
              topicId: resolvedTopicId || null,
              subjectName: targetSubject,
              topicName: targetTopic || ext.topicName || 'Geral',
              type: ext.type,
              difficulty: ext.difficulty,
              source: ext.source,
              statement: ext.statement,
              codeSnippet: ext.codeSnippet || null,
              explanation: ext.explanation,
              options: {
                create: ext.options.map((opt) => ({
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
          console.warn('[QuestionService] Erro ao salvar questão gerada no banco:', err);
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

    const themeLabel =
      subjectName && !isGenericTopic
        ? `${subjectName} - ${topicName}`
        : subjectName || topicName;

    let notice: string | null = null;
    if (questions.length === 0) {
      notice = `Acervo local concluído para "${themeLabel}": nenhuma questão encontrada neste formato no banco local.`;
    } else if (questions.length < count) {
      notice = `Acervo local concluído para "${themeLabel}": lote ajustado para ${questions.length} de ${count} questões disponíveis exclusivamente neste assunto.`;
    }

    const totalAvailable = await prisma.question.count({ where: strictWhere });

    return {
      questions,
      requestedCount: count,
      actualCount: questions.length,
      totalAvailable,
      notice,
      providerSummary: {
        fromCache,
        fromExternal,
        isExternalAvailable: GeminiQuestionService.isConfigured(),
      },
    };
  }

  /**
   * Alias de compatibilidade para busca/geração de lote estrito.
   */
  public static async getQuestionsBatch(
    userId: string,
    params: QuestionBatchRequest
  ): Promise<QuestionBatchResponse> {
    return this.generateBatch(userId, params);
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
      throw new AppError(404, 'NOT_FOUND', 'Questão não encontrada.');
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

    if (topicId) {
      const ownedTopic = await prisma.topic.findFirst({
        where: { id: topicId, user_id: userId },
      });
      if (!ownedTopic) {
        throw new AppError(404, 'NOT_FOUND', 'Assunto não encontrado.');
      }
    }

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
        where: {
          user_id: userId,
          subject_id: subject.id,
          name: { equals: topicName, mode: 'insensitive' },
        },
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
    const accuracy =
      params.questionsCount > 0 ? (params.correctCount / params.questionsCount) * 100 : 0;

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
