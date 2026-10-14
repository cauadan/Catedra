import { Request, Response, NextFunction } from 'express';
import {
  studySessionCreateSchema,
  studySessionEventSchema,
  declaredDistractionSchema,
  sessionEvaluationSchema,
} from '@estudos/domain';
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

  /**
   * POST /api/study-sessions/:id/events
   */
  static async recordEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const parseResult = studySessionEventSchema.safeParse(req.body);

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

      const session = await StudySessionService.recordEvent(userId, id, parseResult.data.type);
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
   * POST /api/study-sessions/:id/blocks/:blockId/finish
   */
  static async finishBlock(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const blockId = req.params.blockId as string;
      const body = req.body ?? {};

      const parseResult = declaredDistractionSchema.safeParse(body);
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

      const session = await StudySessionService.finishBlock(
        userId,
        id,
        blockId,
        parseResult.data.declared_minutes
      );
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
   * POST /api/study-sessions/:id/finish
   */
  static async finish(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const body = req.body ?? {};

      const parseResult = declaredDistractionSchema.safeParse(body);
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

      const session = await StudySessionService.finish(userId, id, parseResult.data.declared_minutes);
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
   * POST /api/study-sessions/:id/cancel
   */
  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const session = await StudySessionService.cancel(userId, id);
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
   * POST /api/study-sessions/:id/evaluation
   */
  static async evaluate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const parseResult = sessionEvaluationSchema.safeParse(req.body);

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

      const session = await StudySessionService.evaluate(userId, id, parseResult.data);
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
}
