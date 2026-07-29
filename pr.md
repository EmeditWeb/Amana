## Summary
Resolves issues #937, #936, #935, and #934 across documentation, CI, security, and product planning.

## Changes

### 1. Product: User Research Plan for Pilot Regions (#937)
- Created comprehensive user research plan at `docs/USER_RESEARCH_PLAN_PILOT_REGIONS.md`.
- Defined 8-week pilot scope targeting 2 Nigerian regions with 80-120 participants.
- Established 9 success metrics including trade completion (≥85%), dispute rate (≤10%), and NPS (≥40).
- Outlined 5-phase research methodology: stakeholder interviews, onboarding workshops, active trading, feedback sessions, and quantitative surveys.
- Identified primary stakeholders (cooperative leaders, buyers, sellers, drivers) and budget estimate (~₦4.8M/$10K USD).

### 2. CI: GitHub Actions Cache Documentation (#936)
- Created `docs/GITHUB_ACTIONS_CACHE_STRATEGY.md` documenting cache key strategies for all stacks.
- Explained Node.js (pnpm), Rust (Cargo), and binary caching mechanisms.
- Documented cache key patterns: `setup-node-<OS>-pnpm-<hash(lockfile)>` for Node, `rust-cache-<OS>-<hash(Cargo.lock)>` for Rust.
- Added troubleshooting guide for cache misses and stale dependencies.
- Covered cache invalidation triggers and reproducibility guarantees.

### 3. Docs: README Quickstart Accuracy (#935)
- Updated `README.md` to use `pnpm` consistently across all setup commands (previously mixed npm/pnpm).
- Added Prerequisites section with `npm install -g pnpm` installation instructions.
- Converted numbered steps to copy-paste bash code blocks for frontend, backend, and mobile setup.
- Updated CI gates section to reflect `pnpm install --frozen-lockfile` commands.
- Fixed duplicate CI section causing confusion.

### 4. Security: Rate-Limit Breach Auditing and Alerting (#934)
- Enhanced `backend/src/lib/rateLimit.ts` with breach tracking and suspicious pattern detection.
- Implemented in-memory breach counter tracking per key with 15-minute sliding window.
- Added automatic security alerts after 5+ breaches within window (logged as `RATE_LIMIT_ABUSE`).
- Logs every breach with IP address, path, HTTP method, user agent, and wallet address for audit trails.
- Structured logs compatible with SIEM tools and log aggregation platforms.

## Validation
- README quickstart commands tested locally (copy-paste accurate)
- Rate-limit breach logging verified via unit tests
- Documentation reviewed for completeness and accuracy
- All acceptance criteria met for issues #937, #936, #935, #934

closes #937, closes #936, closes #935, closes #934
