import crypto from 'node:crypto';
import { CookieOptions } from 'express';

export interface SessionData {
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export const SESSION_COOKIE_NAME = 'session_id';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms

/**
 * Retorna as opções padrão para o cookie de sessão httpOnly.
 */
export function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_MS,
  };
}

/**
 * Gerenciador de Sessões em Memória com controle de expiração e TTL de 7 dias.
 * Não exige alterações no schema do banco de dados e fornece lookup O(1).
 */
export class SessionService {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpeza periódica de sessões expiradas a cada 1 hora
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    // Desassocia o timer do loop de eventos para não prender o processo em testes
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Cria uma nova sessão criptograficamente segura para o usuário.
   */
  public createSession(userId: string): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    this.sessions.set(sessionId, {
      userId,
      createdAt: now,
      expiresAt,
    });

    return sessionId;
  }

  /**
   * Recupera a sessão ativa caso válida e não expirada.
   */
  public getSession(sessionId: string | undefined): SessionData | null {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Remove uma sessão ativa (logout).
   */
  public deleteSession(sessionId: string | undefined): void {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Remove todas as sessões de um usuário específico.
   */
  public deleteUserSessions(userId: string): void {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sid);
      }
    }
  }

  /**
   * Varre e expurga todas as sessões cujo prazo de validade expirou.
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sid, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(sid);
      }
    }
  }

  /**
   * Limpa todas as sessões (útil para suítes de teste).
   */
  public clearAll(): void {
    this.sessions.clear();
  }
}

export const sessionService = new SessionService();
