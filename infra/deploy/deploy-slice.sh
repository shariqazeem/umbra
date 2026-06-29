#!/usr/bin/env bash
# =============================================================================
# deploy-slice.sh — push-button, self-verifying testnet deploy of the UmbraPool
# slice.
#
# What it does (idempotent):
#   1. Loud preflight: stellar-cli, wasm32 target, jq, network=testnet, deployer
#      identity exists + friendbot-funded, circuit fixtures present. On ANY
#      failure it prints the exact fix command and stops.
#   2. Build + upload + deploy umbra_pool; deploy the native SAC demo asset;
#      one-time init (token + verification keys).
#   3. Write infra/deploy/deployment.json — the single machine-readable source of
#      truth: {network, contractIds, wasmHash, deployTx, deployedAt, ...}.
#
# Re-running is safe: if deployment.json already names a pool contract it reuses
# it and exits 0. Pass --force to redeploy from scratch.
#
# Deployer identity is ONE config var (UMBRA_DEPLOYER). For G7 this var becomes a
# multi-sig signer alias — that is intentionally NOT implemented here and must not
# block this slice.
#
# Requires: stellar-cli, rustup + wasm32-unknown-unknown, jq, curl, and the
# fixtures from circuits/scripts/build-slice.sh. Testnet only.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$HERE/../.." && pwd)"

# ---- config: sane testnet defaults, .env overrides (no var is required) --------
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

UMBRA_NETWORK="${UMBRA_NETWORK:-testnet}"
# --- G7 multi-sig seam: single deployer-identity config var. Today this is a
#     plain named `stellar keys` identity; for G7 it becomes the multi-sig signer
#     alias. Do NOT implement multi-sig here; do NOT let it block the slice. -----
UMBRA_DEPLOYER="${UMBRA_DEPLOYER:-umbra-deployer}"
UMBRA_HORIZON_URL="${UMBRA_HORIZON_URL:-https://horizon-testnet.stellar.org}"
EXPLORER_BASE="${UMBRA_EXPLORER_BASE:-https://stellar.expert/explorer/testnet}"
TESTNET_RPC_URL="${UMBRA_RPC_URL:-https://soroban-testnet.stellar.org}"
TESTNET_PASSPHRASE="Test SDF Network ; September 2015"

DEPLOYMENT_JSON="$HERE/deployment.json"
BUILD="$ROOT_DIR/circuits/build"
# stellar-cli >=23 builds Soroban wasm for the `wasm32v1-none` target; older CLIs
# use `wasm32-unknown-unknown`. Resolve whichever the installed CLI produced.
WASM_TARGET_DIR="$ROOT_DIR/contracts/target"
resolve_pool_wasm() {
  local c
  for c in "$WASM_TARGET_DIR/wasm32v1-none/release/umbra_pool.wasm" \
           "$WASM_TARGET_DIR/wasm32-unknown-unknown/release/umbra_pool.wasm"; do
    [ -f "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

# ---- output helpers ----------------------------------------------------------
step() { printf '\n==> %s\n' "$*"; }
ok()   { printf 'OK   %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*" >&2; }
# fail "<what failed>" "<exact fix command>"
fail() {
  printf '\nPREFLIGHT FAILED: %s\n' "$1" >&2
  if [ -n "${2:-}" ]; then
    printf '  run this to fix it:\n\n      %s\n\n' "$2" >&2
  fi
  exit 1
}

# Prefer a tx hash printed in a `…/tx/<hash>` URL, then a "transaction <hash>"
# phrase, then any 64-hex token that is not the (excluded) wasm hash.
# Usage: extract_txhash <logfile> <wasm-hash-to-exclude-or-empty>
extract_txhash() {
  local h
  h="$(grep -oiE 'tx/[0-9a-f]{64}' "$1" 2>/dev/null | grep -oiE '[0-9a-f]{64}' | head -n1 || true)"
  [ -z "$h" ] && h="$(grep -oiE 'transaction[^0-9a-f]*[0-9a-f]{64}' "$1" 2>/dev/null | grep -oiE '[0-9a-f]{64}' | head -n1 || true)"
  [ -z "$h" ] && h="$(grep -oiE '[0-9a-f]{64}' "$1" 2>/dev/null | grep -vi "^${2:-}$" | head -n1 || true)"
  printf '%s' "$h"
}

# ---- preflight ---------------------------------------------------------------
preflight() {
  step "preflight checks"

  command -v stellar >/dev/null 2>&1 || fail \
    "stellar CLI not on PATH" \
    "brew install stellar-cli      # or: cargo install --locked stellar-cli"

  command -v rustup >/dev/null 2>&1 || fail \
    "rustup not found (needed to add the wasm32 build target)" \
    "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"

  # stellar-cli >=23 builds for wasm32v1-none; older CLIs use wasm32-unknown-unknown.
  rustup target list --installed 2>/dev/null | grep -qE '^wasm32(v1-none|-unknown-unknown)$' || fail \
    "no wasm32 Soroban target installed (stellar-cli >=23 needs wasm32v1-none)" \
    "rustup target add wasm32v1-none      # older CLIs: rustup target add wasm32-unknown-unknown"

  command -v jq >/dev/null 2>&1 || fail "jq not installed" "brew install jq"

  [ "$UMBRA_NETWORK" = "testnet" ] || fail \
    "UMBRA_NETWORK is '$UMBRA_NETWORK' — this demo deploy is testnet-only (mainnet is intentionally blocked)" \
    "export UMBRA_NETWORK=testnet"

  # Make sure the CLI knows the 'testnet' network alias (modern CLI ships it;
  # this is a best-effort, idempotent registration).
  stellar network add testnet \
    --rpc-url "$TESTNET_RPC_URL" \
    --network-passphrase "$TESTNET_PASSPHRASE" >/dev/null 2>&1 || true

  DEPLOYER_ADDR="$(stellar keys address "$UMBRA_DEPLOYER" 2>/dev/null || true)"
  [ -n "$DEPLOYER_ADDR" ] || fail \
    "deployer identity '$UMBRA_DEPLOYER' does not exist in the stellar keystore" \
    "stellar keys generate $UMBRA_DEPLOYER --network testnet --fund"

  if command -v curl >/dev/null 2>&1; then
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "$UMBRA_HORIZON_URL/accounts/$DEPLOYER_ADDR" 2>/dev/null || echo 000)"
    [ "$code" = "200" ] || fail \
      "deployer '$UMBRA_DEPLOYER' ($DEPLOYER_ADDR) is not funded on testnet (Horizon returned HTTP $code)" \
      "stellar keys fund $UMBRA_DEPLOYER --network testnet"
  else
    warn "curl not found — skipping the friendbot-funded check."
    warn "if deploy fails with an underfunded/txMalformed error, run: stellar keys fund $UMBRA_DEPLOYER --network testnet"
  fi

  local f
  for f in shield_soroban.json withdraw_soroban.json; do
    [ -f "$BUILD/$f" ] || fail \
      "missing circuit fixture $BUILD/$f" \
      "bash circuits/scripts/build-slice.sh"
  done

  ok "preflight passed — deployer $UMBRA_DEPLOYER = $DEPLOYER_ADDR on $UMBRA_NETWORK"
}

# ---- upload wasm (returns the on-chain wasm hash) ----------------------------
upload_wasm() {
  local log h
  log="$(mktemp)"
  h="$(stellar contract upload --wasm "$1" \
        --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" 2>"$log")" \
    || h="$(stellar contract install --wasm "$1" \
        --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" 2>>"$log")" \
    || true
  cat "$log" >&2
  rm -f "$log"
  printf '%s' "$h"
}

# ---- main --------------------------------------------------------------------
main() {
  preflight

  # idempotency: reuse an existing deployment unless --force
  if [ "$FORCE" -eq 0 ] && [ -f "$DEPLOYMENT_JSON" ]; then
    local existing
    existing="$(jq -r '.contractIds.pool // ""' "$DEPLOYMENT_JSON" 2>/dev/null || echo "")"
    if [ -n "$existing" ] && [ "$existing" != "null" ]; then
      ok "already deployed: pool $existing"
      printf '     %s/contract/%s\n' "$EXPLORER_BASE" "$existing"
      printf '     (re-run with --force to redeploy from scratch)\n'
      exit 0
    fi
  fi

  step "build contracts (wasm32 release)"
  ( cd "$ROOT_DIR/contracts" && stellar contract build )
  POOL_WASM="$(resolve_pool_wasm)" || fail \
    "umbra_pool.wasm not found under contracts/target/{wasm32v1-none,wasm32-unknown-unknown}/release" \
    "cd contracts && stellar contract build"
  ok "wasm: $POOL_WASM"

  step "upload umbra_pool wasm"
  WASM_HASH="$(upload_wasm "$POOL_WASM")"
  [ -n "$WASM_HASH" ] || fail "wasm upload returned no hash (see stellar output above)" ""
  ok "wasm hash: $WASM_HASH"

  step "deploy umbra_pool"
  local dlog
  dlog="$(mktemp)"
  POOL="$(stellar contract deploy --wasm-hash "$WASM_HASH" \
            --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" 2>"$dlog")"
  cat "$dlog" >&2
  DEPLOY_TX="$(extract_txhash "$dlog" "$WASM_HASH")"
  rm -f "$dlog"
  [ -n "$POOL" ] || fail "deploy returned no contract id (see stellar output above)" ""
  ok "pool contract: $POOL"
  [ -n "$DEPLOY_TX" ] || warn "could not parse the deploy tx hash from CLI output (deployTx will be empty)"

  step "deploy native SAC token wrapper (demo asset)"
  UMBRA_TOKEN="${UMBRA_TOKEN:-}"
  if [ -z "$UMBRA_TOKEN" ]; then
    UMBRA_TOKEN="$(stellar contract asset deploy --asset native \
                     --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" 2>/dev/null \
                   || stellar contract id asset --asset native --network "$UMBRA_NETWORK" 2>/dev/null \
                   || echo "")"
  fi
  ok "token: ${UMBRA_TOKEN:-<unset>}"

  step "init pool (bind token + verification keys) — one-time"
  local vk_shield vk_withdraw
  vk_shield="$(jq -c '.vk' "$BUILD/shield_soroban.json")"
  vk_withdraw="$(jq -c '.vk' "$BUILD/withdraw_soroban.json")"
  if stellar contract invoke --id "$POOL" \
       --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" \
       -- init --token "$UMBRA_TOKEN" --vk_shield "$vk_shield" --vk_withdraw "$vk_withdraw" 2>&1; then
    ok "init complete"
  else
    warn "init failed or pool was already initialized — continuing (idempotent)"
  fi

  step "write deployment.json"
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n \
    --arg network    "$UMBRA_NETWORK" \
    --arg passphrase "$TESTNET_PASSPHRASE" \
    --arg pool       "$POOL" \
    --arg token      "$UMBRA_TOKEN" \
    --arg wasmHash   "$WASM_HASH" \
    --arg deployTx   "$DEPLOY_TX" \
    --arg deployer   "$DEPLOYER_ADDR" \
    --arg deployerId "$UMBRA_DEPLOYER" \
    --arg base       "$EXPLORER_BASE" \
    --arg now        "$now" \
    '{
       network: $network,
       networkPassphrase: $passphrase,
       contractIds: { pool: $pool, token: $token },
       wasmHash: $wasmHash,
       deployTx: $deployTx,
       deployTxUrl: (if $deployTx == "" then "" else $base + "/tx/" + $deployTx end),
       poolContractUrl: ($base + "/contract/" + $pool),
       deployer: $deployer,
       deployerId: $deployerId,
       explorerBase: $base,
       deployedAt: $now
     }' > "$DEPLOYMENT_JSON"

  ok "wrote $DEPLOYMENT_JSON"
  echo
  cat "$DEPLOYMENT_JSON"
  echo
  step "next: capture the demo txs"
  printf '     bash infra/deploy/capture-demo-txs.sh\n'
}

main "$@"
