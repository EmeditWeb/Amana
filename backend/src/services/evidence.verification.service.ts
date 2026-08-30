import { PrismaClient, TradeEvidence } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { recordEvidenceVerificationBatch, recordEvidenceVerificationFailure } from '../lib/metrics.js';

// ── Configuration ───────────────────────────────────────────────────────

export interface BatchConfig {
  /** Number of evidence records per batch (default: 100). */
  batchSize: number;
  /** Maximum retry attempts per failed batch (default: 3). */
  maxRetries: number;
  /** Delay between retry attempts in ms (default: 1000). */
  retryDelayMs: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ── Types ───────────────────────────────────────────────────────────────

export interface VerificationResult {
  cid: string;
  verified: boolean;
  pinned: boolean;
  error?: string;
}

export interface BatchProgress {
  /** Total evidence records discovered. */
  total: number;
  /** Number of records processed so far. */
  processed: number;
  /** Number of successful verifications. */
  succeeded: number;
  /** Number of failed verifications. */
  failed: number;
  /** Number of retries performed across all batches. */
  retries: number;
  /** Current batch index (1-based). */
  currentBatch: number;
  /** Total number of batches. */
  totalBatches: number;
}

export interface VerifyAllReport {
  progress: BatchProgress;
  results: VerificationResult[];
  durationMs: number;
}

// ── Service ─────────────────────────────────────────────────────────────

export class EvidenceVerificationService {
  private readonly prisma: PrismaClient;
  private readonly config: BatchConfig;

  constructor(prisma: PrismaClient, config?: Partial<BatchConfig>) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Verify all evidence records using paginated batch processing.
   *
   * Previously this loaded every record into memory at once (OOM risk).
   * Now it fetches records in configurable batches, tracks progress,
   * retries on transient failures, and emits metrics per batch.
   */
  async verifyAll(onProgress?: (progress: BatchProgress) => void): Promise<VerifyAllReport> {
    const startTime = Date.now();
    const { batchSize } = this.config;

    // Count total records up front for progress reporting
    const total = await this.prisma.tradeEvidence.count();
    const totalBatches = Math.ceil(total / batchSize) || 1;

    const progress: BatchProgress = {
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      retries: 0,
      currentBatch: 0,
      totalBatches,
    };

    const allResults: VerificationResult[] = [];
    let cursor: string | undefined;

    logger.info({ total, totalBatches, batchSize }, 'Starting batched evidence verification');

    while (progress.processed < total) {
      progress.currentBatch++;
      const batchStart = Date.now();

      const batch = await this.fetchBatch(batchSize, cursor);
      if (batch.length === 0) break;

      // Set cursor for next page
      cursor = batch[batch.length - 1].id;

      const { results, retries } = await this.processBatchWithRetry(batch);

      progress.processed += batch.length;
      progress.succeeded += results.filter((r) => r.verified).length;
      progress.failed += results.filter((r) => !r.verified).length;
      progress.retries += retries;

      allResults.push(...results);

      const batchDurationMs = Date.now() - batchStart;
      recordEvidenceVerificationBatch(progress.currentBatch, batch.length, batchDurationMs);

      logger.info(
        {
          batch: progress.currentBatch,
          totalBatches,
          batchCount: batch.length,
          batchDurationMs,
          overallProcessed: progress.processed,
        },
        'Evidence verification batch completed',
      );

      onProgress?.({ ...progress });
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      { ...progress, durationMs },
      'Evidence verification completed',
    );

    return { progress, results: allResults, durationMs };
  }

  /**
   * Verify a single evidence CID.
   */
  async verifySingle(cid: string): Promise<VerificationResult> {
    const record = await this.prisma.tradeEvidence.findFirst({
      where: { ipfsCid: cid },
    });

    if (!record) {
      return { cid, verified: false, pinned: false, error: 'Evidence record not found' };
    }

    // Check IPFS pin status (placeholder — real implementation checks Pinata/IPFS gateway)
    const pinned = await this.checkPinStatus(cid);
    return { cid, verified: pinned, pinned };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Fetch a single page of evidence records using cursor-based pagination.
   */
  private async fetchBatch(limit: number, afterId?: string): Promise<TradeEvidence[]> {
    return this.prisma.tradeEvidence.findMany({
      take: limit,
      skip: afterId ? 1 : 0,
      cursor: afterId ? { id: afterId } : undefined,
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Process a batch with configurable retry logic for transient failures.
   */
  private async processBatchWithRetry(
    batch: TradeEvidence[],
  ): Promise<{ results: VerificationResult[]; retries: number }> {
    const results: VerificationResult[] = [];
    let retries = 0;

    for (const record of batch) {
      let lastError: string | undefined;
      let verified = false;

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          verified = await this.checkPinStatus(record.ipfsCid);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          retries++;
          logger.warn(
            { cid: record.ipfsCid, attempt: attempt + 1, error: lastError },
            'Evidence verification attempt failed',
          );

          if (attempt < this.config.maxRetries) {
            await this.delay(this.config.retryDelayMs * (attempt + 1));
          }
        }
      }

      if (lastError) {
        recordEvidenceVerificationFailure(record.ipfsCid, lastError);
      }

      results.push({
        cid: record.ipfsCid,
        verified,
        pinned: verified,
        error: lastError,
      });
    }

    return { results, retries };
  }

  /**
   * Check whether a CID is pinned on IPFS (Pinata / IPFS gateway).
   *
   * In production this calls the Pinata `data/pinList` API or queries
   * an IPFS gateway.  Replace this stub with the real implementation.
   */
  private async checkPinStatus(_cid: string): Promise<boolean> {
    // TODO: Integrate with Pinata / IPFS gateway
    // const res = await fetch(`https://api.pinata.cloud/data/pinList?hashContains=${cid}`, {
    //   headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    // });
    // const data = await res.json();
    // return data.count > 0;
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
