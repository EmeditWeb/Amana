import { Router, Request, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { appLogger } from "../middleware/logger";
import { recordCspViolation } from "../lib/cspMetrics";

/**
 * Browsers POST a CSP violation report here as
 * `{ "csp-report": { "blocked-uri": "...", "violated-directive": "...", ... } }`,
 * configured via helmet's `reportUri` directive in app.ts. Browsers use
 * `Content-Type: application/csp-report` (some send `application/json`),
 * neither of which the app-wide `express.json()` in app.ts parses, so this
 * route scopes its own parser to both.
 */
interface CspReportBody {
  "csp-report"?: {
    "blocked-uri"?: string;
    "violated-directive"?: string;
    "document-uri"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: string;
  };
}

const cspReportBodyParser = express.json({
  type: ["application/csp-report", "application/json"],
  limit: "20kb",
});

export function createCspRouter(): Router {
  const router = Router();
  // Created per router instance (not module scope) so each createCspRouter()
  // call — one per app instance — gets its own rate-limit counter, rather
  // than sharing state across every app created in the same process (which
  // would otherwise leak between test cases building a fresh app each time).
  const cspReportLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post(
    "/api/v1/csp-violation",
    cspReportLimiter,
    cspReportBodyParser,
    (req: Request<unknown, unknown, CspReportBody>, res: Response) => {
      const report = req.body?.["csp-report"];
      const blockedUri = report?.["blocked-uri"] ?? "unknown";
      const directive = report?.["effective-directive"] ?? report?.["violated-directive"] ?? "unknown";

      appLogger.warn(
        { tag: "csp-violation", blockedUri, directive, report },
        "CSP violation reported",
      );
      recordCspViolation(blockedUri, directive);

      res.status(204).end();
    },
  );

  return router;
}
