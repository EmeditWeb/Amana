import { Worker, Job } from 'bullmq';
import { appLogger } from '../../middleware/logger';
import { createQueueConnection, NotificationJobData } from '../queue';
import { prisma } from '../../lib/db';
import type { Prisma } from '@prisma/client';
import { bullJobDuration, bullJobFailedTotal } from '../../lib/bullMetrics';

export function createNotificationWorker(): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { userAddress, type, title, message, metadata } = job.data;
      appLogger.info({ jobId: job.id, userAddress, type }, 'Processing notification job');
      const start = performance.now();
      try {
        if (type === 'in_app') {
          await prisma.inAppNotification.create({
            data: {
              userAddress,
              title,
              message,
              type,
              metadata: (metadata ?? {}) as Prisma.InputJsonValue,
            },
          });
        } else {
          appLogger.info({ jobId: job.id, type, userAddress }, `${type} notification dispatched`);
        }
        bullJobDuration.record((performance.now() - start) / 1000, { queue: 'notifications', job_type: type });
        appLogger.info({ jobId: job.id, userAddress }, 'Notification job completed');
      } catch (err) {
        bullJobFailedTotal.add(1, { queue: 'notifications', job_type: type, error_code: 'error' });
        throw err;
      }
    },
    { connection: createQueueConnection() },
  );
}
