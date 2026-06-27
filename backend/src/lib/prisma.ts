/**
 * Singleton Prisma client. Reuse across hot-reload in dev to avoid
 * "too many connections" errors.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '@/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
