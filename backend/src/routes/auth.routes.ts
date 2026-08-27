import { Router } from 'express';
import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { AuthService } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthRequest } from '../services/auth.service';
import { RATE_LIMIT_CONFIG } from '../config/rateLimit';
import { createIpRateLimiter } from '../lib/rateLimit';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  getCookie,
  setAuthCookies,
} from '../lib/authCookies';

const authLimiter = createIpRateLimiter(RATE_LIMIT_CONFIG.auth);
const refreshLimiter = createIpRateLimiter(RATE_LIMIT_CONFIG.authRefresh);

const router = Router();

const challengeSchema = z.object({
  walletAddress: z.string().refine((val: string) => StrKey.isValidEd25519PublicKey(val), {
    message: 'Invalid Stellar public key',
  }),
});

function isZodError(err: unknown): err is { errors: unknown[] } {
  return err instanceof z.ZodError;
}

function handleAuthError(err: unknown, isVerify: boolean) {
  if (isZodError(err)) {
    return { status: 400, error: err.errors };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: isVerify ? 401 : 400, error: message };
}

router.post('/challenge', authLimiter, async (req, res) => {
  try {
    const { walletAddress } = challengeSchema.parse(req.body);
    const challenge = await AuthService.generateChallenge(walletAddress);
    res.json({ challenge });
  } catch (err: unknown) {
    const { status, error } = handleAuthError(err, false);
    res.status(status).json({ error });
  }
});

const verifySchema = z.object({
  walletAddress: z.string().refine((val: string) => StrKey.isValidEd25519PublicKey(val), {
    message: 'Invalid Stellar public key',
  }),
  signedChallenge: z.string(),
});

router.post('/verify', authLimiter, async (req, res) => {
  try {
    const { walletAddress, signedChallenge } = verifySchema.parse(req.body);
    const accessToken = await AuthService.verifySignatureAndIssueJWT(walletAddress, signedChallenge);
    const session = await AuthService.issueSession(walletAddress, accessToken);
    setAuthCookies(res, session);
    res.json({ authenticated: true });
  } catch (err: unknown) {
    const { status, error } = handleAuthError(err, true);
    res.status(status).json({ error });
  }
});

router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const jti = req.user?.jti;
    const exp = req.user?.exp;
    if (jti && exp) {
      await AuthService.revokeToken(jti, exp);
    }
    await AuthService.revokeRefreshToken(getCookie(req, REFRESH_TOKEN_COOKIE));
    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (_err: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
    clearAuthCookies(res);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const refreshToken = getCookie(req, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Missing refresh token cookie' });
    }
    const session = await AuthService.rotateRefreshToken(refreshToken);
    setAuthCookies(res, session);
    res.json({ authenticated: true });
  } catch (err: unknown) {
    clearAuthCookies(res);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(401).json({ error: msg });
  }
});

router.get('/validate', authMiddleware, (req: AuthRequest, res) => {
  res.json({ valid: true, user: req.user });
});

export { router as authRoutes };
