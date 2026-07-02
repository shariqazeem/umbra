#!/usr/bin/env bash
# Build the SLICE circuits (shield, withdraw) end-to-end and produce the proof
# fixtures the contract tests consume:
#   circuits/build/{shield,withdraw}_{final.zkey,vkey.json,proof.json,public.json,soroban.json}
#
# DEMO ceremony (single contributor) — never for mainnet keys.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUITS_DIR="$(cd "$HERE/.." && pwd)"
ROOT_DIR="$(cd "$CIRCUITS_DIR/.." && pwd)"
SRC="$CIRCUITS_DIR/src"
BUILD="$CIRCUITS_DIR/build"
POT_POWER="${POT_POWER:-15}"
SNARKJS="${SNARKJS:-npx --yes snarkjs}"
rand() { head -c 64 /dev/urandom | base64; }

command -v circom >/dev/null || { echo "circom not on PATH"; exit 1; }
mkdir -p "$BUILD"

echo "==> regenerate Poseidon constants + slice inputs"
( cd "$ROOT_DIR" && corepack pnpm --filter @umbra/crypto-bls run gen:constants >/dev/null )
( cd "$ROOT_DIR" && corepack pnpm exec tsx "$CIRCUITS_DIR/scripts/gen-fixtures.ts" )

cd "$BUILD"
if [ ! -f pot_final.ptau ]; then
  echo "==> Powers of Tau (bls12381, power=$POT_POWER)"
  $SNARKJS powersoftau new bls12381 "$POT_POWER" pot_0.ptau -v
  $SNARKJS powersoftau contribute pot_0.ptau pot_1.ptau --name="umbra-demo" -e="$(rand)" -v
  $SNARKJS powersoftau prepare phase2 pot_1.ptau pot_final.ptau -v
fi

for NAME in shield withdraw transfer claim; do
  echo "==> $NAME: compile + setup + prove + export"
  [ -f "$NAME.r1cs" ] || circom "$SRC/$NAME.circom" --r1cs --wasm --prime bls12381 -o "$BUILD" -l "$SRC"
  $SNARKJS groth16 setup "$NAME.r1cs" pot_final.ptau "${NAME}_0.zkey"
  $SNARKJS zkey contribute "${NAME}_0.zkey" "${NAME}_final.zkey" --name="umbra-demo" -e="$(rand)" -v
  $SNARKJS zkey export verificationkey "${NAME}_final.zkey" "${NAME}_vkey.json"
  # Use snarkjs to compute the witness (circom's generate_witness.js is CommonJS and
  # breaks under this repo's "type":"module"; snarkjs wtns calculate takes the wasm directly).
  $SNARKJS wtns calculate "${NAME}_js/${NAME}.wasm" "${NAME}_input.json" "${NAME}.wtns"
  $SNARKJS groth16 prove "${NAME}_final.zkey" "${NAME}.wtns" "${NAME}_proof.json" "${NAME}_public.json"
  $SNARKJS groth16 verify "${NAME}_vkey.json" "${NAME}_public.json" "${NAME}_proof.json"
  ( cd "$ROOT_DIR" && corepack pnpm exec tsx "$CIRCUITS_DIR/scripts/export-soroban.ts" "$NAME" )
done

# Full-exit withdraw fixture (has_change = 0): the SAME withdraw circuit + proving key, a
# different witness. Pins the Critical #1 fix (a note can be fully withdrawn even at a full tree).
echo "==> withdraw_exit: full-exit witness (has_change=0)"
$SNARKJS wtns calculate "withdraw_js/withdraw.wasm" "withdraw_exit_input.json" "withdraw_exit.wtns"
$SNARKJS groth16 prove "withdraw_final.zkey" "withdraw_exit.wtns" "withdraw_exit_proof.json" "withdraw_exit_public.json"
$SNARKJS groth16 verify "withdraw_vkey.json" "withdraw_exit_public.json" "withdraw_exit_proof.json"
cp withdraw_vkey.json withdraw_exit_vkey.json   # identical verifying key to withdraw
( cd "$ROOT_DIR" && corepack pnpm exec tsx "$CIRCUITS_DIR/scripts/export-soroban.ts" withdraw_exit )

echo
echo "Slice fixtures ready under $BUILD: shield_soroban.json, withdraw_soroban.json"
