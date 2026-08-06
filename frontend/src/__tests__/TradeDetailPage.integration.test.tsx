import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TradeDetailPage from "@/app/trades/[id]/page";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { signTransaction } from "@stellar/freighter-api";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "trade-123" }),
}));

jest.mock("@/hooks/useAuth");
jest.mock("@/hooks/useWallet");
jest.mock("@stellar/freighter-api", () => ({
  signTransaction: jest.fn(),
}));

const BUYER_ADDRESS = "GBUYER123456789012345678901234567890123456789012345678";
const SELLER_ADDRESS = "GSELLER12345678901234567890123456789012345678901234567";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockSignTransaction = signTransaction as jest.MockedFunction<typeof signTransaction>;
const originalFetch = globalThis.fetch;

function mockAuth() {
  mockUseAuth.mockReturnValue({
    address: BUYER_ADDRESS,
    token: "jwt-token",
    shortAddress: "GBUY...5678",
    isAuthenticated: true,
    isWalletConnected: true,
    isWalletDetected: true,
    isLoading: false,
    error: null,
    connectWallet: jest.fn(),
    authenticate: jest.fn(),
    logout: jest.fn(),
    refreshAuth: jest.fn(),
  });
}

function mockWallet() {
  mockUseWallet.mockReturnValue({
    publicKey: BUYER_ADDRESS,
    network: "testnet",
    balances: { XLM: "1000" },
    isConnected: true,
    isConnecting: false,
    error: null,
    refreshBalances: jest.fn(),
  });
}

function mockBackendResponse(body: unknown, init: ResponseInit = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? "",
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function tradeResponse(status = "PENDING") {
  return {
    tradeId: "trade-123",
    buyerAddress: BUYER_ADDRESS,
    sellerAddress: SELLER_ADDRESS,
    amountCngn: "5000",
    buyerLossBps: 100,
    sellerLossBps: 200,
    status,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  };
}

describe("Trade detail integration with mocked backend responses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
    mockWallet();
    mockSignTransaction.mockResolvedValue({
      signedTxXdr: "signed-xdr",
      signerAddress: BUYER_ADDRESS,
    } as Awaited<ReturnType<typeof signTransaction>>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("loads trade details from the backend and completes the deposit signing flow", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockBackendResponse(tradeResponse()))
      .mockResolvedValueOnce(mockBackendResponse({ unsignedXdr: "deposit-xdr" }))
      .mockResolvedValueOnce(mockBackendResponse(tradeResponse("FUNDED")));
    globalThis.fetch = fetchMock;

    render(<TradeDetailPage />);

    expect(await screen.findByText("trade-123")).toBeInTheDocument();
    expect(screen.getByText("5000 cNGN")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("action-deposit"));

    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalledWith("deposit-xdr", expect.any(Object));
    });
    expect(
      await screen.findByText(/Deposit signed successfully/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/trades/trade-123",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      }),
    );
  });

  it("shows backend error details and retries successfully", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockBackendResponse(
          { error: "Trade service unavailable" },
          { status: 503, statusText: "Service Unavailable" },
        ),
      )
      .mockResolvedValueOnce(mockBackendResponse(tradeResponse("FUNDED")));
    globalThis.fetch = fetchMock;

    render(<TradeDetailPage />);

    expect(await screen.findByText("Trade service unavailable")).toBeInTheDocument();

    await userEvent.click(screen.getByText(/retry/i));

    expect(await screen.findByText("trade-123")).toBeInTheDocument();
    expect(screen.getByText("FUNDED")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
