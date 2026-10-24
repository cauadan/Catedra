import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
 * Em desenvolvimento (NODE_ENV !== 'production'), secure é estritamente false.
 * Em produção (web e API em domínios distintos no Render), usa sameSite 'none' + secure
 * para que o navegador aceite e reenvie o cookie em requisições cross-site.
 */
export function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_MS,
  };
}

export const SESSION_CONFIG = {
  saveUninitialized: false,
  resave: false,
  cookie: getSessionCookieOptions(),
};

const DEV_SESSIONS_FILE = path.join(os.tmpdir(), 'estudos-dev-sessions.json');

function shouldPersistDevSessions(): boolean {
  return process.env.NODE_ENV !== 'test' && !process.env.VITEST;
}

/**
 * Gerenciador de Sessões em Memória com controle de expiração e TTL de 7 dias.
 * Em ambiente de desenvolvimento, sincroniza em arquivo temporário para preservar a sessão em reloads do tsx watch.
 */
export class SessionService {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadFromDisk();

    // Limpeza periódica de sessões expiradas a cada 1 hora
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    // Desassocia o timer do loop de eventos para não prender o processo em testes
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  private loadFromDisk(): void {
    if (!shouldPersistDevSessions()) return;
    try {
      if (!fs.existsSync(DEV_SESSIONS_FILE)) return;
      const raw = fs.readFileSync(DEV_SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<
        string,
        { userId: string; createdAt: string; expiresAt: string }
      >;
      const now = Date.now();
      for (const [sid, data] of Object.entries(parsed)) {
        const expiresAt = new Date(data.expiresAt);
        if (expiresAt.getTime() > now) {
          this.sessions.set(sid, {
            userId: data.userId,
            createdAt: new Date(data.createdAt),
            expiresAt,
          });
        }
      }
    } catch {
      // Ignora falhas de leitura de cache de sessão dev
    }
  }

  private saveToDisk(): void {
    if (!shouldPersistDevSessions()) return;
    try {
      const obj: Record<string, { userId: string; createdAt: string; expiresAt: string }> = {};
      for (const [sid, data] of this.sessions.entries()) {
        obj[sid] = {
          userId: data.userId,
          createdAt: data.createdAt.toISOString(),
          expiresAt: data.expiresAt.toISOString(),
        };
      }
      fs.writeFileSync(DEV_SESSIONS_FILE, JSON.stringify(obj), 'utf8');
    } catch {
      // Ignora falhas de escrita de cache de sessão dev
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
    this.saveToDisk();

    return sessionId;
  }

  /**
   * Recupera a sessão ativa caso válida e não expirada.
   */
  public getSession(sessionId: string | undefined): SessionData | null {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return null;
    }

    let session = this.sessions.get(sessionId);
    if (!session && shouldPersistDevSessions()) {
      this.loadFromDisk();
      session = this.sessions.get(sessionId);
    }
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      this.saveToDisk();
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
      this.saveToDisk();
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
    this.saveToDisk();
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
    this.saveToDisk();
  }

  /**
   * Limpa todas as sessões (útil para suítes de teste).
   */
  public clearAll(): void {
    this.sessions.clear();
    this.saveToDisk();
  }
}

export const sessionService = new SessionService();
