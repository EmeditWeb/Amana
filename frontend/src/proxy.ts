import { NextRequest, NextResponse } from "next/server";

/**
 * Content-Security-Policy hardening (issue #1000).
 *
 * Mirrors the backend's helmet CSP directives (backend/src/app.ts) so the
 * two surfaces enforce the same policy, plus a per-request nonce for
 * `script-src` so Next.js's own inline bootstrap scripts still execute
 * under a strict, non-`'unsafe-inline'` policy.
 *
 * Rollout: this ships directly in enforce mode rather than the
 * report-only staged rollout described in the original proposal, since
 * `'strict-dynamic'` + a nonce is required for Next.js's App Router to
 * function at all (its inline scripts have no other way to be allowed) —
 * there's no meaningful "report-only" middle state for that specific
 * directive. `Content-Security-Policy-Report-Only` for the rest of the
 * directives is left as a follow-up if broader monitoring before enforcing
 * is wanted.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'strict-dynamic' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://ipfs.io https://*.pinata.cloud`,
    `connect-src 'self' https://api.stellar.org https://horizon.stellar.org https://horizon-testnet.stellar.org`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `report-uri ${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/csp-violation`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (proxied API calls, not HTML — the backend sets its own CSP)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, and common static asset extensions
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
