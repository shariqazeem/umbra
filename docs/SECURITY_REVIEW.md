# Umbra — Internal Security Review

_Internal engineering review of the Umbra privacy pool, circuits, and client code.
**This is not an audit** and does not replace one. It documents trust assumptions,
invariants, known limitations, and the concrete blockers before real assets. Scope:
`contracts/umbra-pool`, `contracts/groth16-verifier`, `circuits/{shield,withdraw}.circom`,
and the TS wallet/prover/recovery/payment-link code. Date: 2026-06-27._

> Network reality: Umbra runs on **Stellar testnet**. The pool is **unaudited** and
> must not hold real assets until §14 is complete. Umbra provides **link privacy, not
> confidential amounts** — amounts are public on-chain.

---

## 1. Trust assumptions

- **Groth16 trusted setup.** Each circuit (shield, withdraw) has a proving/verifying
  key from a trusted setup. The current ceremony is **single-contributor (demo-grade)**.
  If the setup's toxic waste is known, an attacker can forge proofs → mint/withdraw
  arbitrarily. **This is the top mainnet blocker** (§10).
- **Poseidon constants** are correct and identical across Rust contract, Circom circuit,
  and TS (`poseidon_matches_ts_oracle` pins this).
- **CAP-0059 BLS12-381 host functions** (subgroup checks, MSM, pairing) are correct —
  this is Stellar protocol, not Umbra code.
- **init() is run once by an honest deployer** binding the correct verifying keys + the
  intended asset. A wrong vk would accept the wrong circuit's proofs. (Mainnet: multisig.)
- **snarkjs / circom** soundness for proof generation.

## 2. Public inputs (pinned cross-language order)

- `shield`: `[commitment, amount]`.
- `withdraw`: `[root, nullifier, recipient, amount]`.

These are byte-for-byte the contract's `public_inputs` vector; any mismatch with the
proof's public signals fails verification.

## 3. Private witnesses

- `shield`: `secret`.
- `withdraw`: `secret`, `value`, `pathElements[depth]`, `pathIndices[depth]`.

Witnesses never leave the browser. The proof reveals nothing about them beyond the
public inputs.

## 4. Core invariants (enforced by the circuits + contract)

| Invariant | Where |
| --- | --- |
| `commitment = Poseidon(secret, amount)` | shield circuit |
| Merkle inclusion of `Poseidon(secret, value)` under `root` | withdraw circuit |
| `nullifier = Poseidon(secret, leafIndex)`, `leafIndex` from path bits | withdraw circuit |
| `amount == value` (amount conservation, full-note) | withdraw circuit |
| recipient bound into the constraint system | withdraw circuit |
| funds pulled on shield, paid on withdraw | contract `token::transfer` |
| commitment inserted, root appended | contract `insert_commitment` |

## 5. Double-spend prevention

Each withdrawal records its `nullifier` in **persistent** storage and rejects any
nullifier already present (`Error::NullifierAlreadySpent`). The nullifier is derived in
the circuit from `(secret, leafIndex)`, so the same note can be spent at most once.
**Tested:** `double_spend_rejected`. ⚠️ See §13 — nullifier storage TTL is a real
mainnet concern.

## 6. Root freshness / recent-roots ring

`withdraw` proves inclusion under a `root` public input and the contract requires that
root to be in its **recent-roots ring (last 32)** (`Error::UnknownRoot`). A fabricated
root also fails proof verification (root is a public input). The ring means a proof must
be used within ~32 deposits of being generated, or re-proved against a newer root.
**Gap:** there is no explicit test for a *valid-but-evicted* root (needs a multi-insert
fixture) — recommended.

## 7. Recipient binding

`recipient` is a public input and is forced into the withdraw constraint system, so a
proof generated for recipient R cannot be replayed to pay R'. **Tested:**
`wrong_recipient_rejected`. Note: today the proof binds an opaque recipient *field*; it
is **not** coupled to the literal payout `to` address (the contract pays `to`
independently). Coupling them is roadmap (prevents a front-runner from changing `to`).

## 8. Amount visibility (the honest limitation)

`amount` is a **public input**, is emitted in `DepositCreated` / `WithdrawalCompleted`,
and is the literal token-transfer value. **Amounts are public.** Umbra hides *which
deposit funded which withdrawal*, not the amounts. This is link privacy, not
confidential balances. **Tested (link integrity, not amount hiding):** payment-link
tamper tests. Confidential amounts are roadmap (§14, and the Confidential-Tokens path).

## 9. Merkle depth limitation

Depth **8** → **256 notes per pool**. Adequate for a demo; far too small for
production. Depth 20 (~1M notes) requires a circuit recompile + a new trusted setup.

## 10. Trusted-setup risk (top blocker)

Single-contributor Groth16 ceremony. A compromised setup forges proofs. Mitigations:
a proper **MPC ceremony** (e.g. p0tion), or **migrate to a transparent proof system**
(PLONK/Halo2/UltraHonk) that needs no per-circuit ceremony.

## 11. Fee-payer privacy leak

The account that **submits** a `withdraw` pays the transaction fee and appears as the
tx source on-chain. So while the proof hides the *deposit→withdrawal link*, the
**submitter's account is visible** and the payout `to` is public. A user who shields and
then withdraws from the same account is correlatable. **Fix: a relayer** submits
withdrawals on the user's behalf (proof in, tx out) — see `docs/RELAYER.md`.

## 12. Recovery scan assumptions

The cross-device recovery (`lib/umbra/note-derivation.ts`, `recovery.ts`):
- Derives note secrets deterministically from a **wallet signature** (Ed25519 →
  deterministic). **A site that tricks the user into signing the derivation message can
  derive their seed** → recover/spend their notes. The message is domain-separated and
  should be treated like unlocking a wallet.
- Re-identifies own notes by re-deriving secrets and matching commitments. Poseidon
  collision-resistance means it **cannot claim another wallet's note**. **Tested:**
  `recovery.test.ts` (cross-seed non-collision over 64 nonces).
- Scans a **recent ledger window** (~6h, tunable) — misses older deposits without an
  indexer (§14). Pre-deterministic random-secret notes are **not** recoverable.
- The encrypted **audit log is local-only** (private metadata; not on chain).

## 13. Storage / rent / TTL assumptions

- `vk`, `token`, `frontier`, `roots`, `next_index` → **instance** storage.
- Nullifiers → **persistent** storage with `extend_ttl(100_000, 1_000_000)`.
- ⚠️ **Critical for mainnet:** if a nullifier's storage entry ever **expires/is archived**,
  the `has(nullifier)` check returns false and the note becomes **double-spendable**.
  On a long-lived mainnet pool, nullifier entries must be kept alive **indefinitely**
  (rent/archival strategy) or replaced by a different accumulator (e.g. an on-chain
  nullifier-set commitment). This is a genuine design item, not just ops.

## 14. Mainnet blockers (consolidated)

1. Independent **audit** (contract + circuits + verifier path + recovery/codec).
2. **Trusted setup** — MPC ceremony, or transparent-proof migration.
3. **Amount privacy** (confidential amounts) — or build on Confidential Tokens.
4. **Fee-payer privacy** — relayer.
5. **Merkle depth 20** (+ ceremony).
6. **Production indexer** for note discovery.
7. **Nullifier TTL/rent** strategy (§13).
8. **Deployer multisig** + admin controls.
9. Monitoring, incident response, compliance/disclosure story.

## 15. Recommended audits

- **Circuit audit** — soundness, under-constrained signals, the recipient-binding
  constraint, leafIndex derivation, Poseidon parameters.
- **Contract audit** — Soroban auth, storage/TTL (§13), the incremental tree math,
  root-ring eviction, reentrancy/auth on `token::transfer`.
- **Verifier path** — the CAP-0059 usage and public-input encoding.
- **Client crypto** — note derivation, recovery matching, payment-link codec, the
  AES-GCM audit packet.

---

## Test coverage (today)

| Test | Invariant | Where |
| --- | --- | --- |
| `poseidon_matches_ts_oracle` | Poseidon: Rust ≡ circuit ≡ TS | contract |
| `happy_path_shield_then_withdraw` | end-to-end shield→withdraw | contract |
| `double_spend_rejected` | reused nullifier rejected | contract |
| `invalid_proof_rejected` | tampered proof rejected on-chain | contract |
| `wrong_recipient_rejected` | recipient binding | contract |
| `amount_mismatch_rejected` | amount conservation (A ≠ A+1) | contract |
| `payment-link integrity` (×4) | amount/commitment tamper rejected | TS (`payment-link.test.ts`) |
| `deterministic recovery` (×3) | recovery never claims others' notes | TS (`recovery.test.ts`) |
| `viewing key & audit packets` (×6) | disclosure crypto, wrong-key fails | TS (`viewing-key.test.ts`) |

Contract suite: **6/6**. Recommended additions: valid-but-evicted root rejection (needs
a multi-insert fixture); a fuzz test over random tampered public inputs.
