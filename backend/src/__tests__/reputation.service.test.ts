import { ReputationService } from "../services/reputation.service";

const TradeStatus = {
  COMPLETED: "COMPLETED",
  DISPUTED: "DISPUTED",
  FUNDED: "FUNDED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  CREATED: "CREATED",
} as const;

describe("ReputationService", () => {
  let mockPrisma: {
    trade: { findMany: jest.Mock };
    dispute: { findMany: jest.Mock };
  };
  let service: ReputationService;

  const allTrades: Record<string, unknown>[] = [];

  function setMockTrades(trades: Record<string, unknown>[]) {
    allTrades.length = 0;
    allTrades.push(...trades);
    mockPrisma.trade.findMany.mockImplementation(
      ({ where }: { where: { buyerAddress?: string; sellerAddress?: string } }) =>
        Promise.resolve(
          allTrades.filter(
            (t) =>
              (where.buyerAddress && (t as any).buyerAddress === where.buyerAddress) ||
              (where.sellerAddress && (t as any).sellerAddress === where.sellerAddress),
          ),
        ),
    );
  }

  function makeTrade(overrides: Record<string, unknown> = {}) {
    return {
      tradeId: overrides.tradeId ?? "trade-001",
      buyerAddress: overrides.buyerAddress ?? "gbuyer",
      sellerAddress: overrides.sellerAddress ?? "gseller",
      amountUsdc: overrides.amountUsdc ?? "1000",
      status: overrides.status ?? TradeStatus.COMPLETED,
      createdAt: overrides.createdAt ?? new Date("2025-01-01"),
      completedAt: overrides.completedAt ?? new Date("2025-01-15"),
      updatedAt: overrides.updatedAt ?? new Date("2025-01-15"),
    };
  }

  beforeEach(() => {
    mockPrisma = {
      trade: { findMany: jest.fn() },
      dispute: { findMany: jest.fn() },
    };
    service = new ReputationService(mockPrisma as any);
  });

  describe("getUserReputation", () => {
    it("should return default values when user has no trades", async () => {
      setMockTrades([]);
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.trustScore).toBe(50);
      expect(result.totalTrades).toBe(0);
      expect(result.completedTrades).toBe(0);
      expect(result.disputedTrades).toBe(0);
      expect(result.successRate).toBe(100);
      expect(result.history).toEqual([]);
    });

    it("should increase trust score for completed trades as buyer", async () => {
      setMockTrades(
        Array.from({ length: 3 }, (_, i) =>
          makeTrade({ tradeId: `trade-${i}`, buyerAddress: "guser" }),
        ),
      );
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.trustScore).toBe(65);
      expect(result.totalTrades).toBe(3);
      expect(result.completedTrades).toBe(3);
    });

    it("should apply dispute penalties to trust score", async () => {
      setMockTrades([]);
      mockPrisma.dispute.findMany.mockResolvedValue([
        {
          id: 1,
          tradeId: "trade-001",
          status: "RESOLVED",
          initiator: "guser",
          createdAt: new Date("2025-01-10"),
        },
        {
          id: 2,
          tradeId: "trade-002",
          status: "OPEN",
          initiator: "guser",
          createdAt: new Date("2025-01-11"),
        },
      ]);

      const result = await service.getUserReputation("guser");

      expect(result.trustScore).toBe(38);
      expect(result.disputedTrades).toBe(0);
    });

    it("should compute success rate correctly", async () => {
      setMockTrades([
        makeTrade({ buyerAddress: "guser", status: TradeStatus.COMPLETED }),
        makeTrade({ buyerAddress: "guser", status: TradeStatus.COMPLETED }),
        makeTrade({ buyerAddress: "guser", status: TradeStatus.DISPUTED }),
        makeTrade({ buyerAddress: "guser", status: TradeStatus.FUNDED }),
      ]);
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.successRate).toBe(50);
      expect(result.totalTrades).toBe(4);
      expect(result.completedTrades).toBe(2);
    });

    it("should clamp trust score to 0-100 range", async () => {
      setMockTrades(
        Array.from({ length: 100 }, (_, i) =>
          makeTrade({ tradeId: `trade-${i}`, buyerAddress: "guser" }),
        ),
      );
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.trustScore).toBe(100);
    });

    it("should cap history at 20 entries", async () => {
      setMockTrades(
        Array.from({ length: 30 }, (_, i) =>
          makeTrade({ tradeId: `trade-${i}`, buyerAddress: "guser" }),
        ),
      );
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.history.length).toBeLessThanOrEqual(20);
    });

    it("should handle seller role correctly in history", async () => {
      setMockTrades([
        makeTrade({
          tradeId: "trade-seller",
          buyerAddress: "gbuyer",
          sellerAddress: "guser",
        }),
      ]);
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.history[0]!.event).toContain("seller");
    });

    it("should handle buyer role correctly in history", async () => {
      setMockTrades([
        makeTrade({
          tradeId: "trade-buyer",
          buyerAddress: "guser",
          sellerAddress: "gseller",
        }),
      ]);
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await service.getUserReputation("guser");

      expect(result.history[0]!.event).toContain("buyer");
    });
  });
});
