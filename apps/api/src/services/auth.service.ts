import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sessionService } from './session.service.js';
import { SafeUser } from '../types/auth.types.js';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export type AuthResult =
  | { success: true; user: SafeUser; sessionId: string }
  | { success: false; reason: 'conflict' | 'invalid_credentials' };

export class AuthService {
  /**
   * Registra um novo usuário no sistema com fuso horário e senha criptografada.
   */
  public async register(dto: RegisterDTO): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return { success: false, reason: 'conflict' };
    }

    const passwordHash = await hashPassword(dto.password);
    const timezone = dto.timezone?.trim() || 'America/Sao_Paulo';

    try {
      const user = await prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: normalizedEmail,
          password_hash: passwordHash,
          timezone,
          week_starts_on: 'MONDAY',
        },
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

      const sessionId = sessionService.createSession(user.id);
      return { success: true, user, sessionId };
    } catch (error) {
      // Captura violação de restrição única do Prisma (P2002) decorrente de concorrência simultânea (TOCTOU)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { success: false, reason: 'conflict' };
      }
      throw error;
    }
  }

  /**
   * Autentica um usuário existente validando e-mail e senha.
   */
  public async login(dto: LoginDTO): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, reason: 'invalid_credentials' };
    }

    const isMatch = await verifyPassword(dto.password, user.password_hash);
    if (!isMatch) {
      return { success: false, reason: 'invalid_credentials' };
    }

    const sessionId = sessionService.createSession(user.id);

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      week_starts_on: user.week_starts_on,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return { success: true, user: safeUser, sessionId };
  }

  /**
   * Realiza o logout revogando a sessão ativa.
   */
  public logout(sessionId: string | undefined): void {
    if (sessionId) {
      sessionService.deleteSession(sessionId);
    }
  }
}

export const authService = new AuthService();
