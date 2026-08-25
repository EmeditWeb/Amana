import { EventEmitter } from "events";

export interface TradeStatusEvent {
  trade_id: string;
  status: string;
  event_type: string;
  timestamp: string;
}

class TradeStatusEventBus extends EventEmitter {
  publish(event: Omit<TradeStatusEvent, "timestamp"> & { timestamp?: string }) {
    const payload: TradeStatusEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    this.emit("trade-status", payload);
  }
}

export const tradeStatusEvents = new TradeStatusEventBus();
