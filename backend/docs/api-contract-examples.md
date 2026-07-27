# Amana API Contract Examples

This document provides working code snippets in JavaScript/TypeScript demonstrating
the Amana backend API: authentication, trade lifecycle, dispute management, and
evidence upload. All examples use `fetch` (Node 18+) and require no external SDK.

## Table of Contents

- [Authentication](#authentication)
- [Create a Trade](#create-a-trade)
- [List Trades](#list-trades)
- [Deposit Funds](#deposit-funds)
- [Confirm Delivery](#confirm-delivery)
- [Release Funds](#release-funds)
- [Initiate Dispute](#initiate-dispute)
- [Upload Evidence](#upload-evidence)
- [Audit Trail](#audit-trail)

---

## Authentication

Amana uses a challenge/response flow with Stellar key pairs.

### Step 1: Request Challenge

```typescript
const BASE_URL = 'https://api.amana.com';

async function requestChallenge(walletAddress: string) {
  const res = await fetch(`${BASE_URL}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  const { challenge } = await res.json();
  return challenge; // e.g. "amana:login:1742794421:7ced1c65"
}
```

### Step 2: Verify Challenge (Sign with Stellar wallet)

```typescript
import { Keypair } from '@stellar/stellar-sdk';

async function verifyAndGetToken(
  walletAddress: string,
  secretKey: string,
  challenge: string,
) {
  // Sign the challenge with your Stellar secret key
  const keypair = Keypair.fromSecret(secretKey);
  const signedChallenge = keypair.sign(Buffer.from(challenge)).toString('base64');

  const res = await fetch(`${BASE_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signedChallenge }),
  });
  const { token } = await res.json();
  return token; // JWT bearer token
}
```

### Step 3: Use the Token

```typescript
function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-correlation-id': crypto.randomUUID(),
  };
}
```

---

## Create a Trade

```typescript
async function createTrade(
  token: string,
  params: {
    sellerAddress: string;
    amountUsdc: string;
    buyerLossBps?: number;
    sellerLossBps?: number;
    description?: string;
  },
) {
  const res = await fetch(`${BASE_URL}/trades`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      sellerAddress: params.sellerAddress,
      amountUsdc: params.amountUsdc,
      buyerLossBps: params.buyerLossBps ?? 5000,
      sellerLossBps: params.sellerLossBps ?? 5000,
      description: params.description,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? 'Trade creation failed');
  }

  return res.json(); // { id: string, unsignedXdr: string, ... }
}
```

**Usage:**

```typescript
const trade = await createTrade(token, {
  sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  amountUsdc: '1000.50',
  buyerLossBps: 5000,
  sellerLossBps: 5000,
  description: '50kg rice bags',
});
console.log('Trade created:', trade.id);
```

---

## List Trades

```typescript
async function listTrades(
  token: string,
  filters?: {
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
  },
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.sort) params.set('sort', filters.sort);

  const res = await fetch(`${BASE_URL}/trades?${params}`, {
    headers: authHeaders(token),
  });
  return res.json();
}
```

**Usage:**

```typescript
const { data, pagination } = await listTrades(token, {
  status: 'FUNDED',
  page: 1,
  limit: 20,
  sort: '-createdAt',
});

for (const trade of data) {
  console.log(`${trade.id}: ${trade.amountUsdc} USDC — ${trade.status}`);
}
```

---

## Deposit Funds

```typescript
async function deposit(tradeId: string, token: string) {
  const res = await fetch(`${BASE_URL}/trades/${tradeId}/deposit`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  const { transactionXdr, hash } = await res.json();
  return { transactionXdr, hash };
}
```

---

## Confirm Delivery

```typescript
async function confirmDelivery(
  tradeId: string,
  token: string,
  proof?: { proofOfDeliveryUrl?: string; notes?: string },
) {
  const res = await fetch(`${BASE_URL}/trades/${tradeId}/confirm`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(proof ?? {}),
  });
  return res.json(); // { id, status: 'DELIVERED', updatedAt }
}
```

---

## Release Funds

```typescript
async function releaseFunds(tradeId: string, token: string) {
  const res = await fetch(`${BASE_URL}/trades/${tradeId}/release`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return res.json(); // { transactionXdr, hash, status: 'COMPLETED' }
}
```

---

## Initiate Dispute

```typescript
async function initiateDispute(
  tradeId: string,
  token: string,
  reason: string,
  category?: string,
) {
  const res = await fetch(`${BASE_URL}/trades/${tradeId}/dispute`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason, category }),
  });

  if (res.status === 429) {
    const err = await res.json();
    const retryAfter = Number(res.headers.get('retry-after') ?? 60);
    throw new Error(`Rate limited. Retry after ${retryAfter}s`);
  }

  return res.json(); // { id, tradeId, status: 'OPEN', ... }
}
```

---

## Upload Evidence

```typescript
async function uploadEvidence(
  tradeId: string,
  token: string,
  file: File | Blob,
  metadata: Record<string, unknown>,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('metadata', JSON.stringify(metadata));

  const res = await fetch(`${BASE_URL}/trades/${tradeId}/evidence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-correlation-id': crypto.randomUUID() },
    body: form,
  });
  return res.json(); // { tradeId, cid, status: 'uploaded' }
}
```

**Usage with local file (Node.js):**

```typescript
import { readFileSync } from 'node:fs';

const file = new Blob([readFileSync('/path/to/video.mp4')], { type: 'video/mp4' });
const evidence = await uploadEvidence('trade-uuid-123', token, file, {
  timestamp: new Date().toISOString(),
  coordinates: { lat: 6.5244, lng: 3.3792 },
});
```

---

## Audit Trail

```typescript
async function getAuditTrail(
  tradeId: string,
  token: string,
  filters?: { limit?: number; offset?: number; action?: string },
) {
  const params = new URLSearchParams();
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  if (filters?.action) params.set('action', filters.action);

  const res = await fetch(
    `${BASE_URL}/trades/${tradeId}/history?${params}`,
    { headers: authHeaders(token) },
  );
  return res.json(); // { entries: Array<{ action, actor, changes, timestamp }> }
}
```

---

## Error Handling

All errors follow a consistent JSON structure:

```typescript
interface AmanaError {
  error: {
    code: string;
    message: string;
    statusCode: number;
    correlationId: string;
    requestId: string;
    details?: Array<{ field: string; issue: string }>;
    timestamp: string;
  };
}

async function apiFetch(url: string, options: RequestInit) {
  const res = await fetch(url, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? body;
    throw Object.assign(new Error(err.message ?? 'Request failed'), {
      code: err.code,
      statusCode: res.status,
      correlationId: res.headers.get('x-correlation-id'),
    });
  }

  return res;
}
```

---

## Idempotency Keys

For safe retries on mutation endpoints:

```typescript
async function idempotentPost(url: string, token: string, body: unknown) {
  const key = crypto.randomUUID();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Idempotency-Key': key,
    },
    body: JSON.stringify(body),
  });

  return res.json();
}
```
