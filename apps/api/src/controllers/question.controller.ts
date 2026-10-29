import { Request, Response, NextFunction } from 'express';
import { QuestionService } from '../services/question.service.js';
import { questionBatchRequestSchema, questionAnswerRequestSchema } from '@estudos/domain';

export class QuestionController {
  /**
   * GET /api/questions/catalog-info
   * Retorna os temas cobertos pelo acervo e status das integrações externas.
   */
  static async getCatalogInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await QuestionService.getCatalogInfo();
      return res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/questions/generate-batch
   * Gera lote de 5 ou 10 questões usando a cascata Cache-First.
   */
  static async generateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado.',
          },
        });
      }

      const parseResult = questionBatchRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Parâmetros inválidos.',
            details: parseResult.error.format(),
          },
        });
      }

      const result = await QuestionService.generateBatch(userId, parseResult.data);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/questions/answer
   * Valida resposta do usuário e grava a tentativa.
   */
  static async answerQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado.',
          },
        });
      }

      const parseResult = questionAnswerRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados de resposta inválidos.',
            details: parseResult.error.format(),
          },
        });
      }

      const result = await QuestionService.answerQuestion(userId, parseResult.data);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/questions/log-practice-session
   * Cria uma sessão de estudo concluída e computa os acertos de prática.
   */
  static async logPracticeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Usuário não autenticado.',
          },
        });
      }

      const { topicId, subjectName, topicName, minutes, questionsCount, correctCount, notes } = req.body;
      const session = await QuestionService.logPracticeSession(userId, {
        topicId,
        subjectName,
        topicName,
        minutes: Number(minutes) || 15,
        questionsCount: Number(questionsCount) || 0,
        correctCount: Number(correctCount) || 0,
        notes,
      });

      return res.status(201).json({ data: session });
    } catch (error) {
      next(error);
    }
  }
}
