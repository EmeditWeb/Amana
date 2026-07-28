import type { NextWebVitalsMetric } from "next/app";

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV === "production") {
    const body = JSON.stringify(metric);
    (navigator.sendBeacon || fetch)("/api/vitals", {
      body,
      method: "POST",
      keepalive: true,
      type: "application/json",
    } as RequestInit);
  }
}

export function lazyLoad<T>(importFn: () => Promise<{ default: T }>, componentName: string): Promise<{ default: T }> {
  if (typeof window !== "undefined") {
    performance.mark(`${componentName}-load-start`);
  }
  return importFn().then((mod) => {
    if (typeof window !== "undefined") {
      performance.mark(`${componentName}-load-end`);
      performance.measure(`${componentName}-load`, `${componentName}-load-start`, `${componentName}-load-end`);
    }
    return mod;
  });
}
