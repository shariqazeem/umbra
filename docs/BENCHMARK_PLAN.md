# Umbra — Phase 0 Benchmark Plan

> This is infrastructure, not a demo. Phase 0 exists to **reduce technical
> uncertainty before product code is written**. Every load-bearing assumption from
> `FEASIBILITY_REVIEW.md` is turned into an executable, pass/fail benchmark with a
> reproducible output. No UI, no wallet, no invoices — only measurement.

```
pnpm benchmark            # run every benchmark the environment supports
pnpm benchmark:list       # list benchmarks + criteria, run nothing
pnpm benchmark -- --filter=B01,B02
pnpm benchmark -- --only=node     # only benchmarks needing nothing but Node
pnpm benchmark:json       # machine-readable report on stdout
```

Exit code is non-zero **iff** any benchmark FAILs or ERRORs. A benchmark whose
toolchain is absent is **SKIP** (never a failure) and prints the exact command to
enable it. Reports are written to `infra/benchmarks/results/{latest.json,latest.md}`.

## Capability model

A benchmark only runs when its required capabilities are present; otherwise it is
skipped with an actionable hint. This is what keeps the harness **honest about what
it actually measured**.

| Capability | Detected by | Needed for |
|------------|-------------|-----------|
| `node` | always | B01, B02 |
| `snarkjs` | module resolves | B03 |
| `circuit-artifacts` | `circuits/build/*` present | B03, B04, B05, B06 |
| `circom` | `circom --version` | building artifacts (`circuits/scripts/run-all.sh`) |
| `cargo` | `cargo --version` | B07, B08 |
| `stellar-cli` | `stellar version` | B04, B05, B06 |
| `testnet` | `UMBRA_RPC_URL` + passphrase + source secret | B04, B05, B06 |

## The benchmarks

Each maps to one Phase-0 objective and declares — in code, surfaced in the report —
its purpose, success criteria, failure criteria, measurement method, and output.

### B01 · Poseidon over BLS12-381 Fr — configuration validity → *objective 5*
- **Purpose.** Prove Poseidon is instantiated over the correct field (BLS12-381 Fr,
  **not** BN254 — the silent-insecurity risk in FEASIBILITY §2), is deterministic,
  and diffuses well.
- **Success.** Fr modulus == canonical r; width 255 bits; all round constants & MDS
  entries ∈ Fr; param generation deterministic; hashing deterministic; a 1-bit input
  change flips ≥96 of 255 output bits.
- **Failure.** Edited/wrong modulus; 254-bit width; any constant out of field;
  non-determinism; weak diffusion.
- **Measurement.** Direct constant comparison; regenerate params twice; hash twice;
  avalanche over 64 single-bit perturbations.
- **Output.** Booleans + diffusion stats; canonical Poseidon vectors as evidence
  (the regression baseline the Circom witness must reproduce).
- **Runs in:** Node (always).

### B02 · snarkjs ↔ Soroban serialization round-trip → *objective 2 (prerequisite)*
- **Purpose.** Validate the byte encodings the verifier and circuits depend on:
  96-byte G1, 192-byte G2 (uncompressed BE), 32-byte Fr, and the 2×128-bit
  address-limb split. A silent mismatch makes every on-chain verification fail.
- **Success.** Every point/scalar/address round-trips equal; G1 **and** G2 bytes
  match @noble's uncompressed encoding (flag bits cleared = the IETF/host layout);
  each address limb < 2¹²⁸ < r.
- **Failure.** Any round-trip inequality; layout disagrees with noble; limb ≥ r.
- **Measurement.** Encode→decode curve points/scalars and compare; cross-check raw
  coordinate bytes against @noble; split/rejoin random 32-byte addresses.
- **Output.** Booleans per structure + byte lengths.
- **Runs in:** Node (always). *This benchmark already caught a real bug: the Fp2
  (c0/c1) coordinate order for G2 was reversed vs. the IETF/host layout.*

### B03 · Groth16/BLS12-381 proof generation end-to-end → *objective 1*
- **Purpose.** A real proof is generated over BLS12-381 from a Circom circuit and
  verified off-chain; measure proving latency (the desktop-only constraint, FEAS §5).
- **Success.** `fullProve` → `verify` accepts; curve == bls12381; median latency
  within the desktop budget (< 10s for the membership circuit).
- **Failure.** Proof rejected; wrong curve; proving errors or exceeds budget.
- **Measurement.** `snarkjs.groth16.fullProve` over 5 samples (witness+prove timed);
  `snarkjs.groth16.verify`; curve read from the vk.
- **Output.** Latency stats (median/p95/min/max ms), verify result, curve, proof size.
- **Runs in:** snarkjs + circuit-artifacts (build via `circuits/scripts/run-all.sh`).

### B04 · Groth16/BLS12-381 verification inside a Soroban contract → *objective 2*
- **Purpose.** The load-bearing claim: a real proof verifies **inside a Soroban
  contract on testnet** via the CAP-0059 host functions. Ground truth for B02/B03.
- **Success.** Verifier returns **true** for a valid proof **and false** for a
  tampered proof (soundness sanity), with no host error.
- **Failure.** Host error (bad encoding / off-curve), false on a valid proof, or true
  on a tampered proof.
- **Measurement.** `infra/deploy/run-verification.sh --valid` and `--tampered` deploy
  (or reuse) the verifier and invoke `verify`; a JSON result line is parsed.
- **Output.** valid_accepted, tampered_rejected, contract id, mode.
- **Runs in:** stellar-cli + testnet + circuit-artifacts.

### B05 · Instruction consumption → *objective 3*
- **Purpose.** Quantify the central risk (FEAS §1): the composite transaction
  (verify ~40M + MSM + SAC transfers + storage) must fit 100M and practically stay
  under ~80M.
- **Success.** CPU instructions < 80,000,000 (ideally < 70,000,000).
- **Failure.** ≥ 80,000,000 (no headroom for the real withdraw) or ≥ 100,000,000.
- **Measurement.** `infra/deploy/measure-resources.sh` reports cpu_insns from the
  simulation/tx cost.
- **Output.** cpu_instructions (absolute + % of 100M), headroom to the practical wall.
- **Runs in:** stellar-cli + testnet + circuit-artifacts.

### B06 · Transaction resource usage → *objective 4*
- **Purpose.** Confirm ledger-entry counts sit inside the per-tx limits and quantify
  fees incl. nullifier rent (the storage-cost questions, FEAS §6).
- **Success.** read entries ≤ 100, write entries ≤ 50; fees reported.
- **Failure.** entries exceed the per-tx limits, or resource usage unreadable.
- **Measurement.** Same script reports footprint entry counts, R/W bytes, resource &
  rent fees.
- **Output.** read/write entries vs limits, R/W bytes, resource fee, rent fee.
- **Runs in:** stellar-cli + testnet + circuit-artifacts.

### B07 · Nullifier storage behavior → *objective 6*
- **Purpose.** Validate the spent-nullifier set against the real Soroban storage
  semantics (persistent entries), natively — no testnet needed.
- **Success.** All `nullifier` tests pass: spent reads spent, absent reads unspent,
  double-insert rejected, spend-before-init rejected.
- **Failure.** Any nullifier-storage test fails or the contract won't build.
- **Measurement.** `cargo test -p bench-pool nullifier` against the soroban-sdk host.
- **Output.** tests passed/failed, cargo exit code.
- **Runs in:** cargo.

### B08 · Replay / double-spend protection → *objective 7*
- **Purpose.** The security-critical assumption: a spend cannot be replayed; domain
  separation rejects cross-deployment proofs.
- **Success.** All `replay` tests pass: second spend rejected, cross-domain proof
  rejected.
- **Failure.** Any replay test fails — a double-spend or cross-deployment replay
  succeeds (fund-loss-class defect).
- **Measurement.** `cargo test -p bench-pool replay` against the soroban-sdk host.
- **Output.** tests passed/failed, cargo exit code.
- **Runs in:** cargo. *Archival-replay (TTL-lapse → restore → re-spend) is only
  partially observable in the test host; the testnet hardening lives in infra/deploy.*

### Objective 8 · Reproducible results
Satisfied by the harness itself: deterministic ordering, a per-run id, a capability
matrix recorded in every report, and JSON+Markdown written to
`infra/benchmarks/results/`. Same environment → same verdicts.

## Building the toolchain-gated benchmarks

```
# Circuits (B03) and the on-chain artifacts (B04–B06):
#   needs circom 2.2.x (bls12381) + snarkjs
bash circuits/scripts/run-all.sh

# On-chain (B04–B06): needs the stellar CLI and a funded testnet key
cp infra/deploy/.env.example .env && $EDITOR .env
cargo install --locked stellar-cli   # if not present

# Contract logic (B07, B08): needs cargo (Rust)
pnpm benchmark -- --filter=B07,B08
```

## Baseline result on the reference machine (darwin-arm64, node 22)

With only Node + cargo present (no circom/stellar-cli/testnet):

| ID | Status | Note |
|----|--------|------|
| B01 | **PASS** | Fr modulus verified; 195 t=3 constants; avalanche avg 126.7/255 |
| B02 | **PASS** | G1/G2/Fr/limbs round-trip; G2 fp2 order fixed to match the host layout |
| B03 | SKIP | needs `circuit-artifacts` (`circuits/scripts/run-all.sh`) |
| B04 | SKIP | needs `stellar-cli` + `testnet` + `circuit-artifacts` |
| B05 | SKIP | needs `stellar-cli` + `testnet` + `circuit-artifacts` |
| B06 | SKIP | needs `stellar-cli` + `testnet` + `circuit-artifacts` |
| B07 | **PASS** | 5 nullifier-storage tests green against the soroban-sdk host |
| B08 | **PASS** | 3 replay/domain-separation tests green |

The four gated benchmarks are not failures — they are the work a developer enables by
installing the corresponding toolchain. The two highest-value uncertainties that can
be settled **without any blockchain** (Poseidon-over-BLS correctness and the
serialization the whole verifier depends on) are settled here, now, green.

## What remains uncertain after a full green run

A full-green Phase 0 still does **not** prove: the *composite* withdraw transaction
budget under real SAC transfers (B05 measures verify-shape; extend to the withdraw
shape); archival-replay across the live TTL lifecycle (B08 covers the logic, not the
ledger archival lifecycle); browser/mobile proving (B03 measures the local Node
prover, not a constrained browser). These are tracked as the residual risks in the
final report and the implementation plan.
