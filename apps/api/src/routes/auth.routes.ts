import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/logout', AuthController.logout);
authRouter.get('/me', authMiddleware, AuthController.me);
