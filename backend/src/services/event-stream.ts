import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { eventIndexerEmitter, IndexedEventRecord } from "./event-indexer";
import { appLogger } from "../middleware/logger";

interface StreamFilter {
  tradeId?: string;
  eventType?: string;
}

export class EventStreamService {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, StreamFilter> = new Map();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: "/api/v1/ws/events" });

    this.wss.on("connection", (ws: WebSocket, req) => {
      const url = new URL(req.url ?? "", "http://localhost");
      const filter: StreamFilter = {};
      const tradeId = url.searchParams.get("trade_id");
      const eventType = url.searchParams.get("type");
      if (tradeId) filter.tradeId = tradeId;
      if (eventType) filter.eventType = eventType;

      this.clients.set(ws, filter);

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", () => {
        this.clients.delete(ws);
      });

      ws.send(JSON.stringify({ type: "connected", message: "Event stream connected" }));
    });

    eventIndexerEmitter.on("event", (event: IndexedEventRecord) => {
      this.broadcast(event);
    });

    appLogger.info("[EventStream] WebSocket server initialized on /api/v1/ws/events");
  }

  private broadcast(event: IndexedEventRecord): void {
    const message = JSON.stringify({ type: "event", data: event });

    for (const [ws, filter] of this.clients.entries()) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(ws);
        continue;
      }

      if (filter.tradeId && event.tradeId !== filter.tradeId) continue;
      if (filter.eventType && event.eventType !== filter.eventType) continue;

      try {
        ws.send(message);
      } catch {
        this.clients.delete(ws);
      }
    }
  }

  stop(): void {
    for (const ws of this.clients.keys()) {
      ws.close();
    }
    this.clients.clear();
    this.wss.close();
    appLogger.info("[EventStream] Stopped");
  }
}
