import { Router, Request, Response } from "express";
import {
  PrometheusExporter,
} from "@opentelemetry/exporter-prometheus";
import { MeterProvider } from "@opentelemetry/sdk-metrics";

export function createMetricsRouter(): Router {
  const router = Router();

  // Initialize Prometheus exporter for metrics collection
  const prometheusExporter = new PrometheusExporter(
    {
      port: 0, // Use 0 since we're not binding to a separate port
    },
    () => {
      // Initialization callback (optional)
    }
  );

  // GET /metrics - Prometheus metrics endpoint
  router.get("/metrics", async (_req: Request, res: Response) => {
    try {
      // Get metrics in Prometheus text format
      const metrics = await prometheusExporter.getMetricsAndResource();
      res.set("Content-Type", "text/plain; charset=utf-8");
      res.send(metrics);
    } catch (error) {
      res.status(500).json({
        error: "Failed to collect metrics",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
