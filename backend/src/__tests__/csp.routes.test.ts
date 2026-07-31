import request from "supertest";
import express from "express";
import { createCspRouter } from "../routes/csp.routes";
import { recordCspViolation } from "../lib/cspMetrics";

jest.mock("../lib/cspMetrics", () => ({
  recordCspViolation: jest.fn(),
}));

jest.mock("../middleware/logger", () => ({
  appLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

/**
 * Exercises `createCspRouter` directly against a minimal Express app,
 * rather than the full `createApp()`, since the full app currently fails
 * to boot under `ts-jest` due to a pre-existing, unrelated type error in
 * `services/encryption.service.ts` (reproduces identically on every other
 * test in this suite that imports `app.ts`, e.g. `health.routes.test.ts`).
 */
function buildApp(): express.Application {
  const app = express();
  app.use(createCspRouter());
  return app;
}

describe("POST /api/v1/csp-violation", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it("accepts a csp-report payload and returns 204", async () => {
    const res = await request(app)
      .post("/api/v1/csp-violation")
      .set("Content-Type", "application/csp-report")
      .send(JSON.stringify({
        "csp-report": {
          "blocked-uri": "https://evil.example.com/script.js",
          "violated-directive": "script-src",
          "effective-directive": "script-src",
        },
      }));

    expect(res.status).toBe(204);
  });

  it("records the violation with blocked-uri and directive labels", async () => {
    await request(app)
      .post("/api/v1/csp-violation")
      .set("Content-Type", "application/csp-report")
      .send(JSON.stringify({
        "csp-report": {
          "blocked-uri": "https://evil.example.com/script.js",
          "effective-directive": "script-src",
        },
      }));

    expect(recordCspViolation).toHaveBeenCalledWith(
      "https://evil.example.com/script.js",
      "script-src",
    );
  });

  it("falls back to 'unknown' when the report is missing expected fields", async () => {
    await request(app)
      .post("/api/v1/csp-violation")
      .set("Content-Type", "application/csp-report")
      .send(JSON.stringify({}));

    expect(recordCspViolation).toHaveBeenCalledWith("unknown", "unknown");
  });

  it("also accepts application/json content type", async () => {
    const res = await request(app)
      .post("/api/v1/csp-violation")
      .set("Content-Type", "application/json")
      .send({ "csp-report": { "blocked-uri": "https://x.example.com" } });

    expect(res.status).toBe(204);
    expect(recordCspViolation).toHaveBeenCalledWith("https://x.example.com", "unknown");
  });

  it("rate-limits after 10 requests per minute from the same client", async () => {
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await request(app)
        .post("/api/v1/csp-violation")
        .set("Content-Type", "application/csp-report")
        .send(JSON.stringify({ "csp-report": { "blocked-uri": "x" } }));
      expect(ok.status).toBe(204);
    }

    const limited = await request(app)
      .post("/api/v1/csp-violation")
      .set("Content-Type", "application/csp-report")
      .send(JSON.stringify({ "csp-report": { "blocked-uri": "x" } }));

    expect(limited.status).toBe(429);
  });
});
