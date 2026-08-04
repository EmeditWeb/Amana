import { Worker, Job } from 'bullmq';
import { createQueueConnection, WebhookJobData } from '../queue';
import { webhookService } from '../../services/webhook.service';
import { getJobContextualLogger } from '../../lib/logging';

export function createWebhookWorker(): Worker<WebhookJobData> {
  return new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { tradeId, status, payload } = job.data;
      const logger = getJobContextualLogger(job.id, undefined, { tradeId, status });

      logger.info('Processing webhook job');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await webhookService.dispatch(tradeId, status as any, payload);
      logger.info('Webhook job completed');
    },
    { connection: createQueueConnection() },
  );
}
