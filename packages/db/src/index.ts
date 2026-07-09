import { PrismaClient } from '@prisma/client';

export * from './encryption';

/**
 * Global singleton for the Prisma client.
 *
 * In development the client is attached to `globalThis` so that
 * hot-reloading (e.g. via Next.js) does not create a new connection
 * pool on every module reload.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';
