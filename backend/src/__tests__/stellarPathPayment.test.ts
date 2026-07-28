import { Asset, Keypair } from "@stellar/stellar-sdk";

const mockLoadAccount = jest.fn();
const mockStrictSendPaths = jest.fn();
const mockStrictReceivePaths = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock("../config/stellar", () => ({
  horizonServer: {
    loadAccount: (...args: unknown[]) => mockLoadAccount(...args),
    strictSendPaths: (...args: unknown[]) => mockStrictSendPaths(...args),
    strictReceivePaths: (...args: unknown[]) => mockStrictReceivePaths(...args),
    submitTransaction: (...args: unknown[]) => mockSubmitTransaction(...args),
  },
  sorobanRpcClient: {},
  networkPassphrase: "Test SDF Network ; September 2015",
}));

import {
  buildPathPaymentStrictSend,
  buildPathPaymentStrictReceive,
  findStrictSendPaths,
  findStrictReceivePaths,
  submitPathPayment,
} from "../lib/stellarPathPayment";

const SOURCE_PUBLIC_KEY = Keypair.random().publicKey();
const DEST_PUBLIC_KEY = Keypair.random().publicKey();
const USDC_ISSUER = "GDDD3FRCH55BSYNKISYY242HQNIBOH35CQP42NSJABR62XK2JOV5MED6";

function mockAccount(sequence = "10") {
  return {
    accountId: () => SOURCE_PUBLIC_KEY,
    sequenceNumber: () => sequence,
  };
}

describe("stellarPathPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAccount.mockResolvedValue(mockAccount());
  });

  it("builds a strict-send path payment transaction with the correct operation", async () => {
    const usdc = new Asset("USDC", USDC_ISSUER);

    const tx = await buildPathPaymentStrictSend({
      sourcePublicKey: SOURCE_PUBLIC_KEY,
      destinationPublicKey: DEST_PUBLIC_KEY,
      sendAsset: Asset.native(),
      sendAmount: "100",
      destAsset: usdc,
      destMin: "9",
    });

    expect(mockLoadAccount).toHaveBeenCalledWith(SOURCE_PUBLIC_KEY);
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]?.type).toBe("pathPaymentStrictSend");
  });

  it("builds a strict-receive path payment transaction with the correct operation", async () => {
    const usdc = new Asset("USDC", USDC_ISSUER);

    const tx = await buildPathPaymentStrictReceive({
      sourcePublicKey: SOURCE_PUBLIC_KEY,
      destinationPublicKey: DEST_PUBLIC_KEY,
      sendAsset: Asset.native(),
      sendMax: "110",
      destAsset: usdc,
      destAmount: "10",
    });

    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]?.type).toBe("pathPaymentStrictReceive");
  });

  it("attaches a text memo when provided", async () => {
    const usdc = new Asset("USDC", USDC_ISSUER);

    const tx = await buildPathPaymentStrictSend({
      sourcePublicKey: SOURCE_PUBLIC_KEY,
      destinationPublicKey: DEST_PUBLIC_KEY,
      sendAsset: Asset.native(),
      sendAmount: "100",
      destAsset: usdc,
      destMin: "9",
      memo: "hello",
    });

    expect(tx.memo.value).toBe("hello");
  });

  it("delegates strict-send path lookups to Horizon", async () => {
    const usdc = new Asset("USDC", USDC_ISSUER);
    const records = [{ source_amount: "100" }];
    mockStrictSendPaths.mockReturnValue({
      call: jest.fn().mockResolvedValue({ records }),
    });

    const result = await findStrictSendPaths(Asset.native(), "100", [usdc]);

    expect(mockStrictSendPaths).toHaveBeenCalledWith(
      Asset.native(),
      "100",
      [usdc],
    );
    expect(result).toEqual(records);
  });

  it("delegates strict-receive path lookups to Horizon", async () => {
    const usdc = new Asset("USDC", USDC_ISSUER);
    const records = [{ destination_amount: "10" }];
    mockStrictReceivePaths.mockReturnValue({
      call: jest.fn().mockResolvedValue({ records }),
    });

    const result = await findStrictReceivePaths([Asset.native()], usdc, "10");

    expect(mockStrictReceivePaths).toHaveBeenCalledWith(
      [Asset.native()],
      usdc,
      "10",
    );
    expect(result).toEqual(records);
  });

  it("submits a signed transaction via Horizon", async () => {
    const fakeResponse = { hash: "abc123", successful: true };
    mockSubmitTransaction.mockResolvedValue(fakeResponse);

    const tx = { toXDR: () => "fake" } as any;
    const result = await submitPathPayment(tx);

    expect(mockSubmitTransaction).toHaveBeenCalledWith(tx);
    expect(result).toBe(fakeResponse);
  });
});
