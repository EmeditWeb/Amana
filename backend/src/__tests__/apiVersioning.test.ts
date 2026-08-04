import request from "supertest";
import { createApp } from "../app";

describe("API versioning", () => {
  const app = createApp();

  it("serves a versioned route under /api/v1 with X-API-Version: 1 and no deprecation headers", async () => {
    const res = await request(app).get("/api/v1/dispute-categories");
    expect(res.status).not.toBe(404);
    expect(res.headers["x-api-version"]).toBe("1");
    expect(res.headers["deprecation"]).toBeUndefined();
    expect(res.headers["sunset"]).toBeUndefined();
  });

  it("still serves the same route at the legacy unprefixed path, marked deprecated", async () => {
    const res = await request(app).get("/dispute-categories");
    expect(res.status).not.toBe(404);
    expect(res.headers["deprecation"]).toBe("true");
    expect(res.headers["sunset"]).toBeDefined();
    expect(res.headers["link"]).toBe('</api/v1>; rel="successor-version"');
  });

  it("does not version or deprecate /health", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-api-version"]).toBeUndefined();
    expect(res.headers["deprecation"]).toBeUndefined();
  });
});
