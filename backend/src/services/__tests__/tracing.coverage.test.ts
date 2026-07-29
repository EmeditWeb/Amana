import { PrismaClient, DisputeStatus, TradeStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock OpenTelemetry so we can assert on span creation without a real
// exporter/collector. Mirrors the pattern used in tracing.middleware.test.ts.
// ---------------------------------------------------------------------------
const mockSpan = {
  setAttributes: jest.fn(),
  setAttribute: jest.fn(),
  addEvent: jest.fn(),
  recordException: jest.fn(),
  setStatus: jest.fn(),
  end: jest.fn(),
};
const mockTracer = { startSpan: jest.fn(() => mockSpan) };

jest.mock('@opentelemetry/api', () => {
  return {
    trace: {
      getTracer: jest.fn(() => mockTracer),
      getActiveSpan: jest.fn(() => mockSpan),
      setSpan: jest.fn(() => ({})),
      active: jest.fn(),
    },
    SpanKind: { INTERNAL: 'INTERNAL', SERVER: 'SERVER' },
    SpanStatusCode: { OK: 'OK', ERROR: 'ERROR' },
    context: {
      active: jest.fn(() => ({})),
      with: jest.fn((_ctx: unknown, fn: () => void) => fn()),
    },
  };
});

jest.mock('ioredis', () => {
  const m = {
    get: jest.fn(),
    set: jest.fn(),
    getdel: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    on: jest.fn(),
  };
  const ctor = jest.fn().mockImplementation(() => m);
  (ctor as any)._instance = m;
  return ctor;
});

jest.mock('../user.service', () => ({
  findOrCreateUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../middleware/logger', () => ({
  appLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Redis from 'ioredis';
import { Keypair } from '@stellar/stellar-sdk';
import { AuthService } from '../auth.service';
import { TradeService } from '../trade.service';
import { DisputeService } from '../dispute.service';
import { ContractService } from '../contract.service';

function getRedisMock() {
  return (Redis as any)._instance;
}

function createMockTradePrisma() {
  return {
    trade: {
      create: jest.fn().mockResolvedValue({ tradeId: 'T-1', status: TradeStatus.PENDING_SIGNATURE }),
      findFirst: jest.fn(),
    },
    dispute: { create: jest.fn().mockResolvedValue({}) },
    disputeCategory: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
  } as unknown as PrismaClient;
}

function createMockContractService() {
  return {
    buildInitiateDisputeTx: jest.fn().mockResolvedValue({ unsignedXdr: 'mock-xdr' }),
  } as unknown as ContractService;
}

function createMockDisputePrisma() {
  const txClient = {
    dispute: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const dispute = {
    id: 1,
    tradeId: 'T-1',
    initiator: 'GBUYER',
    reason: 'not delivered',
    status: DisputeStatus.UNDER_REVIEW,
    version: 0,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    trade: { buyerAddress: 'GBUYER', sellerAddress: 'GSELLER', amountUsdc: '100' },
  };

  txClient.dispute.findFirst.mockResolvedValue(dispute);
  txClient.dispute.findUniqueOrThrow.mockResolvedValue({ ...dispute, status: DisputeStatus.RESOLVED });

  return {
    $transaction: jest.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
  } as unknown as PrismaClient;
}

describe('Distributed tracing coverage (#892)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_ISSUER = 'amana';
    process.env.JWT_AUDIENCE = 'amana-api';
  });

  describe('auth flow', () => {
    it('creates a span for challenge generation', async () => {
      const redisMock = getRedisMock();
      redisMock.set.mockResolvedValue('OK');
      const wallet = Keypair.random().publicKey();

      await AuthService.generateChallenge(wallet);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'auth.generate_challenge',
        expect.objectContaining({ attributes: expect.objectContaining({ 'auth.operation': 'generate_challenge' }) }),
      );
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('creates a span for signature verification with a signature-validity attribute', async () => {
      const redisMock = getRedisMock();
      const keypair = Keypair.random();
      const wallet = keypair.publicKey();
      const challenge = 'test-challenge';
      redisMock.getdel.mockResolvedValue(challenge);

      const signature = keypair.sign(Buffer.from(challenge, 'utf8')).toString('base64url');

      await AuthService.verifySignatureAndIssueJWT(wallet, signature);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'auth.verify_signature',
        expect.objectContaining({ attributes: expect.objectContaining({ 'auth.operation': 'verify_signature' }) }),
      );
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'auth.signature_valid': true }),
      );
    });
  });

  describe('trade lifecycle flow', () => {
    it('creates a span when creating a pending trade', async () => {
      const prisma = createMockTradePrisma();
      const service = new TradeService(prisma, createMockContractService());

      await service.createPendingTrade({
        tradeId: 'T-1',
        buyerAddress: 'GBUYER',
        sellerAddress: 'GSELLER',
        amountUsdc: '100',
        buyerLossBps: 5000,
        sellerLossBps: 5000,
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'trade.create_pending',
        expect.objectContaining({ attributes: expect.objectContaining({ 'trade.id': 'T-1' }) }),
      );
    });

    it('creates a span when initiating a dispute from the trade lifecycle', async () => {
      const prisma = createMockTradePrisma();
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        tradeId: 'T-1',
        buyerAddress: 'GBUYER',
        sellerAddress: 'GSELLER',
        status: TradeStatus.FUNDED,
      });
      const service = new TradeService(prisma, createMockContractService());

      await service.initiateDispute('T-1', 'GBUYER', 'reason', 'category');

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'dispute.initiate',
        expect.objectContaining({ attributes: expect.objectContaining({ 'trade.id': 'T-1' }) }),
      );
    });
  });

  describe('dispute resolution flow', () => {
    it('creates a span with from/to status attributes when transitioning a dispute', async () => {
      const prisma = createMockDisputePrisma();
      const service = new DisputeService(prisma);
      process.env.ADMIN_STELLAR_PUBKEYS = 'GMEDIATOR';

      await service.transitionDisputeStatus('T-1', 'GMEDIATOR', DisputeStatus.RESOLVED);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'dispute.transition_status',
        expect.objectContaining({ attributes: expect.objectContaining({ 'trade.id': 'T-1' }) }),
      );
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'dispute.status_from': DisputeStatus.UNDER_REVIEW,
          'dispute.status_to': DisputeStatus.RESOLVED,
        }),
      );

      delete process.env.ADMIN_STELLAR_PUBKEYS;
    });
  });
});
