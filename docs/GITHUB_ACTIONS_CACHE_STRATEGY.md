# GitHub Actions Cache Strategy

This document explains the cache key strategy used in Amana's GitHub Actions workflows to improve build times and ensure reproducibility.

## Overview

Amana uses GitHub Actions caching to store dependencies and build artifacts across workflow runs. The caching strategy balances performance (faster builds) with correctness (accurate dependency resolution).

## Cache Keys by Stack

### Node.js Dependencies (Frontend, Backend, Mobile)

**Location**: `.github/workflows/ci.yml`, `.github/workflows/staging.yml`

**Strategy**: Uses `pnpm` built-in caching via `actions/setup-node@v4`

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
    cache-dependency-path: <stack>/pnpm-lock.yaml
```

**Cache Key Pattern**: 
- Primary: `setup-node-<OS>-pnpm-<hash(pnpm-lock.yaml)>`
- The `actions/setup-node` action automatically generates cache keys based on the lockfile hash

**Invalidation**: Cache is invalidated automatically when `pnpm-lock.yaml` changes

**Restore Behavior**: 
- Exact match: Uses cached `node_modules`
- No match: Runs `pnpm install` and creates new cache

### Rust Dependencies (Contracts)

**Location**: `.github/workflows/ci.yml`

**Strategy**: Uses `Swatinem/rust-cache@v2` for Cargo dependencies and build artifacts

```yaml
- name: Cache Rust dependencies and build
  if: matrix.stack == 'contracts'
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: contracts
    cache-targets: true
```

**Cache Key Pattern**:
- Primary: `rust-cache-<OS>-<hash(Cargo.lock)>-<hash(Cargo.toml)>`
- Automatically managed by `rust-cache` action

**What's Cached**:
- `~/.cargo/registry/index/`
- `~/.cargo/registry/cache/`
- `~/.cargo/git/db/`
- `target/` directory (compiled artifacts)

**Invalidation**: Cache is invalidated when `Cargo.lock` or `Cargo.toml` changes

### Cargo-Audit Binary Cache

**Location**: `.github/workflows/ci.yml`

**Strategy**: Manual caching of the `cargo-audit` binary to avoid reinstalling on every run

```yaml
- name: Cache cargo-audit binary
  if: matrix.stack == 'contracts'
  id: cache-cargo-audit
  uses: actions/cache@v4
  with:
    path: ~/.cargo/bin/cargo-audit
    key: ${{ runner.os }}-cargo-audit-${{ hashFiles('**/Cargo.lock') }}
```

**Cache Key Pattern**: `<OS>-cargo-audit-<hash(Cargo.lock)>`

**Restore Behavior**:
- Cache hit: Uses cached binary, skips installation
- Cache miss: Runs `cargo install cargo-audit --locked`

## Multi-Stack Cache Dependencies

**Location**: `.github/workflows/ci.yml` (E2E integration tests)

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
    cache-dependency-path: |
      mobile/pnpm-lock.yaml
      frontend/pnpm-lock.yaml
      backend/pnpm-lock.yaml
```

**Cache Key Pattern**: Hash of all three lockfiles combined

**Purpose**: E2E tests require dependencies from multiple stacks

## Cache Reproducibility

### Lockfile Integrity

All caches are keyed by lockfile hashes (`pnpm-lock.yaml`, `Cargo.lock`), ensuring:

1. **Deterministic Dependencies**: Same lockfile = same dependencies
2. **Version Pinning**: Transitive dependencies are locked
3. **Cross-Run Consistency**: Cache restore produces identical `node_modules`/`target` across runs

### Cache Invalidation Triggers

Caches are invalidated when:

1. **Lockfile Changes**: New dependencies or version updates
2. **OS Changes**: Caches are OS-specific (Linux, macOS, Windows)
3. **Manual Invalidation**: Changing the cache key prefix in workflows

### Best Practices

1. **Always commit lockfiles**: Never add `pnpm-lock.yaml` or `Cargo.lock` to `.gitignore`
2. **Update lockfiles atomically**: Run `pnpm install` or `cargo update` to update lockfiles
3. **Avoid manual lockfile edits**: Use package manager commands
4. **Test locally first**: Ensure `pnpm install --frozen-lockfile` and `cargo build` work locally before pushing

## Cache Storage Limits

GitHub Actions cache has a 10GB storage limit per repository. Amana's current cache usage:

- **Frontend pnpm**: ~200MB
- **Backend pnpm**: ~300MB
- **Mobile pnpm**: ~250MB
- **Rust dependencies**: ~500MB
- **Cargo-audit binary**: ~10MB

**Total**: ~1.3GB (well within limits)

## Debugging Cache Issues

### Cache Not Restoring

1. Check lockfile hasn't changed between runs
2. Verify OS matches (Linux != macOS)
3. Check GitHub Actions cache storage isn't full

### Stale Dependencies

1. Delete cache manually from GitHub UI (Settings → Actions → Caches)
2. Update lockfile and push

### Cache Misses

1. Check workflow logs for "Cache not found" messages
2. Verify `cache-dependency-path` points to correct lockfile
3. Ensure lockfile is committed to repository

## References

- [actions/setup-node caching](https://github.com/actions/setup-node#caching-global-packages-data)
- [Swatinem/rust-cache](https://github.com/Swatinem/rust-cache)
- [GitHub Actions cache documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
