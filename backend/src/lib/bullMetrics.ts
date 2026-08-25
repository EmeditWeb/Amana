import { Queue } from "bullmq";
import { metrics } from "@opentelemetry/api";
import { appLogger } from "../middleware/logger";

const meter = metrics.getMeter("amana-backend");

const queueWaiting = meter.createObservableGauge("bull_queue_waiting", {
  description: "Number of waiting jobs in BullMQ queue",
});
const queueActive = meter.createObservableGauge("bull_queue_active", {
  description: "Number of active jobs in BullMQ queue",
});
const queueFailed = meter.createObservableGauge("bull_queue_failed", {
  description: "Number of failed jobs in BullMQ queue",
});

export const bullJobDuration = meter.createHistogram("bull_job_duration_seconds", {
  description: "BullMQ job processing duration in seconds",
  unit: "s",
});

export const bullJobFailedTotal = meter.createCounter("bull_job_failed_total", {
  description: "Total number of failed BullMQ jobs",
});

type QueueEntry = { name: string; queue: Queue };
const registeredQueues: QueueEntry[] = [];

/** Register a queue for metric collection. Call once per queue at startup. */
export function registerQueueForMetrics(name: string, queue: Queue): void {
  registeredQueues.push({ name, queue });
}

async function collectQueueCounts(): Promise<void> {
  for (const { name, queue } of registeredQueues) {
    try {
      const counts = await queue.getJobCounts("waiting", "active", "failed");
      queueWaiting.addCallback((result) => result.observe(counts.waiting ?? 0, { queue: name }));
      queueActive.addCallback((result) => result.observe(counts.active ?? 0, { queue: name }));
      queueFailed.addCallback((result) => result.observe(counts.failed ?? 0, { queue: name }));
    } catch (err) {
      appLogger.warn({ err, queue: name }, "Failed to collect BullMQ metrics");
    }
  }
}

let _collectionInterval: ReturnType<typeof setInterval> | null = null;

/** Start collecting queue metrics every 15 seconds. Idempotent. */
export function startQueueMetricsCollection(): void {
  if (_collectionInterval) return;
  _collectionInterval = setInterval(() => {
    collectQueueCounts().catch((err) =>
      appLogger.warn({ err }, "BullMQ metrics collection error"),
    );
  }, 15_000);
}

/** Stop collection (used in tests). */
export function stopQueueMetricsCollection(): void {
  if (_collectionInterval) {
    clearInterval(_collectionInterval);
    _collectionInterval = null;
  }
}
