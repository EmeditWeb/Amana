import { Response, NextFunction } from "express";
import { isAdminAddress } from "../lib/accessControl";
import { AuthRequest } from "../services/auth.service";

/**
 * Restricts a route to admin wallet addresses only. Applied to fee accounting
 * (`/fees`, `/fees/summary`) and other admin-only routes — non-admin
 * authenticated users receive 403 rather than being able to read financial
 * data. Uses the case-normalized admin allowlist so a differently-cased
 * wallet address for a legitimate admin is never incorrectly rejected.
 */
export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const walletAddress = req.user?.walletAddress?.trim();
  if (!walletAddress || !isAdminAddress(walletAddress)) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
};
