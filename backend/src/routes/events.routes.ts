import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { EventIndexerService } from "../services/event-indexer";

export function createEventRouter(prisma: PrismaClient, indexer: EventIndexerService): Router {
  const router = Router();

  router.get("/events", async (req: Request, res: Response) => {
    try {
      const { trade_id, type, from, to, limit, offset } = req.query;

      const result = await indexer.queryEvents({
        tradeId: trade_id as string | undefined,
        type: type as string | undefined,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to query events" });
    }
  });

  router.get("/events/lag", async (_req: Request, res: Response) => {
    try {
      const db = prisma as any;
      const latest = await db.indexedEvent.findFirst({
        orderBy: { ledgerSequence: "desc" },
        select: { ledgerSequence: true, ingestedAt: true },
      });

      res.json({
        lastIngestedLedger: indexer.getLastIngestedLedger(),
        latestPersistedLedger: latest?.ledgerSequence ?? null,
        latestIngestedAt: latest?.ingestedAt ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get indexer lag" });
    }
  });

  router.post("/events/backfill", async (req: Request, res: Response) => {
    try {
      const { from, to } = req.body ?? {};
      const result = await indexer.backfill(from ? Number(from) : undefined, to ? Number(to) : undefined);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger backfill" });
    }
  });

  router.get("/trades/:id/timeline", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const timeline = await indexer.getTradeTimeline(id);
      res.json({ data: timeline });
    } catch (error) {
      res.status(500).json({ error: "Failed to get trade timeline" });
    }
  });

  return router;
}
