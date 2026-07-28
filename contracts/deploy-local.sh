#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Local Soroban deployment entrypoint (contracts/deploy-local.sh)
#
# Convenience wrapper so the local deployment workflow can be run directly
# from `contracts/` without needing to know the script lives under the
# repository-wide `scripts/` directory. Builds the amana_escrow wasm artifact
# and deploys (or upgrades) it against a local Soroban sandbox/standalone
# network.
#
# See `scripts/deploy-contract-local.sh --help` for full usage, or run:
#   ./contracts/deploy-local.sh --help
# ─────────────────────────────────────────────────────────────────────────────

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$repo_root/scripts/deploy-contract-local.sh" "$@"
