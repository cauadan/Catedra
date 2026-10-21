import { PrismaClient } from '@prisma/client';

/**
 * Instância singleton do Prisma Client para acesso ao banco PostgreSQL.
 * Habilita emissão de eventos de query para auditoria de performance anti-N+1.
 */
export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
        ],
});
