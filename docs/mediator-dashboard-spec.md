# Mediator Dashboard Specification

## Overview

The Mediator Dashboard is a dedicated interface enabling mediators to efficiently review disputes, assess evidence, make informed decisions, and track resolution outcomes. This specification defines the UX, data requirements, and implementation tasks.

## User Stories

### Story 1: Dispute Discovery
**As a** Mediator  
**I want to** see all open disputes requiring my attention  
**So that** I can prioritize which cases to review

**Acceptance Criteria:**
- [ ] Dashboard displays list of open disputes in reverse chronological order
- [ ] Each dispute shows: tradeId, parties, amount, reason, time since initiated
- [ ] Disputes are filterable by status (pending, in-review, resolved)
- [ ] Disputes are sortable by date, amount, or priority
- [ ] Pagination or infinite scroll for large dispute lists
- [ ] Search by tradeId to quickly find specific disputes

### Story 2: Case Review
**As a** Mediator  
**I want to** view complete case information including trade history, evidence, and communications  
**So that** I can make informed decisions

**Acceptance Criteria:**
- [ ] Case detail view shows:
  - Trade info (buyer, seller, amount, status)
  - Dispute info (initiator, reason, date initiated)
  - Complete tamper-evident audit trail (with signature verification status)
  - All submitted evidence (photos, videos, documents)
- [ ] Audit trail events display:
  - Event type (CREATED, FUNDED, MANIFEST_SUBMITTED, etc.)
  - Timestamp with timezone
  - Actor (buyer/seller address)
  - Metadata (relevant to event type)
- [ ] Evidence gallery displays:
  - Thumbnail previews for images
  - Video player with duration/quality info
  - File metadata (uploader, upload time, file size, MIME type)
  - Verification badge showing IPFS hash and content integrity
- [ ] Full audit trail can be exported as CSV with signature
- [ ] Evidence can be downloaded or viewed full-screen
- [ ] Access control: Only accessible to mediators AND mediator must be assigned to dispute

### Story 3: Evidence Assessment
**As a** Mediator  
**I want to** annotate evidence and create assessment notes  
**So that** I have a record of my findings

**Acceptance Criteria:**
- [ ] Notes section allows markdown formatting
- [ ] Notes are timestamped and immutable (append-only)
- [ ] Notes display inline with evidence timeline
- [ ] Notes are searchable
- [ ] Notes export with case as audit trail
- [ ] Mediator can view their own and other mediators' notes (if multi-mediator reviews)

### Story 4: Outcome Assignment
**As a** Mediator  
**I want to** assign a resolution outcome and enter supporting rationale  
**So that** the dispute can be settled fairly

**Acceptance Criteria:**
- [ ] Outcome form displays options:
  - **Full Refund**: Buyer receives 100% refund, seller gets 0%
  - **Full Release**: Seller receives 100% funds, buyer gets 0%
  - **Loss Ratio Split**: Automatic split based on trade's loss ratio (e.g., 50/50, 70/30)
  - **Custom Split**: Mediator enters custom percentage split
- [ ] Form requires:
  - Selection of outcome type
  - Detailed justification (markdown supported)
  - Optional fine or penalty (if applicable)
- [ ] Preview shows exact settlement amounts before confirmation
- [ ] Confirmation step requires mediator re-verification
- [ ] Once submitted, outcome is immutable and triggers settlement

### Story 5: Audit Trail Verification
**As a** Mediator  
**I want to** cryptographically verify the audit trail authenticity  
**So that** I'm confident the evidence hasn't been tampered with

**Acceptance Criteria:**
- [ ] Audit trail includes signature metadata
- [ ] One-click verification button shows verification status
- [ ] Verification result displays:
  - Valid/Invalid status
  - Signature algorithm (Ed25519)
  - Signing key ID
  - Payload hash (SHA-256)
- [ ] Invalid signature shows clear warning
- [ ] Export includes signature for external verification
- [ ] Verification timestamp and results are logged

### Story 6: Case Timeline
**As a** Mediator  
**I want to** see a chronological timeline of all case events  
**So that** I understand the trade progression

**Acceptance Criteria:**
- [ ] Timeline view shows:
  - Trade lifecycle events (CREATED, FUNDED, DELIVERY_CONFIRMED, etc.)
  - Evidence submissions with previews
  - Dispute events (INITIATED, RESOLVED)
  - Mediator notes and assessments
- [ ] Timeline is interactive (clickable events expand to detail)
- [ ] Timeline can be filtered by event type
- [ ] Timeline exports as printable report

### Story 7: Resolution Tracking
**As a** Mediator  
**I want to** track resolved cases and their outcomes  
**So that** I can generate reports on resolution effectiveness

**Acceptance Criteria:**
- [ ] Resolved cases view shows:
  - Case ID and parties
  - Original dispute reason
  - Resolution outcome and justification
  - Settlement amounts
  - Resolution date
- [ ] Filtering by outcome type (refund, release, split)
- [ ] Filtering by resolution date range
- [ ] Summary statistics:
  - Total cases reviewed
  - Resolution rate (resolved / total)
  - Average resolution time
  - Distribution of outcomes
- [ ] Export resolved cases as CSV

## Backend Implementation Tasks

### Task 1: Mediator Routes Enhancement
**File:** `backend/src/routes/disputes.routes.ts`

**Acceptance Criteria:**
- [ ] `GET /disputes/open` - List all open disputes for mediator
- [ ] `GET /disputes/:tradeId` - Get dispute detail with full history
- [ ] `GET /disputes/:tradeId/audit` - Get tamper-evident audit trail with signature
- [ ] `POST /disputes/:tradeId/notes` - Add assessment note
- [ ] `GET /disputes/:tradeId/notes` - List all notes (append-only)
- [ ] `POST /disputes/:tradeId/resolve` - Submit resolution outcome
- [ ] `GET /disputes/resolved` - List all resolved disputes
- [ ] Proper authorization (mediator role check)

### Task 2: Dispute Service Enhancements
**File:** `backend/src/services/dispute.service.ts`

**Acceptance Criteria:**
- [ ] Method to fetch disputes by status
- [ ] Method to get complete dispute with audit trail
- [ ] Method to store and retrieve assessment notes
- [ ] Method to validate and execute resolution
- [ ] Method to calculate settlement amounts
- [ ] Access control layer for mediator authorization
- [ ] Event logging for all mediator actions

### Task 3: Database Schema Updates
**File:** `backend/prisma/schema.prisma`

**Acceptance Criteria:**
- [ ] `MediatorNote` model with fields:
  - `id`, `tradeId`, `mediatorAddress`, `content`, `createdAt`
- [ ] `Dispute` model fields for resolution:
  - `resolvedBy`, `resolution`, `justification`, `resolvedAt`
- [ ] Settlement tracking fields:
  - `buyerSettlement`, `sellerSettlement`, `fineAmount`
- [ ] Index on `tradeId`, `mediatorAddress`, `status`, `resolvedAt`

### Task 4: Audit Trail Integration
**File:** `backend/src/services/auditTrail.service.ts`

**Acceptance Criteria:**
- [ ] Audit trail includes mediator notes in timeline
- [ ] Audit trail includes resolution outcome
- [ ] Export includes signature verification data
- [ ] Notes are immutable and append-only
- [ ] Full timestamps with timezone info

### Task 5: Settlement Execution
**File:** `backend/src/services/settlement.service.ts` (new)

**Acceptance Criteria:**
- [ ] Calculate settlement amounts based on outcome type
- [ ] Apply loss ratio for split outcomes
- [ ] Handle custom splits with validation
- [ ] Invoke Stellar smart contract with settlement params
- [ ] Verify blockchain settlement confirmation
- [ ] Log settlement events in audit trail
- [ ] Handle failure/retry scenarios

## Frontend Implementation Tasks

### Task 1: Mediator Layout & Navigation
**File:** `frontend/src/app/mediator/layout.tsx`

**Acceptance Criteria:**
- [ ] Responsive mediator dashboard layout
- [ ] Sidebar navigation with sections:
  - Dashboard (home)
  - Open Cases
  - My Cases (assigned to me)
  - Resolved Cases
  - Settings
- [ ] User profile/logout in header
- [ ] Breadcrumb navigation
- [ ] Mobile responsive design

### Task 2: Dispute List Component
**File:** `frontend/src/components/mediator/DisputeList.tsx`

**Acceptance Criteria:**
- [ ] Display paginated list of disputes
- [ ] Filter by status (pending, in-review, resolved)
- [ ] Sort by date, amount, or initiator
- [ ] Search by trade ID
- [ ] Click to view case detail
- [ ] Status badges with color coding
- [ ] Time-since initiated display (relative time)
- [ ] Responsive table/card layout

### Task 3: Case Detail Component
**File:** `frontend/src/app/mediator/case/[tradeId]/page.tsx`

**Acceptance Criteria:**
- [ ] Tab navigation (Overview, Audit Trail, Evidence, Notes, Resolution)
- [ ] Tab state preservation (URL params)
- [ ] Responsive layout for mobile/tablet
- [ ] Loading states and error handling
- [ ] Access control enforcement

### Task 4: Audit Trail Tab Component
**File:** `frontend/src/components/mediator/AuditTrailTab.tsx`

**Acceptance Criteria:**
- [ ] Display chronological audit trail
- [ ] Show signature verification badge
- [ ] Verify button with visual feedback
- [ ] Export button (CSV with signature)
- [ ] Event type icons/colors for quick scanning
- [ ] Expandable event details
- [ ] Copy hash/signature to clipboard

### Task 5: Evidence Gallery Component
**File:** `frontend/src/components/mediator/EvidenceGallery.tsx`

**Acceptance Criteria:**
- [ ] Thumbnail grid for images
- [ ] Video player for video evidence
- [ ] Metadata display (uploader, timestamp, IPFS hash)
- [ ] Download links
- [ ] Full-screen view/lightbox
- [ ] IPFS hash verification badge
- [ ] Loading skeletons and error states
- [ ] Responsive grid layout

### Task 6: Assessment Notes Component
**File:** `frontend/src/components/mediator/AssessmentNotes.tsx`

**Acceptance Criteria:**
- [ ] Rich text editor with markdown support
- [ ] Post note button with optimistic updates
- [ ] Display notes in chronological order
- [ ] Show mediator name and timestamp
- [ ] Read-only note display
- [ ] Notes are immutable (no edit/delete)
- [ ] Search notes functionality

### Task 7: Resolution Form Component
**File:** `frontend/src/components/mediator/ResolutionForm.tsx`

**Acceptance Criteria:**
- [ ] Radio buttons for outcome type selection
- [ ] Custom split percentage input with validation
- [ ] Real-time settlement amount calculation
- [ ] Justification textarea with markdown
- [ ] Optional fine amount input
- [ ] Preview settlement amounts
- [ ] Confirmation dialog before submission
- [ ] Submit button with loading state
- [ ] Success/error toast notifications

## API Endpoints Summary

```
GET    /disputes/open                    # List open disputes
GET    /disputes/resolved                # List resolved disputes
GET    /disputes/my-cases               # List disputes assigned to mediator
GET    /disputes/:tradeId               # Get dispute detail
GET    /disputes/:tradeId/audit         # Get audit trail with signature
POST   /disputes/:tradeId/notes         # Add assessment note
GET    /disputes/:tradeId/notes         # List notes for dispute
POST   /disputes/:tradeId/resolve       # Submit resolution outcome
GET    /disputes/:tradeId/settlement    # Get settlement details
```

## Success Metrics

- [ ] All tasks completed with passing tests
- [ ] Mediator can view and filter open disputes
- [ ] Mediator can review complete case with audit trail
- [ ] Mediator can submit resolution outcome
- [ ] Settlement execution successfully transfers funds
- [ ] Audit trail includes all mediator actions
- [ ] Dashboard accessible only to authorized mediators
- [ ] Evidence gallery loads efficiently (pagination/lazy loading)
