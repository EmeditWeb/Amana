import { Worker, Job } from "bullmq";
import { createQueueConnection } from "../queue";
import { TrustScoreService } from "../../services/trustScore.service";
import { prisma } from "../../lib/db";
import { getJobContextualLogger } from "../../lib/logging";

export interface TrustScoreRecalculationJobData {
  triggeredBy: string;
  walletAddress?: string;
}

const QUEUE_NAME = "trust-score-recalculation";

export function createTrustScoreRecalculationWorker() {
  const connection = createQueueConnection();

  const worker = new Worker<TrustScoreRecalculationJobData>(
    QUEUE_NAME,
    async (job: Job<TrustScoreRecalculationJobData>) => {
      const logger = getJobContextualLogger(job.id, undefined, { triggeredBy: job.data.triggeredBy });
      logger.info("[TrustScoreWorker] Processing recalculation job");

      const service = new TrustScoreService(prisma);

      if (job.data.walletAddress) {
        const result = await service.calculateTrustScore(
          job.data.walletAddress,
        );
        logger.info(
          {
            walletAddress: job.data.walletAddress,
            trustScore: result.trustScore,
            tier: result.tier,
          },
          "[TrustScoreWorker] Single user recalculation complete",
        );
        return result;
      }

      logger.info("[TrustScoreWorker] Batch recalculation not yet implemented");

      return { processed: 0 };
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  );

  worker.on("completed", (job) => {
    const logger = getJobContextualLogger(job.id);
    logger.info("[TrustScoreWorker] Job completed");
  });

  worker.on("failed", (job, err) => {
    const logger = getJobContextualLogger(job?.id);
    logger.error({ error: err.message }, "[TrustScoreWorker] Job failed");
  });

  return worker;
}
