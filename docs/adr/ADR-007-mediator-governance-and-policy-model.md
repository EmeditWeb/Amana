# ADR-007: Mediator Governance and Policy Model

## Status

Proposed

## Context

Amana relies on mediators to resolve disputes when buyers and sellers disagree about delivery, quality, or payout. Mediator intervention is a critical trust anchor for the platform, but it also creates risk: an unauthorized actor could interfere with dispute resolution, a mediator could act inconsistently, or the policy could drift over time as the product evolves.

The system therefore needs a policy model that defines who can act as a mediator, how policies are enforced, and how the platform keeps dispute outcomes consistent and auditable.

## Decision

1. **Use a centralized mediator allowlist for authorization.** The backend reads mediator and arbitrator addresses from a shared configuration source (`ADMIN_STELLAR_PUBKEYS`) rather than allowing each route to independently parse the environment. This avoids drift between controllers and services.
2. **Treat mediators as privileged operators, not ordinary users.** Only addresses in the allowlist can access mediator-specific routes, transition dispute state, or review disputes that are not directly assigned to them. This keeps dispute resolution constrained to a known operator set.
3. **Keep mediator policy simple and auditable.** The contract and backend should rely on explicit dispute outcomes and recorded evidence rather than hidden or implicit rules. Every decision should be visible through the dispute record, event logs, and audit trail.
4. **Separate policy from dispute logic.** The system should not embed ad hoc mediator behavior into the core escrow payout calculations. Instead, the contract evaluates the payout based on the mediator's ruling and the parties' pre-agreed risk-sharing parameters, while the backend records the rationale and evidence.
5. **Require a clear evidence trail for all mediator actions.** Dispute decisions, status transitions, and any rationale entered by a mediator should be captured in the platform's audit trail so that disputes can be reviewed later by operators or support staff.

## Consequences

- **Positive:** The mediator layer is easier to reason about and safer to operate because authorization and policy are centralized.
- **Positive:** The audit trail strengthens trust in dispute outcomes and makes later review or incident response easier.
- **Negative:** The current model depends on a relatively small, centrally managed mediator pool. That improves control but also creates operational concentration risk if the allowlist is misconfigured or under-resourced.
- **Negative:** The policy is intentionally conservative. It favors safety and accountability over a more flexible, community-governed mediator model.
- **Follow-up:** If Amana later introduces a larger or more decentralized mediator network, this ADR should be revisited to define qualification, onboarding, rotation, and SLA expectations.
