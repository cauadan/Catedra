import { Router } from 'express';
import { StudySessionController } from '../controllers/study-session.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const studySessionRouter = Router();

// Todas as rotas exigem autenticação obrigatória
studySessionRouter.use(authMiddleware);

// Ordem obrigatória: declarar rotas estáticas antes dos parâmetros de caminho (:id)
studySessionRouter.post('/', StudySessionController.create);
studySessionRouter.get('/active', StudySessionController.getActive);
studySessionRouter.get('/pending-evaluation', StudySessionController.getPendingEvaluation);
studySessionRouter.get('/:id', StudySessionController.getById);
