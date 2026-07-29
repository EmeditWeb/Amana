import { Prisma, PrismaClient } from "@prisma/client";
import { Parser } from "json2csv";
import { prisma as defaultPrisma } from "../lib/db";
import { appLogger } from "../middleware/logger";

export const FEE_RATE = 0.01; // 1% platform fee

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
    const where: Prisma.PlatformFeeEventWhereInput = {};
    if (params.dateFrom || params.dateTo) {
      where.collectedAt = {
        ...(params.dateFrom ? { gte: params.dateFrom } : {}),
        ...(params.dateTo ? { lte: params.dateTo } : {}),
      };
    }

    const records = await this.db.platformFeeEvent.findMany({
      where,
      select: { feeUsdc: true },
    });

    const total = records.reduce((sum, r) => {
      const v = parseFloat(r.feeUsdc);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    return {
      totalFeesUsdc: total.toFixed(6),
      totalTrades: records.length,
      dateFrom: params.dateFrom?.toISOString() ?? null,
      dateTo: params.dateTo?.toISOString() ?? null,
    };
  }

  /**
   * Export all fee events in the date range as a CSV string.
   */
  async exportCsv(params: { dateFrom?: Date; dateTo?: Date }): Promise<string> {
    const where: Prisma.PlatformFeeEventWhereInput = {};
    if (params.dateFrom || params.dateTo) {
      where.collectedAt = {
        ...(params.dateFrom ? { gte: params.dateFrom } : {}),
        ...(params.dateTo ? { lte: params.dateTo } : {}),
      };
    }

    const records = await this.db.platformFeeEvent.findMany({
      where,
      orderBy: [{ collectedAt: "desc" }, { id: "desc" }],
    });

    const rows = records.map((r) => ({
      id: r.id,
      tradeId: r.tradeId,
      tradeAmountUsdc: r.tradeAmountUsdc,
      feeUsdc: r.feeUsdc,
      collectedAt: r.collectedAt.toISOString(),
      ledgerSequence: r.ledgerSequence ?? "",
    }));

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

    return parser.parse(rows);
  }
}

export const feeAccountingService = new FeeAccountingService();
