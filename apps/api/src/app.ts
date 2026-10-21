import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes.js';
import { subjectRouter } from './routes/subject.routes.js';
import { topicRouter } from './routes/topic.routes.js';
import { plannedSessionRouter } from './routes/planned-session.routes.js';
import { studySessionRouter } from './routes/study-session.routes.js';
import { goalRouter } from './routes/goal.routes.js';
import { statisticsRouter } from './routes/statistics.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';

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

// Rotas de Agenda e Planejamento (Fase 3)
app.use('/api/planned-sessions', plannedSessionRouter);

// Rotas de Execução do Estudo e Timer (Fases 4 e 5)
app.use('/api/study-sessions', studySessionRouter);

// Rotas de Metas de Estudo, Estatísticas e Dashboard (Fases 6 e 7)
app.use('/api/goals', goalRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/dashboard', dashboardRouter);

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
