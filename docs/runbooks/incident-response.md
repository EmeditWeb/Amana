# Incident Response Runbook

Severity levels, response steps, and escalation for production incidents.
Uses the same P0-P3 severity convention as
[threat-model.md](../threat-model.md).

## Severity levels

| Severity | Definition | Examples | Response time |
|---|---|---|---|
| **P0 - Critical** | Funds at risk, or the service is down for all users | Treasury/escrow contract draining unexpectedly; backend fully down; database unreachable in production; admin key compromise (see [threat-model.md](../threat-model.md) TH-P-02) | Immediate - page on-call now |
| **P1 - High** | Core functionality broken for a significant subset of users, no direct fund loss yet | Trade creation/deposit/release failing; auth broken for a subset of wallets; a migration failed mid-way in production | Immediate - page on-call |
| **P2 - Medium** | Degraded but workable; a non-core path is broken | Evidence upload failing; audit history export broken; elevated but not failing error rates; a feature-flagged feature misbehaving (can be disabled via [admin.md](../api/admin.md#feature-flags) as immediate mitigation) | Same business day |
| **P3 - Low** | Cosmetic or edge-case issue, no user-facing outage | Docs endpoint drift; a rarely-hit validation message is wrong | Next working session |

When in doubt, classify one level higher and downgrade after triage - it's
cheaper to stand down a P0 than to escalate a mishandled P1.

## Immediate response steps

1. **Acknowledge.** Whoever notices first (alert, user report, or manual
   observation) claims the incident and starts a timeline (timestamped
   notes - what you observed, what you tried, what happened).
2. **Classify severity** using the table above.
3. **Mitigate before diagnosing**, if a fast mitigation exists:
   - Disable the specific feature flag if the incident traces to a
     flagged feature ([admin.md](../api/admin.md#feature-flags)) - this
     takes effect immediately with no redeploy.
   - Roll back the last deploy if the incident started right after one
     (see [rollback.md](./rollback.md)).
   - For a suspected fund-draining or key-compromise incident (P0), the
     priority is stopping further loss, not preserving evidence -
     revoke/rotate the admin key(s) in `ADMIN_STELLAR_PUBKEYS` and pause
     the affected flow if possible before anything else.
4. **Check health/status signals**:
   ```bash
   curl https://<host>/health/ready
   curl https://<host>/health/detail   # deeper dependency checks
   ```
   (see [trades.md](../api/trades.md) / [overview.md](../api/overview.md)
   for general API conventions, and [errors.md](../api/errors.md) for
   reading error codes out of application logs).
5. **Communicate.** Post an initial status update as soon as severity is
   classified, even before root cause is known - "investigating a P1
   affecting trade releases" beats silence. Update at a cadence
   proportional to severity (continuous for P0, every 30-60 min for P1).
6. **Escalate** per the table below if you can't mitigate or diagnose
   within the response-time target for the severity.

## Escalation matrix

| Situation | Escalate to | Notes |
|---|---|---|
| P0/P1, on-call hasn't acknowledged within 10 min | Secondary on-call / eng lead | Don't wait past the response-time target to escalate |
| Suspected fund loss or admin-key compromise | Eng lead + whoever holds treasury/admin key rotation authority | Follow the mitigation-before-diagnosis order above |
| Failed production migration | On-call, immediately - see the escalation table in [migration-rollback-playbook.md](../migration-rollback-playbook.md#8-contacts-and-escalation) | Do not attempt further migrations until resolved |
| Data loss suspected | On-call immediately; stop all writes | Same as the migration playbook's guidance - do not run further migrations or write operations until the extent of loss is understood |
| Contract bug already executed on-chain (funds moved incorrectly) | Eng lead + treasury/admin key holder | This is not a rollback - see [rollback.md](./rollback.md#contract-rollback) |

## During the incident

- Keep the timeline updated - every mitigation attempt and its result, not
  just the final fix. This becomes the postmortem's evidence.
- Prefer the smallest change that stops user impact over a complete fix
  under pressure. Land the full fix as a follow-up once the incident is
  stood down.
- If a rollback is the mitigation, follow [rollback.md](./rollback.md)
  rather than improvising - rolling back application code while a
  migration is half-applied, or rolling back a contract upgrade with
  in-flight trades, has specific failure modes documented there.

## Stand-down criteria

An incident is resolved (not just mitigated) when:

- The user-facing symptom is gone and has stayed gone through at least one
  full traffic cycle.
- Root cause is identified (not just "the rollback fixed it").
- Any data inconsistency introduced during the incident has been
  accounted for (reconciled, or confirmed none exists).

## Postmortem

For P0/P1 incidents, write a blameless postmortem within 2 business days
covering: timeline, root cause, what mitigated it, what will prevent
recurrence (with owners and rough timing - not necessarily a hard deadline).
Link the postmortem from the incident's tracking issue. P2/P3 incidents get
a postmortem at the reporter's discretion - always write one if the same
class of issue has recurred.

## Backup verification

`db-backup-verify-daily` (`infra/k8s/cronjob-backup-verify.yaml`) runs
`scripts/verify-backup.sh` every day, an hour after `db-backup-daily`
completes. It restores the latest backup into a scratch database
(`VERIFY_DATABASE_URL`, created and dropped on every run) and checks:

- Every production table exists in the restored backup, with a row count
  that isn't larger than production's (a larger count indicates a corrupted
  or wrong backup was restored) and isn't zero when production has data.
- No orphaned foreign keys in the restored backup.
- Every table with a `created_at` column has *some* data in the backup if
  production has data (catches a backup that silently missed writes).

**If `BackupVerificationFailed` fires** (P1 — a broken backup is not yet an
outage, but treat it with urgency):

1. Check the failed Job's logs (`kubectl logs -n amana job/db-backup-verify-daily-<timestamp>`)
   for which specific check(s) failed — logged per-table, per-constraint.
2. The scratch database is deliberately **left in place on failure** (not
   torn down) — connect to it directly to investigate further before the
   next scheduled run overwrites it.
3. If the failure indicates the backup itself is bad (not a script bug),
   treat this as a live gap in disaster-recovery coverage until the next
   backup cycle produces a verified-good backup — do not assume the
   *previous* verified-good backup is still an acceptable RPO if it's now
   more than one backup cycle old.
4. If the failure is a false positive (e.g. a legitimate large data purge
   dropped production's row count below a stale backup's), that's a gap in
   the check's heuristics — file it, don't just silence the alert.

**If `BackupVerificationNotRunRecently` fires**: the CronJob itself may be
disabled, the cluster scheduler may be unhealthy, or a prior failed run's
`concurrencyPolicy: Forbid` may be blocking new runs — check
`kubectl get cronjob db-backup-verify-daily -n amana` first.
