# Umbra — Internal Security Review

_Internal engineering review of the Umbra privacy pool, circuits, and client code.
**This is not an audit** and does not replace one. It documents trust assumptions,
invariants, known limitations, and the concrete blockers before real assets. Scope:
`contracts/umbra-pool`, `contracts/groth16-verifier`, `circuits/{shield,withdraw}.circom`,
and the TS wallet/prover/recovery/payment-link code. Date: 2026-07-01._

> Network reality: Umbra runs on **Stellar testnet**. The pool is **unaudited** and
> must not hold real assets at scale until §14 is complete. Umbra provides **link
> privacy, not confidential amounts** — amounts are public on-chain.

---

## 0. Self-review hardening pass (2026-07-01)

A focused adversarial self-review (multiple models) of the money paths surfaced five
issues. **This is not a substitute for an independent audit** (§14, §15), but the
exploitable ones are now fixed, tested, and compiled into the deployed wasm.

| # | Severity | Issue | Status |
| --- | --- | --- | --- |
| **C1** | Critical | Withdrawal proof bound an opaque `recipient` **field** but the contract paid the `to` address independently — a stolen/observed proof could be **redirected** (front-running theft). | **Fixed** — see §7 |
| **H1** | High | `init()` was a separate, unauthenticated call — a deploy↔init window let an attacker **front-run initialization** and bind a malicious verifying key (→ forged proofs, drain). | **Fixed** — see §1 |
| **M1** | Medium | `shield`/`withdraw` did not reject **non-positive amounts** before the token transfer. | **Fixed** — `nonpositive_amount_rejected` |
| **M2** | Medium | No guard once the fixed-depth tree is **full** (frontier math only valid for index `< 2^depth`). | **Fixed** — `tree_full_rejected` |
| **M3** | Medium | Nullifier persistent-storage **TTL/archival** could re-enable a double-spend on a long-lived pool. | **Documented** — §13 (rent strategy required for longevity; acceptable for a capped canary) |

**C1 fix, in one line:** the withdrawal proof's `recipient` public input is now
`field(to) = sha256(addr ScVal XDR)` with the top byte cleared, computed **byte-identically**
in the contract (`address_to_field`, Rust) and the wallet (`addressToField`, TS — verified
equal for both `G…` and `C…` addresses). On-chain the contract recomputes `field(to)` and
rejects any mismatch (`Error::RecipientMismatch`), so a proof can only ever pay the exact
address it was generated for. This is also what makes a **trustless relayer** possible
(`docs/RELAYER.md`): a relayer can submit a user's withdrawal but **cannot redirect the
funds**.

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
- **The constructor binds the correct verifying keys + intended asset, atomically at
  deploy** (H1 fix). There is no separate `init()` to front-run; the keys are fixed in the
  contract-creation transaction and cannot be changed afterward. A wrong vk would accept
  the wrong circuit's proofs, so the deployer must publish the correct keys. (Mainnet:
  multisig deployer identity — §14.)
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
| `recipient == field(to)` (proof bound to the payout address — C1) | contract `withdraw` |
| `amount > 0` on shield + withdraw (M1) | contract |
| tree not full: `next_index < 2^depth` on shield (M2) | contract |
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

## 7. Recipient binding (C1 — fixed)

`recipient` is a public input and is forced into the withdraw constraint system, so a
proof generated for one recipient cannot be replayed for another. **Tested:**
`wrong_recipient_rejected`.

**C1 (fixed):** the proof's `recipient` is now **coupled to the literal payout `to`
address**. The wallet sets `recipient = field(to)` where
`field(addr) = sha256(addr ScVal XDR)` with the top byte cleared (always a valid Fr
element). On-chain, `withdraw` recomputes `address_to_field(to)` and rejects any mismatch
(`Error::RecipientMismatch`) **after** verifying the proof but **before** spending the
nullifier — so a rejected redirect does not even burn the note. The encoding is
byte-identical in Rust (`address_to_field`) and TS (`addressToField`), verified for both
classic (`G…`) and contract (`C…`) addresses.

Consequence: a stolen or observed proof **cannot be redirected** to a different address by
a front-runner or a malicious relayer — the funds can only go where the prover intended.
**Tested:** `wrong_payee_rejected` (a valid proof for payee P is rejected for any `to ≠ P`,
and the nullifier survives the rejection).

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
- ⚠️ **M3 — critical for a long-lived mainnet pool:** if a nullifier's storage entry ever
  **expires/is archived**, the `has(nullifier)` check returns false and the note becomes
  **double-spendable**. Nullifier entries must be kept alive **indefinitely** (rent/archival
  strategy) or replaced by a different accumulator (e.g. an on-chain nullifier-set
  commitment). This is a genuine design item, not just ops.
  - **Canary stance:** for a **capped, short-lived canary** the TTL (`extend_ttl(100_000,
    1_000_000)` ≈ well beyond the canary window) means no nullifier can plausibly expire
    before the canary is wound down, so M3 is not exploitable in that window. It **must**
    be resolved (rent automation or a nullifier-set accumulator) before any unbounded /
    long-lived deployment.

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
| `wrong_recipient_rejected` | recipient binding (proof public input) | contract |
| `wrong_payee_rejected` | **C1** — proof can't be redirected to `to ≠ payee`; nullifier survives rejection | contract |
| `amount_mismatch_rejected` | amount conservation (A ≠ A+1) | contract |
| `nonpositive_amount_rejected` | **M1** — amount ≤ 0 rejected (shield + withdraw) | contract |
| `tree_full_rejected` | **M2** — shield rejected once tree is full | contract |
| `payment-link integrity` (×4) | amount/commitment tamper rejected | TS (`payment-link.test.ts`) |
| `deterministic recovery` (×3) | recovery never claims others' notes | TS (`recovery.test.ts`) |
| `viewing key & audit packets` (×6) | disclosure crypto, wrong-key fails | TS (`viewing-key.test.ts`) |

Contract suite: **9/9** (real proofs vs the real BLS host). Recommended additions:
valid-but-evicted root rejection (needs a multi-insert fixture); a fuzz test over random
tampered public inputs.
