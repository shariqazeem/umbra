# Umbra — Technical Architecture

> Private finance layer for Stellar. Shield, transfer privately, invoice
> privately, get paid privately. Zero-knowledge is load-bearing: every
> state-changing operation is a Groth16 proof verified inside a Soroban contract.

This document is the architecture of record. It is opinionated by design — where
a real choice exists, one option is selected and the rejected ones are named.
Sections map 1:1 to the brief, prefaced by the keystone decisions that everything
else depends on.

---

## 0. Keystone decisions

These five decisions determine the entire system. They are not negotiable
without redesigning everything downstream.

| # | Decision | Why this and not the alternative |
|---|----------|----------------------------------|
| K1 | **BLS12-381**, not BN254 | Soroban (Protocol 22+, CAP-0059) ships native BLS12-381 host functions: G1/G2 MSM, `multi_pairing_check`, and `Fr` field arithmetic. BN254 (the Ethereum/snarkjs default) has **no** host support and would have to be emulated in WASM — prohibitively expensive. BLS12-381 is the only curve with a credible on-chain Groth16 verifier on Stellar today. snarkjs and Circom both target it. |
| K2 | **Groth16**, not PLONK/Halo2 | Constant 3-pairing verification maps directly onto Soroban's `multi_pairing_check` host function. ~288-byte proofs. Mature tooling (Circom + snarkjs + rapidsnark). Cost: per-circuit trusted setup — acceptable, mitigated by a ceremony. PLONK's universal setup isn't worth its heavier, host-unsupported verifier here. |
| K3 | **The contract computes zero hashes.** All hashing — commitments, Merkle membership, **and incremental tree insertion** — happens *inside the circuits*. The contract only verifies proofs and updates flat state. | On-chain Poseidon over `Fr` would cost ~20 hashes × hundreds of `Fr` host-calls **per insert** and risks blowing the per-transaction instruction budget. Folding insertion into the proof makes the contract uniform, tiny, auditable, and removes the single largest on-chain cost risk. The tradeoff — heavier circuits and serialized inserts — is the right place to spend complexity in a ZK hackathon. |
| K4 | **UTXO note model** (Zcash-style shielded notes), not an account model | Notes give native unlinkability and a clean join-split. A private *account* model (hidden balances) needs nullifier-per-spend bookkeeping that leaks more and is harder to get right. Notes + a 2-in/2-out join-split is the proven design. |
| K5 | **Relayer-submitted spends.** Transfers and unshields are submitted by a relayer, not the user's own Stellar account. | If the user's public account pays the network fee, the fee-payer *is* the deanonymizer — it links the shielded action back to a real identity. The relayer breaks that link and is paid a `fee` bound inside the proof. It is trusted for **liveness only**, never for safety. |

**Corollary — there are exactly two circuits and two verified entrypoints:**

- `shield` — public deposit → one new shielded note.
- `spend` — 2-in/2-out join-split that covers **private transfer, unshield, and
  relayer fee in a single circuit**. (Unshield is just a spend with a public
  output. There is no separate unshield circuit.)

Everything below is an elaboration of those two operations.

---

## 1. System architecture

```
                          ┌───────────────────────────────────────────┐
                          │                  CLIENT                    │
                          │  Next.js 15 / React 19 (local-first SPA)   │
                          │                                            │
                          │  ┌────────────┐   ┌──────────────────────┐ │
                          │  │ wallet-core│   │  proving (web worker)│ │
                          │  │ keys·notes │   │  circom wasm +       │ │
                          │  │ scan·build │   │  snarkjs groth16     │ │
                          │  └─────┬──────┘   └──────────┬───────────┘ │
                          │        │                     │             │
                          │  ┌─────▼─────────────────────▼──────────┐  │
                          │  │  OPFS + wa-sqlite (encrypted at rest) │  │
                          │  └───────────────────────────────────────┘  │
                          └───────┬───────────────────────┬────────────┘
                                  │ read (paths,           │ submit (proof +
                                  │ ciphertext stream)     │ public inputs)
                          ┌───────▼────────┐       ┌───────▼────────┐
                          │    INDEXER     │       │    RELAYER     │
                          │ rebuilds tree, │       │ pays XLM fee,  │
                          │ serves paths + │       │ submits spend, │
                          │ ciphertexts.   │       │ claims `fee`.  │
                          │ UNTRUSTED for  │       │ TRUSTED for    │
                          │ safety.        │       │ liveness only. │
                          └───────┬────────┘       └───────┬────────┘
                                  │ getEvents /            │ invokeContract
                                  │ ledger meta            │
                          ┌───────▼────────────────────────▼────────────┐
                          │              STELLAR / SOROBAN               │
                          │  ┌────────────────────────────────────────┐  │
                          │  │  Umbra Pool contract                   │  │
                          │  │  · groth16 verify (BLS12-381 host fns) │  │
                          │  │  · roots ring buffer + frontier        │  │
                          │  │  · nullifier set                       │  │
                          │  │  · asset vault (via SAC)               │  │
                          │  └────────────────────────────────────────┘  │
                          └──────────────────────────────────────────────┘
```

**Trust placement is the whole point:**

- The **contract** is the only safety anchor. It owns the canonical Merkle root,
  the nullifier set, and the assets.
- The **indexer** cannot forge membership (roots are on-chain; clients verify
  paths against them) and cannot read notes (they're encrypted). It is a
  performance and availability convenience. If it lies or disappears, clients
  fall back to Soroban RPC `getEvents` and rebuild the tree themselves.
- The **relayer** cannot steal (recipient, amount, and its own `fee` are bound
  inside the proof) and cannot read notes. It can only censor — and the user can
  switch relayers or self-submit.
- The **client** holds all secrets. Keys never leave the device.

This is a *local-first* system wearing a Next.js coat. The server renders the
shell; the wallet is a client-side application with its own encrypted database.

---

## 2. Smart contract architecture

One contract: **Umbra Pool** (Soroban, Rust). Single asset per pool instance
(MVP: XLM via its Stellar Asset Contract). Multi-asset is N instances or an
asset-keyed extension (production).

The contract is deliberately small. It does four things: verify Groth16 proofs,
maintain the root ring buffer, maintain the nullifier set, and custody assets.
It **never** hashes.

### Storage layout

```rust
// instance storage (bounded, cheap, always live)
struct Config {
    asset:        Address,        // SAC of the pooled asset (XLM SAC for MVP)
    depth:        u32,            // Merkle depth = 20
    vk_shield:    VerifyingKey,   // Groth16 vk for the shield circuit
    vk_spend:     VerifyingKey,   // Groth16 vk for the spend circuit
    domain:       BytesN<32>,     // chain id ‖ contract id — replay separation
}

struct TreeState {
    next_index:   u32,                 // next free leaf
    frontier:     Vec<BytesN<32>>,     // depth filled-subtree hashes (incremental MT)
    roots:        Vec<BytesN<32>>,     // ring buffer of last ROOT_HISTORY (=64) roots
    root_cursor:  u32,
}

// persistent storage (unbounded, TTL-managed)
//   Map key:  nullifier  BytesN<32>   ->   ()       // spent-nullifier set
```

`VerifyingKey` holds the Groth16 verification elements: `alpha_g1`, `beta_g2`,
`gamma_g2`, `delta_g2`, and `ic: Vec<G1>` (one per public input + 1). Stored once
at init.

### Entrypoints

```rust
fn init(admin, config: Config);

// Public deposit -> one shielded note. Proof binds (old_root, new_root, leaf,
// commitment, value, asset). Caller transfers `value` of `asset` in via SAC.
fn shield(
    proof: Proof,
    new_root: BytesN<32>, leaf_index: u32, commitment: BytesN<32>,
    value: i128, depositor: Address,
    note_ciphertext: Bytes,         // self-encrypted, for recovery (unconstrained)
);

// 2-in / 2-out join-split. Covers private transfer + unshield + fee.
fn spend(
    proof: Proof,
    membership_root: BytesN<32>,    // any recent root (inputs prove against it)
    new_root: BytesN<32>,           // insertion base is the CURRENT root
    nullifiers: [BytesN<32>; 2],
    out_commitments: [BytesN<32>; 2],
    public_out: i128,               // unshield amount (0 for pure private xfer)
    recipient: Address,             // bound in proof via 2 limbs; ignored if 0
    fee: i128, relayer: Address,    // bound in proof via 2 limbs
    out_ciphertexts: [Bytes; 2],    // encrypted notes for recipients (unconstrained)
);

// read-only
fn current_root() -> BytesN<32>;
fn is_known_root(r: BytesN<32>) -> bool;
fn is_spent(nf: BytesN<32>) -> bool;
```

### `shield` logic

1. Verify `proof` against `vk_shield` with public inputs
   `[domain, asset_id, value, old_root, new_root, leaf_index, commitment]`.
2. Require `old_root == current_root()` (insertion serializes through the head).
3. `asset.transfer(depositor, this, value)` — pull funds into the vault.
4. `frontier`/`next_index` advance to match `new_root` (the contract trusts the
   proof for the new root, but pins the *old* root it was built on); push
   `new_root` into the ring; `next_index += 1`.
5. Emit `commitment(leaf_index, commitment, note_ciphertext)`.

### `spend` logic

1. Verify `proof` against `vk_spend` with public inputs
   `[domain, asset_id, membership_root, old_root(=current), new_root,
   nf0, nf1, cm0, cm1, public_out, recipient_hi, recipient_lo,
   fee, relayer_hi, relayer_lo]`.
2. Require `is_known_root(membership_root)` and `old_root == current_root()`.
3. Require `!is_spent(nf0) && !is_spent(nf1) && nf0 != nf1`; then mark both spent
   (persistent entries, TTL bumped — see §2 archival note).
4. Insert `new_root` into the ring; `next_index += 2`; update frontier.
5. If `public_out > 0`: `asset.transfer(this, recipient, public_out)` (unshield).
6. If `fee > 0`: `asset.transfer(this, relayer, fee)`.
7. Emit `commitment` events for `cm0`, `cm1` with their ciphertexts; emit
   `nullifier` events for `nf0`, `nf1`.

### Groth16 verifier (the only cryptography in the contract)

Verification is the standard equation, rearranged to a single product-of-pairings
identity so it lands on one host call:

```
vk_x = IC[0] + Σ pub_i · IC[i]            // G1 MSM over public inputs
assert multi_pairing_check(
    [ −A,  alpha_g1,  vk_x,    C   ],     // G1 vector
    [  B,  beta_g2,   gamma_g2, delta_g2] // G2 vector
) == true                                  // ∏ e == 1_GT
```

Implemented with `bls12_381_g1_msm` (for `vk_x`) and
`bls12_381_multi_pairing_check`. Public inputs are `Fr` scalars; the contract
receives 32-byte big-endians and feeds them to the MSM. Cost is ~1 MSM of ~15
points plus one 4-term pairing check — comfortably inside budget and **constant**
regardless of tree depth (because the contract isn't hashing).

This verifier is factored into a reusable `groth16` Rust module so both `vk`s use
identical code.

### Soroban-specific hazards handled

- **State archival.** Nullifiers are *persistent* entries and must never be
  archivable into a state where a spent note could be replayed. Every write bumps
  TTL; a background "TTL keeper" (the relayer, opportunistically) extends
  long-lived nullifiers. The roots ring and frontier are instance storage and are
  bumped on every op.
- **Public input field-fit.** A Stellar address is 32 bytes = 256 bits > the
  ~255-bit `Fr` modulus. Addresses (`recipient`, `relayer`) are bound as **two
  128-bit limbs** (`*_hi`, `*_lo`), each safely inside `Fr`, and reconstructed
  on-chain. This binds the full address in the proof so a relayer cannot redirect
  a payout.
- **Replay / cross-deployment.** `domain = H(chain_id ‖ contract_id)` is a public
  input in both circuits, so a proof is valid only against the deployment it was
  made for. Defends against testnet→mainnet and fork replay.
- **Proof malleability.** Groth16 proofs are re-randomizable, but every
  consequential value (nullifiers, recipient, amounts, fee, relayer) is a *bound
  public input*, and nullifier-uniqueness is enforced on-chain. A malleated proof
  produces the identical state transition or fails — no theft, no double-spend.

---

## 3. Circom circuit architecture

Two circuits, BLS12-381 scalar field, Poseidon as the algebraic hash. Built with
Circom 2 + circomlib (Poseidon constants regenerated for BLS12-381 `Fr` — the
stock circomlib constants are BN254-specific and **must not** be reused).

Shared gadgets (`packages/circuits/lib`):

- `poseidon.circom` — BLS12-381-parameterized Poseidon (t=2 for 2→1 compression,
  t up to 5 for note commitments).
- `merkle_inclusion.circom` — depth-20 path verification (leaf + 20 siblings +
  path bits → root).
- `merkle_insert.circom` — **incremental** insertion: proves
  `frontier` hashes to `old_root` and that placing `leaf` at `next_index`
  yields `new_root`. This is the gadget that lets the contract avoid hashing.
- `nullifier.circom`, `commitment.circom`, `key_derivation.circom`.
- `num2bits_strict` range checks for value conservation safety.

### Circuit A — `shield`

```
PUBLIC : domain, asset, value, old_root, new_root, leaf_index, commitment
PRIVATE: owner_pk, rcm, frontier[20]

constraints:
  commitment === Poseidon(owner_pk, value, asset, rcm)
  new_root   === MerkleInsert(old_root, frontier, leaf_index, commitment)
```

Small: one commitment hash + one insertion path. Sub-second proving.

### Circuit B — `spend` (2-in / 2-out join-split)

```
PUBLIC : domain, asset, membership_root, old_root, new_root,
         nf[0..1], cm_out[0..1], public_out,
         recipient_hi, recipient_lo, fee, relayer_hi, relayer_lo

PRIVATE: ask, nk,                          // spend keys (nk = Poseidon(ask))
         in_value[0..1], in_rcm[0..1], in_pos[0..1],
         in_path[0..1][20], is_dummy[0..1],
         out_pk[0..1], out_value[0..1], out_rcm[0..1],
         frontier[20]

constraints:
  nk === Poseidon(ask)
  owner_pk = Poseidon(nk)
  for i in 0,1:                            // INPUTS
     cm_in_i = Poseidon(owner_pk, in_value[i], asset, in_rcm[i])
     is_dummy[i] OR MerkleInclusion(membership_root, in_pos[i], cm_in_i, in_path[i])
     in_value[i] < 2^64                    // range check (no field wraparound)
     nf[i] === is_dummy[i] ? Poseidon(nk, in_pos[i], 1)   // domain-tagged dummy
                           : Poseidon(nk, in_pos[i])
  for j in 0,1:                            // OUTPUTS
     cm_out[j] === Poseidon(out_pk[j], out_value[j], asset, out_rcm[j])
     out_value[j] < 2^64
  in_value[0] + in_value[1]                // VALUE CONSERVATION
     === out_value[0] + out_value[1] + public_out + fee
  new_root === MerkleInsert²(old_root, frontier, cm_out[0], cm_out[1])
  bind(domain, recipient_hi, recipient_lo, relayer_hi, relayer_lo)  // anchored
```

Design notes that matter:

- **Dummy inputs.** A 1-real-input spend (e.g. simple unshield) sets
  `is_dummy[1]=1`, forces `in_value[1]=0`, skips membership, and tags the dummy
  nullifier so it can't collide with a real one. Standard Tornado-Nova trick.
- **Range checks are not optional.** Without `value < 2^64`, a prover could pick
  values that wrap the ~255-bit field and forge conservation. Every value is
  range-constrained.
- **One circuit, three products.** `public_out=0, fee>0` → private transfer.
  `public_out>0` → unshield. `cm_out[j]` of value 0 → fewer real outputs. The
  contract reads `public_out`/`recipient` to decide payouts; the circuit guarantees
  they're funded.
- **Recipient/relayer are inert in the circuit** (just bound bits) but are what
  the contract pays — binding them in the proof is what stops redirection.

Estimated size: dominated by 2×20 Merkle hashes + 2-leaf insertion ≈ a few
hundred Poseidon permutations → tens-of-thousands of constraints. Browser proving
in single-digit seconds with rapidsnark-wasm; faster on the relayer's native
prover.

---

## 4. Merkle tree design

- **Type:** append-only **incremental Merkle tree** (IMT). The contract stores
  only the **frontier** (the ≤20 rightmost filled-subtree hashes) and `next_index`
  — *not* the full tree. O(depth) on-chain state.
- **Depth:** 20 → 1,048,576 notes. Sufficient through early production; raised
  later by redeploy + migration, not in-place.
- **Hash:** Poseidon t=2 (2→1) over BLS12-381 `Fr`. Zero-subtree hashes are
  precomputed constants `Z[0..20]` baked into both circuit and indexer.
- **Insertion lives in the proof** (K3). `shield` inserts one leaf; `spend`
  inserts two. Each pins `old_root == current_root`, so all insertions serialize
  through the contract head — there is exactly one canonical tree and one
  canonical `next_index`.
- **Root history:** the contract keeps a **ring buffer of the last 64 roots**.
  Spends prove membership against *any* of them, so a proof built a few blocks ago
  stays valid even as others insert concurrently. Without this, every concurrent
  insert would invalidate in-flight proofs.
- **Off-chain mirror:** the indexer and each client rebuild the full tree from
  `commitment` events to produce membership paths and the current frontier.
  Because the root is on-chain, a client always checks its locally built path
  against the on-chain root before trusting it.

Insertion serialization is the price of K3. For hackathon and early-production
volumes it's a non-issue; the relayer serializes submissions. Production breaks
the bottleneck with batched insertion (§21).

---

## 5. Commitment design

A note is a shielded UTXO:

```
note := (owner_pk, value, asset, rcm)
   owner_pk : Poseidon(nk)            recipient's public note key (in their address)
   value    : u64                     amount, range-checked in-circuit
   asset    : Fr                      asset identifier (fixed per pool in MVP)
   rcm      : Fr (random)             commitment trapdoor / blinding
```

```
commitment  cm := Poseidon(owner_pk, value, asset, rcm)
```

- **Hiding:** `rcm` is uniform in `Fr`, so `cm` reveals nothing about `value`,
  `owner_pk`, or `asset` to an on-chain observer.
- **Binding:** Poseidon collision-resistance binds the note to its commitment;
  you cannot later claim a different value for the same `cm`.
- **What's on-chain:** only `cm` (a leaf) and an encrypted `note_ciphertext`. The
  fields live in the ciphertext, decryptable only by the owner.
- **No address reuse needed for privacy:** the trapdoor randomizes every note, so
  even repeated payments of the same amount to the same address produce unlinkable
  commitments.

`asset` is a field element now (single-pool MVP keeps it constant) but is carried
through every constraint so multi-asset pools (§21) are a config change, not a
circuit rewrite.

---

## 6. Nullifier design

```
nullifier  nf := Poseidon(nk, position)
   nk       : Poseidon(ask)           nullifier key, secret
   position : leaf index of the spent note
```

Properties, and why each holds:

- **Deterministic for the owner.** The owner knows `nk` and the note's
  `position`, so they can always recompute `nf` to spend.
- **Unlinkable to the commitment.** `nf` is a Poseidon image under the secret
  `nk`; with only the public `owner_pk = Poseidon(nk)` (one-way) an observer
  cannot derive `nf`. The on-chain `nf` and `cm` for the same note are
  computationally unlinkable.
- **Unique per note.** `position` is unique per leaf, so each note yields exactly
  one `nf`. Re-spending reproduces the same `nf`; the contract's spent-set rejects
  it → **double-spend is structurally impossible**.
- **Owner-bound.** Only the holder of `ask` (→ `nk`) can produce a valid `nf` in a
  proof, because the circuit ties `nf`, `owner_pk`, and the note's `cm` to the
  same `nk`.
- **Dummy notes** use `Poseidon(nk, position, 1)` (domain-tagged) so a padding
  input can never collide with a real spend.

The contract stores nullifiers as a persistent set (membership = spent). This set
grows monotonically; that's inherent to any UTXO privacy system and is the only
unbounded state.

---

## 7. Shield flow

Turning public funds into a private note. The amount is public (it's a visible
SAC transfer); what's hidden is the *link* between depositor and the note's future
life.

```
USER (client)                         RELAYER/SELF            UMBRA POOL (Soroban)
 1. pick value, asset
 2. derive owner_pk from seed
 3. rcm ← random; cm = Poseidon(owner_pk,value,asset,rcm)
 4. fetch current frontier+root (indexer; verified vs on-chain root)
 5. PROVE shield:  old_root,new_root,leaf,cm,value  ───────►
                                                     shield(proof, …, depositor)
 6. self-encrypt note → ciphertext                   ├─ verify groth16 (vk_shield)
                                                      ├─ require old_root==current
                                                      ├─ SAC.transfer(depositor→pool, value)
                                                      ├─ root ring ← new_root; next_index++
                                                      └─ emit commitment(leaf,cm,ct)
 7. scan event, persist note locally  ◄──────────────────────────────────────────┘
```

Shield is **self-submitted** (the depositor's account is already public — no
privacy gained by relaying), and it *does* carry a proof: shielding is a
cryptographic act and earns the signal color in the UI ("proving…"). The proof
guarantees `cm` actually commits to the deposited `value`, so the pool can't be
seeded with an over-valued note.

---

## 8. Private transfer flow

Sender spends owned notes and creates a note for the recipient. Nothing public
reveals sender, recipient, or amount — only two nullifiers, two new commitments,
and two ciphertexts appear on-chain, indistinguishable from any other spend.

```
SENDER (client)                              RELAYER              UMBRA POOL
 1. select input note(s); pad to 2 (dummy if 1)
 2. recipient address (owner_pk', enc_pk') from invoice/contact
 3. split: out0 = note to recipient(value V)
           out1 = change to self(value = Σin − V − fee)
 4. rcm', encrypt each output note to its recipient's enc_pk (X25519+AEAD)
 5. fetch membership path(s) + current frontier (indexer, verified)
 6. PROVE spend:  membership_root, old_root,new_root,
                  nf0,nf1, cm0,cm1, public_out=0, fee, relayer ──►
 7. send (proof, public inputs, ciphertexts) to relayer ─────────► spend(…)
                                                          ├─ verify groth16 (vk_spend)
                                                          ├─ known_root(membership_root)
                                                          ├─ old_root==current
                                                          ├─ nullifiers unspent → mark
                                                          ├─ root ring ← new_root
                                                          ├─ SAC.transfer(pool→relayer, fee)
                                                          └─ emit commitments + nullifiers
 8. recipient's client trial-decrypts cm0 ciphertext ◄──────────── (event stream)
    → learns (value,rcm,asset) → records spendable note
 9. sender records change note (out1)
```

Key points:

- **Recipient discovers payment by scanning**, not by being told. Their client
  pulls the ciphertext stream and trial-decrypts; a successful decrypt = a note
  for them. No direct sender→recipient channel is required.
- **The relayer is paid from inside the pool** (`fee`), so the user needs no XLM
  and never touches a public account for the transfer. That's the privacy win of
  K5.
- **Change is a normal output** — there are always two outputs, so "transfer with
  change" and "transfer without" are indistinguishable on-chain.

---

## 9. Invoice & donation flow

Invoices and donation links are **UX layers over a private transfer** — there is
**no on-chain invoice state** (that would leak the request). An invoice is an
off-chain, shareable object; the payment is an ordinary `spend`.

```
Invoice (signed object, lives in a link / QR / local DB):
  { umbra_address, asset, amount?, invoice_id, memo?, expiry? }
  umbra_address = bech32( owner_pk ‖ enc_pk )      // payee's shielded address
```

- **Create:** payee generates `invoice_id` (random), encodes the invoice into a
  URL (`umbra.app/pay#<base64url payload>`) or QR. `amount` optional →
  donation/"pay what you want" link. Nothing hits the chain.
- **Pay:** payer's client decodes the invoice, builds a `spend` with an output
  note to `umbra_address`, and — crucially — puts `invoice_id` **inside the
  encrypted note memo**. Submits via relayer like any transfer.
- **Reconcile:** payee scans the ciphertext stream, trial-decrypts, and matches
  `invoice_id` → marks the invoice paid. Because `invoice_id` rides inside the
  encrypted note, only the payee learns which payment settles which invoice.

This means invoices, donation links, and plain transfers are the *same on-chain
event*. An observer cannot even tell a commercial payment from a personal one.
Invoices are reconciled purely client-side. (Production may add an optional,
client-run notifier so a merchant backend gets a webhook on detection — still
without the chain learning anything.)

---

## 10. Unshield flow

Unshield is **`spend` with `public_out > 0`** — no separate circuit, no separate
entrypoint. The user converts a private note back to a public balance.

```
USER (client)                               RELAYER             UMBRA POOL
 1. select input note(s); pad to 2
 2. set public_out = amount to withdraw
    recipient = a Stellar account (bound via hi/lo limbs)
    out0 = optional change note to self; out1 = dummy
 3. Σin === out_change + public_out + fee
 4. PROVE spend (public_out>0, recipient bound) ───────────────►
 5. submit via relayer ────────────────────────────────────────► spend(…)
                                                          ├─ verify groth16
                                                          ├─ nullify inputs
                                                          ├─ SAC.transfer(pool→recipient, public_out)
                                                          ├─ SAC.transfer(pool→relayer, fee)
                                                          └─ emit commitment(change) + nullifiers
```

- **Recipient is bound in the proof** (two limbs), so neither the relayer nor a
  front-runner can redirect the withdrawal. A copied `(proof, inputs)` pays the
  same recipient or fails on the spent nullifier — no theft.
- **Amount-correlation is the residual leak** (withdrawing exactly what you
  shielded, soon after, links them). The UI nudges toward round denominations and
  delay, and surfaces the current anonymity-set size. Production adds decoy/split
  withdrawals.

---

## 11. Security assumptions

The system is secure **iff** all of these hold:

1. **Trusted setup integrity.** Groth16 needs a per-circuit setup; the Phase-2
   toxic waste must be destroyed by ≥1 honest participant. We run a small
   multi-contributor ceremony and publish the transcript. A compromised setup
   breaks *soundness* (forgeable proofs → minting/theft), not privacy.
2. **Cryptographic hardness:** discrete log and the pairing assumptions on
   BLS12-381; Poseidon (over BLS12-381 `Fr`) collision- and preimage-resistance;
   X25519 + XChaCha20-Poly1305 AEAD security; Argon2id for the at-rest key.
3. **Soroban host correctness:** the BLS12-381 host functions and the SAC behave
   to spec. (We rely on the protocol's audited implementations.)
4. **Contract correctness:** the verifier equation, public-input ordering,
   nullifier set, and ring buffer are bug-free. This is the highest-risk
   human-error surface and gets the most test/audit attention.
5. **Client integrity:** the user's device and the served frontend bundle are not
   compromised. Keys live client-side; a malicious bundle could exfiltrate them.
   Mitigated by SRI, minimal third-party JS, and (production) reproducible builds.
6. **Randomness:** `rcm`, `ask`, and ephemeral encryption keys come from a CSPRNG
   (`crypto.getRandomValues`). Weak randomness breaks hiding and key secrecy.

Soundness failure = money theft. Privacy failure = deanonymization. We treat (1)
and (4) as the soundness-critical pair and (5)(6) as the privacy-critical pair.

---

## 12. Threat model

**What an on-chain observer sees:** shield deposits (depositor account, amount,
`cm`), nullifiers, output commitments, encrypted ciphertexts, unshield withdrawals
(recipient account, amount), relayer fee payments, and timing.

**What stays hidden:** the link between a shield and any later spend; sender↔
recipient links; note values inside the pool; who owns which note; which invoice a
payment settles.

| Vector | Class | Mitigation |
|--------|-------|------------|
| Double-spend | Soundness | Nullifier set; circuit binds `nf` to the spent note. |
| Forged note / mint from nothing | Soundness | Groth16 soundness + value-conservation + range checks. Depends on honest setup. |
| Field-overflow conservation forgery | Soundness | `value < 2^64` range checks on every input/output. |
| Relayer redirects payout | Integrity | `recipient`/`relayer` bound as proof public inputs. |
| Replay across deployments/forks | Integrity | `domain = H(chain‖contract)` bound in every proof. |
| Proof malleability | Integrity | All consequential values are bound public inputs; nullifier uniqueness enforced. |
| Fee-payer linkage | Privacy | Relayer submits; fee paid from pool (K5). |
| Network/IP linkage | Privacy | Relayer terminates the user's connection; client guidance for Tor/VPN. |
| Amount correlation (shield 100 → unshield 100) | Privacy | Denomination nudges, delay, decoy splits (prod), anonymity-set meter. |
| Timing correlation | Privacy | Relayer batching/jitter (prod). |
| Small anonymity set | Privacy | Surface set size honestly in UI; don't overclaim privacy on a thin pool. |
| Indexer lies about membership | Safety→none | Clients verify every path against the on-chain root. Indexer can't forge. |
| Indexer/relayer censors | Liveness | Switch provider; self-submit; multiple relayers. |
| Malicious frontend bundle | Key theft | SRI, dependency minimalism, reproducible builds (prod), wallet-core isolation. |
| Garbage output ciphertext | Griefing | Recipient simply can't detect; sender-side only. Prod: commit to ciphertext in-proof. |
| Compliance / illicit use | Abuse | Optional viewing keys + association-set ("proof of innocence") in production. |

**Out of scope / accepted (MVP):** global passive network adversary doing
traffic analysis at the IP layer; coercion of the user; a malicious *protocol
deployer* who ships a backdoored verifying key (mitigated only by the public
ceremony + reproducible contract build).

---

## 13. Local wallet state architecture

The wallet is the heart of the product and is **local-first**. Keys never leave
the device; the server never sees plaintext.

- **Storage:** `wa-sqlite` (SQLite compiled to WASM) on the **OPFS** VFS — a real
  origin-private file handle, durable and fast, no IndexedDB row-shredding. One
  database file per profile.
- **Encryption at rest:** the spending seed and all note secrets are sealed under
  a key derived from the user's passphrase via **Argon2id**; optionally unlocked
  via a passkey/WebAuthn PRF for a passwordless re-open. Sensitive columns
  (seed, `rcm`, note values, memos) are AEAD-encrypted; the DB is useless if
  copied off the device.
- **Key hierarchy (deterministic from one seed):**

```
seed (BIP39, 24 words)
 ├─ ask                = HKDF(seed,"umbra/ask")        spend authority (secret)
 │   └─ nk             = Poseidon(ask)                  nullifier key (secret)
 │       └─ owner_pk   = Poseidon(nk)                   public note key (shareable)
 └─ (enc_sk, enc_pk)   = X25519 from HKDF(seed,"umbra/enc")   note encryption
Umbra address (shareable) = bech32m( owner_pk ‖ enc_pk )
```

- **Schema (essentials):** `keys`, `notes(cm, value, asset, rcm, position,
  status[unspent|pending|spent], nf)`, `nullifiers_seen`, `sync_checkpoint(last
  ledger/cursor)`, `invoices`, `contacts`, `tx_history`.
- **Scanning loop:** pull new `commitment` events since the checkpoint →
  trial-decrypt each ciphertext with `enc_sk` → on success, insert an unspent
  note and precompute its `nf` → watch for that `nf` on-chain to mark spends by
  others / confirm own. Entirely local; the indexer learns nothing about which
  notes are the user's.
- **Recovery:** the 24-word seed regenerates all keys; replaying the event stream
  and trial-decrypting reconstructs the full note set. The local DB is a cache,
  not the source of truth — the chain is.

Wallet logic is a framework-agnostic package (`wallet-core`) so it is unit-test
-able headless and reusable outside React.

---

## 14. Indexing architecture

The indexer exists for **speed and availability, never for trust** (§1).

- **Ingest:** poll Soroban RPC `getEvents` for the Umbra contract (or consume
  ledger close meta) and persist `commitment`, `nullifier`, and `root` events in
  order.
- **Maintain:** rebuild the canonical depth-20 IMT from commitments; keep the
  frontier and the recent-roots window in sync with the contract.
- **Serve (REST/tRPC):**
  - `GET /tree/frontier` → current frontier + `next_index` + root (for building
    `shield`/`spend` insertion witnesses).
  - `GET /tree/path?index=` → Merkle authentication path (clients **re-verify**
    it against the on-chain root before use).
  - `GET /notes/ciphertexts?from=cursor` → the **entire** encrypted note stream,
    paginated. Clients fetch in bulk and **trial-decrypt locally**.
  - `GET /nullifiers?from=cursor` → spent set deltas.
- **Privacy of the indexer itself:** clients never ask "is this note mine?"
  They pull the whole ciphertext stream and decrypt offline, so the indexer can't
  learn ownership from query patterns. (Production: PIR or oblivious sync for
  larger streams.)
- **Trustlessness fallback:** every endpoint is reproducible from public chain
  data. If the indexer is down or hostile, the client rebuilds directly from RPC
  `getEvents`. The indexer cannot forge membership (root is on-chain) or read
  notes (encrypted).
- **Stack:** Node/TypeScript service + Postgres (tree nodes + event log + cursor),
  deployed as a small always-on worker. Hackathon can run it as a single process
  with SQLite.

---

## 15. Proof generation architecture

- **Where:** in the **browser**, in a dedicated **web worker**, so the UI stays
  responsive and keys never leave the device. The relayer optionally offers a
  *native* prover (rapidsnark) for low-power devices — but only on
  witnesses that carry no secret beyond what the relayer would see anyway;
  default is local proving.
- **Stack:** Circom-generated witness calculator (WASM) + **snarkjs** Groth16
  prover, with **rapidsnark-wasm** as the fast path. Proving runs off the main
  thread; the UI shows a live "PROVING" state (the signal-color moment — ZK made
  visible, not hidden).
- **Artifacts & caching:** per circuit we ship `circuit.wasm` (witness) and
  `circuit.zkey` (proving key). `zkey`s are large (tens of MB); they're served
  from a CDN and cached in **Cache Storage / OPFS** after first load, so proving
  is a one-time download then instant-warm. Verifying keys are tiny and embedded
  in the contract at init.
- **Trusted setup pipeline:** `powersoftau` (BLS12-381) → per-circuit Phase 2 →
  export `vk` (to contract) and `zkey` (to client). The ceremony is multi-
  contributor with a published transcript; the build is reproducible so anyone
  can check the deployed `vk` matches the circuit.
- **Performance budget:** `shield` proves sub-second; `spend` (≈ tens of
  thousands of constraints) targets single-digit seconds in-browser, ~1s native.
  Witness generation is the floor; we keep circuits lean (Poseidon t tuned, no
  redundant hashing) to stay there.
- **Determinism guardrail:** proving must be reproducible and side-effect free;
  the worker is pure (inputs → proof), which also makes it trivially testable.

---

## 16. Frontend architecture

Next.js 15 App Router + React 19, but make no mistake: this is a **local-first
client app**. The server renders the shell and serves static circuit/proving
assets; it holds no user state and sees no secrets. Most wallet surfaces are
client components.

- **Layers:**
  - `app/` — routes/shell (mostly server components for layout, client islands
    for the wallet).
  - `wallet-core` (package) — keys, notes, scanning, tx building. Framework-free.
  - `proving` (package) — the worker + snarkjs orchestration.
  - `sdk` (package) — typed clients for the contract (Stellar SDK + generated
    bindings), the indexer, and the relayer.
  - UI state — React Query for indexer/chain reads; a small store for wallet
    session; **no secrets in React state longer than needed**.
- **Design system (authoritative — `docs/design-system.md`):** Swiss Brutalist.
  Three colors only — black, white, and `#FF3B00` **reserved for cryptographic
  actions** (shield, prove, send). The premium/precise feel (Linear/Stripe/Apple
  lineage) is achieved through *restraint and typographic structure*, not
  ornament. Inter for UI; **JetBrains Mono for every address, hash, proof, and
  balance**, each with one-click copy. The signal color appearing exactly when a
  proof is generated is a feature: it tells the user "cryptography is happening
  now," which is the product's whole thesis made legible.
- **Core surfaces:** Shield, Send (transfer), Receive/Invoice, Activity, Settings/
  Backup. Each cryptographic step renders its proof state explicitly.
- **Routing of secrets:** key material flows client → worker only. No secret is
  ever sent to a route handler. The relayer receives *proofs and public inputs*,
  never witnesses.

---

## 17. Folder structure

Within the primary packages:

```
packages/circuits/
  circuits/        shield.circom, spend.circom
  lib/             poseidon, merkle_inclusion, merkle_insert, nullifier,
                   commitment, key_derivation, range
  build/           compiled wasm, r1cs, zkey, vkey  (artifacts; gitignored, CI-built)
  scripts/         compile.ts, ptau.ts, phase2.ts, export-vk.ts
  test/            circuit_tests (witness + constraint assertions)

packages/contracts/                 # Rust / Cargo workspace
  pool/            lib.rs (init/shield/spend), storage.rs, events.rs
  groth16/         verifier (bls12-381 host fns), vk types
  test/            integration tests against the host
  bindings/        generated TS contract client

packages/wallet-core/
  src/keys/  src/notes/  src/scan/  src/tx/  src/crypto/  src/db/(wa-sqlite+OPFS)

packages/proving/   worker.ts, prover.ts, artifact-cache.ts
packages/sdk/       contract.ts, indexer.ts, relayer.ts, types
packages/types/     shared Fr/encoding/note types

apps/web/           app/ components/ hooks/ lib/ styles/   (current Phase-0.1 scaffold)
apps/indexer/       ingest/ tree/ api/
apps/relayer/       submit/ fee/ queue/
```

The existing repo root (`app/`, `components/`, `hooks/`, `lib/`, `styles/`,
`tests/`) **is** `apps/web` today; §18 describes promoting it into the monorepo.

---

## 18. Monorepo structure

- **Tooling:** **pnpm workspaces + Turborepo** for the JS/TS side; a **Cargo
  workspace** for the Rust contracts under `packages/contracts`. One repo, two
  build systems, wired together by Turbo tasks.
- **Layout:**

```
umbra/
  apps/      web · indexer · relayer
  packages/  circuits · contracts · wallet-core · proving · sdk · types · config
  docs/      ARCHITECTURE.md · design-system.md
  turbo.json · pnpm-workspace.yaml
```

- **Dependency flow (one direction, no cycles):**

```
circuits ──artifacts──► proving ──► wallet-core ──► apps/web
contracts ──bindings──► sdk ─────────► wallet-core, apps/{web,indexer,relayer}
types ──► (everything)
```

- **Cross-language seams (the source-of-truth pins):** these must agree exactly or
  proofs silently fail to verify. They're generated/checked in CI, never
  hand-duplicated:
  - Public-input **ordering** — one schema in `packages/types` drives the circuit,
    the Rust verifier, and the SDK.
  - **Field encoding** — 32-byte big-endian `Fr`; the address hi/lo limb split;
    Poseidon constants. Shared fixtures test all three implementations against the
    same vectors.
  - **Verifying key** — exported from `circuits` → embedded in `contracts` at
    init; CI asserts the on-chain `vk` matches the circuit hash.
- **Migration from today:** Phase 0.1 is a single Next app at the root.
  Step 1 introduces pnpm/Turbo and moves the app to `apps/web` unchanged.
  Step 2+ add packages as each phase needs them. No big-bang rewrite.

---

## 19. Recommended development sequence

Ordered so the **highest-risk, most-load-bearing** piece is proven first. If the
on-chain verifier doesn't work, nothing else matters — so it goes first.

1. **Spike: on-chain Groth16 over BLS12-381.** Deploy a throwaway Soroban contract
   that verifies a snarkjs-generated BLS12-381 Groth16 proof of a trivial circuit.
   *Exit criterion:* `multi_pairing_check` returns true within the instruction
   budget. **This de-risks the entire project.** Do it day one.
2. **Poseidon-on-BLS12-381 + primitives.** Regenerate Poseidon constants; implement
   `commitment`, `nullifier`, `key_derivation` gadgets with cross-impl test
   vectors (circom ↔ TS).
3. **`shield` end-to-end.** Shield circuit → `vk` → contract `shield` entrypoint →
   SAC custody → emit/scan a commitment. First real proof verified on Stellar.
4. **IMT + indexer.** `merkle_insert`/`merkle_inclusion` gadgets; indexer rebuilds
   the tree and serves paths; client verifies paths vs on-chain root.
5. **`spend` end-to-end.** 2-in/2-out join-split with conservation + range +
   nullifiers; contract `spend`; private transfer working between two local
   wallets via trial-decrypt.
6. **Relayer.** Move spend submission behind the relayer; fee paid from pool;
   recipient/relayer binding verified.
7. **Unshield.** It's `spend` with `public_out>0` — mostly UI + recipient limbs.
8. **Wallet persistence.** wa-sqlite + OPFS, Argon2id seal, scanning loop,
   balances, history.
9. **Invoices & donation links.** Off-chain invoice objects, `invoice_id` in the
   encrypted memo, reconciliation by scan.
10. **Frontend polish + proving UX.** The brutalist surfaces, the signal-color
    proving states, copyable mono crypto data, anonymity-set meter.
11. **Trusted setup ceremony + demo hardening.** Multi-contributor Phase 2,
    published transcript, scripted demo path.

Parallelizable: circuits (a) and contract verifier (b) by different people once
the §18 public-input schema is pinned; frontend shell while crypto matures.

---

## 20. Hackathon MVP scope

**The bar:** a real-feeling private payment, with a proof verified on Stellar, end
to end, live.

**In:**

- One pool, **one asset** (XLM via its SAC).
- **Shield**, **private transfer** (with change), **unshield** — all three,
  because together they tell the whole story; individually they don't.
- On-chain Groth16 verification (both `vk`s), depth-20 IMT, 64-root ring,
  nullifier set.
- Local wallet: OPFS + wa-sqlite, seed backup, scanning, balances.
- Indexer (single process ok) + relayer (single, trusted-for-liveness).
- Invoice / donation link as a shareable URL reconciled by scan.
- Brutalist UI with explicit, signal-colored proving states.
- A small but real trusted-setup ceremony (≥2 contributors), transcript published.

**Out (explicitly deferred, stated honestly in the demo):**

- Multi-asset pools; cross-asset.
- Batched/rollup insertion (MVP serializes inserts through the relayer).
- Viewing keys / compliance / proof-of-innocence.
- PIR sync (MVP fetches the full ciphertext stream).
- Decoy traffic, timing defenses beyond relayer basics.
- Mobile-native proving, passkey unlock (passphrase only for MVP).

**Demo script:** shield 100 XLM → show the commitment on-chain and the local note
→ privately send 40 to a second wallet (watch it appear via trial-decrypt, sender
unlinkable) → generate an invoice, pay it from wallet two → unshield 25 to a fresh
account. Throughout, the signal color marks each proof. Point at the explorer:
nullifiers and commitments, no amounts, no links.

---

## 21. Post-hackathon production scope

What turns the MVP into *the* default privacy layer for Stellar:

- **Batched insertion (kill the serialization bottleneck).** A permissionless
  sequencer accumulates new commitments and submits **one** SNARK proving a
  batch root update (zk-rollup style). The contract verifies one proof and
  advances the root for N inserts. Removes the single-insert head contention and
  scales throughput by orders of magnitude. The contract stays hash-free.
- **Multi-asset pools.** `asset` is already threaded through every note and
  constraint; production adds per-asset vaults (or an asset-keyed pool) and
  cross-asset shielded swaps.
- **Decentralized relayers + relayer marketplace.** Open relayer registry, fee
  competition, reputation; users pick or rotate. Optional relayer-side proving
  for thin clients.
- **Compliance without breaking privacy.** Opt-in **viewing keys** (auditor/
  self-audit/selective disclosure) and **association sets** ("proof of innocence":
  prove your funds derive from an approved set without revealing which). Lets
  honest users demonstrate provenance; keeps custody trustless.
- **Stronger metadata privacy.** PIR or oblivious sync so clients don't fetch the
  whole stream; relayer batching with timing jitter; decoy/split shield+unshield
  to defeat amount correlation; integrated network-layer privacy guidance.
- **Larger / upgradeable tree.** Depth 32 via migration; formalized root-history
  and archival-safe nullifier lifecycle.
- **Trusted setup at scale.** A large public Phase-2 ceremony (hundreds of
  participants) per production circuit, with a permanent verifiable transcript;
  reproducible contract builds so the deployed `vk` is publicly checkable.
- **Audits & formal verification.** Independent audit of circuits + contract;
  formal verification of the verifier equation, conservation, and nullifier logic
  — the soundness-critical core.
- **Recurring/streaming private payments, payroll, subscriptions.** Higher-order
  commerce primitives built on the same note + spend foundation.

---

### Appendix — naming & constants (pin these once, everywhere)

| Constant | Value (MVP) |
|----------|-------------|
| Curve | BLS12-381 |
| Proof system | Groth16 |
| Algebraic hash | Poseidon over BLS12-381 `Fr` (constants regenerated for `Fr`) |
| Tree | Incremental Merkle, depth **20**, Poseidon t=2 |
| Root history | last **64** roots (ring buffer) |
| Join-split | **2-in / 2-out** |
| Value range | `[0, 2^64)`, range-checked in-circuit |
| Note encryption | X25519 + XChaCha20-Poly1305 |
| At-rest KDF | Argon2id |
| Address encoding | bech32m( `owner_pk` ‖ `enc_pk` ) |
| Field encoding | 32-byte big-endian; addresses as 2×128-bit limbs |
| Domain separation | `domain = H(chain_id ‖ contract_id)`, public input in both circuits |
```
