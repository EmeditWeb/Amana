import { PrismaClient, TradeStatus, DisputeStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/db";
import { appLogger } from "../middleware/logger";

export interface TrustScoreBreakdown {
  baseScore: number;
  tradeCompletionBonus: number;
  volumeBonus: number;
  disputePenalty: number;
  activityDecay: number;
  finalScore: number;
}

export interface TrustScoreDetails {
  trustScore: number;
  breakdown: TrustScoreBreakdown;
  stats: {
    totalTrades: number;
    completedTrades: number;
    disputedTrades: number;
    totalVolumeUsdc: number;
    successRate: number;
    accountAgeDays: number;
    lastTradeAt: string | null;
  };
  tier: TrustTier;
  history: TrustScoreEvent[];
}

export type TrustTier =
  | "newcomer"
  | "developing"
  | "established"
  | "trusted"
  | "elite";

export interface TrustScoreEvent {
  id: string;
  event: string;
  impact: number;
  impactLabel: string;
  timestamp: string;
  type:
    | "trade_completed"
    | "trade_initiated"
    | "dispute_initiated"
    | "dispute_lost"
    | "volume_milestone"
    | "account_created";
  decayedImpact: number;
}

interface TrustScoreConfig {
  baseScore: number;
  tradeCompletionPoints: number;
  tradeCompletionMaxTrades: number;
  tradeCompletionDiminishingRate: number;
  volumeThresholds: { minTrades: number; bonus: number }[];
  disputeInitiatedPenalty: number;
  disputeLostPenalty: number;
  decayHalfLifeDays: number;
  minScore: number;
  maxScore: number;
}

const DEFAULT_CONFIG: TrustScoreConfig = {
  baseScore: 50,
  tradeCompletionPoints: 5,
  tradeCompletionMaxTrades: 50,
  tradeCompletionDiminishingRate: 0.8,
  volumeThresholds: [
    { minTrades: 50, bonus: 15 },
    { minTrades: 25, bonus: 8 },
    { minTrades: 10, bonus: 5 },
  ],
  disputeInitiatedPenalty: 2,
  disputeLostPenalty: 8,
  decayHalfLifeDays: 90,
  minScore: 0,
  maxScore: 100,
};

type TrustScoreDatabase = {
  trade: Pick<PrismaClient["trade"], "findMany">;
  dispute: Pick<PrismaClient["dispute"], "findMany">;
  user: Pick<PrismaClient["user"], "findUnique">;
};

export class TrustScoreService {
  private config: TrustScoreConfig;

  constructor(
    private readonly prisma: TrustScoreDatabase = defaultPrisma as unknown as TrustScoreDatabase,
    config?: Partial<TrustScoreConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async calculateTrustScore(walletAddress: string): Promise<TrustScoreDetails> {
    const normalized = walletAddress.toLowerCase();
    const startTime = Date.now();

    appLogger.info(
      { walletAddress: normalized },
      "[TrustScore] Calculating trust score",
    );

    const user = await this.prisma.user.findUnique({
      where: { walletAddress: normalized },
    });

    const [buyerTrades, sellerTrades, disputes] = await Promise.all([
      this.prisma.trade.findMany({
        where: { buyerAddress: normalized },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.trade.findMany({
        where: { sellerAddress: normalized },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.dispute.findMany({
        where: { initiator: normalized },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const allTrades = [...buyerTrades, ...sellerTrades];
    const completedTrades = allTrades.filter(
      (t) => t.status === TradeStatus.COMPLETED,
    );
    const disputedTrades = allTrades.filter(
      (t) => t.status === TradeStatus.DISPUTED,
    );
    const totalTrades = allTrades.length;
    const completedCount = completedTrades.length;
    const disputedCount = disputedTrades.length;

    const totalVolumeUsdc = allTrades.reduce((sum, t) => {
      return sum + parseFloat(t.amountUsdc || "0");
    }, 0);

    const successRate =
      totalTrades > 0
        ? Math.round((completedCount / totalTrades) * 1000) / 10
        : 100;

    const accountAgeDays = user
      ? Math.floor(
          (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    const lastTrade =
      allTrades.length > 0
        ? allTrades.reduce((latest, t) =>
            t.updatedAt > latest.updatedAt ? t : latest,
          )
        : null;

    const breakdown = this.calculateBreakdown(
      completedCount,
      totalTrades,
      totalVolumeUsdc,
      disputes.length,
      allTrades,
      normalized,
    );

    const tier = this.getTrustTier(breakdown.finalScore);

    const history = this.buildHistory(
      completedTrades,
      disputes,
      normalized,
    );

    const durationMs = Date.now() - startTime;
    appLogger.info(
      {
        walletAddress: normalized,
        trustScore: breakdown.finalScore,
        tier,
        durationMs,
      },
      "[TrustScore] Calculation complete",
    );

    return {
      trustScore: breakdown.finalScore,
      breakdown,
      stats: {
        totalTrades,
        completedTrades: completedCount,
        disputedTrades: disputedCount,
        totalVolumeUsdc,
        successRate,
        accountAgeDays,
        lastTradeAt: lastTrade?.updatedAt.toISOString() ?? null,
      },
      tier,
      history,
    };
  }

  private calculateBreakdown(
    completedCount: number,
    totalTrades: number,
    totalVolumeUsdc: number,
    disputeCount: number,
    allTrades: { createdAt: Date; amountUsdc: string; status: TradeStatus }[],
    normalizedAddress: string,
  ): TrustScoreBreakdown {
    const baseScore = this.config.baseScore;

    const tradeCompletionBonus = this.calculateTradeCompletionBonus(
      completedCount,
    );

    const volumeBonus = this.calculateVolumeBonus(totalTrades, totalVolumeUsdc);

    const disputePenalty = this.calculateDisputePenalty(disputeCount);

    const activityDecay = this.calculateActivityDecay(
      allTrades,
      normalizedAddress,
    );

    const rawScore =
      baseScore +
      tradeCompletionBonus +
      volumeBonus -
      disputePenalty +
      activityDecay;

    const finalScore = Math.max(
      this.config.minScore,
      Math.min(this.config.maxScore, Math.round(rawScore * 10) / 10),
    );

    return {
      baseScore,
      tradeCompletionBonus,
      volumeBonus,
      disputePenalty,
      activityDecay,
      finalScore,
    };
  }

  private calculateTradeCompletionBonus(completedCount: number): number {
    if (completedCount === 0) return 0;

    const { tradeCompletionPoints, tradeCompletionMaxTrades, tradeCompletionDiminishingRate } =
      this.config;

    let bonus = 0;
    for (let i = 1; i <= Math.min(completedCount, tradeCompletionMaxTrades); i++) {
      bonus += tradeCompletionPoints * Math.pow(tradeCompletionDiminishingRate, i - 1);
    }

    return Math.round(bonus * 10) / 10;
  }

  private calculateVolumeBonus(totalTrades: number, totalVolumeUsdc: number): number {
    const { volumeThresholds } = this.config;

    let tradeCountBonus = 0;
    for (const threshold of volumeThresholds) {
      if (totalTrades >= threshold.minTrades) {
        tradeCountBonus = threshold.bonus;
        break;
      }
    }

    const volumeBonus = totalVolumeUsdc >= 100000 ? 5
      : totalVolumeUsdc >= 50000 ? 3
      : totalVolumeUsdc >= 10000 ? 2
      : totalVolumeUsdc >= 1000 ? 1
      : 0;

    return tradeCountBonus + volumeBonus;
  }

  private calculateDisputePenalty(disputeCount: number): number {
    if (disputeCount === 0) return 0;

    return disputeCount * this.config.disputeInitiatedPenalty;
  }

  private calculateActivityDecay(
    allTrades: { createdAt: Date; amountUsdc: string; status: TradeStatus }[],
    _normalizedAddress: string,
  ): number {
    if (allTrades.length === 0) return 0;

    const now = Date.now();
    const halfLifeMs = this.config.decayHalfLifeDays * 24 * 60 * 60 * 1000;
    let weightedSum = 0;
    let totalWeight = 0;

    for (const trade of allTrades) {
      const ageMs = now - trade.createdAt.getTime();
      const weight = Math.pow(0.5, ageMs / halfLifeMs);

      let tradeValue = 0;
      if (trade.status === TradeStatus.COMPLETED) {
        tradeValue = 2;
      } else if (trade.status === TradeStatus.DISPUTED) {
        tradeValue = -1;
      } else if (trade.status === TradeStatus.FUNDED || trade.status === TradeStatus.DELIVERED) {
        tradeValue = 1;
      }

      weightedSum += tradeValue * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 0;

    const normalizedScore = (weightedSum / totalWeight) * 5;
    return Math.round(Math.max(-20, Math.min(20, normalizedScore)) * 10) / 10;
  }

  getTrustTier(score: number): TrustTier {
    if (score >= 85) return "elite";
    if (score >= 70) return "trusted";
    if (score >= 55) return "established";
    if (score >= 35) return "developing";
    return "newcomer";
  }

  private buildHistory(
    completedTrades: { tradeId: string; buyerAddress: string; sellerAddress: string; completedAt: Date | null; createdAt: Date }[],
    disputes: { id: number; tradeId: string; status: DisputeStatus; createdAt: Date }[],
    normalizedAddress: string,
  ): TrustScoreEvent[] {
    const events: TrustScoreEvent[] = [];
    const now = Date.now();
    const halfLifeMs = this.config.decayHalfLifeDays * 24 * 60 * 60 * 1000;

    for (const trade of completedTrades.slice(0, 10)) {
      const role = trade.buyerAddress === normalizedAddress ? "buyer" : "seller";
      const timestamp = trade.completedAt?.toISOString() ?? trade.createdAt.toISOString();
      const ageMs = now - (trade.completedAt ?? trade.createdAt).getTime();
      const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
      const rawImpact = this.config.tradeCompletionPoints;
      const decayedImpact = Math.round(rawImpact * decayFactor * 10) / 10;

      events.push({
        id: `trade-${trade.tradeId}`,
        event: `Completed trade as ${role} (${trade.tradeId.slice(0, 8)}...)`,
        impact: rawImpact,
        impactLabel: `+${rawImpact}`,
        timestamp,
        type: "trade_completed",
        decayedImpact,
      });
    }

    for (const dispute of disputes.slice(0, 5)) {
      const lost = dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED;
      const timestamp = dispute.createdAt.toISOString();
      const ageMs = now - dispute.createdAt.getTime();
      const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
      const rawImpact = lost
        ? -this.config.disputeLostPenalty
        : -this.config.disputeInitiatedPenalty;
      const decayedImpact = Math.round(rawImpact * decayFactor * 10) / 10;

      events.push({
        id: `dispute-${dispute.id}`,
        event: lost
          ? `Dispute on trade ${dispute.tradeId.slice(0, 8)}... was resolved against you`
          : `Initiated dispute on trade ${dispute.tradeId.slice(0, 8)}...`,
        impact: rawImpact,
        impactLabel: `${rawImpact}`,
        timestamp,
        type: lost ? "dispute_lost" : "dispute_initiated",
        decayedImpact,
      });
    }

    events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return events.slice(0, 20);
  }
}
