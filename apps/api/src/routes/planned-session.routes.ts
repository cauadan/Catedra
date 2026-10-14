import { Router } from 'express';
import { PlannedSessionController } from '../controllers/planned-session.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const plannedSessionRouter = Router();

// Todas as rotas exigem autenticação obrigatória
plannedSessionRouter.use(authMiddleware);

plannedSessionRouter.get('/', PlannedSessionController.list);
plannedSessionRouter.post('/', PlannedSessionController.create);
plannedSessionRouter.patch('/:id', PlannedSessionController.update);
plannedSessionRouter.patch('/:id/status', PlannedSessionController.updateStatus);
plannedSessionRouter.post('/:id/reschedule', PlannedSessionController.reschedule);
plannedSessionRouter.delete('/:id', PlannedSessionController.delete);
