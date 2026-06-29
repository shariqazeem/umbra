# Umbra — Scope & Mainnet Path

_As of 2026-06-21. The honest-scope document: what is demo-grade, why, and the
explicit path to mainnet. This is the canonical source the README and the demo
video point to._

> Umbra ships a complete ZK pipeline — Circom circuits, BLS12-381 Groth16
> verification inside a Soroban contract, on-chain Poseidon tree. For the
> hackathon, two parameters are demo-grade: Merkle depth 8 (256-note capacity)
> and a single-contributor trusted setup. Both are isolated to two constants and
> one ceremony file. The mainnet path is explicit: depth-20 recompile (1M+
> notes), MPC trusted-setup ceremony via p0tion, external audit, multi-sig
> deployer, relayer for withdraw privacy. Productionizing is a parameter bump + a
> ceremony + an audit — not a redesign.

---

## What's real and proven today

The load-bearing cryptography is finished and adversarially tested — not stubbed,
not mocked.

`cargo test -p umbra-pool` → **5/5 pass with real snarkjs-generated Groth16 proofs
verified by the real BLS12-381 host functions** (the soroban-sdk test host runs the
same host code as testnet):

- happy path — shield → withdraw, recipient paid, nullifier spent
- **double-spend rejected**
- **invalid proof rejected** on-chain
- **wrong-recipient rejected** (recipient binding)
- on-chain Poseidon ≡ circuit Poseidon (cross-implementation oracle)

Supporting evidence: `bench-pool` 6/6; `crypto-bls` 13/13 (Rust ≡ circuit ≡ TS
Poseidon oracle); circuits compile and prove/verify end-to-end (`build-slice.sh`);
benchmarks B01/B02/B07/B08 pass.

What "proven" honestly means here: this runs in the **native test host** — a real
implementation, strong evidence — but it is **not** the same as a transaction
confirmed on public testnet. **The live-on-testnet evidence — one real shield and
one real withdraw with their stellar.expert explorer links — is the README's job
(item 6), sourced from `infra/deploy/deployment.json`.** This document does not
restate that link; it covers parameters and the path. If the README shows the two
transactions, they are real; if `deployment.json` is still PENDING, the deploy has
not been run yet — there are no fabricated hashes anywhere.

---

## Demo-grade parameters (and exactly why)

Two parameters — and only two — are set for a testnet demo rather than mainnet.
Each is isolated, each is fine for the demo for a concrete reason, and each has a
one-line fix that is config or ceremony, not a redesign.

### 1. Merkle depth 8 (256-note capacity)

- **What it is.** The on-chain Poseidon tree is depth 8 — a single `TREE_DEPTH`
  constant — giving 256-note capacity.
- **Why it's fine for a testnet demo.** It keeps `shield` (Groth16 verify + on-chain
  Poseidon insertion) inside the 100M-instruction/tx budget so the demo runs; a
  demo exercises a handful of notes, not millions.
- **The one-line fix.** Bump `TREE_DEPTH` to 20 and recompile → 1M+ note capacity
  (gate **G1**). The depth lives in a constant and the circuit; nothing else changes.

### 2. Single-contributor trusted setup

- **What it is.** The Groth16 proving/verifying keys come from a single-contributor
  demo ceremony — one zkey per circuit, one ceremony file.
- **Why it's fine for a testnet demo.** Testnet carries no real funds; the setup is
  fast and reproducible, and the proof system itself is identical to production.
- **The one-line fix.** Run a multi-party Phase-2 MPC ceremony via **p0tion** with a
  published, verifiable transcript, then retire the demo zkey (gate **G2**). It is
  coordination, not new code.

> **One test-harness caveat, named honestly:** the contract tests lift the
> conservative default host budget (`reset_unlimited`) to validate _logic_ — so the
> real per-tx testnet instruction cost of shield/withdraw is **not yet measured**.
> That measurement is gate **G4**, not a hidden assumption.

---

## Mainnet readiness gates

The credibility payload. Each gate is a single concern with a concrete done-when —
the cost is named, not hand-waved. G1, G2, G3, G5, and G7 are the mainnet path from
the opening frame; the rest are the production-readiness gaps from the architecture
review (FEASIBILITY_REVIEW §8). G7 and G9 already have isolated seams in the code.

| ID  | Gate | Done-when | Owner |
| --- | ---- | --------- | ----- |
| **G1** | Merkle depth-20 recompile | Circuits recompiled at depth 20; `TREE_DEPTH` + fixtures updated; all contract tests pass at depth 20 → 1M+ note capacity. | Circuits |
| **G2** | MPC trusted-setup ceremony | Multi-party Phase-2 ceremony run via p0tion with ≥N independent contributors and a published, verifiable transcript; single-contributor demo zkey retired. | Cryptography |
| **G3** | External security audit | Independent audit of the Circom circuits, `groth16-verifier`, and `umbra-pool` contract complete; all findings closed or risk-accepted in writing. | Security (external) |
| **G4** | Real instruction-budget proof | B03–B06 run on public testnet; `shield` and `withdraw` confirm within the 100M-instruction/tx budget **without** `reset_unlimited`; resource + fee model published. | Protocol |
| **G5** | Relayer for withdraw privacy | ≥2 independent relayers submit spends (fee bound in-proof, trusted for liveness only) so the fee-payer no longer deanonymizes the user; self-submit remains a fallback. | Infra |
| **G6** | Note discovery & recovery at scale | View-tag scanning + incremental sync shipped; indexer durability + a history-archive source cover note recovery beyond the RPC retention window. | Wallet |
| **G7** | Multi-sig deployer & upgrade governance | `UMBRA_DEPLOYER` is an M-of-N multi-sig controlling deploy + upgrade authority; key management and rotation documented. _(Seam in place: deployer is one config var.)_ | Infra |
| **G8** | Insertion throughput (batched) | Serialized `old_root == current` insertion replaced by Option Y / batched-insertion sequencer; contention/griefing benchmark passes at 10k-user load. | Protocol |
| **G9** | Frontend OpSec hardening | Strict CSP, no third-party scripts/analytics, referrer + dependency-integrity (SRI) policy enforced; build emits no external network calls. _(Seam in place: external links use `rel=noreferrer noopener` + `referrerPolicy=no-referrer`.)_ | Frontend |
| **G10** | Nullifier accumulator & rent funding | Perpetual-rent nullifier set replaced by an accumulator (on-chain root + in-circuit non-membership) or backed by a sustainable fee-funded endowment; state-growth liability bounded. | Protocol |
| **G11** | Recipient-binding ↔ payout-address coupling | The slice's deliberate decoupling is closed — the in-proof recipient field is cryptographically bound to the literal payout address. | Circuits |

---

## Closing

The hard part is done: a real Groth16 proof, verified by the real BLS12-381 host
functions inside a Soroban contract, with double-spend, invalid-proof, and
wrong-recipient all rejected on-chain. What stands between that and mainnet is a
**parameter bump (depth 20), a ceremony (MPC trusted setup), and an audit** — plus
the operational gates above, each with its cost named. None of it is a redesign of
the cryptography. That is the whole claim, and it is the honest one.
