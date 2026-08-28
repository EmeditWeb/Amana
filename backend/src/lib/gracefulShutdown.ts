import type { Server } from "http";
import { appLogger } from "../middleware/logger";

export interface ShutdownClosable {
  close: () => Promise<void> | void;
}

export interface ShutdownDependencies {
  getServer: () => Server | null;
  services: ShutdownClosable[];
  workers: ShutdownClosable[];
  queues: ShutdownClosable[];
  stopMetrics: () => void;
  disconnectDatabase: () => Promise<void>;
  exit: (code: number) => void;
  timeoutMs?: number;
}

export function createGracefulShutdown({
  getServer,
  services,
  workers,
  queues,
  stopMetrics,
  disconnectDatabase,
  exit,
  timeoutMs = 30_000,
}: ShutdownDependencies): (signal: string) => Promise<void> {
  let shuttingDown = false;

  return async (signal: string): Promise<void> => {
    if (shuttingDown) {
      appLogger.warn({ signal }, "Shutdown already in progress");
      return;
    }
    shuttingDown = true;

    appLogger.info({ signal }, "Received shutdown signal. Shutting down gracefully...");

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const shutdown = async (): Promise<void> => {
      appLogger.info("Stopping event services");
      await Promise.all(services.map((service) => service.close()));

      appLogger.info("Draining BullMQ workers");
      await Promise.all(workers.map((worker) => worker.close()));

      appLogger.info("Closing BullMQ queues");
      await Promise.all(queues.map((queue) => queue.close()));

      stopMetrics();
      appLogger.info("Closing HTTP server and database connection");
      const server = getServer();
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await disconnectDatabase();
      appLogger.info("Graceful shutdown complete");
    };

    try {
      await Promise.race([shutdown(), timeout]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      exit(0);
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      appLogger.error({ error }, "Graceful shutdown failed; forcing exit");
      exit(1);
    }
  };
}