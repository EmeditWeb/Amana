import { Request, Response } from "express";
import { apiVersionHeader, deprecationHeaders } from "../apiVersion.middleware";

function createRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((key: string, value: string) => { headers[key] = value; }),
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };
}

describe("apiVersionHeader", () => {
  it("sets X-API-Version and calls next", () => {
    const res = createRes();
    const next = jest.fn();
    apiVersionHeader(1)({} as Request, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-API-Version", "1");
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("deprecationHeaders", () => {
  it("sets Deprecation, Sunset, and Link headers then calls next", () => {
    const res = createRes();
    const next = jest.fn();
    deprecationHeaders("Wed, 28 Oct 2026 00:00:00 GMT", "/api/v1")({} as Request, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("Deprecation", "true");
    expect(res.setHeader).toHaveBeenCalledWith("Sunset", "Wed, 28 Oct 2026 00:00:00 GMT");
    expect(res.setHeader).toHaveBeenCalledWith("Link", '</api/v1>; rel="successor-version"');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
