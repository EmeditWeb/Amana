# Stellar Path Payments

Path payments let one account send a payment in asset A while the recipient
receives a different asset B, using Stellar's built-in DEX to route the
conversion atomically in a single transaction. This is useful for Amana
whenever a buyer or seller wants to settle in a currency other than the
trade's escrow asset (e.g. paying in XLM while the seller receives cNGN/USDC).

The helpers live in [`src/lib/stellarPathPayment.ts`](../src/lib/stellarPathPayment.ts)
and wrap the two path payment operations exposed by `@stellar/stellar-sdk`:

| Variant | You fix | Network solves for | SDK operation |
|---|---|---|---|
| Strict send | The amount you send | The (variable, minimum-bounded) amount the recipient gets | `Operation.pathPaymentStrictSend` |
| Strict receive | The amount the recipient gets | The (variable, maximum-bounded) amount you pay | `Operation.pathPaymentStrictReceive` |

## Finding a path before building the payment

Before building a transaction, it's usually worth quoting a path so you can
set a sane `destMin` / `sendMax` and avoid excessive slippage:

```ts
import { Asset } from "@stellar/stellar-sdk";
import { findStrictSendPaths, findStrictReceivePaths } from "../src/lib/stellarPathPayment";

const xlm = Asset.native();
const usdc = new Asset("USDC", usdcIssuer);

// "If I send 100 XLM, how much USDC could the recipient get?"
const sendPaths = await findStrictSendPaths(xlm, "100", [usdc]);

// "If the recipient must get exactly 10 USDC, how much XLM would I pay?"
const receivePaths = await findStrictReceivePaths([xlm], usdc, "10");
```

## Building a strict-send payment

```ts
import { Asset, Keypair } from "@stellar/stellar-sdk";
import { buildPathPaymentStrictSend, submitPathPayment } from "../src/lib/stellarPathPayment";

const tx = await buildPathPaymentStrictSend({
  sourcePublicKey: sourceKeypair.publicKey(),
  destinationPublicKey: destinationKeypair.publicKey(),
  sendAsset: Asset.native(),
  sendAmount: "100",
  destAsset: usdc,
  destMin: "9", // reject if the recipient would get less than this
});

tx.sign(sourceKeypair);
const result = await submitPathPayment(tx);
```

## Building a strict-receive payment

```ts
import { buildPathPaymentStrictReceive, submitPathPayment } from "../src/lib/stellarPathPayment";

const tx = await buildPathPaymentStrictReceive({
  sourcePublicKey: sourceKeypair.publicKey(),
  destinationPublicKey: destinationKeypair.publicKey(),
  sendAsset: Asset.native(),
  sendMax: "110", // refuse to pay more than this
  destAsset: usdc,
  destAmount: "10",
});

tx.sign(sourceKeypair);
const result = await submitPathPayment(tx);
```

## Error handling

Submission errors from `submitPathPayment` (or any other Horizon/RPC call)
should be run through the existing `classifyStellarError` /
`classifyStellarServiceError` helpers in
[`src/services/stellar.service.ts`](../src/services/stellar.service.ts) and
[`src/errors/service.errors.ts`](../src/errors/service.errors.ts) so failures
are categorized (timeout, rate limited, invalid XDR, etc.) consistently with
the rest of the Stellar integration.

## Runnable example

See [`backend/scripts/path-payment-example.ts`](../scripts/path-payment-example.ts)
for a runnable script that quotes both kinds of paths and builds (but does
not sign/submit) both payment variants:

```bash
npx tsx backend/scripts/path-payment-example.ts
```
