# Umbra — Project Overview

> The complete picture: the idea, the product, how it works, and exactly what has
> been built so far (with honest status on every piece). This is the single document
> to read to understand the whole project.

**Tagline:** *Get paid privately on Stellar.*
**Hackathon:** Stellar Hacks — Real-World ZK (submission deadline 2026-06-29).
**Status (2026-06-21):** core protocol implemented and tested with real proofs;
premium product UI implemented and building; not yet deployed to testnet, not yet
recorded as a demo.

---

## 1. The idea (the vision)

Umbra is a **private finance layer for Stellar** where zero-knowledge cryptography is
**load-bearing** — money literally cannot move without a proof that a Stellar smart
contract verifies on-chain. It is built to feel like a **real financial product**
(Stripe/Linear/Apple quality), not a cryptography demo.

The original goal: a first-place-quality Stellar Hacks submission that uses ZK in a
meaningful way and **verifies the proofs inside a Soroban smart contract** — using
Circom circuits, Groth16 proofs, snarkjs, a Next.js + TypeScript frontend, and a
premium white design.

The original capability set was: **shield** assets into a privacy pool, **transfer**
privately, create private **invoices**, and **receive private payments.**

### The product wedge it became

Through the build we sharpened that broad vision into one unforgettable product:

> **Private Payment Links.**
> Create a payment link → share it with anyone → they pay → you withdraw privately.
> The blockchain can see a deposit and a withdrawal, but **cannot connect them.**

This is the Stripe-payment-link pattern, made private by zero-knowledge proofs on
Stellar. It turns "privacy infrastructure" into a product a non-technical person
understands in five seconds — for freelancers, creators, NGOs, and anyone who wants to
be paid without the whole chain watching.

---

## 2. How it works (in plain language)

1. **A note is private money.** When funds enter the pool, they become a *note* —
   a sealed commitment `Poseidon(secret, amount)`. Whoever holds the `secret` owns it.
2. **Shielding** puts public funds into the pool under a commitment. A small ZK proof
   guarantees the commitment really holds the deposited amount.
3. **Withdrawing** spends a note. A ZK proof proves, without revealing which note:
   that the note is in the pool (Merkle inclusion), that you own it, a one-time
   **nullifier** so it can't be spent twice, the **recipient** is bound into the proof,
   and the amount is conserved. The Soroban contract **verifies that proof on-chain**
   and only then releases funds.
4. **Privacy** comes from the pool: a withdrawal can't be linked to the deposit that
   funded it (mixer anonymity). On-chain an observer sees a deposit and a withdrawal —
   never the line between them.
5. **A payment link is a pre-authorized shield.** The recipient generates the note
   secret and the shield proof *at link-creation time*; the link carries the commitment
   and the proof but **never the secret**. The payer simply funds it. Only the
   recipient — the sole holder of the secret — can ever withdraw.

---

## 3. The keystone technical decisions

These are the choices everything else depends on (full reasoning in
`docs/ARCHITECTURE.md` and `docs/FEASIBILITY_REVIEW.md`):

| Decision | Why |
|----------|-----|
| **BLS12-381** (not BN254) | Soroban (Protocol 22, CAP-0059) ships **native BLS12-381 host functions** — the only pairing-friendly curve with a real on-chain verifier on Stellar. BN254 has no host support. snarkjs + Circom both target BLS12-381. |
| **Groth16** | Constant 3–4-pairing verification maps onto Soroban's `bls12_381_multi_pairing_check` in one host call. ~40M instructions ≈ 40% of the 100M tx budget (measured by Stellar's own privacy-pools prototype). |
| **Poseidon over BLS12-381 Fr** | ZK-friendly hash for commitments, nullifiers, and the Merkle tree. Constants are **regenerated for BLS12-381** (circomlib's are BN254-specific and would be silently insecure). The contract, the circuits, and the wallet all share the exact same constants. |
| **Mixer-shaped (not join-split)** | Shield → private withdraw is the proven, budget-safe shape. Withdraw verifies but does **not** insert, so no single transaction pays for verify *and* tree-hashing together. |
| **Payment links = application layer** | The product is built entirely on top of the frozen protocol — no new circuits, no new contracts. |

---

## 4. What we have built (with honest status)

Legend: ✅ done & verified · 🟡 done, not fully verified · ⬜ not started / external.

### 4.1 The smart contract — ✅ implemented & tested natively

`contracts/umbra-pool` (Rust / Soroban, soroban-sdk 22):
- `shield(proof, commitment, amount, depositor)` — verifies a Groth16 proof, pulls
  funds via the token contract, inserts the commitment into an **on-chain Poseidon
  Merkle tree**, emits `DepositCreated`.
- `withdraw(proof, root, nullifier, recipient, amount, to)` — verifies the proof,
  rejects unknown roots and spent nullifiers, pays the recipient, emits
  `WithdrawalCompleted`.
- Storage: **commitments** (incremental tree frontier + recent-roots ring),
  **nullifiers** (persistent spent-set).
- `contracts/groth16-verifier` — the BLS12-381 Groth16 verifier (G1 MSM + 4-term
  pairing check via CAP-0059 host functions), reused by the pool.
- `contracts/poseidon.rs` — Poseidon over Fr using the host functions, **byte-for-byte
  identical** to the circuit and wallet (proven by a cross-impl oracle test).

**Tests — ✅ 5/5 passing with real proofs verified by the real BLS12-381 host:**
happy path (shield→withdraw, recipient paid, nullifier spent) · double-spend rejected ·
invalid proof rejected on-chain · wrong-recipient rejected · Poseidon-matches-oracle.

### 4.2 The circuits — ✅ implemented & proving

`circuits/` (Circom 2.2.3, compiled `--prime bls12381`):
- `shield.circom` — proves `commitment = Poseidon(secret, amount)`.
- `withdraw.circom` — proves all five required properties: Merkle inclusion, note
  ownership, nullifier derivation, recipient binding, amount conservation.
- `merkle.circom`, `poseidon/poseidon.circom` — shared gadgets; constants auto-
  generated to match the contract and wallet.
- Real Groth16 proofs are generated end-to-end (a demo trusted-setup ceremony +
  snarkjs) and exported to the contract's exact byte layout.

### 4.3 The wallet core — ✅ implemented & typechecked

`packages/wallet-core` (framework-free TypeScript): the note model
(commitment/nullifier), an incremental Poseidon Merkle tree that mirrors the contract,
and witness-input construction for shield/withdraw.

`packages/crypto-bls`: real BLS12-381 field arithmetic, Poseidon, and the Soroban
point encoding (built on the audited `@noble/curves`). 13 unit tests passing.

### 4.4 Payment Links — ✅ implemented, security verified

`lib/umbra/payment-link.ts` + `app/links` + `app/pay/[id]`:
- The **pre-authorized-shield** design (recipient pre-generates the proof; link carries
  commitment + proof, never the secret).
- Security: amount/commitment tampering is rejected (the proof binds them — verified in
  Node), recipient substitution is impossible (the secret never leaves the recipient's
  wallet). Zero protocol changes.

### 4.5 The frontend — 🟡 implemented & building (not yet browser-QA'd)

Next.js 15 + React 19, premium "financial" design (Apple/Stripe/Linear):
- Routes: `/` (landing), `/links` (create link), `/pay/[id]` (checkout), `/withdraw`,
  `/wallet` (activity), `/shield` (advanced).
- A premium component library (`components/umbra/`): Button/Card/Field/Shell, the
  **cryptography timeline** (the signature proving animation), and the **"what the chain
  sees" reveal**.
- In-browser proving (snarkjs) wired; circuit artifacts served from `public/circuits`.
- **Verified by `next build`: all 8 routes compile and prerender.** Visual QA on a real
  screen is the remaining step.

### 4.6 The benchmark harness — ✅ runs, reduces uncertainty

`packages/benchmarks` + `pnpm benchmark`: 8 objective benchmarks (B01–B08). B01
(Poseidon config), B02 (Soroban encoding — *caught a real G2 byte-order bug*), B07
(nullifier storage), B08 (replay protection) all **PASS**; B03–B06 are gated on
circom/stellar-cli/testnet and skip with clear instructions.

### 4.7 The documentation — ✅ complete

`docs/`: `ARCHITECTURE.md` (the full design), `FEASIBILITY_REVIEW.md` (grounded
feasibility, costs, risks), `IMPLEMENTATION_PLAN.md` (the build plan), `BENCHMARK_PLAN.md`,
`JUDGE_REVIEW.md` (brutally honest judge assessment + the path to winning),
`design-system.md` (the premium design spec), and this overview.

---

## 5. Validation evidence

- `cargo test -p umbra-pool` → **5 passed** (real proofs, real on-chain verification).
- `cargo test` (all contracts) → bench-pool 6, umbra-pool 5, all green.
- `pnpm benchmark` → B01/B02/B07/B08 PASS, B03–B06 SKIP (gated), exit 0.
- `pnpm --filter @umbra/crypto-bls test` → 13 unit tests pass.
- `tsc --noEmit` (app) → clean.
- `next build` → all 8 routes compile and prerender.

---

## 6. Repository map

```
contracts/        Soroban (Rust): umbra-pool · groth16-verifier · bench-pool
circuits/         Circom: shield · withdraw · merkle · poseidon (+ build scripts)
packages/
  crypto-bls/     BLS12-381 Fr, Poseidon, Soroban encoding
  wallet-core/    notes, Merkle tree, witness generation
  bench-harness/  the benchmark runner framework
  benchmarks/     the 8 Phase-0 benchmarks
app/              Next.js routes: / · links · pay/[id] · withdraw · wallet · shield
components/umbra/ premium UI + cryptography timeline + chain-reveal
lib/umbra/        wallet store · prover · soroban client · payment links · config
infra/            benchmark results · testnet deploy scripts
docs/             ARCHITECTURE · FEASIBILITY_REVIEW · IMPLEMENTATION_PLAN ·
                  BENCHMARK_PLAN · JUDGE_REVIEW · design-system · PROJECT_OVERVIEW
```

Tech stack: Circom 2.2.3 · snarkjs · Groth16/BLS12-381 · soroban-sdk 22 (CAP-0059) ·
`@noble/curves` · Next.js 15 / React 19 / TypeScript / Tailwind · pnpm + Cargo workspaces.

---

## 7. What remains (the final sprint — all non-cryptographic)

The cryptography is frozen and proven. The remaining work is *evidence a judge can
see*:

1. ⬜ **Deploy to testnet once** and run shield → withdraw on-chain; capture the
   contract id + explorer view showing the deposit and withdrawal are unlinked.
   (Needs `stellar-cli` + the wasm target + a funded key — `infra/deploy/deploy-slice.sh`
   is written and ready.)
2. 🟡 **Run the frontend in a browser**, fix any runtime polish, and pre-generate the
   demo's proofs so nothing heavy runs live on stage.
3. ⬜ **Record the ~2-minute demo video** ending on the "they cannot be connected"
   reveal.
4. ⬜ **README above the fold**: the one-sentence pitch + the link→pay→withdraw GIF +
   the testnet contract id.

### Known limitations (honest)

- The slice uses **Merkle depth 8** (256 notes) so on-chain shield fits the budget; the
  production target is depth 20 with in-circuit insertion.
- The **trusted setup is a single-contributor demo ceremony** (not production-secure).
- **Recipient binding vs. payout address** are decoupled in the slice (documented).
- The browser wallet assumes **single-user** tree sync; multi-party event sync is
  deferred.
- Tests lift the conservative default host budget (`reset_unlimited`); real testnet
  cost is characterized separately.

---

## 8. One-line summary

> **Umbra is the first private payment-link product for Stellar: share a link, get paid,
> and the blockchain can't see who paid you — enforced by a zero-knowledge proof a
> Soroban smart contract verifies on-chain.** The cryptography is real and tested; the
> product is built; what's left is deploying it and filming it.
