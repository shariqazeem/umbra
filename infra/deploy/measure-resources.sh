#!/usr/bin/env bash
# B05/B06 driver: measure the resource consumption of an on-chain verification via
# the RPC simulation cost report. Prints a JSON line with cpuInsns + footprint.
#
# NOTE: the exact field names in `stellar contract invoke --cost` output vary by CLI
# version; this parses the simulated cost. Confirm against your installed CLI and
# adjust the grep/jq below if needed. The withdraw-shaped number (verify + SAC
# transfers + storage) is the figure that matters for FEASIBILITY_REVIEW.md §1 — set
# UMBRA_SOROBAN_ARTIFACT / contract accordingly to measure the full shape.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$HERE/_common.sh"

SOROBAN_JSON="$BUILD_DIR/${ARTIFACT}_soroban.json"
[ -f "$SOROBAN_JSON" ] || { emit_json '{"error":"missing soroban artifact; run circuits/scripts/run-all.sh"}'; exit 0; }
CID="$(ensure_verifier)"
ARGDIR="$BUILD_DIR/_args"
mkdir -p "$ARGDIR"
node -e '
const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const d=process.argv[2];
fs.writeFileSync(d+"/vk.json",JSON.stringify(j.vk));
fs.writeFileSync(d+"/proof.json",JSON.stringify(j.proof));
fs.writeFileSync(d+"/pub.json",JSON.stringify(j.publicInputs));
' "$SOROBAN_JSON" "$ARGDIR"

# Run with cost reporting. Capture stderr where the CLI prints the resource report.
COST_REPORT="$(stellar contract invoke --cost \
  --id "$CID" --source-account "$UMBRA_SOURCE_SECRET" "${stellar_net[@]}" \
  -- verify \
  --vk "$(cat "$ARGDIR/vk.json")" \
  --proof "$(cat "$ARGDIR/proof.json")" \
  --public_inputs "$(cat "$ARGDIR/pub.json")" 2>&1 || true)"

# Extract numbers. Field labels differ across CLI versions; try common ones.
extract () { echo "$COST_REPORT" | grep -iE "$1" | grep -oE '[0-9]+' | head -1; }
CPU="$(extract 'cpu.*insn|instructions')"
MEM="$(extract 'mem.*byte')"
RENTRIES="$(extract 'read.*entr|entries.*read')"
WENTRIES="$(extract 'write.*entr|entries.*write')"
RBYTES="$(extract 'read.*byte')"
WBYTES="$(extract 'write.*byte')"
FEE="$(extract 'resource.*fee|fee')"

emit_json "{\"shape\":\"verify-only:${ARTIFACT}\",\"cpuInsns\":${CPU:-0},\"memBytes\":${MEM:-0},\"readEntries\":${RENTRIES:-0},\"writeEntries\":${WENTRIES:-0},\"readBytes\":${RBYTES:-0},\"writeBytes\":${WBYTES:-0},\"resourceFeeStroops\":${FEE:-0}}"
