import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '@estudos/domain';
import { authService } from '../services/auth.service.js';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '../services/session.service.js';
import { formatErrorResponse } from '../utils/errors.js';

export class AuthController {
  /**
   * POST /api/auth/register
   * Realiza o cadastro de um novo usuário, emitindo o cookie de sessão httpOnly.
   */
  public static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parseResult = registerSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : undefined,
          message: issue.message,
        }));

        res
          .status(400)
          .json(formatErrorResponse('VALIDATION_ERROR', 'Dados de cadastro inválidos.', details));
        return;
      }

      const result = await authService.register(parseResult.data);

      if (!result.success) {
        if (result.reason === 'conflict') {
          res
            .status(409)
            .json(
              formatErrorResponse(
                'CONFLICT',
                'E-mail já cadastrado no sistema.'
              )
            );
          return;
        }
      }

      if (result.success) {
        res.cookie(SESSION_COOKIE_NAME, result.sessionId, getSessionCookieOptions());
        res.status(201).json({
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            timezone: result.user.timezone,
            week_starts_on: result.user.week_starts_on,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Valida as credenciais do usuário e emite o cookie de sessão httpOnly.
   */
  public static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parseResult = loginSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : undefined,
          message: issue.message,
        }));

        res
          .status(400)
          .json(formatErrorResponse('VALIDATION_ERROR', 'Dados de login inválidos.', details));
        return;
      }

      const result = await authService.login(parseResult.data);

      if (!result.success) {
        res
          .status(401)
          .json(
            formatErrorResponse(
              'UNAUTHORIZED',
              'Credenciais inválidas. Verifique seu e-mail e senha.'
            )
          );
        return;
      }

      res.cookie(SESSION_COOKIE_NAME, result.sessionId, getSessionCookieOptions());
      res.status(200).json({
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          timezone: result.user.timezone,
          week_starts_on: result.user.week_starts_on,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Destrói a sessão ativa e remove o cookie httpOnly.
   */
  public static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
      authService.logout(sessionId);

      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Retorna os dados do perfil do usuário autenticado pela sessão.
   */
  public static async me(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(formatErrorResponse('UNAUTHORIZED', 'Não autorizado'));
        return;
      }

      res.status(200).json({
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          timezone: req.user.timezone,
          week_starts_on: req.user.week_starts_on,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
