import {
  Counter,
  Gauge,
  Histogram,
  MeterProvider,
} from "@opentelemetry/sdk-metrics";

class MetricsService {
  private static instance: MetricsService;
  private meterProvider: MeterProvider;

  // Trade metrics
  private tradeCounter: Counter;
  private tradeCompletedCounter: Counter;
  private tradeActiveGauge: Gauge;
  private tradeLatencyHistogram: Histogram;

  // Dispute metrics
  private disputeCreatedCounter: Counter;
  private disputeResolvedCounter: Counter;
  private disputeOpenGauge: Gauge;
  private disputeResolutionTimeHistogram: Histogram;

  // General processing metrics
  private requestDurationHistogram: Histogram;
  private errorCounter: Counter;

  private constructor(meterProvider: MeterProvider) {
    this.meterProvider = meterProvider;
    const meter = meterProvider.getMeter("amana-backend");

    // Trade metrics
    this.tradeCounter = meter.createCounter("trades_created_total", {
      description: "Total number of trades created",
      unit: "1",
    });

    this.tradeCompletedCounter = meter.createCounter("trades_completed_total", {
      description: "Total number of completed trades",
      unit: "1",
    });

    this.tradeActiveGauge = meter.createObservableGauge(
      "trades_active_count",
      {
        description: "Current number of active trades",
        unit: "1",
      }
    );

    this.tradeLatencyHistogram = meter.createHistogram(
      "trade_processing_duration_ms",
      {
        description: "Duration of trade processing from creation to completion",
        unit: "ms",
      }
    );

    // Dispute metrics
    this.disputeCreatedCounter = meter.createCounter("disputes_created_total", {
      description: "Total number of disputes created",
      unit: "1",
    });

    this.disputeResolvedCounter = meter.createCounter(
      "disputes_resolved_total",
      {
        description: "Total number of disputes resolved",
        unit: "1",
      }
    );

    this.disputeOpenGauge = meter.createObservableGauge("disputes_open_count", {
      description: "Current number of open disputes",
      unit: "1",
    });

    this.disputeResolutionTimeHistogram = meter.createHistogram(
      "dispute_resolution_duration_ms",
      {
        description: "Duration from dispute creation to resolution",
        unit: "ms",
      }
    );

    // General metrics
    this.requestDurationHistogram = meter.createHistogram(
      "http_request_duration_ms",
      {
        description: "HTTP request processing time",
        unit: "ms",
      }
    );

    this.errorCounter = meter.createCounter("errors_total", {
      description: "Total number of errors encountered",
      unit: "1",
    });
  }

  static getInstance(
    meterProvider: MeterProvider
  ): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService(meterProvider);
    }
    return MetricsService.instance;
  }

  // Trade methods
  recordTradeCreated(attributes?: Record<string, string | number | boolean>) {
    this.tradeCounter.add(1, attributes);
  }

  recordTradeCompleted(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>
  ) {
    this.tradeCompletedCounter.add(1, attributes);
    this.tradeLatencyHistogram.record(durationMs, attributes);
  }

  recordTradeLatency(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>
  ) {
    this.tradeLatencyHistogram.record(durationMs, attributes);
  }

  // Dispute methods
  recordDisputeCreated(
    attributes?: Record<string, string | number | boolean>
  ) {
    this.disputeCreatedCounter.add(1, attributes);
  }

  recordDisputeResolved(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>
  ) {
    this.disputeResolvedCounter.add(1, attributes);
    this.disputeResolutionTimeHistogram.record(durationMs, attributes);
  }

  // Request metrics
  recordRequestDuration(
    durationMs: number,
    attributes?: Record<string, string | number | boolean>
  ) {
    this.requestDurationHistogram.record(durationMs, attributes);
  }

  recordError(attributes?: Record<string, string | number | boolean>) {
    this.errorCounter.add(1, attributes);
  }

  getMeterProvider(): MeterProvider {
    return this.meterProvider;
  }
}

export default MetricsService;
