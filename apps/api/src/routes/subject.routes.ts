import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { SubjectController } from '../controllers/subject.controller.js';

export const subjectRouter = Router();

// Todas as rotas de matérias requerem autenticação
subjectRouter.use(authMiddleware);

subjectRouter.get('/', SubjectController.listSubjects);
subjectRouter.post('/', SubjectController.createSubject);
subjectRouter.patch('/:id', SubjectController.updateSubject);
subjectRouter.delete('/:id', SubjectController.deleteSubject);
