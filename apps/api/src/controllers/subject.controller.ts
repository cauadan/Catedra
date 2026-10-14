import { Request, Response, NextFunction } from 'express';
import { SubjectService } from '../services/subject.service.js';
import { subjectCreateSchema } from '@estudos/domain';

export class SubjectController {
  static async createSubject(req: Request, res: Response, next: NextFunction) {
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

      const parseResult = subjectCreateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
            details: parseResult.error.format(),
          },
        });
      }

      const subject = await SubjectService.createSubject(userId, parseResult.data);
      return res.status(201).json(subject);
    } catch (error) {
      next(error);
    }
  }

  static async listSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const includeArchived = req.query.include_archived === 'true' || req.query.include_archived === '1';
      
      const subjects = await SubjectService.listSubjects(userId, includeArchived);
      return res.json(subjects);
    } catch (error) {
      next(error);
    }
  }

  static async updateSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const subjectId = req.params.id as string;

      // Importante: validar com o Zod de update
      // Porém precisamos trazer o import subjectUpdateSchema do domain,
      // para facilitar, eu uso req.body para chamar o service que faz a validação ou faço aqui
      // Vamos assumir que a validação tá no routes ou controller
      const { subjectUpdateSchema } = await import('@estudos/domain');
      
      const parseResult = subjectUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
            details: parseResult.error.format(),
          },
        });
      }

      const subject = await SubjectService.updateSubject(userId, subjectId, parseResult.data);
      return res.json(subject);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Matéria não encontrada.' },
        });
      }
      next(error);
    }
  }

  static async deleteSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const subjectId = req.params.id as string;

      await SubjectService.deleteSubject(userId, subjectId);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Matéria não encontrada.' },
        });
      }
      // O Prisma lança um erro P2003 quando viola FK (RESTRICT) - vamos mapear para 409
      if (error.code === 'P2003') {
         return res.status(409).json({
            error: { code: 'CONFLICT', message: 'Exclusão recusada: há sessões vinculadas. Arquive a matéria em vez de excluir.' }
         });
      }
      next(error);
    }
  }
}
