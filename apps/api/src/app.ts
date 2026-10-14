import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes.js';
import { subjectRouter } from './routes/subject.routes.js';
import { topicRouter } from './routes/topic.routes.js';

/**
 * Instância da aplicação Express (apps/api)
 * Configura middlewares globais, rotas de base e tratamento centralizado de erros em português.
 */
export const app = express();

// Middlewares globais
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Rota de verificação de integridade e saúde do serviço
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Serviço da API operacional e em execução.',
    timestamp: new Date().toISOString(),
  });
});

// Rotas de Autenticação e Sessão (Marco 2)
app.use('/api/auth', authRouter);

// Rotas de Matérias (Marco 3)
app.use('/api/subjects', subjectRouter);
app.use('/api/topics', topicRouter);

// Middleware de tratamento de rotas não encontradas (404)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Rota '${req.method} ${req.path}' não encontrada.`,
    },
  });
});

// Middleware global de tratamento de erros em português
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERRO INTERNO DO SERVIDOR]:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
    },
  });
});
