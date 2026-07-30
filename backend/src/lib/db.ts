import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { recordPoolMetrics, recordPoolTimeout } from './metrics';

// Ensure a single instance of Prisma Client is used across the application
declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  client.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    const model = String(params.model ?? "");
    const operation = params.action;
    const startTime = Date.now();

    const data = params.args?.data as Record<string, unknown> | undefined;

    if (data) {
      if (model === 'User' && typeof data.walletAddress === 'string') {
        data.walletAddress = data.walletAddress.toLowerCase();
      }

      if (model === 'Trade') {
        if (typeof data.buyerAddress === 'string') {
          data.buyerAddress = data.buyerAddress.toLowerCase();
        }
        if (typeof data.sellerAddress === 'string') {
          data.sellerAddress = data.sellerAddress.toLowerCase();
        }
      }

      if (model === 'Dispute' && typeof data.initiator === 'string') {
        data.initiator = data.initiator.toLowerCase();
      }
    }

    try {
      const result = await next(params);
      const durationMs = Date.now() - startTime;
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      throw error;
    }
  });

  return client;
};

export const prisma = global.prisma ?? prismaClientSingleton();

if (env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
