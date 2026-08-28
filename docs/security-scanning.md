# Security Scanning

Amana runs automated dependency vulnerability scanning on pull requests and in
the weekly scheduled security workflow. The scanners fail on high or critical
findings; they are not reporting-only checks.

## CI Pipeline

Security audits run in `.github/workflows/security-audit.yml` and **fail the
workflow** on any **high** or **critical** severity vulnerability.

| Job | Tool | Command | Fail threshold |
|-----|------|---------|----------------|
| `frontend` | pnpm audit | `pnpm audit --audit-level=high` | high + critical |
| `backend` | pnpm audit | `pnpm audit --audit-level=high` | high + critical |
| `mobile` | pnpm audit | `pnpm audit --audit-level=high` | high + critical |
| `contracts` | cargo audit | `cargo audit` | any advisory |
| `routes-d` | npm audit | `npm audit --audit-level=high` | high + critical |

Pull requests also run GitHub's dependency review with a high-severity
threshold. The weekly workflow runs Trivy across all five stacks and uploads
SARIF results to the GitHub Security tab. Audit JSON and SARIF files are kept
as workflow artifacts for investigation.

For scheduled or manually dispatched failures, configure the optional
`SECURITY_AUDIT_SLACK_WEBHOOK` repository secret to notify the security channel.
The workflow always writes a failure summary with a run link, and response
steps are documented in the [vulnerability response runbook](runbooks/security-vulnerability-response.md).

Docker image scanning via Trivy can be added once the project ships Dockerfiles (see [docker-profiles.md](docker-profiles.md)).

## Running Scans Locally

```bash
# Run all scanners and write reports to security-reports/
bash scripts/security-scan.sh

# Override report directory
REPORT_DIR=/tmp/my-scan bash scripts/security-scan.sh
```

The script auto-skips tools that are not installed and summarises results in `security-reports/summary.txt`.

## Fixing Vulnerabilities

1. **npm** — Run `npm audit fix` in the affected workspace (`frontend/`, `backend/`, `mobile/`, or `routes-d/`). For breaking changes use `npm audit fix --force` and test thoroughly.
2. **cargo** — Update the affected crate in `Cargo.toml` and run `cargo update`.
3. If no fix is available, open a tracking issue and add an advisory exception in `contracts/.cargo/audit.toml` with a justification comment.

## Installing Optional Scanners

```bash
# cargo-audit (Rust advisories)
cargo install cargo-audit --locked

# Trivy (filesystem + container image scanning)
# https://aquasecurity.github.io/trivy/latest/getting-started/installation/
brew install trivy          # macOS
sudo apt install trivy      # Debian/Ubuntu
```
