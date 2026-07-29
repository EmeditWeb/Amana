import { Request, Response, NextFunction } from "express";

/** Advertises which API version served this response. */
export function apiVersionHeader(version: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("X-API-Version", String(version));
    next();
  };
}

/** Marks a route tree as deprecated per RFC 8594 (Sunset) and the Deprecation header draft.
 *  `successorPath` is advertised via a Link header so clients can discover where to migrate. */
export function deprecationHeaders(sunsetDate: string, successorPath: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", sunsetDate);
    res.setHeader("Link", `<${successorPath}>; rel="successor-version"`);
    next();
  };
}
