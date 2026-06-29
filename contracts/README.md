# Umbra benchmark contracts

Soroban (Rust) contracts for Phase-0 validation. A Cargo workspace, pinned to a
Protocol-22 `soroban-sdk` (CAP-0059 BLS12-381 host functions).

| Crate | Responsibility | Validated by |
|-------|----------------|--------------|
| `groth16-verifier` | Groth16 verification over BLS12-381 (G1 MSM + 4-term `pairing_check`); subgroup checks are host-automatic | **B04** on testnet |
| `bench-pool` | Spent-nullifier set, domain separation, double-spend rejection — the storage/replay core, no BLS | **B07/B08** natively |

## Why the split

`bench-pool` deliberately contains **no** BLS so its security-critical state machine
(nullifiers, replay, domain separation) runs natively against the soroban-sdk test
host — no testnet, no proving — and is green before any product code exists. The
BLS-heavy `groth16-verifier` is validated where it must be: **on testnet** (B04),
because the host functions are the thing under test.

## Run the native tests (B07/B08)

```
cd contracts
cargo test -p bench-pool              # all
cargo test -p bench-pool nullifier    # B07
cargo test -p bench-pool replay       # B08
```

## Build / deploy the verifier (B04)

```
cargo install --locked stellar-cli
stellar contract build                # → target/wasm32-unknown-unknown/release/groth16_verifier.wasm
# deployment + invocation are driven by infra/deploy/run-verification.sh
```

## Verification equation (groth16-verifier)

```
e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
vk_x = IC[0] + Σ pub_i · IC[i]          # one G1 MSM
```

Cost is **constant in circuit size** (~40M instructions, FEASIBILITY §1); only the
public-input count affects the MSM term. The verifying key is supplied per call here
for benchmarking; the production pool pins it at init.

> The `groth16-verifier` BLS host-function API surface is pinned to `soroban-sdk`
> 22.0.x. Confirm against your target testnet protocol; B04 is the ground-truth check.
