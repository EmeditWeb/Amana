import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createFeeAccountingRouter } from "../routes/fees.routes";
import { AuthService } from "../services/auth.service";
import { errorHandler } from "../middleware/errorHandler";

// ─── Auth mocks ────────────────────────────────────────────────────────────────

jest.mock("../services/auth.service", () => ({
  AuthService: {
    validateToken: jest.fn(async (token: string) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jwtLib = require("jsonwebtoken");
      return jwtLib.decode(token);
    }),
    isTokenRevoked: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock("../lib/accessControl", () => ({
  isMediatorAddress: jest.fn(),
}));

const { isMediatorAddress } = jest.requireMock("../lib/accessControl");

// ─── Helpers ───────────────────────────────────────────────────────────────────

const adminAddress = StellarSdk.Keypair.random().publicKey();
const nonAdminAddress = StellarSdk.Keypair.random().publicKey();

function makeToken(walletAddress: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      walletAddress,
      jti: `jti-${walletAddress.slice(0, 8)}`,
      iss: process.env.JWT_ISSUER,
      aud: process.env.JWT_AUDIENCE,
      nbf: now - 1,
    },
    process.env.JWT_SECRET!,
    { algorithm: "HS256" },
  );
}

const feeRecord = {
  id: 1,
  tradeId: "trade-001",
  tradeAmountUsdc: "100.00",
  feeUsdc: "1.000000",
  collectedAt: new Date("2026-07-01T00:00:00.000Z"),
  ledgerSequence: 42,
};

// ─── Test setup ────────────────────────────────────────────────────────────────

function buildApp(mockPrisma: any) {
  const app = express();
  app.use(express.json());
  app.use("/fees", createFeeAccountingRouter(mockPrisma));
  app.use(errorHandler);
  return app;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Fee accounting routes", () => {
  let adminToken: string;
  let nonAdminToken: string;
  let mockPrisma: any;
  let app: express.Application;

  beforeAll(() => {
    adminToken = makeToken(adminAddress);
    nonAdminToken = makeToken(nonAdminAddress);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AuthService, "isTokenRevoked").mockResolvedValue(false);

    mockPrisma = {
      platformFeeEvent: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    app = buildApp(mockPrisma);
  });

  // ── Authorization ─────────────────────────────────────────────────────────

  describe("GET /fees — authorization", () => {
    it("returns 401 when no token provided", async () => {
      const res = await request(app).get("/fees");
      expect(res.status).toBe(401);
    });

    it("returns 403 when non-admin token provided", async () => {
      (isMediatorAddress as jest.Mock).mockReturnValue(false);
      const res = await request(app)
        .get("/fees")
        .set("Authorization", `Bearer ${nonAdminToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /fees/summary — authorization", () => {
    it("returns 401 when no token provided", async () => {
      const res = await request(app).get("/fees/summary");
      expect(res.status).toBe(401);
    });

    it("returns 403 when non-admin token provided", async () => {
      (isMediatorAddress as jest.Mock).mockReturnValue(false);
      const res = await request(app)
        .get("/fees/summary")
        .set("Authorization", `Bearer ${nonAdminToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /fees — JSON ────────────────────────────────────────────────────────

  describe("GET /fees (JSON)", () => {
    beforeEach(() => {
      (isMediatorAddress as jest.Mock).mockReturnValue(true);
    });

    it("returns paginated fee list", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([feeRecord]);
      mockPrisma.platformFeeEvent.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/fees?format=json&page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].tradeId).toBe("trade-001");
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns empty list when no fees recorded", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([]);
      mockPrisma.platformFeeEvent.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/fees")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it("passes date range to the service", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([]);
      mockPrisma.platformFeeEvent.count.mockResolvedValue(0);

      const res = await request(app)
        .get(
          "/fees?format=json&dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-06-30T00:00:00.000Z",
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.platformFeeEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            collectedAt: {
              gte: new Date("2026-01-01T00:00:00.000Z"),
              lte: new Date("2026-06-30T00:00:00.000Z"),
            },
          }),
        }),
      );
    });

    it("rejects invalid date range (dateFrom after dateTo)", async () => {
      const res = await request(app)
        .get(
          "/fees?dateFrom=2026-12-31T00:00:00.000Z&dateTo=2026-01-01T00:00:00.000Z",
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ── GET /fees — CSV ─────────────────────────────────────────────────────────

  describe("GET /fees (CSV)", () => {
    beforeEach(() => {
      (isMediatorAddress as jest.Mock).mockReturnValue(true);
    });

    it("returns CSV with BOM and correct headers", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([feeRecord]);

      const res = await request(app)
        .get("/fees?format=csv")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toContain(
        "platform-fees-export.csv",
      );
      // BOM character
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text).toContain('"tradeId"');
      expect(res.text).toContain('"feeUsdc"');
      expect(res.text).toContain("trade-001");
    });
  });

  // ── GET /fees/summary ───────────────────────────────────────────────────────

  describe("GET /fees/summary", () => {
    beforeEach(() => {
      (isMediatorAddress as jest.Mock).mockReturnValue(true);
    });

    it("returns aggregated totals", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([
        { feeUsdc: "1.000000" },
        { feeUsdc: "2.500000" },
      ]);

      const res = await request(app)
        .get("/fees/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalFeesUsdc).toBe("3.500000");
      expect(res.body.totalTrades).toBe(2);
      expect(res.body.dateFrom).toBeNull();
      expect(res.body.dateTo).toBeNull();
    });

    it("includes date range in summary when provided", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get(
          "/fees/summary?dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-06-30T00:00:00.000Z",
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dateFrom).toBe("2026-01-01T00:00:00.000Z");
      expect(res.body.dateTo).toBe("2026-06-30T00:00:00.000Z");
    });

    it("returns zero total when no fees collected", async () => {
      mockPrisma.platformFeeEvent.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/fees/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalFeesUsdc).toBe("0.000000");
      expect(res.body.totalTrades).toBe(0);
    });
  });
});
