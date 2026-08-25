/**
 * Tests for the backward-compatibility shims exported from circuitBreaker.ts
 * (withCircuitBreaker, getCircuitBreaker, __resetCircuitBreakerForTests).
 *
 * These shims previously lived in the deleted circuit-breaker.ts file.
 * See: https://github.com/KingFRANKHOOD/Amana/issues/1025
 */
import {
  CircuitBreaker,
  withCircuitBreaker,
  getCircuitBreaker,
  __resetCircuitBreakerForTests,
} from "../lib/circuitBreaker";

describe("CircuitBreaker (legacy-compatible API via canonical module)", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    __resetCircuitBreakerForTests();
    // Use the new named-breaker API with a deterministic clock for fast tests
    let fakeNow = 0;
    breaker = new CircuitBreaker("legacy-compat-test", {
      failureThreshold: 3,
      cooldownMs: 1_000,
      now: () => fakeNow,
    });
    // Expose advanceTime via closure-captured variable on the breaker object
    (breaker as any).__advanceTime = (ms: number) => { fakeNow += ms; };
  });

  function advanceTime(ms: number) {
    (breaker as any).__advanceTime(ms);
  }

  it("starts in CLOSED state", () => {
    expect(breaker.currentState).toBe("CLOSED");
  });

  it("opens after reaching failure threshold", async () => {
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    expect(breaker.currentState).toBe("CLOSED");

    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    expect(breaker.currentState).toBe("OPEN");
  });

  it("resets failure count on success while CLOSED", async () => {
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    await breaker.call(() => Promise.resolve("ok"));

    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    // Only 2 failures after the reset – still CLOSED
    expect(breaker.currentState).toBe("CLOSED");
  });

  it("transitions to HALF_OPEN after cooldown elapses", async () => {
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    await breaker.call(() => Promise.reject(new Error("e"))).catch(() => {});
    expect(breaker.currentState).toBe("OPEN");

    advanceTime(1_001);
    // Next call triggers cooldown → HALF_OPEN transition
    await breaker.call(() => Promise.resolve("ok")).catch(() => {});
    // After 1 success (successThreshold=2 default) still HALF_OPEN
    expect(breaker.currentState).toBe("HALF_OPEN");
  });

  it("closes after successful half-open probes", async () => {
    let fakeNow2 = 0;
    const b = new CircuitBreaker("hopen-close-test", {
      failureThreshold: 1,
      successThreshold: 1,
      cooldownMs: 50,
      now: () => fakeNow2,
    });
    await b.call(() => Promise.reject(new Error("e"))).catch(() => {});
    expect(b.currentState).toBe("OPEN");

    fakeNow2 += 51;
    await b.call(() => Promise.resolve("ok"));
    expect(b.currentState).toBe("CLOSED");
  });

  it("re-opens after failed half-open probe", async () => {
    let fakeNow3 = 0;
    const b = new CircuitBreaker("hopen-reopen-test", {
      failureThreshold: 1,
      cooldownMs: 50,
      now: () => fakeNow3,
    });
    await b.call(() => Promise.reject(new Error("e"))).catch(() => {});
    fakeNow3 += 51;
    await b.call(() => Promise.reject(new Error("e"))).catch(() => {});
    expect(b.currentState).toBe("OPEN");
  });
});

describe("withCircuitBreaker (backward-compat shim)", () => {
  it("executes operation when circuit is CLOSED", async () => {
    const b = new CircuitBreaker("shim-closed-test", {
      failureThreshold: 3,
      cooldownMs: 1_000,
    });
    const result = await withCircuitBreaker(async () => "success", b);
    expect(result).toBe("success");
  });

  it("throws when circuit is OPEN", async () => {
    const b = new CircuitBreaker("shim-open-test", {
      failureThreshold: 1,
      cooldownMs: 60_000,
    });
    await b.call(() => Promise.reject(new Error("boom"))).catch(() => {});

    await expect(
      withCircuitBreaker(async () => "should not run", b)
    ).rejects.toThrow("Circuit breaker");
  });

  it("records failure when operation throws", async () => {
    const b = new CircuitBreaker("shim-failure-test", {
      failureThreshold: 3,
      cooldownMs: 1_000,
    });

    await expect(
      withCircuitBreaker(async () => {
        throw new Error("service error");
      }, b)
    ).rejects.toThrow("service error");

    // Only 1 failure so far, still CLOSED
    expect(b.currentState).toBe("CLOSED");
  });
});

describe("getCircuitBreaker", () => {
  it("returns a CircuitBreaker instance", () => {
    __resetCircuitBreakerForTests();
    const cb = getCircuitBreaker();
    expect(cb).toBeInstanceOf(CircuitBreaker);
  });

  it("returns same instance across calls", () => {
    const a = getCircuitBreaker();
    const b = getCircuitBreaker();
    expect(a).toBe(b);
  });
});
