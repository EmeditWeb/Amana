# Amana System Architecture

## Overview

Amana is a decentralized financial escrow platform built on Stellar blockchain. The system architecture follows a three-tier model with frontend, backend, and smart contracts.

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web Browser (Frontend)                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ React 19 + Next.js 16                                      │   │
│  │ - User authentication (Freighter wallet)                   │   │
│  │ - Trade creation and management UI                         │   │
│  │ - Evidence upload and submission                           │   │
│  │ - Dispute workflow and evidence review                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                    HTTPS (REST/JSON)
                           │
┌──────────────────────────┴──────────────────────────────────────────┐
│                    Amana Backend (Node.js)                           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ API Gateway & Express Middleware                          │   │
│  │ - JWT Authentication & Authorization                      │   │
│  │ - Request logging and rate limiting                       │   │
│  │ - Error handling and validation                           │   │
│  └────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Service Layer                                              │   │
│  │ - Trade Service: lifecycle and state management           │   │
│  │ - Dispute Service: conflict resolution                    │   │
│  │ - Audit Trail Service: tamper-evident event logging       │   │
│  │ - Evidence Service: file upload and verification          │   │
│  │ - Stellar Integration: blockchain interaction            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                            │                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Data Access Layer (Prisma ORM)                             │   │
│  │ - Database abstraction and query building                  │   │
│  │ - Schema management via migrations                         │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────┬──────────────────┬───┘
           │                                  │                  │
           │                                  │                  │
           ▼                                  ▼                  ▼
    ┌────────────┐                  ┌──────────────┐    ┌──────────────┐
    │ PostgreSQL │                  │ Stellar RPC  │    │ IPFS/Pinata  │
    │ Database   │                  │ Soroban      │    │ File Storage │
    └────────────┘                  │ Contracts    │    └──────────────┘
                                    └──────────────┘

```

## Component Architecture

### Frontend Layer (Next.js + React)

| Component | Responsibility |
|-----------|-----------------|
| Pages | Trade listing, details, creation, dispute views |
| Components | Reusable UI elements (forms, modals, cards) |
| Hooks | State management via Zustand |
| API Client | HTTP requests to backend |
| Auth Flow | Freighter wallet integration |

**Technology Stack:**
- Framework: Next.js 16.1.6, React 19.2.3
- State: Zustand
- UI: Tailwind CSS, Radix UI, Lucide Icons
- Testing: Jest, Playwright, Testing Library

### Backend Layer (Node.js + Express)

#### API Routes
- `/trades` - Trade CRUD operations
- `/disputes` - Dispute management
- `/audit` - Audit trail and verification
- `/evidence` - File upload and management
- `/health` - Liveness and readiness probes

#### Services

```
AuditTrailService
├── getTradeHistory(tradeId, callerAddress)
├── getCanonicalPayload(tradeId, events)
├── signPayload(payload)
└── verifyPayload(payload, signature)

TradeService
├── createTrade(params)
├── fundTrade(tradeId, txHash)
├── deliverTrade(tradeId)
├── completeTrade(tradeId)
└── listTrades(filters)

DisputeService
├── initiatDispute(tradeId, reason)
├── submitEvidence(disputeId, evidence)
├── resolvDispute(disputeId, outcome)
└── getDisputeHistory(tradeId)

EvidenceService
├── uploadFile(file)
├── verifyIpfsHash(cid, localFile)
├── getFileMetadata(cid)
└── cleanupExpiredFiles()

StellarService
├── buildTransaction(params)
├── signTransaction(tx)
├── submitTransaction(tx)
└── getAccountBalance(address)
```

#### Middleware Pipeline

```
Request
  │
  ├─► Request Logger Middleware
  │    (logs incoming requests)
  │
  ├─► CORS Middleware
  │    (cross-origin request handling)
  │
  ├─► Auth Middleware
  │    (JWT validation & extraction)
  │
  ├─► Validation Middleware
  │    (Zod schema validation)
  │
  ├─► Route Handler
  │    (service invocation)
  │
  ├─► Error Handler Middleware
  │    (standardized error responses)
  │
  └─► Response Logger
       (logs outgoing responses)
```

### Data Layer (Prisma ORM)

#### Key Entities

```
Trade
├── tradeId (PK)
├── buyerAddress (FK: User)
├── sellerAddress (FK: User)
├── amountUsdc (Decimal)
├── status (CREATED|FUNDED|DELIVERED|COMPLETED|DISPUTED|CANCELLED)
├── createdAt
├── fundedAt
├── deliveredAt
├── completedAt
└── updatedAt

DeliveryManifest
├── tradeId (FK: Trade, PK)
├── vehicleRegistration
├── expectedDeliveryAt
├── createdAt
└── updatedAt

Dispute
├── tradeId (FK: Trade, PK)
├── initiator (User Address)
├── reason
├── status (PENDING|RESOLVED)
├── resolution
├── createdAt
├── resolvedAt
└── updatedAt

TradeEvidence
├── evidenceId (PK)
├── tradeId (FK: Trade)
├── cid (IPFS content hash)
├── filename
├── mimeType
├── uploadedBy (User Address)
├── createdAt
└── ipfsExpiresAt
```

## Security Architecture

### Authentication & Authorization

```
User Request
     │
     ├─► JWT Token (from /auth/login)
     │
     ├─► Extract wallet address
     │
     ├─► Validate token signature
     │
     ├─► Check token expiration
     │
     ├─► Verify wallet not in revocation list
     │
     └─► Proceed with authorization checks
          (buyer/seller/mediator/admin roles)
```

### Audit & Compliance

```
All State Changes
     │
     ├─► Generate event record
     │
     ├─► Store in database (immutable append-only)
     │
     ├─► Compute SHA-256 hash
     │
     ├─► Sign with Ed25519 private key
     │
     ├─► Store signature + metadata
     │
     └─► Enable cryptographic verification
          (for auditors and compliance)
```

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│        Load Balancer (Optional)         │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
    ┌─────────┐       ┌─────────┐
    │Backend  │       │Backend  │
    │Instance │   ...│Instance │
    │ (Node)  │       │ (Node)  │
    └────┬────┘       └────┬────┘
         │                 │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │   PostgreSQL    │
         │   Primary DB    │
         └─────────────────┘
```

## Observability Stack

- **Logging**: Pino (structured logs)
- **Tracing**: OpenTelemetry (distributed tracing)
- **Metrics**: Prometheus (application metrics)
- **Visualization**: Grafana (dashboards)
- **Sampling**: Jaeger/Zipkin (trace collection)

## Performance Considerations

### Database
- Read replicas for audit queries (immutable data)
- Indexes on tradeId, buyerAddress, sellerAddress
- Time-series partitioning for audit tables

### Caching
- Redis for JWT blacklist (token revocation)
- In-memory caching for configuration
- HTTP cache headers for static assets

### Async Processing
- BullMQ for event processing
- Webhook delivery for notifications
- Scheduled cleanup of expired evidence
