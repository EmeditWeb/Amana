import { Worker, Job } from 'bullmq';
import { appLogger } from '../../middleware/logger';
import { createQueueConnection, WebhookJobData } from '../queue';
import { webhookService } from '../../services/webhook.service';
import { bullJobDuration, bullJobFailedTotal } from '../../lib/bullMetrics';

export function createWebhookWorker(): Worker<WebhookJobData> {
  return new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { tradeId, status, payload } = job.data;
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
    },
    { connection: createQueueConnection() },
  );
}
