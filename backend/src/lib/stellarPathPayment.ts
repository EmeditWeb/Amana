import {
  Account,
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk";
import { horizonServer, networkPassphrase } from "../config/stellar";

/**
 * Utilities for building Stellar path payments (cross-asset conversions in a
 * single transaction) and for finding conversion paths ahead of time.
 *
 * Path payments let a sender pay in one asset while the recipient receives a
 * different asset, using the Stellar network's built-in DEX to route the
 * conversion atomically. Two variants are supported by the network and both
 * are exposed here:
 *
 *  - **strict send**: the sender fixes the amount they send; the recipient
 *    gets "whatever the path yields", bounded by a minimum.
 *  - **strict receive**: the recipient's amount is fixed; the sender pays
 *    "whatever the path costs", bounded by a maximum.
 *
 * See https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#path-payment-strict-send
 */

export interface PathPaymentStrictSendParams {
  /** Public key of the account funding/signing the transaction. */
  sourcePublicKey: string;
  /** Destination account public key that will receive `destAsset`. */
  destinationPublicKey: string;
  /** Asset the sender is spending. */
  sendAsset: Asset;
  /** Exact amount of `sendAsset` to spend, as a decimal string (e.g. "10.5"). */
  sendAmount: string;
  /** Asset the destination account will receive. */
  destAsset: Asset;
  /**
   * Minimum acceptable amount of `destAsset` the destination should receive,
   * as a decimal string. Protects the sender against slippage.
   */
  destMin: string;
  /** Optional intermediate assets forming the conversion path. Defaults to none (direct or auto-routed by Horizon's path-finding). */
  path?: Asset[];
  /** Memo text to attach to the transaction, if any. */
  memo?: string;
  /** Transaction fee in stroops. Defaults to `BASE_FEE`. */
  fee?: string;
  /** Transaction timeout in seconds. Defaults to 30. */
  timeoutSeconds?: number;
}

export interface PathPaymentStrictReceiveParams {
  /** Public key of the account funding/signing the transaction. */
  sourcePublicKey: string;
  /** Destination account public key that will receive `destAsset`. */
  destinationPublicKey: string;
  /** Asset the sender is spending. */
  sendAsset: Asset;
  /**
   * Maximum amount of `sendAsset` the sender is willing to spend, as a
   * decimal string. Protects the sender against slippage.
   */
  sendMax: string;
  /** Asset the destination account will receive. */
  destAsset: Asset;
  /** Exact amount of `destAsset` the destination should receive, as a decimal string. */
  destAmount: string;
  /** Optional intermediate assets forming the conversion path. */
  path?: Asset[];
  /** Memo text to attach to the transaction, if any. */
  memo?: string;
  /** Transaction fee in stroops. Defaults to `BASE_FEE`. */
  fee?: string;
  /** Transaction timeout in seconds. Defaults to 30. */
  timeoutSeconds?: number;
}

/**
 * Loads the current sequence number for `publicKey` from Horizon and returns
 * an `Account` object usable as a transaction source.
 */
export async function loadSourceAccount(publicKey: string): Promise<Account> {
  const account = await horizonServer.loadAccount(publicKey);
  return new Account(account.accountId(), account.sequenceNumber());
}

/**
 * Builds (but does not sign or submit) a path-payment-strict-send
 * transaction: "I will send exactly `sendAmount` of `sendAsset`; the
 * recipient gets at least `destMin` of `destAsset`."
 *
 * Callers are responsible for signing the returned transaction with the
 * source account's keypair and submitting it via `submitPathPayment`.
 */
export async function buildPathPaymentStrictSend(
  params: PathPaymentStrictSendParams,
): Promise<Transaction> {
  const sourceAccount = await loadSourceAccount(params.sourcePublicKey);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: params.fee ?? BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: params.sendAsset,
        sendAmount: params.sendAmount,
        destination: params.destinationPublicKey,
        destAsset: params.destAsset,
        destMin: params.destMin,
        path: params.path ?? [],
      }),
    )
    .setTimeout(params.timeoutSeconds ?? 30);

  if (params.memo) {
    transaction.addMemo(Memo.text(params.memo));
  }

  return transaction.build();
}

/**
 * Builds (but does not sign or submit) a path-payment-strict-receive
 * transaction: "The recipient will get exactly `destAmount` of `destAsset`;
 * I will pay at most `sendMax` of `sendAsset`."
 *
 * Callers are responsible for signing the returned transaction with the
 * source account's keypair and submitting it via `submitPathPayment`.
 */
export async function buildPathPaymentStrictReceive(
  params: PathPaymentStrictReceiveParams,
): Promise<Transaction> {
  const sourceAccount = await loadSourceAccount(params.sourcePublicKey);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: params.fee ?? BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: params.sendAsset,
        sendMax: params.sendMax,
        destination: params.destinationPublicKey,
        destAsset: params.destAsset,
        destAmount: params.destAmount,
        path: params.path ?? [],
      }),
    )
    .setTimeout(params.timeoutSeconds ?? 30);

  if (params.memo) {
    transaction.addMemo(Memo.text(params.memo));
  }

  return transaction.build();
}

/**
 * Finds candidate conversion paths from `sourceAssets` to `destAsset` for a
 * fixed destination amount, using Horizon's `/paths/strict-receive` endpoint.
 * Useful for quoting a `sendMax` before building a strict-receive payment.
 */
export async function findStrictReceivePaths(
  sourceAssets: Asset[],
  destAsset: Asset,
  destAmount: string,
): Promise<Horizon.ServerApi.PaymentPathRecord[]> {
  const response = await horizonServer
    .strictReceivePaths(sourceAssets, destAsset, destAmount)
    .call();
  return response.records;
}

/**
 * Finds candidate conversion paths for a fixed source amount, using
 * Horizon's `/paths/strict-send` endpoint. Useful for quoting a `destMin`
 * before building a strict-send payment.
 */
export async function findStrictSendPaths(
  sourceAsset: Asset,
  sourceAmount: string,
  destinationAssets: Asset[],
): Promise<Horizon.ServerApi.PaymentPathRecord[]> {
  const response = await horizonServer
    .strictSendPaths(sourceAsset, sourceAmount, destinationAssets)
    .call();
  return response.records;
}

/**
 * Submits an already-signed transaction to Horizon and returns the
 * submission result. Left as a thin wrapper so callers can reuse the
 * existing error classification helpers in `stellar.service.ts` around it.
 */
export async function submitPathPayment(
  signedTransaction: Transaction,
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  return horizonServer.submitTransaction(signedTransaction);
}
