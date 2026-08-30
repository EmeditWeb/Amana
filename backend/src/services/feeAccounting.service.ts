import { Prisma, PrismaClient } from "@prisma/client";
import { Parser } from "json2csv";
import { prisma as defaultPrisma } from "../lib/db";
import { appLogger } from "../middleware/logger";
import { cacheService } from "../lib/cache";

export const FEE_RATE = 0.01; // 1% platform fee
export const CSV_EXPORT_MAX_ROWS = 100_000;

export interface FeeEventRecord {
  id: number;
  tradeId: string;
  tradeAmountUsdc: string;
  feeUsdc: string;
  collectedAt: Date;
  ledgerSequence: number | null;
}

export interface FeeAggregation {
  totalFeesUsdc: string;
  totalTrades: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface FeeListResult {
  items: FeeEventRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class FeeAccountingService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /**
   * Calculate and record the 1% platform fee for a completed trade.
   * Idempotent: if a fee event already exists for this tradeId, it is a no-op
   * and returns the existing record.
   */
  async recordFee(
    tx: Prisma.TransactionClient,
    tradeId: string,
    tradeAmountUsdc: string,
    ledgerSequence?: number,
  ): Promise<FeeEventRecord> {
    const existing = await tx.platformFeeEvent.findUnique({
      where: { tradeId },
    });

    if (existing) {
      appLogger.debug(
        { tradeId },
        "[FeeAccounting] Fee already recorded, skipping duplicate",
      );
      return existing;
    }

    const amount = parseFloat(tradeAmountUsdc);
    const fee = Number.isFinite(amount) ? amount * FEE_RATE : 0;
    const feeUsdc = fee.toFixed(6);

    const record = await tx.platformFeeEvent.create({
      data: {
        tradeId,
        tradeAmountUsdc,
        feeUsdc,
        ledgerSequence: ledgerSequence ?? null,
        collectedAt: new Date(),
      },
    });

    appLogger.info(
      { tradeId, tradeAmountUsdc, feeUsdc, ledgerSequence },
      "[FeeAccounting] Platform fee recorded",
    );

    return record;
  }

  /**
   * List fee events with optional date range filtering and pagination.
   */
  async listFees(params: {
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }): Promise<FeeListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PlatformFeeEventWhereInput = {};
    if (params.dateFrom || params.dateTo) {
      where.collectedAt = {
        ...(params.dateFrom ? { gte: params.dateFrom } : {}),
        ...(params.dateTo ? { lte: params.dateTo } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.db.platformFeeEvent.findMany({
        where,
        orderBy: [{ collectedAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      this.db.platformFeeEvent.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Aggregate total fees collected within an optional date range.
   */
  async aggregateFees(params: {
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<FeeAggregation> {
    const dateFrom = params.dateFrom?.toISOString() ?? null;
    const dateTo = params.dateTo?.toISOString() ?? null;
    const cacheKey = `fees:aggregate:${dateFrom ?? "start"}:${dateTo ?? "end"}`;

    return cacheService.getOrSet(cacheKey, 60, async () => {
      const filters: Prisma.Sql[] = [];
      if (params.dateFrom) {
        filters.push(Prisma.sql`"collectedAt" >= ${params.dateFrom}`);
      }
      if (params.dateTo) {
        filters.push(Prisma.sql`"collectedAt" <= ${params.dateTo}`);
      }

      const where =
        filters.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
          : Prisma.empty;

      const rows = await this.db.$queryRaw<
        Array<{ totalFeesUsdc: string | null; totalTrades: number | bigint }>
      >(Prisma.sql`
        SELECT
          COALESCE(SUM(CAST("feeUsdc" AS DECIMAL)), 0)::text AS "totalFeesUsdc",
          COUNT(*)::int AS "totalTrades"
        FROM "PlatformFeeEvent"
        ${where}
      `);
      const aggregate = rows[0];
      const total = Number.parseFloat(aggregate?.totalFeesUsdc ?? "0");

      return {
        totalFeesUsdc: Number.isFinite(total) ? total.toFixed(6) : "0.000000",
        totalTrades: Number(aggregate?.totalTrades ?? 0),
        dateFrom,
        dateTo,
      };
    });
  }

  /**
   * Export fee events in the date range as a CSV string.
   * Uses cursor-based pagination to avoid loading all records into memory at once.
   * Enforces a maximum row limit to prevent OOM on large datasets.
   */
  async exportCsv(params: {
    dateFrom?: Date;
    dateTo?: Date;
    maxRows?: number;
  }): Promise<{ csv: string; totalExported: number; truncated: boolean }> {
    const maxRows = Math.min(
      params.maxRows ?? CSV_EXPORT_MAX_ROWS,
      CSV_EXPORT_MAX_ROWS,
    );

    const where: Prisma.PlatformFeeEventWhereInput = {};
    if (params.dateFrom || params.dateTo) {
      where.collectedAt = {
        ...(params.dateFrom ? { gte: params.dateFrom } : {}),
        ...(params.dateTo ? { lte: params.dateTo } : {}),
      };
    }

    const parser = new Parser({
      fields: [
        "id",
        "tradeId",
        "tradeAmountUsdc",
        "feeUsdc",
        "collectedAt",
        "ledgerSequence",
      ],
    });

    const BATCH_SIZE = 1000;
    let lastId = 0;
    let totalExported = 0;
    let truncated = false;
    const rows: Array<Record<string, unknown>> = [];

    while (totalExported < maxRows) {
      const remaining = maxRows - totalExported;
      const take = Math.min(BATCH_SIZE, remaining);

      const batch = await this.db.platformFeeEvent.findMany({
        where: {
          ...where,
          id: { gt: lastId },
        },
        orderBy: [{ id: "asc" }],
        take,
      });

      if (batch.length === 0) break;

      for (const r of batch) {
        if (totalExported >= maxRows) {
          truncated = true;
          break;
        }
        rows.push({
          id: r.id,
          tradeId: r.tradeId,
          tradeAmountUsdc: r.tradeAmountUsdc,
          feeUsdc: r.feeUsdc,
          collectedAt: r.collectedAt.toISOString(),
          ledgerSequence: r.ledgerSequence ?? "",
        });
        totalExported++;
      }

      const lastRecord = batch[batch.length - 1];
      if (lastRecord) lastId = lastRecord.id;

      if (batch.length < take) break;
    }

    return {
      csv: parser.parse(rows),
      totalExported,
      truncated,
    };
  }
}

export const feeAccountingService = new FeeAccountingService();
