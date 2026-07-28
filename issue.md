## Resolved Issues

### ✅ #937 Product: User research plan for pilot regions
**Status**: RESOLVED  
**Labels**: product, research

**Description**:
Create a short research plan to validate assumptions with regional cooperative partners; include success metrics and pilot scope.

**Resolution**:
- Created comprehensive user research plan at `docs/USER_RESEARCH_PLAN_PILOT_REGIONS.md`
- Defined 8-week pilot scope for 2 Nigerian regions
- Identified stakeholders: 30-40 farmers, 20-30 buyers, 10-20 drivers, 4-6 cooperative leaders
- Established success metrics: ≥85% trade completion, ≤10% dispute rate, NPS ≥40
- Outlined 5-phase research methodology with deliverables

**Acceptance Criteria**: ✅ Research plan drafted and stakeholders identified.

---

### ✅ #936 CI: Document cache keys and reproducibility
**Status**: RESOLVED  
**Labels**: ci, docs

**Description**:
Add documentation explaining GitHub Actions cache key strategy used in the workflows for maintainers.

**Resolution**:
- Created `docs/GITHUB_ACTIONS_CACHE_STRATEGY.md` with comprehensive cache documentation
- Documented cache keys for Node.js (pnpm), Rust (Cargo), and binary caching
- Explained cache invalidation triggers and reproducibility guarantees
- Added debugging guide for cache issues
- Covered multi-stack cache dependencies for E2E tests

**Acceptance Criteria**: ✅ Doc file added explaining cache keys and updating workflows if necessary.

---

### ✅ #935 Docs: Make README quickstart copy-paste accurate
**Status**: RESOLVED  
**Labels**: docs

**Description**:
Ensure the setup commands in the top-level README are copy-paste runnable (pnpm vs npm notes, correct file names).

**Resolution**:
- Updated `README.md` to use `pnpm` consistently across all setup commands
- Added Prerequisites section with pnpm installation instructions
- Converted numbered steps to copy-paste bash blocks for frontend, backend, mobile
- Updated CI gates section to reflect `pnpm install --frozen-lockfile` commands
- Fixed duplicate CI section that was causing confusion

**Acceptance Criteria**: ✅ README quickstart updated and validated locally.

---

### ✅ #934 Security: Audit and log suspicious activity for rate-limit breaches
**Status**: RESOLVED  
**Labels**: security, backend

**Description**:
Log and alert on repeated rate-limit breaches or anomalous request patterns to detect abuse.

**Resolution**:
- Enhanced `backend/src/lib/rateLimit.ts` with breach tracking and alerting
- Implemented breach counter tracking per key with 15-minute sliding window
- Added automatic alerts after 5+ breaches within window (logged as `RATE_LIMIT_ABUSE`)
- Logs every breach with IP, path, user agent, and wallet address for audit trail
- Structured logs compatible with SIEM tools for security monitoring

**Acceptance Criteria**: ✅ Alerts for suspicious patterns and rate-limit logs stored.
