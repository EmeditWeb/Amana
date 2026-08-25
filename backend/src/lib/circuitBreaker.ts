// Canonical circuit breaker implementation.
// All services MUST import from this file. The old circuit-breaker.ts has been
// removed. See: https://github.com/KingFRANKHOOD/Amana/issues/1025

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold?: number;
  /** Number of consecutive successes in HALF_OPEN before closing again. */
  successThreshold?: number;
  /** Milliseconds to wait in OPEN state before moving to HALF_OPEN. */
  cooldownMs?: number;
  /** Override Date.now() for deterministic tests. */
  now?: () => number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — call blocked`);
    this.name = "CircuitBreakerOpenError";
  }
}

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreakerStates(): Array<{ name: string; state: CircuitState }> {
  return Array.from(registry.entries()).map(([name, cb]) => ({
    name,
    state: cb.currentState,
  }));
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
    registry.set(name, this);
  }

  get currentState(): CircuitState {
    return this.state;
  }

  get failureCountValue(): number {
    return this.failureCount;
  }

  get successCountValue(): number {
    return this.successCount;
  }

  get openedAtValue(): number | null {
    return this.openedAt;
  }

  get cooldownMsValue(): number {
    return this.cooldownMs;
  }

  async call<T>(operation: () => Promise<T>): Promise<T> {
    this.transitionIfCooldownElapsed();

    if (this.state === "OPEN") {
      throw new CircuitBreakerOpenError(this.name);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private transitionIfCooldownElapsed(): void {
    if (this.state === "OPEN" && this.openedAt !== null) {
      if (this.now() - this.openedAt >= this.cooldownMs) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
        this.failureCount = 0;
      }
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.openedAt = null;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAt = this.now();
      this.failureCount = 0;
      this.successCount = 0;
      return;
    }
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = this.now();
      this.successCount = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Backward-compatibility shims (previously exported by circuit-breaker.ts)
// ---------------------------------------------------------------------------

/**
 * Module-level default breaker used by the legacy `withCircuitBreaker` API.
 * Registered as "default" in the circuit-breaker registry so it appears in
 * health check listings alongside the named breakers.
 */
const _defaultBreaker = new CircuitBreaker("default", {
  failureThreshold: 5,
  cooldownMs: 30_000,
});

/**
 * Convenience wrapper that executes `operation` through the supplied (or
 * default) circuit breaker using the canonical `.call()` API.
 *
 * @deprecated Prefer constructing a named `CircuitBreaker` and calling
 * `.call()` directly.  This shim exists only to support existing callers
 * migrated from the old circuit-breaker.ts.
 */
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  breaker: CircuitBreaker = _defaultBreaker,
): Promise<T> {
  return breaker.call(operation);
}

/**
 * Returns the module-level default circuit breaker.
 *
 * @deprecated Construct a named `CircuitBreaker` instance instead.
 */
export function getCircuitBreaker(): CircuitBreaker {
  return _defaultBreaker;
}

/**
 * Resets the default circuit breaker to a clean CLOSED state.
 * **For use in tests only.**
 */
export function __resetCircuitBreakerForTests(): void {
  // Reset by invoking the internal state-reset helper exposed for testing.
  // Cast to access private fields – acceptable in test-only helper code.
  const b = _defaultBreaker as unknown as {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    openedAt: number | null;
  };
  b.state = "CLOSED";
  b.failureCount = 0;
  b.successCount = 0;
  b.openedAt = null;
}
