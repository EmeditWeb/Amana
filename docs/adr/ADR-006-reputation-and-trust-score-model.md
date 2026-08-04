# ADR-006: Reputation and Trust Score Model

## Status

Proposed

## Context

Amana needs a clear way to help buyers, sellers, and drivers assess whether a counterpart is likely to behave well before they open a trade or dispute. The platform already exposes reputation and trust-score endpoints in the backend, but the scoring model needs to be explicit so it is explainable to users, resilient to manipulation, and consistent across the API, frontend, and analytics tooling.

The model must balance several goals:

- Reward successful completion of trades.
- Penalize disputes and losses without making the score overly punitive for normal risk.
- Avoid requiring the user to manually maintain a score.
- Be simple enough for the frontend to display and for operators to reason about.

A purely "number of completed trades" approach would overvalue low-volume users and would not reflect the fact that a disputed or abandoned trade is a meaningful signal.

## Decision

1. **Use a single normalized trust-score value from 0 to 100.** The backend computes one numeric trust score per wallet and exposes it through the reputation and trust-score APIs. The score is intended to be a coarse risk signal rather than a legal or financial guarantee.
2. **Calculate the score from a mix of behavior and history.** The initial implementation uses:
   - a base score,
   - a bonus for completed trades,
   - a bonus for trading volume milestones,
   - penalties for initiated disputes and lost disputes,
   - a decay factor so older activity contributes less over time.
3. **Keep the score server-side and derived from platform data.** Trust-score values are computed by the backend from trade and dispute history rather than trusting client-supplied values. This prevents users from self-reporting or tampering with the score.
4. **Expose both a summary score and a breakdown.** The API returns the final score, the contributing components (completion bonus, volume bonus, penalties, decay), and a short event history so the frontend can explain why the score changed.
5. **Treat reputation as an aggregation of user history, not a separate on-chain truth source.** Reputation is derived from the same trade and dispute records, and is used for presentation and risk assessment rather than for enforcing transfer logic on-chain.

## Consequences

- **Positive:** The score is explainable, consistent, and easy to display in the UI. It helps users make better decisions without needing to inspect raw trade history.
- **Positive:** The backend can update and recalibrate the score centrally as business rules evolve, which is easier to maintain than distributing scoring logic across clients.
- **Negative:** The score is an approximation and will be imperfect for edge cases. A user with a small number of trades may still be treated as low-trust even if their recent behavior has been strong.
- **Negative:** The model depends on accurate trade and dispute data. If disputes are under-recorded or status transitions are inconsistent, the score becomes less meaningful.
- **Follow-up:** If the platform later introduces richer risk models (for example, role-specific scoring or a dispute-weighted confidence band), this ADR should be revisited and superseded.
