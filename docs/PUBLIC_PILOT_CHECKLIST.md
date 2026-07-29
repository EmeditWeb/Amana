# Public Pilot Launch Checklist

This checklist operationalizes the launch of a regional public pilot, building on the
research plan in [`USER_RESEARCH_PLAN_PILOT_REGIONS.md`](./USER_RESEARCH_PLAN_PILOT_REGIONS.md).
It is meant to be copied into a tracked issue/board per region and checked off by the
ops owner before go-live, and revisited during the pilot.

Owner: Ops lead for the pilot region. Each section lists a suggested owner; adjust to
the team actually running the region.

## 1. Legal Review

- [ ] Confirm the pilot region is not subject to licensing/regulatory restrictions that
      would block escrow or payment-facilitation activity (legal counsel sign-off).
- [ ] Terms of Service and Privacy Policy reviewed for region-specific requirements
      (data residency, consumer protection, KYC/AML obligations).
- [ ] Confirm dispute/arbitration clauses in the ToS match the actual dispute process
      used in this pilot (see Section 4).
- [ ] Data processing agreements in place for any third-party services used in region
      (SMS/notification providers, payment rails, storage).
- [ ] Escrow/custody structure reviewed against local money-transmission rules; document
      the determination (exempt / licensed / requires local partner).
- [ ] Sign-off recorded (name, date, scope of approval) before onboarding starts.

## 2. User Onboarding

- [ ] Onboarding flow (mobile + web) tested end-to-end for the target user segments
      (buyers, sellers, drivers, cooperative leaders) as defined in the research plan.
- [ ] Identity verification / KYC steps configured for the region's requirements.
- [ ] Local-language copy reviewed for onboarding screens, ToS summary, and support
      materials.
- [ ] Support channel (WhatsApp/SMS/phone) set up and staffed for onboarding questions.
- [ ] Cooperative leaders / regional partners briefed and given a point of contact.
- [ ] Test accounts created and a full trade lifecycle (create → fund → deliver →
      release) run against the pilot environment before real users onboard.
- [ ] Rollout capped (invite codes / waitlist / staged cohort) so onboarding volume can
      be throttled if support or infra can't keep up.

## 3. Monitoring & Alerting

- [ ] Dashboards in place for: trade creation rate, funding rate, dispute rate,
      release/settlement latency, and Stellar transaction failure rate (see
      [`docs/METRICS.md`](./METRICS.md) and [`docs/PROMETHEUS_METRICS.md`](./PROMETHEUS_METRICS.md)).
- [ ] Alerting thresholds configured for: elevated dispute rate, elevated Stellar
      submission failures, webhook delivery failures, and API error-rate spikes.
- [ ] On-call rotation defined for the pilot window with an escalation path.
- [ ] Logging confirmed to capture enough context to investigate a disputed trade
      without exposing PII beyond what's necessary (see [`docs/audit-logging.md`](./audit-logging.md)).
- [ ] Synthetic/canary trade scheduled on a fixed cadence to catch silent regressions.

## 4. Dispute Handling

- [ ] Dispute intake path (in-app + support channel) tested and documented.
- [ ] Dispute categories and SLAs defined and communicated to the ops/mediator team
      (see [`docs/mediator-dashboard-spec.md`](./mediator-dashboard-spec.md)).
- [ ] Mediator(s) assigned for the pilot region with access to the mediator dashboard.
- [ ] Evidence submission flow (photos/manifest) verified for the devices/network
      conditions expected in-region.
- [ ] Escalation path defined for disputes the mediator cannot resolve (legal, refund
      authority, loss-sharing exceptions).
- [ ] Dispute outcomes tracked and reviewed weekly during the pilot to catch systemic
      issues early.

## 5. Communications Plan

- [ ] Internal announcement drafted (what's launching, region, dates, success metrics,
      who to contact for issues).
- [ ] External/user-facing messaging drafted for onboarding invites, in-app banners,
      and support scripts.
- [ ] Incident communication template prepared (what we tell users if the pilot has a
      P1 outage or a paused-trades event).
- [ ] Post-pilot debrief scheduled (date fixed at launch) to review metrics against the
      research plan's success criteria and decide on next steps (expand, iterate, stop).
- [ ] Stakeholder update cadence agreed (e.g., weekly summary to leadership during the
      pilot window).

## Sign-off

- [ ] Ops review complete — all sections above checked or explicitly waived with a
      documented reason.
- [ ] Go/no-go decision recorded with date and approver.

| Section | Owner | Reviewed by | Date |
|---|---|---|---|
| Legal Review | | | |
| User Onboarding | | | |
| Monitoring & Alerting | | | |
| Dispute Handling | | | |
| Communications Plan | | | |
