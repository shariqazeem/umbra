# Umbra — Current State (Honest Snapshot)

As of **2026-06-21**. No spin. Three buckets: what's **real and tested**, what
**compiles but has never actually run in a browser / on a network**, and what's
**not done at all**.

---

## The one honest paragraph

The hard part is done and proven: the **cryptography and the Soroban smart contract are
real and tested** — 5 contract tests pass with **real Groth16 proofs verified by the real
BLS12-381 host functions**, including the adversarial cases (double-spend, invalid proof,
wrong recipient). The **product** — payment links, the premium UI, the narrative landing
— is **fully written, typechecks, and builds/SSRs cleanly in dev**, but **no human has
ever opened it in a real browser**, **in-browser proving has never actually executed**,
and **nothing is deployed to testnet**. So: "does the ZK work and does the contract
verify it" → **yes, proven.** "Is it live on Stellar and does it run smoothly in a
browser" → **not yet demonstrated.**

---

## ✅ Real and tested (high confidence)

- **Smart contracts** (`contracts/umbra-pool`, `contracts/groth16-verifier`):
  `shield()` + `withdraw()`, on-chain Poseidon Merkle tree, nullifier set, events.
  `cargo test -p umbra-pool` → **5/5 pass against the soroban-sdk test host, which runs
  the same BLS12-381 host code as testnet:** happy path · double-spend rejected · invalid
  proof rejected · wrong-recipient rejected · on-chain Poseidon ≡ circuit Poseidon.
  (`bench-pool` 6/6.) These use **real snarkjs-generated proofs**, not stubs.
- **Circuits** (Circom 2.2.3, BLS12-381): `shield` + `withdraw` compile; real Groth16
  proofs generate and verify (`circuits/scripts/build-slice.sh`).
- **crypto-bls**: 13 unit tests pass; the Poseidon oracle confirms Rust ≡ circuit ≡ TS.
- **Payment-link integrity**: amount/commitment tampering rejection **verified in Node**.
- **Benchmarks**: B01 (Poseidon), B02 (encoding — caught a real bug), B07/B08
  (nullifier/replay) pass.

What "tested" honestly means here: the verification runs in the **native test host**
(real host implementation), which is strong evidence — but it is **not the same as a
transaction confirmed on public testnet**. We have not done the latter.

---

## 🟡 Compiles, but never actually run in a browser / on a network (unverified)

- **The entire frontend.** `tsc --noEmit` clean, `next build` green (8 routes), `next
  dev` serves every route HTTP 200. **But no one has rendered it in an actual browser.**
  So the visuals, animations, scroll-reveal, responsive layout, and the wow-moment
  reveal are **eyeballed in code only** — not seen on a screen.
- **In-browser proving (snarkjs).** Artifacts are wired (`public/circuits/`) and the
  prover is dynamically imported, but Groth16 proving in a real browser **has never been
  executed here**. The **withdraw zkey is 3.9 MB** → realistic risk of a multi-second
  freeze or OOM on a mid-tier laptop. **Latency is unmeasured.** (The `/withdraw` and
  `/links`/`/shield` flows do call real proving; `/pay` local path does not — see below.)
- **On-chain submission (`lib/umbra/soroban.ts`).** `submitShield`/`submitWithdraw` are
  written, typecheck, and are browser-safe (lazy-loaded stellar-sdk, Uint8Array not
  Buffer), but have **never run against a real network** — there's no contract to call.
- **The "local demo" path is partly choreographed.** With no testnet configured (the
  default), `/pay` shows success after a ~2.8 s timeout (the proof is already in the
  link; nothing is submitted), and `/withdraw` generates a real proof then waits. Honest
  read: **without a deployed contract, the UI demonstrates the flow and the local proving
  — it does not put anything on a real chain.**

---

## ❌ Not done at all

- **Testnet deployment.** No live contract id, no explorer link, no on-chain tx.
  `infra/deploy/deploy-slice.sh` exists but is **unrun** (needs `stellar-cli` + the
  `wasm32` Rust target + a friendbot-funded key — none were available in the build env).
- **Demo video.** None.
- **README above-the-fold.** Not written — still the scaffold blurb.
- **B03–B06 benchmarks** (proof-gen latency, on-chain verify cost, instruction budget,
  resources) — gated, never run. So the **real testnet instruction cost is unmeasured.**

---

## Honest caveats baked into what exists

- **Merkle depth 8** (256 notes), not the architecture's 20 — a budget-driven slice
  constant (depth-20 shield overran the test budget).
- **Tests lift the host budget** (`reset_unlimited`) to validate logic; the real testnet
  cost of a shield/withdraw tx is therefore **not measured**.
- **Trusted setup is a single-contributor demo ceremony** — not production-secure.
- **Recipient binding vs. payout address are decoupled** in the slice (the proof binds a
  recipient field; coupling it to the literal payout address is deferred).
- **Browser wallet assumes a single user** (it rebuilds the tree from its own notes);
  multi-party deposits would need event sync.
- **Payment-link URLs embed the proof** (~1–2 KB) → dense QR codes.

---

## Verification evidence (command → result)

| Command | Result |
|---------|--------|
| `cargo test` (contracts) | umbra-pool 5/5, bench-pool 6/6 ✅ |
| `pnpm --filter @umbra/crypto-bls test` | 13/13 ✅ |
| `pnpm benchmark` | B01/B02/B07/B08 PASS, B03–B06 SKIP (gated) ✅ |
| `tsc --noEmit` (app) | clean ✅ |
| `next build` | 8/8 routes compile & prerender ✅ |
| `next dev` + route fetches | all routes HTTP 200, no SSR errors ✅ |
| **a human opening it in a browser** | **never done** ❌ |
| **a transaction on Stellar testnet** | **never done** ❌ |

---

## Bottom line

We have a **genuinely working, tested private-payments protocol on Stellar** (the rare,
hard thing most teams never reach) wrapped in a **fully-built, build-clean premium
product**. The gap to a winning submission is **not more engineering** — it is
**evidence**: deploy it to testnet once (to make the on-chain proof real and linkable),
click through it in a browser (and de-risk the 3.9 MB withdraw proof), and record a
2-minute video. Until those happen, the strongest claim we can honestly make is *"it
passes 5 tests that verify real ZK proofs with the real Stellar host code,"* not *"here's
the live transaction."*
