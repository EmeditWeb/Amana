import express from "express";
import request from "supertest";
import { createDisputeRouter } from "../controllers/dispute.controller";
import { disputeIdParamSchema } from "../controllers/dispute.controller";

jest.mock("../middleware/auth.middleware", () => {
  const actual = jest.requireActual("../middleware/auth.middleware");
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.user = { walletAddress: "G" + "A".repeat(55) };
      next();
    },
  };
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/", createDisputeRouter());
  return app;
}

const validBody = { status: "RESOLVED" };

describe("Dispute transition route param validation (issue #1035)", () => {
  const app = buildApp();

  it("rejects an empty id with 400 before reaching the service", async () => {
    const res = await request(app)
      .post("/%20/transition")
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id|Dispute\/trade ID/i);
  });

  it("rejects SQL injection attempts in the id param with 400", async () => {
    const injection = "1'; DROP TABLE disputes; --";
    const res = await request(app)
      .post(`/${encodeURIComponent(injection)}/transition`)
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("rejects XSS / script payloads in the id param with 400", async () => {
    const xss = "<script>alert(1)</script>";
    const res = await request(app)
      .post(`/${encodeURIComponent(xss)}/transition`)
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("rejects ids containing path traversal / special characters with 400", async () => {
    const res = await request(app)
      .post(`/${encodeURIComponent("../../etc/passwd")}/transition`)
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("rejects ids that are too long with 400", async () => {
    const res = await request(app)
      .post(`/${"a".repeat(256)}/transition`)
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it("disputeIdParamSchema accepts a valid alphanumeric trade id", () => {
    const result = disputeIdParamSchema.safeParse({ id: "trade_123-abc" });
    expect(result.success).toBe(true);
  });

  it("disputeIdParamSchema rejects invalid characters", () => {
    const result = disputeIdParamSchema.safeParse({ id: "bad id!" });
    expect(result.success).toBe(false);
  });
});
