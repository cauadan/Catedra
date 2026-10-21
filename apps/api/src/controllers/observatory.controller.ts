import { Request, Response, NextFunction } from 'express';
import { observatoryQuerySchema } from '@estudos/domain';
import { ObservatoryService } from '../services/observatory.service.js';
import { AppError } from '../utils/errors.js';

export class ObservatoryController {
  /**
   * GET /api/observatory?date=YYYY-MM-DD
   */
  static async getObservatory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const parseResult = observatoryQuerySchema.safeParse(req.query);

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

      const data = await ObservatoryService.getObservatory(userId, parseResult.data);
      return res.status(200).json({ data });
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
