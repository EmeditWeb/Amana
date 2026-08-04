import { Worker, Job } from "bullmq";
import { createQueueConnection } from "../queue";
import { TrustScoreService } from "../../services/trustScore.service";
import { prisma } from "../../lib/db";
import { appLogger } from "../../middleware/logger";

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
      appLogger.info(
        { jobId: job.id, triggeredBy: job.data.triggeredBy },
        "[TrustScoreWorker] Processing recalculation job",
      );

      const service = new TrustScoreService(prisma);

      if (job.data.walletAddress) {
        const result = await service.calculateTrustScore(
          job.data.walletAddress,
        );
        appLogger.info(
          {
            jobId: job.id,
            walletAddress: job.data.walletAddress,
            trustScore: result.trustScore,
            tier: result.tier,
          },
          "[TrustScoreWorker] Single user recalculation complete",
        );
        return result;
      }

      appLogger.info(
        { jobId: job.id },
        "[TrustScoreWorker] Batch recalculation not yet implemented",
      );

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
    appLogger.info(
      { jobId: job.id },
      "[TrustScoreWorker] Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    appLogger.error(
      { jobId: job?.id, error: err.message },
      "[TrustScoreWorker] Job failed",
    );
  });

  return worker;
}
