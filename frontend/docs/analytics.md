# Analytics & Privacy

Amana uses a privacy-first, opt-out analytics layer to collect anonymous usage
telemetry. No personally identifiable information (PII) is ever sent.

---

## What is collected

| Event | Properties sent | PII? |
|-------|----------------|------|
| `page_view` | Route name (e.g. `/trades`) | No |
| `funnel_step` (trade creation) | Step name (`details`, `negotiation`, `review`, `submitted`, `confirmed`) | No |
| `trade_status_change` | New status label | No |
| `dispute_event` | Action label (`initiated`, `evidence_uploaded`, `resolved`) | No |
| `auth_event` | Step name + `success`/`failed` | No |
| `api_failure` | Endpoint path + HTTP status code | No |
| `ui_failure` | Error type label | No |

## What is never collected

- Wallet addresses or Stellar public keys
- Trade amounts, fee values, or any financial data
- User names, email addresses, or phone numbers
- IP addresses
- Browser fingerprints or device identifiers
- Query parameters from URLs

All payloads are passed through `scrubProperties()` in
`frontend/src/lib/analytics.ts` before dispatch, which automatically redacts
strings matching email, IP, and wallet-address patterns, as well as any
properties whose key contains sensitive terms (`email`, `name`, `wallet`,
`token`, etc.).

---

## Analytics providers

The provider is selected via the `NEXT_PUBLIC_ANALYTICS_PROVIDER` environment
variable:

| Value | Behaviour |
|-------|-----------|
| `plausible` | Sends events to Plausible via `window.plausible`. Requires the Plausible script on the page. |
| `custom` | POSTs JSON to `NEXT_PUBLIC_ANALYTICS_ENDPOINT` via `navigator.sendBeacon` (fallback: `fetch`). |
| *(unset)* | No-op in production; logs to `console.debug` in development. |

---

## How to opt out

### In the UI

Go to **Settings → Privacy & Analytics** and toggle **Usage analytics** off.
The preference is stored in `localStorage` under the key `amana_analytics_opt_out`
and takes effect immediately — no page reload required.

### Programmatically

```ts
import { setAnalyticsOptOut, isAnalyticsOptedOut } from "@/lib/analytics";

// Opt out
setAnalyticsOptOut(true);

// Check current preference
isAnalyticsOptedOut(); // → true

// Opt back in
setAnalyticsOptOut(false);
```

The `publishEvent` function in `analytics.ts` checks `isAnalyticsOptedOut()`
before every dispatch, so opting out suppresses all subsequent events for the
session.

---

## Using the analytics functions

```ts
import {
  trackPageView,
  trackTradeCreationStep,
  trackTradeStatusChange,
  trackDisputeEvent,
  trackAuthEvent,
  trackFailure,
  trackApiFailure,
} from "@/lib/analytics";

// Page view (use route segment, never include IDs or query params with PII)
trackPageView("/trades");

// Trade creation funnel
trackTradeCreationStep("details");       // step 1 started
trackTradeCreationStep("negotiation");   // step 2
trackTradeCreationStep("review");        // step 3
trackTradeCreationStep("submitted");     // form submitted

// Trade status change
trackTradeStatusChange("FUNDED");
trackTradeStatusChange("COMPLETED");

// Dispute flow
trackDisputeEvent("initiated");
trackDisputeEvent("evidence_uploaded");
trackDisputeEvent("resolved");

// Auth events
trackAuthEvent("wallet_connect", "started");
trackAuthEvent("challenge_sign", "success");

// Errors
trackFailure("dispute_modal_crash");
trackApiFailure("/trades", 500);
```

Or via the React context (recommended inside components):

```tsx
import { useAnalytics } from "@/components/AnalyticsProvider";

function TradeDetailPage() {
  const { trackTradeStatusChange, trackDisputeEvent } = useAnalytics();

  // ...
  trackTradeStatusChange("DISPUTED");
  trackDisputeEvent("initiated");
}
```

---

## Architecture

```
analytics.ts
├── scrubProperties()           — strips PII from any payload
├── isAnalyticsOptedOut()       — reads localStorage opt-out flag
├── setAnalyticsOptOut()        — writes localStorage opt-out flag
├── publishEvent()              — dispatches (no-op when opted out)
│   ├── sendToPlausible()       — plausible provider
│   └── sendToCustomEndpoint()  — custom provider (sendBeacon / fetch)
├── trackEvent()                — generic event
├── trackFunnelStep()           — funnel wrapper
├── trackPageView()             — page view
├── trackTradeCreationStep()    — trade creation funnel
├── trackTradeStatusChange()    — trade status change
├── trackDisputeEvent()         — dispute lifecycle
├── trackAuthEvent()            — auth flow
├── trackFailure()              — UI errors
└── trackApiFailure()           — API errors

AnalyticsProvider.tsx           — React context wrapping all functions
settings/page.tsx               — opt-out toggle (Privacy & Analytics section)
```
