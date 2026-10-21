import { Router } from 'express';
import { ObservatoryController } from '../controllers/observatory.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const observatoryRouter = Router();

observatoryRouter.use(authMiddleware);

observatoryRouter.get('/', ObservatoryController.getObservatory);
