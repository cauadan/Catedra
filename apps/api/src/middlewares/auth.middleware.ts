import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { sessionService, SESSION_COOKIE_NAME } from '../services/session.service.js';
import { formatErrorResponse } from '../utils/errors.js';

/**
 * Middleware de Autenticação Obrigatória.
 * Lê o cookie session_id (ou Authorization Bearer), valida a sessão e garante que o usuário existe no banco.
 * Injeta req.userId e req.user ou retorna HTTP 401 em português.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;

  const sessionId = cookieToken || bearerToken;

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
    return;
  }

  const session = sessionService.getSession(sessionId);
  if (!session) {
    res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        week_starts_on: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      sessionService.deleteSession(sessionId);
      res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error('[ERRO AUTH MIDDLEWARE]:', error);
    res.status(500).json(
      formatErrorResponse(
        'INTERNAL_ERROR',
        'Ocorreu um erro interno ao validar a autenticação.'
      )
    );
  }
}
