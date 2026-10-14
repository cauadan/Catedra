import { User } from '@prisma/client';

/**
 * Representação segura do usuário autenticado sem o hash de senha.
 */
export type SafeUser = Omit<User, 'password_hash'>;
