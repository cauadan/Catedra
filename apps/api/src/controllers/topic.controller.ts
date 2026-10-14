import { Request, Response, NextFunction } from 'express';
import { TopicService } from '../services/topic.service.js';
import { topicCreateSchema, topicUpdateSchema } from '@estudos/domain';

export class TopicController {
  static async createTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const parseResult = topicCreateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: parseResult.error.errors[0]?.message || 'Dados inválidos.',
            details: parseResult.error.format(),
          },
        });
      }

      const topic = await TopicService.createTopic(userId, parseResult.data);
      return res.status(201).json(topic);
    } catch (error: any) {
      if (error.message === 'PARENT_SUBJECT_MISMATCH') {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'O assunto pai informado pertence a outra matéria.' } });
      }
      next(error);
    }
  }

  static async listTopics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const subjectId = req.query.subject_id as string | undefined;
      const includeArchived = req.query.include_archived === 'true' || req.query.include_archived === '1';
      
      const topics = await TopicService.listTopics(userId, subjectId, includeArchived);
      return res.json(topics);
    } catch (error) {
      next(error);
    }
  }

  static async updateTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.id as string;

      const parseResult = topicUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: parseResult.error.errors[0]?.message },
        });
      }

      const topic = await TopicService.updateTopic(userId, topicId, parseResult.data);
      return res.json(topic);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assunto não encontrado.' } });
      if (error.message === 'HIERARCHY_CYCLE') return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Ciclo na hierarquia.' } });
      if (error.message === 'PARENT_SUBJECT_MISMATCH') return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Pai pertence a outra matéria.' } });
      next(error);
    }
  }

  static async deleteTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const topicId = req.params.id as string;

      await TopicService.deleteTopic(userId, topicId);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assunto não encontrado.' } });
      if (error.code === 'P2003') {
         return res.status(409).json({ error: { code: 'CONFLICT', message: 'Há sessões vinculadas. Arquive em vez de excluir.' } });
      }
      next(error);
    }
  }
}
