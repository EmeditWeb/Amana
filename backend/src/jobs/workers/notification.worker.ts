import { Worker, Job } from 'bullmq';
import { createQueueConnection, NotificationJobData } from '../queue';
import { prisma } from '../../lib/db';
import type { Prisma } from '@prisma/client';
<<<<<<< ours
import { getJobContextualLogger } from '../../lib/logging';
=======
import { bullJobDuration, bullJobFailedTotal } from '../../lib/bullMetrics';
>>>>>>> theirs

export function createNotificationWorker(): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { userAddress, type, title, message, metadata } = job.data;
<<<<<<< ours
      const logger = getJobContextualLogger(job.id, undefined, { userAddress, type });

      logger.info('Processing notification job');

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
        // email / push: log intent; extend with provider integration
        logger.info(`${type} notification dispatched`);
      }

      logger.info('Notification job completed');
=======
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
>>>>>>> theirs
    },
    { connection: createQueueConnection() },
  );
}
