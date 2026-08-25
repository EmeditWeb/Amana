import { Server } from "http";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { EventStreamService } from "../services/event-stream";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openConn(server: Server, query: string, token: string, timeoutMs = 5000): Promise<WebSocket> {
  const address = server.address();
  if (!address || typeof address === "string") {
    return Promise.reject(new Error("Server is not listening on a port"));
  }
  const ws = new WebSocket(`ws://localhost:${address.port}/api/v1/ws/events${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  } as any);
  return new Promise<WebSocket>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connection timeout")), timeoutMs);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Opens a connection and resolves with both the socket and the first message
 * the server sends. The message listener is attached *before* the open event
 * resolves so we never miss the greeting frame due to a race.
 */
function connectAndReceive(
  server: Server,
  query: string,
  token: string,
  timeoutMs = 5000,
): Promise<{ ws: WebSocket; message: any }> {
  const address = server.address();
  if (!address || typeof address === "string") {
    return Promise.reject(new Error("Server is not listening on a port"));
  }
  const ws = new WebSocket(`ws://localhost:${address.port}/api/v1/ws/events${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  } as any);
  return new Promise<{ ws: WebSocket; message: any }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connection timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve({ ws, message: JSON.parse(data.toString()) });
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe("EventStreamService connection limits and health (issue #1036)", () => {
  let server: Server;
  let stream: EventStreamService;
  const secret = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
  const issuer = process.env.JWT_ISSUER || "amana";
  const audience = process.env.JWT_AUDIENCE || "amana-api";

  function makeToken(wallet: string, jti = undefined) {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        sub: wallet.toLowerCase(),
        walletAddress: wallet.toLowerCase(),
        jti: jti ?? `${wallet}-${now}`,
        iss: issuer,
        aud: audience,
        iat: now,
        nbf: now,
        exp: now + 3600,
      },
      secret,
      { algorithm: "HS256" }
    );
  }

  beforeEach((done) => {
    server = new Server();
    server.listen(0, () => {
      stream = new EventStreamService(server);
      // Allow the WebSocket server to finish attaching to the HTTP server.
      setTimeout(() => done(), 150);
    });
  });

  afterEach((done) => {
    try {
      stream.stop();
    } catch {
      /* no-op */
    }
    server.close(() => done());
  });

  it("accepts a valid connection and sends a connected message", async () => {
    const token = makeToken("alice");
    const { ws, message } = await connectAndReceive(server, "?user=alice", token);
    expect(message.type).toBe("connected");
    expect(EventStreamService.getConnectionStats().total).toBe(1);
    ws.close();
  });

  it("enforces a per-user connection limit", async () => {
    const opened: WebSocket[] = [];
    const closed: WebSocket[] = [];

    for (let i = 0; i < 7; i++) {
      const token = makeToken("bob", `bob-${i}`);
      const ws = new WebSocket(
        `ws://localhost:${(server.address() as any).port}/api/v1/ws/events?user=bob`,
        { headers: { Authorization: `Bearer ${token}` } } as any,
      );
      ws.once("open", () => opened.push(ws));
      ws.once("close", () => closed.push(ws));
      ws.once("error", () => closed.push(ws));
      await wait(120);
    }

    await wait(400);

    const stats = EventStreamService.getConnectionStats();
    // Server-side bookkeeping must never exceed the per-user cap.
    expect(stats.total).toBeLessThanOrEqual(5);
    expect(stats.maxPerUser).toBeLessThanOrEqual(5);
    expect(stats.perUserLimit).toBe(5);
    // At least two of the seven attempts must have been rejected by the server.
    expect(closed.length).toBeGreaterThanOrEqual(2);

    opened.forEach((ws) => ws.close());
  });

  it("exposes limits and connection count via getConnectionStats", async () => {
    const token = makeToken("carol");
    const ws = await openConn(server, "?user=carol", token);
    const stats = EventStreamService.getConnectionStats();
    expect(stats.globalLimit).toBe(10_000);
    expect(stats.perUserLimit).toBe(5);
    expect(stats.total).toBe(1);
    expect(stats.maxPerUser).toBe(1);
    ws.close();
  });

  it("does not crash on unusual query parameters", async () => {
    const { ws, message } = await connectAndReceive(
      server,
      "?user=../../etc/passwd&trade_id=1",
    );
    expect(message.type).toBe("connected");
    expect(EventStreamService.getConnectionStats().total).toBe(1);
    ws.close();
  });
});
