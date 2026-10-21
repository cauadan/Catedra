import { Router } from 'express';
import { GoalController } from '../controllers/goal.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const goalRouter = Router();

goalRouter.use(authMiddleware);

goalRouter.get('/', GoalController.list);
goalRouter.post('/copy', GoalController.copy);
goalRouter.post('/', GoalController.create);
goalRouter.patch('/:id', GoalController.update);
goalRouter.delete('/:id', GoalController.delete);
