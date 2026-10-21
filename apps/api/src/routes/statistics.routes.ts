import { Router } from 'express';
import { StatisticsController } from '../controllers/statistics.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const statisticsRouter = Router();

statisticsRouter.use(authMiddleware);

statisticsRouter.get('/', StatisticsController.getStatistics);
