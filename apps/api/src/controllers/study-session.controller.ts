import { Request, Response, NextFunction } from 'express';
import { studySessionCreateSchema } from '@estudos/domain';
import { StudySessionService } from '../services/study-session.service.js';
import { AppError } from '../utils/errors.js';

export class StudySessionController {
  /**
   * POST /api/study-sessions
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const parseResult = studySessionCreateSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      const session = await StudySessionService.create(userId, parseResult.data);
      return res.status(201).json({ data: session });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/study-sessions/active
   */
  static async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const session = await StudySessionService.getActive(userId);
      return res.status(200).json({
        data: session,
        server_now: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/study-sessions/pending-evaluation
   */
  static async getPendingEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const session = await StudySessionService.getPendingEvaluation(userId);
      return res.status(200).json({ data: session });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/study-sessions/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const session = await StudySessionService.getById(userId, id);
      return res.status(200).json({ data: session });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }
      next(error);
    }
  }
}
