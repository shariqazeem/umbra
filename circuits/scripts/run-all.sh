#!/usr/bin/env bash
# Build the benchmark circuits end-to-end over BLS12-381 and emit every artifact the
# harness needs:
#   - <circuit>.wasm + <circuit>_final.zkey + <circuit>_vkey.json   (B03 proving)
#   - <circuit>_input.json + <circuit>_proof.json + <circuit>_public.json
#   - <circuit>_soroban.json   (vk + proof in Soroban point bytes, for B04 on-chain)
#
# Requires: circom 2.2.x (compiled with the bls12381 feature) and snarkjs.
# This runs a SMALL, single-contributor ceremony — DEMO-ONLY, never for mainnet keys
# (see FEASIBILITY_REVIEW.md §3).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUITS_DIR="$(cd "$HERE/.." && pwd)"
ROOT_DIR="$(cd "$CIRCUITS_DIR/.." && pwd)"
SRC="$CIRCUITS_DIR/src"
BUILD="$CIRCUITS_DIR/build"
POT_POWER="${POT_POWER:-15}"

command -v circom >/dev/null || { echo "ERROR: circom not on PATH (see circuits/README.md)"; exit 1; }
SNARKJS="${SNARKJS:-npx snarkjs}"

mkdir -p "$BUILD"
cd "$BUILD"

echo "==> [0/6] Regenerating Poseidon constants (TS == Circom, by construction)"
( cd "$ROOT_DIR" && corepack pnpm --filter @umbra/crypto-bls run gen:constants )

echo "==> [1/6] Powers of Tau (BLS12-381, power=$POT_POWER) — DEMO ceremony"
if [ ! -f "pot_final.ptau" ]; then
  $SNARKJS powersoftau new bls12381 "$POT_POWER" pot_0.ptau -v
  $SNARKJS powersoftau contribute pot_0.ptau pot_1.ptau --name="umbra-demo" -v -e="$(head -c 64 /dev/urandom | base64)"
  $SNARKJS powersoftau prepare phase2 pot_1.ptau pot_final.ptau -v
fi

build_circuit () {
  local NAME="$1"
  echo "==> [2/6] Compiling $NAME (--prime bls12381)"
  circom "$SRC/$NAME.circom" --r1cs --wasm --prime bls12381 -o "$BUILD" -l "$SRC"

  echo "==> [3/6] Groth16 setup for $NAME"
  $SNARKJS groth16 setup "$NAME.r1cs" pot_final.ptau "${NAME}_0.zkey"
  $SNARKJS zkey contribute "${NAME}_0.zkey" "${NAME}_final.zkey" --name="umbra-demo" -v -e="$(head -c 64 /dev/urandom | base64)"
  $SNARKJS zkey export verificationkey "${NAME}_final.zkey" "${NAME}_vkey.json"
}

build_circuit bench_hash
build_circuit bench_membership

echo "==> [4/6] Writing sample inputs"
node -e '
const fs = require("fs");
fs.writeFileSync("bench_hash_input.json", JSON.stringify({ a: "3", b: "5" }));
const depth = 20;
const pathElements = Array.from({length: depth}, (_, i) => String(i + 2));
const pathIndices = Array.from({length: depth}, (_, i) => String(i % 2));
fs.writeFileSync("bench_membership_input.json", JSON.stringify({ leaf: "1", pathElements, pathIndices }));
'

echo "==> [5/6] Generating witnesses + proofs"
for NAME in bench_hash bench_membership; do
  node "${NAME}_js/generate_witness.js" "${NAME}_js/${NAME}.wasm" "${NAME}_input.json" "${NAME}.wtns"
  $SNARKJS groth16 prove "${NAME}_final.zkey" "${NAME}.wtns" "${NAME}_proof.json" "${NAME}_public.json"
  $SNARKJS groth16 verify "${NAME}_vkey.json" "${NAME}_public.json" "${NAME}_proof.json"
done

echo "==> [6/6] Exporting vk + proof to Soroban point bytes (for B04)"
( cd "$ROOT_DIR" && corepack pnpm --filter @umbra/benchmarks exec tsx "$CIRCUITS_DIR/scripts/export-soroban.ts" bench_hash )

echo
echo "Artifacts ready under $BUILD — rerun: pnpm benchmark"
