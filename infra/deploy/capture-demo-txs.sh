#!/usr/bin/env bash
# =============================================================================
# capture-demo-txs.sh — submit ONE real shield then ONE real withdraw against the
# already-deployed UmbraPool, and append the two transaction hashes + their
# stellar.expert testnet explorer URLs to infra/deploy/deployment.json.
#
# These two transactions are the backbone of the demo's "can't-connect" reveal:
# a real private deposit and a real private withdrawal, both verifiable on-chain.
#
# Consumes the proofs already produced by circuits/scripts/build-slice.sh and the
# pool contract id written by deploy-slice.sh.
#
# COUPLING / ordering: the on-chain Merkle root after this single shield equals
# the withdraw proof's root, and the withdraw spends that note's nullifier. So
# this is ONE-SHOT per fresh deploy — re-running is a no-op (the nullifier is
# already spent) unless you redeploy. Use --force only after a fresh deploy.
#
# Requires: stellar-cli, jq, a populated deployment.json, and the deployer
# identity from deploy-slice.sh. Testnet only.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$HERE/../.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

UMBRA_NETWORK="${UMBRA_NETWORK:-testnet}"
UMBRA_DEPLOYER="${UMBRA_DEPLOYER:-umbra-deployer}"
EXPLORER_BASE="${UMBRA_EXPLORER_BASE:-https://stellar.expert/explorer/testnet}"
DEPLOYMENT_JSON="$HERE/deployment.json"
BUILD="$ROOT_DIR/circuits/build"

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

step() { printf '\n==> %s\n' "$*"; }
ok()   { printf 'OK   %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*" >&2; }
fail() {
  printf '\nPREFLIGHT FAILED: %s\n' "$1" >&2
  if [ -n "${2:-}" ]; then
    printf '  run this to fix it:\n\n      %s\n\n' "$2" >&2
  fi
  exit 1
}

extract_txhash() {
  local h
  h="$(grep -oiE 'tx/[0-9a-f]{64}' "$1" 2>/dev/null | grep -oiE '[0-9a-f]{64}' | head -n1 || true)"
  [ -z "$h" ] && h="$(grep -oiE 'transaction[^0-9a-f]*[0-9a-f]{64}' "$1" 2>/dev/null | grep -oiE '[0-9a-f]{64}' | head -n1 || true)"
  [ -z "$h" ] && h="$(grep -oiE '[0-9a-f]{64}' "$1" 2>/dev/null | head -n1 || true)"
  printf '%s' "$h"
}

# Invoke the pool contract, surface CLI logs, and set LAST_TX_HASH from the logs.
# Usage: invoke_pool -- <fn> --arg val ...
invoke_pool() {
  local logf
  logf="$(mktemp)"
  if ! stellar contract invoke --id "$POOL" \
         --source-account "$UMBRA_DEPLOYER" --network "$UMBRA_NETWORK" "$@" >/dev/null 2>"$logf"; then
    cat "$logf" >&2
    rm -f "$logf"
    return 1
  fi
  cat "$logf" >&2
  LAST_TX_HASH="$(extract_txhash "$logf" "")"
  rm -f "$logf"
}

preflight() {
  step "preflight checks"

  command -v stellar >/dev/null 2>&1 || fail \
    "stellar CLI not on PATH" \
    "brew install stellar-cli      # or: cargo install --locked stellar-cli"
  command -v jq >/dev/null 2>&1 || fail "jq not installed" "brew install jq"

  [ -f "$DEPLOYMENT_JSON" ] || fail \
    "no deployment.json — deploy the pool first" \
    "bash infra/deploy/deploy-slice.sh"

  POOL="$(jq -r '.contractIds.pool // ""' "$DEPLOYMENT_JSON" 2>/dev/null || echo "")"
  [ -n "$POOL" ] && [ "$POOL" != "null" ] || fail \
    "deployment.json has no pool contract id — deploy the pool first" \
    "bash infra/deploy/deploy-slice.sh"

  local f
  for f in shield_soroban.json withdraw_soroban.json; do
    [ -f "$BUILD/$f" ] || fail \
      "missing circuit fixture $BUILD/$f" \
      "bash circuits/scripts/build-slice.sh"
  done

  DEPLOYER_ADDR="$(stellar keys address "$UMBRA_DEPLOYER" 2>/dev/null || true)"
  [ -n "$DEPLOYER_ADDR" ] || fail \
    "deployer identity '$UMBRA_DEPLOYER' does not exist in the stellar keystore" \
    "stellar keys generate $UMBRA_DEPLOYER --network testnet --fund"

  ok "preflight passed — pool $POOL, deployer $UMBRA_DEPLOYER = $DEPLOYER_ADDR"
}

main() {
  preflight

  # idempotency: don't double-submit (the nullifier would already be spent)
  if [ "$FORCE" -eq 0 ]; then
    local prev
    prev="$(jq -r '.shieldTx // ""' "$DEPLOYMENT_JSON" 2>/dev/null || echo "")"
    if [ -n "$prev" ] && [ "$prev" != "null" ]; then
      ok "demo txs already captured (shieldTx=$prev)"
      printf '     re-run with --force only after a fresh deploy-slice.sh --force\n\n'
      jq '{shieldTx, withdrawTx, shieldExplorerUrl, withdrawExplorerUrl}' "$DEPLOYMENT_JSON"
      exit 0
    fi
  fi

  local depositor="$DEPLOYER_ADDR"
  # C1: the withdraw proof is bound to its payout address — `recipient == field(to)`. The
  # committed fixture is bound to this payee (see circuits/scripts/gen-fixtures.ts and
  # contracts/umbra-pool/src/test.rs), so the demo withdrawal MUST pay exactly this address
  # or the contract rejects it (Error::RecipientMismatch). It is a contract address; the
  # native SAC credits it without a trustline.
  local payee="CCG4XWI5PQXJ22L6PCCFJU5YTPFDI7EBJKSVQ4WMI45DIHG4UPHOSIXG"

  step "shield 1000 (real private deposit)"
  local shield_proof commitment
  shield_proof="$(jq -c '.proof' "$BUILD/shield_soroban.json")"
  # stellar-cli takes BytesN args as bare hex (no 0x prefix).
  commitment="$(jq -r '.publicInputs[0]' "$BUILD/shield_soroban.json")"
  invoke_pool -- shield \
    --proof "$shield_proof" --commitment "$commitment" --amount 1000 --depositor "$depositor" \
    || fail "shield invocation failed (see stellar output above)" ""
  SHIELD_TX="${LAST_TX_HASH:-}"
  ok "shield tx: ${SHIELD_TX:-<no hash parsed>}"

  step "withdraw 1000 -> bound payee (real private withdrawal; proof bound to the payout address — C1)"
  local w_proof root nullifier recipient
  w_proof="$(jq -c '.proof' "$BUILD/withdraw_soroban.json")"
  root="$(jq -r '.publicInputs[0]' "$BUILD/withdraw_soroban.json")"
  nullifier="$(jq -r '.publicInputs[1]' "$BUILD/withdraw_soroban.json")"
  recipient="$(jq -r '.publicInputs[2]' "$BUILD/withdraw_soroban.json")"
  invoke_pool -- withdraw \
    --proof "$w_proof" --root "$root" --nullifier "$nullifier" \
    --recipient "$recipient" --amount 1000 --to "$payee" \
    || fail "withdraw invocation failed (see stellar output above)" ""
  WITHDRAW_TX="${LAST_TX_HASH:-}"
  ok "withdraw tx: ${WITHDRAW_TX:-<no hash parsed>}"

  step "append demo txs to deployment.json"
  local now shield_url withdraw_url tmp
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  [ -n "$SHIELD_TX" ]   && shield_url="$EXPLORER_BASE/tx/$SHIELD_TX"     || shield_url=""
  [ -n "$WITHDRAW_TX" ] && withdraw_url="$EXPLORER_BASE/tx/$WITHDRAW_TX" || withdraw_url=""
  tmp="$(mktemp)"
  jq \
    --arg sTx  "$SHIELD_TX" \
    --arg wTx  "$WITHDRAW_TX" \
    --arg sUrl "$shield_url" \
    --arg wUrl "$withdraw_url" \
    --arg now  "$now" \
    '. + {
       shieldTx: $sTx,
       withdrawTx: $wTx,
       shieldExplorerUrl: $sUrl,
       withdrawExplorerUrl: $wUrl,
       demoCapturedAt: $now
     }' "$DEPLOYMENT_JSON" > "$tmp" && mv "$tmp" "$DEPLOYMENT_JSON"

  ok "updated $DEPLOYMENT_JSON"
  echo
  jq '{shieldTx, withdrawTx, shieldExplorerUrl, withdrawExplorerUrl}' "$DEPLOYMENT_JSON"

  if [ -z "$SHIELD_TX" ] || [ -z "$WITHDRAW_TX" ]; then
    warn "one or both tx hashes could not be parsed from the CLI output."
    warn "the transactions DID submit — find the hashes on the explorer for the deployer"
    warn "account and fill them into deployment.json by hand if needed:"
    warn "  $EXPLORER_BASE/account/$DEPLOYER_ADDR"
  fi
}

main "$@"
