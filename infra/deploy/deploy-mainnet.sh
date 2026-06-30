#!/usr/bin/env bash
# =============================================================================
# deploy-mainnet.sh — deploy the HARDENED UmbraPool to Stellar MAINNET as a
# capped, self-reviewed canary. Mirrors deploy-slice.sh (constructor-init, H1),
# but for mainnet, with real-money guardrails.
#
#   ⚠️  REAL MONEY. This deploys a contract that custodies real XLM. The pool is
#   SELF-REVIEWED (C1/H1/M1/M2 fixed + tested), NOT independently audited, and uses
#   a single-contributor Groth16 trusted setup. Treat it as an EXPERIMENTAL CANARY:
#   deposit only small amounts you can afford to lose, and wind it down when done.
#   See docs/MAINNET_CANARY.md and docs/SECURITY_REVIEW.md.
#
# What it does (one transaction each):
#   1. Loud preflight + a typed confirmation. Verifies the deployer is funded with
#      real XLM, the wasm target + fixtures exist, and an RPC is set.
#   2. Build + upload the hardened wasm; resolve the native XLM SAC on mainnet;
#      deploy umbra_pool via its constructor (token + both verifying keys, atomic).
#   3. Write infra/deploy/deployment.mainnet.json.
#
# Idempotent: if deployment.mainnet.json already names a pool it exits 0. --force
# redeploys from scratch.
#
# Requires: stellar-cli, rustup + wasm32 target, jq, curl, the deployer identity in
# the stellar keystore, and circuits/build/{shield,withdraw}_soroban.json.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$HERE/../.." && pwd)"
BUILD="$ROOT_DIR/circuits/build"
WASM_TARGET_DIR="$ROOT_DIR/contracts/target"
DEPLOYMENT_JSON="$HERE/deployment.mainnet.json"

# --- mainnet config ---------------------------------------------------------
UMBRA_NETWORK="mainnet"
MAINNET_PASSPHRASE="Public Global Stellar Network ; September 2015"
MAINNET_HORIZON_URL="${UMBRA_HORIZON_URL:-https://horizon.stellar.org}"
EXPLORER_BASE="https://stellar.expert/explorer/public"
# Mainnet has no public friendbot RPC; the operator MUST supply one (a provider
# endpoint — Validation Cloud, Blockdaemon, QuickNode, etc.).
UMBRA_RPC_URL="${UMBRA_RPC_URL:-}"
UMBRA_DEPLOYER="${UMBRA_DEPLOYER:-umbra-deployer}"
# Informational canary cap (XLM). The hard cap is enforced client-side today
# (lib/umbra/network.ts MAX_MAINNET_DEPOSIT); see docs/MAINNET_CANARY.md for the
# on-chain max-deposit option recommended before opening the canary publicly.
CANARY_CAP_XLM="${UMBRA_CANARY_CAP_XLM:-25}"

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

step() { printf '\n==> %s\n' "$*"; }
ok()   { printf 'OK   %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*" >&2; }
fail() {
  printf '\nPREFLIGHT FAILED: %s\n' "$1" >&2
  [ -n "${2:-}" ] && printf '  fix:\n\n      %s\n\n' "$2" >&2
  exit 1
}

extract_txhash() {
  grep -oiE 'tx/[0-9a-f]{64}' "$1" 2>/dev/null | grep -oiE '[0-9a-f]{64}' | head -n1 \
    || grep -oiE '[0-9a-f]{64}' "$1" 2>/dev/null | head -n1 || true
}

resolve_pool_wasm() {
  local c
  for c in "$WASM_TARGET_DIR/wasm32v1-none/release/umbra_pool.wasm" \
           "$WASM_TARGET_DIR/wasm32-unknown-unknown/release/umbra_pool.wasm"; do
    [ -f "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

upload_wasm() {
  local log h
  log="$(mktemp)"
  h="$(stellar contract upload --wasm "$1" \
        --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" 2>"$log")" \
    || h="$(stellar contract install --wasm "$1" \
        --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" 2>>"$log")" || true
  cat "$log" >&2; rm -f "$log"
  printf '%s' "$h"
}

preflight() {
  step "preflight — MAINNET (real money)"

  command -v stellar >/dev/null 2>&1 || fail "stellar CLI not on PATH" "brew install stellar-cli"
  command -v jq >/dev/null 2>&1 || fail "jq not installed" "brew install jq"
  command -v rustup >/dev/null 2>&1 || fail "rustup not found" "https://rustup.rs"
  rustup target list --installed 2>/dev/null | grep -qE '^wasm32(v1-none|-unknown-unknown)$' \
    || fail "no wasm32 Soroban target installed" "rustup target add wasm32v1-none"

  [ -n "$UMBRA_RPC_URL" ] || fail \
    "UMBRA_RPC_URL is unset — mainnet needs a Soroban RPC provider endpoint" \
    "export UMBRA_RPC_URL=https://<your-mainnet-soroban-rpc>   # Validation Cloud / Blockdaemon / QuickNode / self-hosted"

  local f
  for f in shield_soroban.json withdraw_soroban.json; do
    [ -f "$BUILD/$f" ] || fail "missing circuit fixture $BUILD/$f" "bash circuits/scripts/build-slice.sh"
  done

  DEPLOYER_ADDR="$(stellar keys address "$UMBRA_DEPLOYER" 2>/dev/null || true)"
  [ -n "$DEPLOYER_ADDR" ] || fail \
    "deployer identity '$UMBRA_DEPLOYER' not in the stellar keystore" \
    "stellar keys add $UMBRA_DEPLOYER   # import the mainnet deployer secret"

  # Register the mainnet alias (idempotent) so --network mainnet resolves.
  stellar network add "$UMBRA_NETWORK" \
    --rpc-url "$UMBRA_RPC_URL" --network-passphrase "$MAINNET_PASSPHRASE" >/dev/null 2>&1 || true

  # The deployer MUST be funded with real XLM (no friendbot on mainnet).
  local code bal
  code="$(curl -s -o /dev/null -w '%{http_code}' "$MAINNET_HORIZON_URL/accounts/$DEPLOYER_ADDR" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] || fail \
    "deployer '$UMBRA_DEPLOYER' ($DEPLOYER_ADDR) is not a funded mainnet account (Horizon HTTP $code)" \
    "send real XLM to $DEPLOYER_ADDR first (a few XLM covers fees + the canary deposit)"
  bal="$(curl -s "$MAINNET_HORIZON_URL/accounts/$DEPLOYER_ADDR" | jq -r '.balances[]|select(.asset_type=="native")|.balance' 2>/dev/null || echo "?")"

  printf '\n'
  printf '  ──────────────────────────────────────────────────────────────\n'
  printf '   MAINNET DEPLOY — real money, self-reviewed (NOT audited) canary\n'
  printf '  ──────────────────────────────────────────────────────────────\n'
  printf '   network    : %s\n' "$UMBRA_NETWORK"
  printf '   deployer   : %s (%s XLM)\n' "$DEPLOYER_ADDR" "$bal"
  printf '   rpc        : %s\n' "$UMBRA_RPC_URL"
  printf '   wasm       : the hardened umbra_pool (C1/H1/M1/M2)\n'
  printf '   canary cap : %s XLM/deposit (client-side; see docs/MAINNET_CANARY.md)\n' "$CANARY_CAP_XLM"
  printf '  ──────────────────────────────────────────────────────────────\n'
  printf '   This custodies REAL XLM with a single-contributor trusted setup and\n'
  printf '   no independent audit. Deposit only what you can afford to lose.\n\n'
  printf '   Type  DEPLOY MAINNET  to proceed: '
  local confirm; IFS= read -r confirm
  [ "$confirm" = "DEPLOY MAINNET" ] || fail "confirmation not given — aborting (nothing deployed)" ""

  ok "preflight passed — deployer $DEPLOYER_ADDR on $UMBRA_NETWORK"
}

main() {
  preflight

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
  POOL_WASM="$(resolve_pool_wasm)" || fail "umbra_pool.wasm not found" "cd contracts && stellar contract build"
  ok "wasm: $POOL_WASM"

  step "upload umbra_pool wasm"
  WASM_HASH="$(upload_wasm "$POOL_WASM")"
  [ -n "$WASM_HASH" ] || fail "wasm upload returned no hash" ""
  ok "wasm hash: $WASM_HASH"

  step "resolve native XLM SAC on mainnet"
  UMBRA_TOKEN="${UMBRA_TOKEN:-}"
  if [ -z "$UMBRA_TOKEN" ]; then
    UMBRA_TOKEN="$(stellar contract id asset --asset native --network "$UMBRA_NETWORK" 2>/dev/null || echo "")"
  fi
  [ -n "$UMBRA_TOKEN" ] || fail "could not resolve the native SAC contract id on mainnet" ""
  ok "token (native SAC): $UMBRA_TOKEN"

  step "deploy umbra_pool (constructor binds token + verifying keys — atomic, H1)"
  local vk_shield vk_withdraw dlog
  vk_shield="$(jq -c '.vk' "$BUILD/shield_soroban.json")"
  vk_withdraw="$(jq -c '.vk' "$BUILD/withdraw_soroban.json")"
  dlog="$(mktemp)"
  POOL="$(stellar contract deploy --wasm-hash "$WASM_HASH" \
            --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" \
            -- --token "$UMBRA_TOKEN" --vk_shield "$vk_shield" --vk_withdraw "$vk_withdraw" 2>"$dlog")"
  cat "$dlog" >&2
  DEPLOY_TX="$(extract_txhash "$dlog")"
  rm -f "$dlog"
  [ -n "$POOL" ] || fail "deploy returned no contract id (see stellar output above)" ""
  ok "pool contract: $POOL (initialized via constructor)"

  step "write deployment.mainnet.json"
  jq -n \
    --arg network    "$UMBRA_NETWORK" \
    --arg passphrase "$MAINNET_PASSPHRASE" \
    --arg pool       "$POOL" \
    --arg token      "$UMBRA_TOKEN" \
    --arg wasmHash   "$WASM_HASH" \
    --arg deployTx   "$DEPLOY_TX" \
    --arg deployer   "$DEPLOYER_ADDR" \
    --arg rpc        "$UMBRA_RPC_URL" \
    --arg explorer   "$EXPLORER_BASE" \
    --arg cap        "$CANARY_CAP_XLM" \
    '{
      network: $network, networkPassphrase: $passphrase, mode: "capped-canary-self-reviewed",
      contractIds: { pool: $pool, token: $token },
      wasmHash: $wasmHash, deployTx: $deployTx,
      deployTxUrl: ($explorer + "/tx/" + $deployTx),
      poolContractUrl: ($explorer + "/contract/" + $pool),
      deployer: $deployer, rpcUrl: $rpc, explorerBase: $explorer, canaryCapXlm: $cap
    }' > "$DEPLOYMENT_JSON"
  ok "wrote $DEPLOYMENT_JSON"
  cat "$DEPLOYMENT_JSON"

  printf '\n==> next steps (the app does NOT touch mainnet money until you do all of these)\n'
  printf '  1. Point the app at the mainnet pool (production env, NOT committed):\n'
  printf '       NEXT_PUBLIC_UMBRA_POOL_CONTRACT=%s\n' "$POOL"
  printf '       NEXT_PUBLIC_UMBRA_RPC_URL=%s\n' "$UMBRA_RPC_URL"
  printf '       NEXT_PUBLIC_UMBRA_NETWORK_PASSPHRASE=%s\n' "$MAINNET_PASSPHRASE"
  printf '       NEXT_PUBLIC_UMBRA_NETWORK=mainnet\n'
  printf '  2. Arm the capped canary (lib/umbra/network.ts): ENABLE_MAINNET_CANARY=true,\n'
  printf '     MAX_MAINNET_DEPOSIT set to %s XLM in stroops. Keep it small.\n' "$CANARY_CAP_XLM"
  printf '  3. Smoke test with ONE tiny shield + withdraw before anything else.\n'
  printf '  See docs/MAINNET_CANARY.md.\n'
}

main "$@"
