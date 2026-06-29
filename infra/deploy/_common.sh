#!/usr/bin/env bash
# Shared helpers for the testnet benchmark scripts. Sourced, not executed.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/circuits/build"
WASM_DIR="$ROOT_DIR/contracts/target/wasm32-unknown-unknown/release"

# Load .env if present (repo root).
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

: "${UMBRA_RPC_URL:?set UMBRA_RPC_URL (see infra/deploy/.env.example)}"
: "${UMBRA_NETWORK_PASSPHRASE:?set UMBRA_NETWORK_PASSPHRASE}"
: "${UMBRA_SOURCE_SECRET:?set UMBRA_SOURCE_SECRET}"
ARTIFACT="${UMBRA_SOROBAN_ARTIFACT:-bench_hash}"

command -v stellar >/dev/null || { echo "ERROR: stellar CLI not on PATH"; exit 1; }

stellar_net=(--rpc-url "$UMBRA_RPC_URL" --network-passphrase "$UMBRA_NETWORK_PASSPHRASE")

# Build + deploy the verifier if no contract id is supplied; echo the contract id.
ensure_verifier () {
  if [ -n "${UMBRA_VERIFIER_CONTRACT:-}" ]; then
    echo "$UMBRA_VERIFIER_CONTRACT"
    return
  fi
  ( cd "$ROOT_DIR/contracts" && stellar contract build >/dev/stderr )
  local wasm="$WASM_DIR/groth16_verifier.wasm"
  stellar contract deploy --wasm "$wasm" --source-account "$UMBRA_SOURCE_SECRET" "${stellar_net[@]}" 2>/dev/stderr
}

# Emit a single-line JSON result for the harness to parse (must be the last stdout line).
emit_json () {
  printf '%s\n' "$1"
}
