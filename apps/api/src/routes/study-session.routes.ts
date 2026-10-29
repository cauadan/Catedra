import { Router } from 'express';
import { StudySessionController } from '../controllers/study-session.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const studySessionRouter = Router();

// Todas as rotas exigem autenticação obrigatória
studySessionRouter.use(authMiddleware);

// Ordem obrigatória: declarar rotas estáticas antes dos parâmetros de caminho (:id)
studySessionRouter.get('/', StudySessionController.listRecent);
studySessionRouter.post('/', StudySessionController.create);
studySessionRouter.get('/active', StudySessionController.getActive);
studySessionRouter.get('/pending-evaluation', StudySessionController.getPendingEvaluation);
studySessionRouter.get('/:id', StudySessionController.getById);
studySessionRouter.post('/:id/events', StudySessionController.recordEvent);
studySessionRouter.post('/:id/blocks/:blockId/finish', StudySessionController.finishBlock);
studySessionRouter.post('/:id/finish', StudySessionController.finish);
studySessionRouter.post('/:id/cancel', StudySessionController.cancel);
studySessionRouter.patch('/:id/blocks', StudySessionController.updateBlocks);
studySessionRouter.patch('/:id/notes', StudySessionController.updateNotes);
studySessionRouter.patch('/:id', StudySessionController.updateNotes);
studySessionRouter.post('/:id/evaluation', StudySessionController.evaluate);
