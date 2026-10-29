import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { QuestionController } from '../controllers/question.controller.js';

export const questionRouter = Router();

// Todas as rotas de questões exigem autenticação
questionRouter.use(authMiddleware);

// Catálogo e status de integrações
questionRouter.get('/catalog-info', QuestionController.getCatalogInfo);

// Geração de lote de questões em cascata Cache-First
questionRouter.post('/generate-batch', QuestionController.generateBatch);

// Submissão de resposta / gabarito comentado
questionRouter.post('/answer', QuestionController.answerQuestion);

// Registro do resultado em sessão de estudo
questionRouter.post('/log-practice-session', QuestionController.logPracticeSession);
