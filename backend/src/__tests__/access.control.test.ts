/**
 * Tests for the shared access-control helpers (Issue #525, #1017)
 *
 * Validates that getMediatorAllowlist and isMediatorAddress correctly parse
 * ADMIN_STELLAR_PUBKEYS and enforce mediator/arbitrator route guards.
 * Addresses are normalized to lowercase for consistent comparison.
 */
import { getMediatorAllowlist, isMediatorAddress, normalizeAddress } from "../lib/accessControl";

const ADDR_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const ADDR_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const ADDR_C = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

describe("getMediatorAllowlist", () => {
  afterEach(() => {
    delete process.env.ADMIN_STELLAR_PUBKEYS;
  });

  it("returns an empty set when env var is unset", () => {
    delete process.env.ADMIN_STELLAR_PUBKEYS;
    expect(getMediatorAllowlist().size).toBe(0);
  });

  it("returns an empty set when env var is an empty string", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = "";
    expect(getMediatorAllowlist().size).toBe(0);
  });

  it("returns a set with one address for a single entry (normalized lowercase)", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = ADDR_A;
    const allowlist = getMediatorAllowlist();
    expect(allowlist.size).toBe(1);
    expect(allowlist.has(ADDR_A.toLowerCase())).toBe(true);
  });

  it("returns all addresses for a comma-separated list (normalized lowercase)", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = `${ADDR_A},${ADDR_B},${ADDR_C}`;
    const allowlist = getMediatorAllowlist();
    expect(allowlist.size).toBe(3);
    expect(allowlist.has(ADDR_A.toLowerCase())).toBe(true);
    expect(allowlist.has(ADDR_B.toLowerCase())).toBe(true);
    expect(allowlist.has(ADDR_C.toLowerCase())).toBe(true);
  });

  it("trims whitespace and normalizes to lowercase", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = `  ${ADDR_A}  ,  ${ADDR_B}  `;
    const allowlist = getMediatorAllowlist();
    expect(allowlist.has(ADDR_A.toLowerCase())).toBe(true);
    expect(allowlist.has(ADDR_B.toLowerCase())).toBe(true);
  });

  it("ignores empty entries produced by trailing commas", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = `${ADDR_A},${ADDR_B},`;
    const allowlist = getMediatorAllowlist();
    expect(allowlist.size).toBe(2);
  });

  it("returns a new Set on each call (no shared mutable state)", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = ADDR_A;
    const first = getMediatorAllowlist();
    const second = getMediatorAllowlist();
    expect(first).not.toBe(second);
  });
});

describe("normalizeAddress", () => {
  it("lowercases addresses", () => {
    expect(normalizeAddress("GABC123")).toBe("gabc123");
  });

  it("trims whitespace", () => {
    expect(normalizeAddress("  GABC123  ")).toBe("gabc123");
  });

  it("handles mixed case and whitespace", () => {
    expect(normalizeAddress("  GaBc123  ")).toBe("gabc123");
  });
});

describe("isMediatorAddress", () => {
  afterEach(() => {
    delete process.env.ADMIN_STELLAR_PUBKEYS;
  });

  it("returns false when the allowlist is empty", () => {
    delete process.env.ADMIN_STELLAR_PUBKEYS;
    expect(isMediatorAddress(ADDR_A)).toBe(false);
  });

  it("returns true for an address that is in the allowlist", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = `${ADDR_A},${ADDR_B}`;
    expect(isMediatorAddress(ADDR_A)).toBe(true);
    expect(isMediatorAddress(ADDR_B)).toBe(true);
  });

  it("returns false for an address that is not in the allowlist", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = ADDR_A;
    expect(isMediatorAddress(ADDR_B)).toBe(false);
  });

  it("is case-insensitive — uppercase and lowercase match after normalization", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = ADDR_A;
    expect(isMediatorAddress(ADDR_A.toLowerCase())).toBe(true);
    expect(isMediatorAddress(ADDR_A.toUpperCase())).toBe(true);
  });

  it("normalizes addresses with leading/trailing whitespace", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = ADDR_A;
    expect(isMediatorAddress(`  ${ADDR_A}  `)).toBe(true);
  });

  it("returns false for an empty-string address", () => {
    process.env.ADMIN_STELLAR_PUBKEYS = ADDR_A;
    expect(isMediatorAddress("")).toBe(false);
  });
});
