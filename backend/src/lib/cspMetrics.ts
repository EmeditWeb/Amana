import { Counter, metrics } from "@opentelemetry/api";

const METER_NAME = "amana-backend";

let cspViolationCounter: Counter | undefined;

function getCounter(): Counter {
  if (!cspViolationCounter) {
    cspViolationCounter = metrics.getMeter(METER_NAME).createCounter("csp_violation_total", {
      description: "Total Content-Security-Policy violation reports received",
    });
  }
  return cspViolationCounter;
}

/** Records one CSP violation report, labeled by the blocked resource and violated directive. */
export function recordCspViolation(blockedUri: string, directive: string): void {
  getCounter().add(1, { blocked_uri: blockedUri, directive });
}

/** Vitest/Jest-only hook to reset the lazily-created counter between test files. */
export function __resetCspMetricsForTests(): void {
  cspViolationCounter = undefined;
}
