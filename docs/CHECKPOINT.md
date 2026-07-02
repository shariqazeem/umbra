# Umbra — Testnet Checkpoint (known-good state)

**Tag:** `v0.1.0-testnet` · **Date:** July 2026 · **Network:** Stellar testnet

This is a deliberate, working checkpoint captured **before** the deeper-tree (capacity) redesign
begins on a branch. If that work goes sideways, this is the commit to return to — everything
below is real, verified, and on-chain.

## Live deployment

| | |
| --- | --- |
| Pool contract | `CAUCOWVCKSOSO3UTBPZHPG3WYTP2733BLV4GIG3FEHIISPSRGJJEOGPC` |
| Asset | native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Merkle depth | 6 (64-note capacity) |
| Proof system | Groth16 / BLS12-381, verified on-chain (CAP-0059) |

## ✅ What works (verified, on-chain)

- **Shield** — deposit XLM into the pool as a private note.
- **Private send** — confidential shielded→shielded transfer; amount hidden on-chain; recipient
  gets a bearer claim link.
- **Unshield / Send** — cash out an **arbitrary amount** to any address (public amount, private
  change); a **full-exit path** guarantees a note can always be withdrawn even at a full tree;
  and cash-out now **spans multiple notes** automatically (note-fragmentation handled).
- **Encrypted note backup** — Zcash-style on-chain note ciphertexts + **register-on-claim**, so
  **deposits, change, AND received notes all recover cross-device** with just the wallet seed;
  amounts stay hidden from everyone else.
- **Payment / donation / invoice links**, **selective disclosure** (encrypted audit packets).
- **Security:** C1 (payee binding), H1 (atomic init), M1/M2 (amount + tree-full guards),
  canonical-input gate (no non-canonical nullifier double-spend), full-exit path.

## 🔬 Audit status

Adversarially reviewed by **Fable 5** across three surfaces (contract, circuits, verifier);
**2 Criticals found, fixed, and re-verified** (non-canonical nullifier double-spend; tree-full
stuck funds). Circuits returned sound. This is **AI-audited + self-reviewed — NOT an independent
human audit.**

## ⚠️ What's limited (honest, by design for a testnet slice)

| Limit | Detail | Fix (roadmap) |
| --- | --- | --- |
| **Capacity** | depth-6 tree = **64 notes total**; the 65th insert reverts | deeper tree (this checkpoint's next branch) / batching |
| **Trusted setup** | single-contributor Groth16 ceremony — a leaked secret could forge proofs | **MPC ceremony** (highest-value production step) |
| **Not human-audited** | AI-audited only | independent professional audit |
| **Anonymity set** | ≤ 64 notes → weak correlation resistance | larger tree + usage |
| **Recovery scan** | client-side, ~6-hour ledger window | server-side indexer (`docs/INDEXER.md`) |
| **Fee privacy** | the tx fee-payer is visible on-chain | relayer (`docs/RELAYER.md`) |
| **Mainnet** | intentionally gated | after the items above |

**Mainnet reality:** deploying to mainnet runs this *same* contract, so the 64-note limit is
identical there — it is **not production-grade** until the trusted-setup ceremony + audit +
capacity work land. A small, self-funded, clearly-labeled **canary** is the honest way to be
"live on mainnet" before then.

## Next up (on a branch, not main)

**#3 — deeper tree.** Attempt to turn 64 notes into tens of thousands by making the transfer's
two Merkle inserts cheaper (a batched/shared-climb insert), then measuring how deep Stellar's
per-tx budget allows. Guardrail: the contract's tree root must stay byte-identical to the
wallet/circuit root (existing tests catch any divergence), so this cannot silently corrupt the
tree. If it doesn't reach the target depth, we return here.
