import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Gera o hash criptográfico seguro de uma senha utilizando bcrypt (10 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara uma senha em texto plano com um hash seguro bcrypt.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
