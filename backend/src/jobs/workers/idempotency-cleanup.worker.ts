import { Worker, Job, Queue } from "bullmq";
import { appLogger } from "../../middleware/logger";
import { createQueueConnection } from "../queue";
import { redis } from "../../lib/redis";
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("amana-backend");
const keysCleanedTotal = meter.createCounter("idempotency_keys_cleaned_total", {
  description: "Total number of idempotency keys removed by the GC job",
});

const QUEUE_NAME = "idempotency-cleanup";

export const idempotencyCleanupQueue = new Queue(QUEUE_NAME, {
  connection: createQueueConnection(),
});

/** Schedule the daily cleanup cron if not already scheduled. */
export async function scheduleIdempotencyCleanup(): Promise<void> {
  const existing = await idempotencyCleanupQueue.getRepeatableJobs();
  if (existing.some((j) => j.name === "daily-cleanup")) return;

  await idempotencyCleanupQueue.add(
    "daily-cleanup",
    {},
    { repeat: { pattern: "0 3 * * *" } }, // 03:00 UTC daily
  );
  appLogger.info("Idempotency cleanup cron scheduled");
}

export function createIdempotencyCleanupWorker(): Worker {
  return new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      appLogger.info("Running idempotency key GC");
      let cleaned = 0;
      let cursor = "0";

      // Redis TTL-based expiry handles actual deletion; this job cleans keys
      // that were stored without TTL (legacy) or whose TTL has already elapsed
      // but haven't been evicted yet (edge case on non-volatile-lru policies).
      do {
        const [next, keys] = await redis.scan(
          cursor,
          "MATCH",
          "idempotency:*",
          "COUNT",
          200,
        );
        cursor = next;

        for (const key of keys) {
          const ttl = await redis.ttl(key);
          // ttl === -1 means no expiry set (legacy key) — delete it
          if (ttl === -1) {
            await redis.del(key);
            cleaned++;
          }
        }
      } while (cursor !== "0");

      keysCleanedTotal.add(cleaned);
      appLogger.info({ cleaned }, "Idempotency key GC complete");
    },
    { connection: createQueueConnection() },
  );
}
