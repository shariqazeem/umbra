#!/usr/bin/env bash
# B04 driver: verify a real Groth16 proof INSIDE the Soroban verifier contract on
# testnet. Prints a JSON result line: {"verified":bool,"contractId":...,"txHash":...}
#
#   run-verification.sh --valid      # genuine proof  → expect verified:true
#   run-verification.sh --tampered   # corrupted proof → expect verified:false
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$HERE/_common.sh"

MODE="${1:---valid}"
SOROBAN_JSON="$BUILD_DIR/${ARTIFACT}_soroban.json"
[ -f "$SOROBAN_JSON" ] || { emit_json '{"verified":false,"error":"missing '"$ARTIFACT"'_soroban.json; run circuits/scripts/run-all.sh"}'; exit 0; }

CID="$(ensure_verifier)"
ARGDIR="$BUILD_DIR/_args"
mkdir -p "$ARGDIR"

# Materialize CLI args from the exported Soroban bytes. For --tampered, flip one
# byte of the proof's A point so verification MUST fail (soundness sanity check).
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const mode=process.argv[2];
const proof={...j.proof};
if(mode==="--tampered"){
  const b=Buffer.from(proof.a,"hex"); b[40]^=0x01; proof.a=b.toString("hex");
}
const dir=process.argv[3];
fs.writeFileSync(dir+"/vk.json", JSON.stringify(j.vk));
fs.writeFileSync(dir+"/proof.json", JSON.stringify(proof));
fs.writeFileSync(dir+"/pub.json", JSON.stringify(j.publicInputs));
' "$SOROBAN_JSON" "$MODE" "$ARGDIR"

# Invoke the contract. The verifier returns "true"/"false".
RESULT="$(stellar contract invoke \
  --id "$CID" --source-account "$UMBRA_SOURCE_SECRET" "${stellar_net[@]}" \
  -- verify \
  --vk "$(cat "$ARGDIR/vk.json")" \
  --proof "$(cat "$ARGDIR/proof.json")" \
  --public_inputs "$(cat "$ARGDIR/pub.json")" 2>/dev/stderr | tr -d '"[:space:]')"

VERIFIED=false
[ "$RESULT" = "true" ] && VERIFIED=true
emit_json "{\"verified\":$VERIFIED,\"contractId\":\"$CID\",\"mode\":\"${MODE#--}\"}"
