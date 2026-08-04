# Sequence Diagrams

This document provides detailed sequence diagrams for key Amana workflows.

## Trade Creation and Funding Flow

```
Buyer            Frontend          Backend           Stellar          Database
  │                 │                 │                │                 │
  ├─Create Trade──>│                 │                │                 │
  │ (seller, amount)│                 │                │                 │
  │                 │─POST /trades──>│                │                 │
  │                 │                 │                │                 │
  │                 │                 ├─Validate────────>               │
  │                 │                 │  recipient                       │
  │                 │                 │                │                 │
  │                 │                 ├─Create Trade Record────────────>│
  │                 │                 │                │                 │
  │                 │                 │<─tradeId───────────────────────┤
  │                 │<─Trade ID────────│                │                 │
  │                 │ (trade-001)      │                │                 │
  │<─Trade Created─┤                 │                │                 │
  │                 │                 │                │                 │
  │ [Display trade in UI]             │                │                 │
  │                 │                 │                │                 │
  ├─Request Quote─>│                 │                │                 │
  │ (from Freighter)                  │                │                 │
  │                 │<─Quote────────────>               │                 │
  │                 │                 │                │                 │
  ├─Approve Payment─>                 │                │                 │
  │ (Freighter tx)                    │                │                 │
  │                 │                 │                │                 │
  │                 ├─Submit to Chain─────────────────>│                 │
  │                 │                 │                │                 │
  │                 │                 │                ├─Process────────>│
  │                 │                 │                │  (5+ sec)       │
  │                 │                 │<─Confirm──────│                 │
  │                 │<─Success────────│                │                 │
  │<─Payment Done─┤ (txHash)         │                │                 │
  │                 │                 │                │                 │
  │                 │                 ├─Update Trade Status───────────>│
  │                 │                 │  (CREATED→FUNDED)                │
  │                 │                 │                │                 │
  │                 │                 ├─Log Audit Event────────────────>│
  │                 │                 │  (FUNDED)                        │
  │                 │<─Status Update──│                │                 │
  │<─Funded───────┤                 │                │                 │
  │ [Ready for delivery]              │                │                 │
```

## Audit Trail Generation and Verification

```
Auditor          Frontend          Backend            Crypto/DB        Public Key
   │                │                 │                 │                │
   ├─Request History               │                 │                │
   │ (trade-001)     │                 │                 │                │
   │                 │─GET /history──>│                 │                │
   │                 │               │                 │                │
   │                 │               ├─Check Access────────────────────>
   │                 │               │ (buyer/seller/admin)              │
   │                 │               │                 │                │
   │                 │               ├─Fetch Events──────────────────────>
   │                 │               │ FROM database                      │
   │                 │               │<─Events──────────────────────────┤
   │                 │               │                 │                │
   │                 │               ├─Mask Sensitive───────────────────>
   │                 │               │ (vehicle reg)                     │
   │                 │               │                 │                │
   │                 │               ├─Build Canonical──────────────────>
   │                 │               │ (JSON payload)                    │
   │                 │               │                 │                │
   │                 │               ├─Hash Payload─────────────────────>
   │                 │               │ (SHA-256)                        │
   │                 │               │                 │                │
   │                 │               ├─Sign Hash────────────────────────>
   │                 │               │ (Ed25519 private)                │
   │                 │               │                 │                │
   │                 │<─Audit + Sig───│                 │                │
   │<─History────────┤                │                 │                │
   │ (with signature)│                │                 │                │
   │                 │                │                 │                │
   ├─Verify Sig────>│                │                 │                │
   │                 │─GET /verify───>│                 │                │
   │                 │ ?sig=base64    │                 │                │
   │                 │               │                 │                │
   │                 │               ├─Hash Payload─────────────────────>
   │                 │               │ (SHA-256)                        │
   │                 │               │                 │                │
   │                 │               ├─Verify with──────────────────────>
   │                 │               │ Ed25519 public key                │
   │                 │               │                                  │
   │                 │<─Valid: true───│                 │                │
   │<─Verified──────┤                │                 │                │
   │ [Audit is tamper-evident]        │                 │                │
```

## Dispute Workflow

```
Parties          Frontend          Backend           Mediator         Database
  │                │                 │                 │                 │
  ├─Initiate Dispute                │                 │                 │
  │ (quality issue)  │                 │                 │                 │
  │                  │─POST /disputes─>│                 │                 │
  │                  │ (reason, tradeId)│               │                 │
  │                  │                 │                 │                 │
  │                  │                 ├─Create Dispute───────────────────>
  │                  │                 │ Record                            │
  │                  │                 │                 │                 │
  │                  │                 ├─Log Audit────────────────────────>
  │                  │                 │ DISPUTE_INITIATED                  │
  │                  │<─Dispute ID─────│                 │                 │
  │                  │ (dispute-001)   │                 │                 │
  │<─Dispute Started-                 │                 │                 │
  │                  │                 │                 │                 │
  │ [Upload Evidence]│                 │                 │                 │
  │                  │                 │                 │                 │
  │                  │─[See Evidence Submission sequence]──────────────────>
  │                  │                 │                 │                 │
  │                  │                 │                 │                 │
  │                  │                 ├─Notify Mediator─────────────────>│
  │                  │                 │                 │ (webhook)       │
  │                  │                 │                 │                 │
  │                  │                 │ ┌────────────────────────────────┐ │
  │                  │                 │ │Mediator Reviews Case          │ │
  │                  │                 │ ├────────────────────────────────┤ │
  │                  │                 │ │ 1. Access audit trail         │ │
  │                  │                 │ │ 2. Review evidence from IPFS  │ │
  │                  │                 │ │ 3. Assess merits              │ │
  │                  │                 │ │ 4. Make decision              │ │
  │                  │                 │ └────────────────────────────────┘ │
  │                  │                 │                 │                 │
  │                  │                 │<─Resolution─────│                 │
  │                  │                 │ (full/partial/  │                 │
  │                  │                 │  split)         │                 │
  │                  │                 │                 │                 │
  │                  │                 ├─Execute Settlement───────────────>
  │                  │                 │ (on Stellar)                      │
  │                  │                 │                 │                 │
  │                  │                 ├─Update Trade Status──────────────>
  │                  │                 │ (COMPLETED)                       │
  │                  │                 │                 │                 │
  │                  │                 ├─Log Audit────────────────────────>
  │                  │                 │ RESOLVED                          │
  │                  │<─Resolution─────│                 │                 │
  │<─Dispute Ended──┤ (outcome)       │                 │                 │
  │                  │                 │                 │                 │
```

## Key Operations Summary

| Operation | Primary Actors | Key Systems | Audit Events |
|-----------|----------------|------------|--------------|
| Trade Creation | Buyer → Backend | Database | CREATED |
| Trade Funding | Buyer → Stellar → Backend | Blockchain, Database | FUNDED |
| Manifest Submit | Seller → Backend | Database | MANIFEST_SUBMITTED |
| Evidence Upload | Buyer/Seller → IPFS → Backend | IPFS, Database | VIDEO/EVIDENCE_SUBMITTED |
| Delivery Confirm | Buyer → Backend | Database | DELIVERY_CONFIRMED |
| Dispute Initiate | Either Party → Backend | Database | DISPUTE_INITIATED |
| Dispute Resolve | Mediator → Stellar → Backend | Blockchain, Database | RESOLVED |
| Trade Complete | Backend → Stellar | Blockchain, Database | COMPLETED |
| Audit Verify | Auditor → Backend → Crypto | Signing Keys | (verification only) |
