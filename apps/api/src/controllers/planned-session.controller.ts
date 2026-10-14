import { Request, Response, NextFunction } from 'express';
import {
  plannedSessionQuerySchema,
  plannedSessionCreateSchema,
  plannedSessionUpdateSchema,
  plannedSessionStatusUpdateSchema,
  plannedSessionRescheduleSchema,
} from '@estudos/domain';
import { PlannedSessionService } from '../services/planned-session.service.js';
import { AppError } from '../utils/errors.js';

export class PlannedSessionController {
  /**
   * GET /api/planned-sessions?view=day|week&date=YYYY-MM-DD
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const timezone = req.user?.timezone || 'America/Sao_Paulo';

      const parseResult = plannedSessionQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Parâmetros de consulta inválidos.',
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      const { view, date } = parseResult.data;
      const response = await PlannedSessionService.list(userId, timezone, view, date);
      return res.status(200).json(response);
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
   * POST /api/planned-sessions
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const timezone = req.user?.timezone || 'America/Sao_Paulo';

      const parseResult = plannedSessionCreateSchema.safeParse(req.body);
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

      const session = await PlannedSessionService.create(userId, timezone, parseResult.data);
      return res.status(201).json(session);
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
   * PATCH /api/planned-sessions/:id
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const timezone = req.user?.timezone || 'America/Sao_Paulo';
      const sessionId = req.params.id as string;

      const parseResult = plannedSessionUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados de atualização inválidos.',
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      const session = await PlannedSessionService.update(userId, timezone, sessionId, parseResult.data);
      return res.status(200).json(session);
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
   * PATCH /api/planned-sessions/:id/status
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const timezone = req.user?.timezone || 'America/Sao_Paulo';
      const sessionId = req.params.id as string;

      const parseResult = plannedSessionStatusUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Status inválido.',
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      const session = await PlannedSessionService.updateStatus(
        userId,
        timezone,
        sessionId,
        parseResult.data.status
      );
      return res.status(200).json(session);
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
   * POST /api/planned-sessions/:id/reschedule
   */
  static async reschedule(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const timezone = req.user?.timezone || 'America/Sao_Paulo';
      const sessionId = req.params.id as string;

      const parseResult = plannedSessionRescheduleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados de remarcação inválidos.',
            details: parseResult.error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      const newSession = await PlannedSessionService.reschedule(
        userId,
        timezone,
        sessionId,
        parseResult.data
      );
      return res.status(201).json(newSession);
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
   * DELETE /api/planned-sessions/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.id as string;

      await PlannedSessionService.delete(userId, sessionId);
      return res.status(204).send();
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
