import rateLimit from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import { RateLimitPreset } from '../config/rateLimit';
import { ErrorCode } from '../errors/errorCodes';
import { AuthRequest } from '../services/auth.service';
import logger from '../middleware/logger';

type KeyGenerator = (req: Request) => string;

// Track rate limit breach attempts for suspicious activity detection
const breachTracker = new Map<string, { count: number; firstBreach: Date; lastBreach: Date }>();
const BREACH_ALERT_THRESHOLD = 5; // Alert after 5 breaches
const BREACH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

function trackRateLimitBreach(key: string, req: Request): void {
  const now = new Date();
  const existing = breachTracker.get(key);

  if (existing) {
    // Check if still within the window
    if (now.getTime() - existing.firstBreach.getTime() < BREACH_WINDOW_MS) {
      existing.count++;
      existing.lastBreach = now;

      // Alert on suspicious patterns
      if (existing.count >= BREACH_ALERT_THRESHOLD) {
        logger.warn('Suspicious rate-limit breach pattern detected', {
          key,
          breachCount: existing.count,
          firstBreach: existing.firstBreach.toISOString(),
          lastBreach: existing.lastBreach.toISOString(),
          ip: resolveClientIp(req),
          path: req.path,
          userAgent: req.headers['user-agent'],
          walletAddress: resolveWalletAddress(req),
          alert: 'RATE_LIMIT_ABUSE',
        });
      }
    } else {
      // Reset if outside window
      breachTracker.set(key, { count: 1, firstBreach: now, lastBreach: now });
    }
  } else {
    breachTracker.set(key, { count: 1, firstBreach: now, lastBreach: now });
  }

  // Log every breach for audit trail
  logger.info('Rate limit breach', {
    key,
    ip: resolveClientIp(req),
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
    walletAddress: resolveWalletAddress(req),
  });
}

function resolveClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function resolveWalletAddress(req: Request): string | undefined {
  const walletAddress = (req as AuthRequest).user?.walletAddress?.trim();
  return walletAddress || undefined;
}

export function createIpRateLimiter(preset: RateLimitPreset) {
  return createRateLimiter(preset, resolveClientIp);
}

export function createWalletRateLimiter(preset: RateLimitPreset) {
  return createRateLimiter(preset, (req: Request) => {
    const walletAddress = resolveWalletAddress(req);
    if (!walletAddress) {
      return resolveClientIp(req);
    }
    return `wallet:${walletAddress}`;
  });
}

function createRateLimiter(preset: RateLimitPreset, keyGenerator: KeyGenerator) {
  return rateLimit({
    windowMs: preset.windowMs,
    max: preset.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: preset.message,
    keyGenerator,
    handler: (
      req: Request,
      res: Response,
      _next: NextFunction,
      options: { message?: string | unknown; windowMs?: number; max?: number },
    ) => {
      const retryAfterSeconds = Math.ceil((options.windowMs ?? preset.windowMs) / 1000);
      const key = keyGenerator(req);

      // Track and alert on suspicious breach patterns
      trackRateLimitBreach(key, req);

      res.status(429).json({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: typeof options.message === 'string' ? options.message : preset.message,
        details: {
          retryAfterSeconds,
          limit: options.max ?? preset.max,
          windowMs: options.windowMs ?? preset.windowMs,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    },
  });
}
