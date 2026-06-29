# Umbra benchmark circuits

Circom 2 circuits over **BLS12-381** used by the Phase-0 harness. These are
benchmark circuits (pipeline + latency), not the production shield/withdraw circuits.

## Contents

| File | Purpose |
|------|---------|
| `src/poseidon/poseidon.circom` | Poseidon t=3 over BLS12-381 Fr (canonical formulation) |
| `src/poseidon/poseidon_constants_t{2,3,5}.circom` | **auto-generated** constants — do not edit |
| `src/bench_hash.circom` | tiny circuit: prove `Poseidon(a,b)=hash` (pipeline floor, B03; proof/vk for B04) |
| `src/bench_membership.circom` | depth-20 Poseidon Merkle inclusion (realistic withdraw shape, B03) |
| `scripts/run-all.sh` | compile → BLS12-381 ceremony → setup → prove → export to Soroban bytes |
| `scripts/export-soroban.ts` | snarkjs vk/proof → Soroban 96/192-byte point layout (for B04) |

## The Poseidon constant rule (read this)

circomlib's Poseidon constants are **BN254-specific** and are silently insecure over
BLS12-381 (FEASIBILITY_REVIEW.md §2). Umbra therefore defines its own parameter set,
generated once by `@umbra/crypto-bls` and consumed by **both** the TypeScript wallet
code and these circuits:

```
pnpm --filter @umbra/crypto-bls run gen:constants
```

This writes `poseidon_constants_t{2,3,5}.circom` (here) and matching JSON. Because
circom and TS read the **same** generated numbers, agreement is by construction;
B01 validates the TS side and the circom witness is checked against B01's canonical
vectors when circom is installed.

## Build

Requires Circom 2.2.x built with the `bls12381` feature, and snarkjs (already a
workspace dependency).

```
# install circom (one option)
cargo install --git https://github.com/iden3/circom.git --tag v2.2.1

bash scripts/run-all.sh        # produces everything under circuits/build/
pnpm benchmark -- --filter=B03 # now runs
```

Artifacts land in `circuits/build/` (git-ignored, CI-rebuilt). The ceremony run by
`run-all.sh` is a **single-contributor demo** — never use those keys for mainnet
(FEASIBILITY_REVIEW.md §3).
