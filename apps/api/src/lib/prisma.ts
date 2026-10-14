import { PrismaClient } from '@prisma/client';

/**
 * Instância singleton do Prisma Client para acesso ao banco PostgreSQL.
 * Centraliza logs e conexões reutilizáveis no ciclo de vida da API.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
