import { Worker, Job } from 'bullmq';
import { createQueueConnection, WebhookJobData } from '../queue';
import { webhookService } from '../../services/webhook.service';
<<<<<<< ours
import { getJobContextualLogger } from '../../lib/logging';
=======
import { bullJobDuration, bullJobFailedTotal } from '../../lib/bullMetrics';
>>>>>>> theirs

export function createWebhookWorker(): Worker<WebhookJobData> {
  return new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { tradeId, status, payload } = job.data;
<<<<<<< ours
      const logger = getJobContextualLogger(job.id, undefined, { tradeId, status });

      logger.info('Processing webhook job');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await webhookService.dispatch(tradeId, status as any, payload);
      logger.info('Webhook job completed');
=======
      appLogger.info({ jobId: job.id, tradeId, status }, 'Processing webhook job');
      const start = performance.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await webhookService.dispatch(tradeId, status as any, payload);
        bullJobDuration.record((performance.now() - start) / 1000, { queue: 'webhooks', job_type: 'dispatch' });
        appLogger.info({ jobId: job.id, tradeId }, 'Webhook job completed');
      } catch (err) {
        bullJobFailedTotal.add(1, { queue: 'webhooks', job_type: 'dispatch', error_code: 'error' });
        throw err;
      }
>>>>>>> theirs
    },
    { connection: createQueueConnection() },
  );
}
