# Secrets Policy

This document describes how Amana prevents accidental secret exposure and what to do when a secret is detected in the repository.

---

## 1. What We Scan For

The CI workflow `.github/workflows/secrets-scan.yml` runs on every push and pull request using **Gitleaks** with custom rules defined in `.gitleaks.toml`.

### Detected patterns

| Pattern | Severity |
|---------|----------|
| Stellar secret key (`S...` 56-char base32) | Critical |
| Private key PEM (`-----BEGIN PRIVATE KEY-----`) | Critical |
| JWT tokens assigned to secret env vars | Critical |
| PostgreSQL URLs with embedded passwords | Critical |
| Redis URLs with embedded passwords | High |
| Supabase service role key | Critical |
| Pinata JWT | Critical |
| Generic `API_KEY` / `SECRET_KEY` assignments | High |

### Safe files (excluded from scanning)
- `*.env.*.example` and `*.env.example` — placeholder values only
- `docs/**`, `*.md` — documentation prose
- `backend/src/__tests__/**` — test fixtures with fake credentials

---

## 2. How to Prevent Exposure

### Never commit real values

Use environment variable files that are excluded by `.gitignore`:

```
.env
.env.staging
.env.production
.env.local
backups/
```

### Use placeholder syntax in example files

```env
# ✓ Safe — placeholder value
JWT_SECRET=your-super-secret-jwt-key-must-be-at-least-32-chars-change-in-production!

# ✗ Unsafe — real value
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Use GitHub Secrets for CI

Reference secrets as `${{ secrets.MY_SECRET }}` in workflows. Never echo or print them.

### Rotate immediately if exposed

If a key is accidentally committed, assume it is compromised even if the commit is later removed from history.

---

## 3. When a Secret Is Detected

### Step 1 — Revoke immediately

Revoke the exposed credential **before** doing anything else:

| Credential type | Where to revoke |
|----------------|-----------------|
| JWT Secret | Rotate `JWT_SECRET` in all environments and invalidate active sessions |
| Stellar secret key | Transfer funds immediately; the key is burned |
| Supabase service role key | Supabase dashboard → API settings → Rotate key |
| Pinata JWT | Pinata dashboard → API Keys → Revoke |
| Database password | Cloud console → Rotate credentials |

### Step 2 — Remove from git history

Removing from git history is **optional for revoked keys** but required for compliance:

```bash
# Using git-filter-repo (preferred)
pip install git-filter-repo
git filter-repo --path-glob '*.env' --invert-paths

# Or using BFG Repo Cleaner
java -jar bfg.jar --delete-files '*.env' repo.git
```

After rewriting history, force-push and notify all team members to re-clone.

### Step 3 — Notify

- Open a security incident issue (use the `security` label, keep it private if sensitive)
- Notify the team lead and on-call engineer
- Document what was exposed, when, and what was done

### Step 4 — Post-mortem

Document the root cause and add a `.gitleaks.toml` rule if the pattern isn't already covered.

---

## 4. Local Pre-commit Hook

Install Gitleaks locally to catch secrets before pushing:

```bash
# Install gitleaks (macOS)
brew install gitleaks

# Run manually
gitleaks detect --config=.gitleaks.toml --source=. --verbose

# Or install as a pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/usr/bin/env bash
gitleaks protect --config=.gitleaks.toml --staged --verbose
EOF
chmod +x .git/hooks/pre-commit
```

---

## 5. GitHub Push Protection

In addition to CI scanning, enable **GitHub's native secret scanning** in the repository settings:

1. **Settings** → **Security** → **Code security and analysis**
2. Enable **Secret scanning**
3. Enable **Push protection** — blocks pushes containing known secret formats

This provides a second layer of protection at the GitHub API level, independent of CI.

---

## 6. Suppressing False Positives

Prefer `.gitleaksignore` at the repo root, listing the exact finding
fingerprint (`<file>:<rule-id>:<line>`) — this is the most reliable
suppression mechanism, and doesn't require guessing how gitleaks scopes a
given `[[allowlists]]` block. Regenerate a fingerprint for a new false
positive with:

```bash
gitleaks dir . --config .gitleaks.toml --no-banner -r /tmp/report.json
jq -r '.[].Fingerprint' /tmp/report.json
```

Path-based `[[allowlists]]` blocks in `.gitleaks.toml` (excluding whole
files/directories, e.g. `docs/`) work as documented — but note that
`paths` entries are **regexes, not glob patterns**: a bare leading `*`
(as in a glob like `*.md`) is invalid regex syntax and crashes gitleaks
entirely rather than just failing to match. Use an anchored, escaped
equivalent instead (`\.md$`).

Document all suppressions (in `.gitleaksignore` or `.gitleaks.toml`) with a
comment explaining why they are safe.

---

## 7. Secret Rotation Schedule

Every secret listed in `.env.staging.example`/K8s `secrets.yaml` should be
rotated on a schedule, not only in response to a leak:

| Secret | Rotation interval |
|---|---|
| JWT secret | 90 days |
| Stellar secret keys | 180 days |
| Pinata JWT | 30 days |
| Supabase service role key | 90 days |
| Redis password | 180 days |

**Status: policy only — not yet automated.** Automating this requires a
versioned secrets backend (AWS Secrets Manager or HashiCorp Vault) that the
backend fetches from at startup with a cache TTL and re-fetches on a
rotation signal, plus an overlapping grace period so an in-flight request
signed with the old JWT secret isn't rejected mid-rotation. Choosing and
wiring up that backend is a significant, infrastructure-dependent piece of
work on its own — deliberately not attempted as part of the gitleaks CI fix
above. Until it exists, rotate these manually by following the incident
rotation steps in section 3, on the schedule above rather than only after a
leak.
