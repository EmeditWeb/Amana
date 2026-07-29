/**
 * Example: building a Stellar path payment with the helpers in
 * `src/lib/stellarPathPayment.ts`.
 *
 * This script is illustrative — it builds transactions but does not sign or
 * submit them (signing requires a real secret key, which should never be
 * hardcoded). See docs/backend/path-payments.md for the full walkthrough.
 *
 * Run with: npx tsx backend/scripts/path-payment-example.ts
 */
import { Asset, Keypair } from "@stellar/stellar-sdk";
import {
  buildPathPaymentStrictSend,
  buildPathPaymentStrictReceive,
  findStrictSendPaths,
  findStrictReceivePaths,
} from "../src/lib/stellarPathPayment";
import { USDC_ISSUER_TESTNET } from "../src/config/stellar";

async function main() {
  const sourceKeypair = Keypair.random();
  const destinationKeypair = Keypair.random();

  const usdc = new Asset("USDC", USDC_ISSUER_TESTNET);
  const nativeXlm = Asset.native();

  // --- Strict send: "I will send exactly 100 XLM, recipient gets at least 9 USDC" ---
  const sendPaths = await findStrictSendPaths(nativeXlm, "100", [usdc]).catch(
    () => [],
  );
  console.log("Strict-send candidate paths:", sendPaths.length);

  const strictSendTx = await buildPathPaymentStrictSend({
    sourcePublicKey: sourceKeypair.publicKey(),
    destinationPublicKey: destinationKeypair.publicKey(),
    sendAsset: nativeXlm,
    sendAmount: "100",
    destAsset: usdc,
    destMin: "9",
    memo: "example strict-send",
  }).catch((error) => {
    console.log(
      "Skipping build (no funded source account on this network):",
      error.message,
    );
    return null;
  });

  if (strictSendTx) {
    console.log("Strict-send transaction XDR:", strictSendTx.toXDR());
  }

  // --- Strict receive: "Recipient gets exactly 10 USDC, I pay at most 110 XLM" ---
  const receivePaths = await findStrictReceivePaths(
    [nativeXlm],
    usdc,
    "10",
  ).catch(() => []);
  console.log("Strict-receive candidate paths:", receivePaths.length);

  const strictReceiveTx = await buildPathPaymentStrictReceive({
    sourcePublicKey: sourceKeypair.publicKey(),
    destinationPublicKey: destinationKeypair.publicKey(),
    sendAsset: nativeXlm,
    sendMax: "110",
    destAsset: usdc,
    destAmount: "10",
    memo: "example strict-receive",
  }).catch((error) => {
    console.log(
      "Skipping build (no funded source account on this network):",
      error.message,
    );
    return null;
  });

  if (strictReceiveTx) {
    console.log("Strict-receive transaction XDR:", strictReceiveTx.toXDR());
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
