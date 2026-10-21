import { Request, Response, NextFunction } from 'express';
import {
  goalCopySchema,
  goalCreateSchema,
  goalListQuerySchema,
  goalUpdateSchema,
} from '@estudos/domain';
import { GoalService } from '../services/goal.service.js';
import { AppError } from '../utils/errors.js';

export class GoalController {
  /**
   * GET /api/goals?period=DAY|WEEK|MONTH&date=YYYY-MM-DD
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const parseResult = goalListQuerySchema.safeParse(req.query);

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

      const goals = await GoalService.list(userId, parseResult.data);
      return res.status(200).json({ data: goals });
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
   * POST /api/goals
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const parseResult = goalCreateSchema.safeParse(req.body);

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

      const goal = await GoalService.create(userId, parseResult.data);
      return res.status(201).json({ data: goal });
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
   * POST /api/goals/copy
   */
  static async copy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const parseResult = goalCopySchema.safeParse(req.body);

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

      const result = await GoalService.copyFromPreviousPeriod(userId, parseResult.data);
      const statusCode = result.copiedCount > 0 ? 201 : 200;
      return res.status(statusCode).json(result);
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
   * PATCH /api/goals/:id
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const parseResult = goalUpdateSchema.safeParse(req.body);

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

      const goal = await GoalService.update(userId, id, parseResult.data);
      return res.status(200).json({ data: goal });
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
   * DELETE /api/goals/:id
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      await GoalService.delete(userId, id);
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
