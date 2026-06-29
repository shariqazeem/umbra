# Umbra — Implementation Plan

> Executable roadmap to a first-place *Stellar Hacks: Real-World ZK* submission.
> Architecture and feasibility are complete; this is the work.

**The clock is the design constraint.** Submission opened 2026-06-15; **deadline
2026-06-29 19:00**. Today is 2026-06-20 → **~9 working days**. Prize pool $10,000,
single open-innovation track, **top 5 win**. Required deliverables: a public
**GitHub repo** and a **demo video**. The track's hard gate: **proofs generated
off-chain (Circom/snarkjs) and verified inside a Stellar smart contract.** Every
decision below is bent toward shipping a flawless, thesis-perfect demo of exactly
that in nine days.

This plan inherits the feasibility verdict directly: **build mixer-shaped, not
join-split.** The reasons are load-bearing and are not revisited here — see
`FEASIBILITY_REVIEW.md` §4, §9. The single most important consequence: **withdraw
does not insert**, so no transaction ever pays for verify *and* on-chain hashing
together, and the heavy join-split circuit is out of the critical path.

---

## 1. Final MVP definition

**The product that ships:** *Umbra — private payments on Stellar.* Shield assets
into a privacy pool, then make a payment to any address that is **provably valid
but cryptographically unlinkable to your deposit**, enforced by a Groth16 proof
**verified inside a Soroban contract**. Wrapped in a premium, institutional, white
financial UI and a shareable **private payment link**.

The privacy guarantee shipped is **payer-unlinkability** (mixer anonymity): no
on-chain observer can link a withdrawal/payment to the shield that funded it. That
is a complete, honest, demoable privacy product — and it is the proven shape.

### A. Mandatory — these define the thesis; without any one, do not submit

| # | Ships | Why it is mandatory |
|---|-------|---------------------|
| A1 | On-chain **Groth16/BLS12-381 verification** in a Soroban contract on **testnet** | This *is* the track requirement. Non-negotiable. |
| A2 | **Shield**: deposit XLM → commitment in an on-chain Merkle tree (proof-backed) | Entry into the pool. |
| A3 | **Private withdraw/pay**: membership + nullifier + **recipient binding** → payout to a bound address | The privacy payoff and the double-spend guard. Recipient binding closes the exact gap Stellar's own prototype left open. |
| A4 | **Double-spend prevention** via on-chain nullifier set | Demonstrates ZK is load-bearing, not cosmetic. |
| A5 | **Premium white frontend** for shield, pay, and activity; copyable mono crypto data | The differentiator vs. the existing CLI prototype: a *product*, not a demo. |
| A6 | **Local encrypted wallet** (keys + notes + scan) | Makes it usable and real. |
| A7 | **Shareable private payment link** (the invoice/donation wedge) | The consumer story judges remember. |
| A8 | **Demo video + README + architecture diagram** | Required to submit and to win. |

### B. Stretch — pursue only after A is frozen and green

| # | Ships if time | Risk |
|---|---------------|------|
| B1 | **In-pool private transfer** (join-split, recipient holds a shielded note → bidirectional privacy) | High — the feasibility review's ~55–65% feature. The demo's climax *if* green. |
| B2 | **Relayer** submission (vs. self-submit) to remove fee-payer linkage | Medium — improves the privacy story; self-submit is acceptable for the demo with a verbal caveat. |
| B3 | **Withdraw with change** (partial spends) | Medium — needs in-circuit insertion on withdraw; reintroduces the budget collision. |
| B4 | Multiple historical-root window beyond the minimum needed for the demo | Low. |

### C. Post-hackathon — explicitly out, do not start

Multi-asset pools · batched/rollup insertion · viewing keys / compliance · nullifier
accumulator · PIR / view-tag scanning · mobile proving · a real multi-party
ceremony · anything in `ARCHITECTURE.md` §21.

### What explicitly does NOT ship (say it out loud)

- ❌ Mainnet. Testnet only.
- ❌ Mobile. Desktop Chrome is the target (proving is client-side and memory-heavy).
- ❌ Recipient privacy in the MVP (payer-unlinkability only; recipient privacy is B1).
- ❌ A production trusted setup (demo ceremony, clearly labelled).
- ❌ Multi-asset (XLM only).

---

## 2. Demo strategy

**Format:** ~2:20 screen recording, one continuous take feel, voiceover. The arc:
*real product → invisible cryptography → on-chain proof → the chain sees nothing.*
The emotional beat to land: **"this feels like Stripe, but the blockchain can't see
it — and the smart contract still proved it was valid."**

**Pre-staged before recording:** two browser profiles (payer "Ana", recipient
"Café"), zkeys pre-warmed in cache, a Stellar testnet explorer tab open, one prior
shield already confirmed so the pool has an anonymity set > 1.

| Time | Screen / action | Proof moment | Narrator (verbatim) |
|------|-----------------|--------------|---------------------|
| 0:00–0:12 | Umbra landing, white premium UI, one balance, one button | — | "This is Umbra. Private payments on Stellar. No mixer jargon, no setup — just money that moves privately." |
| 0:12–0:30 | Click **Shield**. Enter 100 XLM. The **Shield** button is the only colored element (signal). | **Proving (shield)** — precise signal-colored progress, ~2–4s | "When I shield, my browser generates a zero-knowledge proof locally. My keys never leave this device." |
| 0:30–0:45 | Confirmation. Cut to **explorer**: a Soroban tx, a commitment, no owner, no readable amount. | on-chain verify | "The Stellar contract verified that proof and accepted my deposit. On-chain there's a commitment — and nothing else." |
| 0:45–1:05 | Recipient "Café" screen: create a **payment request link**, copy it. Hand off to payer "Ana". | — | "The café shares an Umbra link. No account, no KYC — just a link." |
| 1:05–1:35 | Ana opens the link, clicks **Pay privately**. **Proving (withdraw)** — signal progress, ~3–6s. Submitted. | **Proving + on-chain verify (the climax)** | "Ana pays from the pool. Her browser proves she owns a valid deposit and isn't double-spending — without revealing *which* deposit. The Soroban contract checks the proof and pays the café." |
| 1:35–1:55 | Explorer split-view: **left = what the chain sees** (a nullifier, a payout, a verified proof, no link to Ana's shield); **right = Ana's clean activity feed**. | — | "Here's the whole point. The contract is certain the payment was valid. But nothing on-chain links it back to Ana. Provable, and private." |
| 1:55–2:10 | Recipient "Café" sees funds arrive + reconciled against the link. | — | "The café got paid, and reconciled the invoice — privately." |
| 2:10–2:20 | Title card: *Umbra · Groth16 over BLS12-381 · verified in Soroban · Circom + snarkjs.* | — | "Real zero-knowledge. Verified inside a Stellar smart contract. In something that finally feels like a product." |

**Demo rules:** the signal color appears **only** during proof generation — it
trains the judge's eye that color = cryptography. Always cut to the explorer after
each proof so judges *see* on-chain verification (the rubric). Never show a
terminal. If B1 (in-pool transfer) is green, swap the 1:05–1:35 beat to a
wallet-to-wallet private transfer for a stronger climax; otherwise the
payment-link withdraw carries the demo.

---

## 3. User journey

Every screen, in order of first experience. Desktop, white premium, Inter + mono.

1. **First visit (`/`)** — A single confident hero: "Private payments on Stellar."
   One primary action (**Create wallet**) and one secondary (**Open existing**). No
   wall of features. A one-line trust signal: "Your keys never leave your device."
2. **Wallet creation (`/onboarding`)** — Three steps, one per screen: (a) generate
   a 24-word seed shown in JetBrains Mono with a copy action and a "written it
   down" confirm; (b) set a passphrase (Argon2id-sealed at rest); (c) "you're
   ready." No email, no account. The seed screen is sober and institutional — this
   is the trust moment.
3. **Home / balance (`/`, authenticated)** — A large monospace **shielded balance**,
   a recent **activity** list, and two actions: **Shield** and **Pay**. Empty state
   nudges "Shield funds to begin."
4. **Shield (`/shield`)** — Amount input (mono), a clear "from your Stellar account
   → Umbra pool" line, the projected anonymity-set size, and the **Shield** button
   (signal). On submit: the **proving** state (signal progress + plain-language "generating
   your proof"), then a confirmation with the commitment (mono, copyable) and an
   explorer link.
5. **Create payment link / invoice (`/links`)** — "Request a private payment."
   Optional amount, optional memo/label, optional expiry. Produces a shareable URL
   + QR. List of existing links with **paid / unpaid** status (reconciled locally
   by scan). This is the invoice/donation surface.
6. **Pay (`/pay` or `/pay/[link]`)** — If opened from a link, the recipient + amount
   are pre-filled (recipient shown in mono). Otherwise the payer pastes an address.
   A clear summary, then **Pay privately** (signal). On submit: **proving**
   (withdraw), then confirmation with the payout tx + the "unlinkable to your
   shield" reassurance and an explorer link.
7. **Withdraw (`/withdraw`)** — The same primitive as Pay, framed as
   "move funds out of the pool to an address you control." Amount (full-note in MVP),
   destination, **Withdraw** (signal), proving, confirmation.
8. **Activity (`/activity`)** — Unified feed: shields, payments, withdrawals, each
   with status, amount (local only), and explorer links. The "what you see" half of
   the demo's split-screen.
9. **Settings (`/settings`)** — Seed backup/reveal (re-auth gated), passphrase
   change, network (testnet), and a "what the chain can see about you" transparency
   panel — an honesty feature that builds trust.

---

## 4. Repository structure

Promote today's single Next.js app into a pnpm + Turborepo monorepo with a Cargo
workspace for contracts. **Every directory:**

```
umbra/
├── apps/
│   ├── web/                      # Next.js 15 frontend (today's root app moves here)
│   │   ├── app/                  # App Router routes (see §8)
│   │   ├── components/           # product components (shadcn primitives in components/ui)
│   │   ├── hooks/                # use-copy-to-clipboard, use-wallet, use-prover
│   │   ├── lib/                  # app glue, formatters, route helpers
│   │   ├── styles/               # globals.css + design tokens
│   │   └── public/               # static, incl. circuit artifacts (wasm/zkey) or CDN refs
│   └── indexer/                  # commitment/nullifier indexer + Merkle tree service
│       ├── src/ingest/           # Soroban RPC getEvents poller
│       ├── src/tree/             # incremental Merkle rebuild + path API
│       └── src/api/              # REST endpoints (frontier, path, ciphertexts)
├── contracts/                    # Cargo workspace (Rust / Soroban)
│   ├── pool/                     # UmbraPool: shield, withdraw, state, events
│   │   ├── src/
│   │   └── Cargo.toml
│   ├── groth16/                  # reusable BLS12-381 Groth16 verifier module
│   │   └── src/
│   ├── Cargo.toml                # workspace
│   └── Makefile                  # build/optimize/deploy (stellar-cli) helpers
├── circuits/                     # Circom 2 + snarkjs
│   ├── src/
│   │   ├── shield.circom
│   │   ├── withdraw.circom
│   │   ├── transfer.circom       # STRETCH (B1), not in MVP build
│   │   └── lib/                  # poseidon_bls (regenerated constants), merkle, nullifier, commitment, range
│   ├── scripts/                  # compile, ptau/ceremony, phase2, export-vk, gen-vectors
│   ├── test/                     # witness + constraint tests, cross-impl vectors
│   └── build/                    # artifacts: r1cs, wasm, zkey, vkey (CI-built, gitignored)
├── packages/
│   ├── wallet-core/              # framework-free wallet SDK (keys, notes, scan, tx-build, crypto, db)
│   ├── proving/                  # web-worker prover (snarkjs/rapidsnark-wasm) + artifact cache
│   ├── sdk/                      # typed clients: contract bindings, indexer, (relayer B2)
│   ├── types/                    # shared Fr/encoding/note/public-input schema (the cross-language pin)
│   └── config/                   # shared tsconfig/eslint/prettier/tailwind presets
├── infra/
│   ├── ceremony/                 # trusted-setup transcript + artifacts + verify script
│   ├── deploy/                   # testnet deploy scripts, contract IDs, env templates
│   ├── docker/                   # indexer container (+ optional relayer)
│   └── benchmarks/               # Day-0 gate harness + recorded results (see §12)
├── docs/                         # ARCHITECTURE · FEASIBILITY_REVIEW · IMPLEMENTATION_PLAN · design-system
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

`contracts/` and `circuits/` are **top-level** (not under `packages/`) because they
are non-JS build domains with their own toolchains — keeping them top-level makes
the build graph and the mental model honest.

---

## 5. Package boundaries

Single responsibility each; no overlaps. The dependency arrows point one way.

| Package | Owns | Must NOT contain |
|---------|------|------------------|
| `contracts/pool` | Pool entrypoints (shield/withdraw), tree frontier + root ring, nullifier set, asset custody, events | Any hashing; any proving; key logic |
| `contracts/groth16` | BLS12-381 Groth16 verification (MSM + multi-pairing), vk types, point decoding | Pool/business logic |
| `circuits` | Circom sources, gadgets, trusted-setup scripts, artifact generation, cross-impl test vectors | Any TS app logic; any runtime |
| `packages/types` | The **canonical** public-input ordering, Fr/byte encoding, address-limb split, note types | Behavior; only definitions |
| `packages/wallet-core` | Key hierarchy, note model, scanning, balance, tx assembly, crypto (X25519/AEAD/Argon2id), local DB access | React; proving internals; network transport |
| `packages/proving` | Witness gen + Groth16 proving in a worker, zkey cache | Key material persistence; UI |
| `packages/sdk` | Typed contract client (Stellar SDK), indexer client, relayer client (B2) | Secrets; proving |
| `apps/web` | UI, routing, design system, orchestration of the above | Crypto/proving/contract logic (delegates to packages) |
| `apps/indexer` | Event ingest, Merkle rebuild, path/frontier/ciphertext API | Trust authority (it is untrusted; clients verify vs on-chain root) |

The one seam that must never diverge: **`packages/types` is the single source of
the public-input schema**, consumed by circuits, the Rust verifier (via generated
constants), and the SDK. CI asserts agreement.

---

## 6. Smart contract breakdown

Two compiled units. One business contract, one reusable verifier module.

### `UmbraPool` (the only deployed contract)

- **Responsibility:** custody pooled XLM; verify shield/withdraw proofs; maintain
  the incremental Merkle frontier + recent-roots ring; enforce the nullifier set;
  emit the event stream. **Computes no hashes.**

- **Storage schema:**

  | Scope | Key | Value | Notes |
  |-------|-----|-------|-------|
  | instance | `Config` | asset (SAC), depth=20, domain, `vk_shield`, `vk_withdraw` | set at init |
  | instance | `next_index` | u32 | next free leaf |
  | instance | `frontier` | Vec<BytesN<32>> (≤20) | incremental-tree filled subtrees |
  | instance | `roots` | Vec<BytesN<32>> (ring, 32) | recent valid roots |
  | instance | `root_cursor` | u32 | ring head |
  | persistent | `Null(nf: BytesN<32>)` | `()` | spent-nullifier set; TTL-bumped |

- **Public methods:**

  | Method | Effect |
  |--------|--------|
  | `init(admin, config)` | one-time; stores config + both verifying keys |
  | `shield(proof, new_root, leaf_index, commitment, value, depositor)` | verify(`vk_shield`); require `old_root==current`; SAC.transfer(depositor→pool, value); advance frontier/root; emit `commitment` |
  | `withdraw(proof, root, nullifier, recipient, amount, fee, relayer)` | verify(`vk_withdraw`); require `is_known_root(root)`; require `!is_spent(nullifier)`→mark; SAC.transfer(pool→recipient, amount); optional SAC.transfer(pool→relayer, fee); emit `nullifier`, `withdrawal` |
  | `current_root() / is_known_root(r) / is_spent(nf)` | views |

- **Events:** `commitment(leaf_index, commitment)` · `nullifier(nullifier)` ·
  `withdrawal(recipient, amount)` · `shielded(value)`. (Note ciphertexts ride as
  call args/events only under B1.)

### `groth16` (module linked into `UmbraPool`)

- **Responsibility:** given (vk, proof, public_inputs[]), compute `vk_x` via
  `bls12_381_g1_msm` and return the `bls12_381_multi_pairing_check` of the 4-term
  Groth16 identity. Decode 96/192-byte uncompressed big-endian points. Subgroup
  validation is automatic in the host (do not re-implement).
- **No storage, no events.** Pure verification. Reused by both pool entrypoints.

---

## 7. Circuit breakdown

Two circuits in the MVP. `transfer` is specified for B1 but **not built unless the
stretch is reached.** No on-chain hashing anywhere — both circuits carry their own
Merkle logic.

### `shield`

| | |
|---|---|
| **Public inputs** | `domain`, `asset`, `value`, `old_root`, `new_root`, `leaf_index`, `commitment` |
| **Private inputs** | `owner_pk`, `blinding`, `frontier[20]` |
| **Output** | validity (Groth16) |
| **Constraints** | (1) `commitment = Poseidon(owner_pk, value, asset, blinding)`; (2) `new_root = MerkleInsert(old_root, frontier, leaf_index, commitment)`; (3) frontier consistency with `old_root`. Small (~25 Poseidon). |

### `withdraw` (the privacy payoff — mixer-shaped, **no insertion**)

| | |
|---|---|
| **Public inputs** | `domain`, `asset`, `root`, `nullifier`, `recipient_hi`, `recipient_lo`, `amount`, `fee`, `relayer_hi`, `relayer_lo` |
| **Private inputs** | `ask` (→ `nk`), `value`, `blinding`, `leaf_position`, `merkle_path[20]` |
| **Output** | validity (Groth16) |
| **Constraints** | (1) `nk = Poseidon(ask)`, `owner_pk = Poseidon(nk)`; (2) `commitment = Poseidon(owner_pk, value, asset, blinding)`; (3) `MerkleInclusion(root, leaf_position, commitment, merkle_path)`; (4) `nullifier = Poseidon(nk, leaf_position)`; (5) `amount + fee == value` (full-note withdraw, no change); (6) `value < 2^64` range check (correct 255-bit field width); (7) bind `domain`, `recipient_{hi,lo}`, `relayer_{hi,lo}`. ~25–30 Poseidon, no insertion gadget → smallest viable spend. |

Recipient/relayer are inert in-circuit (bound bits) but are what the contract pays —
binding them is the front-running fix. **Why this is cheap on-chain:** withdraw
verifies + pays + nullifies; it never inserts, so a withdraw tx is verify (~40M) +
1–2 SAC + 1 storage write, comfortably inside budget.

### `transfer` — **B1 stretch only**

2-in/2-out join-split with value conservation, dummy inputs, range checks, **and**
in-circuit 2-leaf insertion (reintroduces the verify+insert cost). Public:
membership_root, old/new insertion roots, 2 nullifiers, 2 output commitments,
public_out, recipient/relayer limbs, fee, domain. Build only if §11 Phase 4 is green.

---

## 8. Frontend route map

| Route | Purpose |
|-------|---------|
| `/` | Landing (unauth) / balance + activity (auth). One screen, one primary action. |
| `/onboarding` | Seed generation, passphrase, ready. The trust moment. |
| `/shield` | Deposit XLM → pool. Proving (shield). Anonymity-set indicator. |
| `/pay` | Pay any address privately (manual entry). Proving (withdraw). |
| `/pay/[link]` | Pay a pre-filled request link (the invoice/donation entry point). |
| `/links` | Create + manage private payment-request links/invoices; paid/unpaid status. |
| `/withdraw` | Move funds from pool to an address you control. Proving (withdraw). |
| `/activity` | Unified history; explorer links; the "what you see" view. |
| `/settings` | Seed backup, passphrase, network, "what the chain sees" transparency panel. |

`/pay` and `/withdraw` share one underlying flow (the withdraw circuit) with
different framing. `/links` + `/pay/[link]` together are the consumer wedge.

---

## 9. Database schema (local, wa-sqlite over OPFS, encrypted at rest)

Sensitive columns AEAD-sealed under an Argon2id-derived key. The DB is a cache; the
chain + seed are the source of truth.

| Table | Columns | Indexes / keys |
|-------|---------|----------------|
| `keys` | `id` PK, `seed_sealed` (blob), `enc_pubkey`, `created_at` | single-row |
| `notes` | `commitment` PK, `value`, `asset`, `blinding` (sealed), `leaf_position`, `status` (unspent/pending/spent), `nullifier`, `created_at`, `spent_at` | idx(`status`), idx(`nullifier`) |
| `nullifiers_seen` | `nullifier` PK, `seen_ledger` | on-chain spends to mark notes spent |
| `payment_links` | `id` PK, `label`, `amount`, `recipient`, `memo`, `expiry`, `status` (unpaid/paid), `created_at`, `paid_tx` | idx(`status`) |
| `activity` | `id` PK, `type` (shield/pay/withdraw), `amount`, `counterparty`, `tx_hash`, `status`, `created_at` | idx(`created_at`) |
| `sync_state` | `id` PK, `last_cursor`, `tree_root`, `updated_at` | single-row scan checkpoint |
| `settings` | `key` PK, `value` | passphrase params, network |

**Relationships:** `notes.nullifier → nullifiers_seen.nullifier` (spend detection);
`payment_links.paid_tx → activity.tx_hash`; `activity` references notes by tx. All
joins are local-only; nothing about ownership leaves the device.

---

## 10. Design system — white premium, institutional, trustworthy

**Direction (decisive):** a **white premium** base in the Stripe / Linear / Apple
lineage — calm surfaces, generous space, hairline structure, confident typography —
with the **`#FF3B00` signal reserved exclusively for cryptographic actions**. This
honors the repeated product brief *and* preserves the one rule from
`design-system.md` that uniquely serves the ZK thesis: **color means cryptography
is happening.** Everything else is black, white, and refined neutrals. This refines
the strict Swiss-Brutalist tokens toward white-premium — a conscious product
decision; `design-system.md` should be updated to match (see §14).

| Element | Specification |
|---------|---------------|
| **Palette** | Paper `#FFFFFF`; app surface `#FAFAFA`; ink `#0A0A0A`; secondary `#6B7280`; hairline `#E6E8EB`; **signal `#FF3B00` (cryptographic actions only)**. No other hue. No gradients. |
| **Typography** | **Inter** for all UI (tight, confident scale: 13/14 body, 20/24/32 headings, -1% to -2% tracking on large). **JetBrains Mono** for every address, hash, proof, balance — always with one-click copy. |
| **Spacing** | 4px base grid; 8/12/16/24/32 rhythm; premium = whitespace, not density. Page max-width ~960–1040px, centered. |
| **Cards** | White, `1px` hairline border, **4px radius**, near-flat (at most a single 1px/very-low-opacity shadow on elevated modals). Depth via borders, not glow. |
| **Tables** | Hairline row separators, monospace numerics right-aligned, generous row height (44–52px), no zebra. Institutional, ledger-like. |
| **Forms** | Large inputs, hairline border, `2–4px` radius, mono for amounts/addresses, inline validation in ink (errors in a muted red distinct from signal — signal is never an error color). Primary submit = the only signal element on the screen when it triggers a proof. |
| **Crypto animations** | The **proving** moment: a precise, restrained signal-colored progress indicator (a thin determinate bar or a minimal stepwise "witness → prove → verify" trio), with plain-language captions. **No** particles, no neon, no spinners-as-spectacle. The aesthetic is a precise instrument's status light, not a slot machine. |

**Hard "no crypto casino" rules:** no purple/green gradients, no glassmorphism, no
glow, no animated coins, no confetti, no dark-mode neon. Trust comes from
restraint, alignment, and monospace honesty.

---

## 11. Development sequence

Date-anchored to the 9-day window. **Each phase ends in working, independently
testable software.** A hard **feature freeze on 2026-06-28**.

### Phase 0 — Feasibility gate + scaffold · Jun 20–21
- Run the **Day-0 benchmark plan** (§12). This gates everything.
- Stand up the monorepo (move app → `apps/web`; add packages, `contracts/`,
  `circuits/`, `infra/`).
- Generate + pin **Poseidon-BLS12-381 constants** with cross-impl vectors
  (circom ↔ Rust ↔ TS). Run the demo trusted setup at small power.
- **Exit test:** a trivial BLS12-381 Groth16 proof verifies on testnet within
  budget; Poseidon vectors agree across all three implementations.

### Phase 1 — Shield end-to-end · Jun 21–23
- `shield.circom` + `vk_shield`; `UmbraPool.shield` + `groth16` module; SAC custody;
  `commitment` event; indexer ingest + tree rebuild.
- **Exit test:** a real shield proof, generated in a worker, verified on testnet;
  the commitment appears in the indexer's tree and the contract's root advances.

### Phase 2 — Withdraw end-to-end (the privacy payoff) · Jun 23–25
- `withdraw.circom` + `vk_withdraw`; `UmbraPool.withdraw` with nullifier set +
  recipient binding + payout.
- **Exit test:** shield → withdraw to a *different* address; proof verified
  on-chain; payout received; **replaying the same proof fails** (double-spend
  blocked); no on-chain link between shield and withdraw.

### Phase 3 — Product layer · Jun 25–27
- Premium white frontend for `/onboarding`, `/shield`, `/pay`, `/links`, `/pay/[link]`,
  `/activity`, `/settings`; `wallet-core` (keys, notes, scan, balance);
  `proving` worker wired to the UI proving states; wa-sqlite/OPFS local DB.
- **Exit test:** a non-developer completes the full journey (create wallet → shield →
  create link → pay link → see activity) on testnet without touching a terminal.

### Phase 4 — Harden + (stretch B1) · Jun 27–28
- Edge cases, error states, the explorer "what the chain sees" view, anonymity-set
  meter, copy affordances everywhere, double-spend + recovery tests.
- **Stretch only if green:** `transfer.circom` + `UmbraPool` spend path for one
  in-pool private transfer (the stronger demo climax).
- **Exit test:** the demo script runs start to finish, twice, with no manual repair.
  **Feature freeze EOD Jun 28.**

### Phase 5 — Submission · Jun 28–29
- Record + edit the demo video (§2); write the README + architecture diagram;
  finalize `infra/deploy` with public contract IDs; make the repo public; dry-run a
  fresh-clone build.
- **Exit test:** submitted on DoraHacks (repo + video) **before Jun 29 19:00**, with
  ≥3 hours of buffer.

---

## 12. Day-0 benchmark plan

Concrete, pass/fail. Run in `infra/benchmarks`; record results in-repo. **If 1 or 4
fail, the architecture changes before any app code.**

| # | Validates | Exact task | Pass criterion |
|---|-----------|------------|----------------|
| 1 | **Proof verification + composite tx budget** | Deploy a BLS12-381 Groth16 verifier on testnet; invoke a realistic `withdraw`-shaped tx: verify (~15 public inputs) + `g1_msm` + 1–2 SAC transfers + 1 nullifier write. Read CPU instructions from the tx meta. | **< ~70M** instructions (headroom under the ~80M practical wall). |
| 2 | **Proof generation latency** | Build `withdraw.circom` (~25–30 Poseidon); prove in-browser with rapidsnark-wasm on a mid-range laptop; time witness + prove. | **< ~10s** end to end; zkey loads/caches successfully. |
| 3 | **Poseidon-BLS12-381 correctness** | Generate constants; compute the same inputs in circom witness, the Rust verifier path, and the TS `wallet-core`. | **Byte-identical** outputs across all three. |
| 4 | **Nullifier integrity (security)** | shield → withdraw → force the nullifier persistent entry toward archival/TTL lapse → attempt replay. | **Replay rejected.** No double-spend. |
| 5 | **Storage + serialization** | Measure per-op ledger writes (entries + bytes) for shield/withdraw; round-trip a snarkjs vk/proof through the Soroban encoder. | Writes ≤ limits; vk/proof decode + verify true. |
| 6 | **Event retention** | Query testnet RPC `getEvents` retention window for the target provider. | Window known; indexer/archive recovery requirement decided. |

---

## 13. Risk register (top 20)

Severity × Likelihood, with the mitigation that actually moves the needle. Ordered
by priority.

| # | Risk | Sev | Lik | Mitigation |
|---|------|-----|-----|------------|
| 1 | Composite withdraw/shield tx exceeds instruction budget | High | Med | **Benchmark #1 Day-0**; drop in-tx fee transfer; minimize public inputs; keep insertion off withdraw |
| 2 | Poseidon-BLS12-381 constants wrong → silent insecurity / verify fails | High | Med | Cross-impl vectors (#3) before trusting any circuit; pin in `types` |
| 3 | Browser proving too slow / OOM on demo machine | High | Med | rapidsnark-wasm; desktop-only; pre-warm zkey; keep withdraw circuit minimal |
| 4 | vk/proof serialization mismatch (snarkjs→Soroban) → always-false verify | High | Med | Reuse `circom2soroban` logic; round-trip tests (#5) |
| 5 | In-circuit insertion (shield) bug → wrong root → withdraw can't prove membership | High | Med | Test insertion gadget against off-chain tree; assert root parity |
| 6 | Scope overrun: B1 join-split eats the schedule, core slips | High | Med | **Ruthless freeze**; B1 is stretch-only after A is green; Jun-28 freeze |
| 7 | Nullifier archival-replay double-spend | High | Low | Persistent + TTL bump; **test #4**; document |
| 8 | Recipient 2-limb binding/reconstruction bug → wrong/failed payout | High | Low | Unit-test on-chain address reconstruction; explorer-verify payout |
| 9 | Indexer/tree desync → wrong Merkle path → unprovable | High | Med | Single tree source; client verifies path vs on-chain root before proving |
| 10 | Trusted-setup (BLS12-381 ptau) not ready in time | Med | Med | Run own small ceremony in Phase 0; smallest sufficient power |
| 11 | SAC (XLM) transfer auth / custody issues | Med | Med | Use SAC + `require_auth`; integration-test in Phase 1 |
| 12 | Range-check field-width (254 vs 255) bug → unsound/failing | Med | Med | Use 255-bit decomposition; test boundary values |
| 13 | wa-sqlite / OPFS browser incompatibility | Med | Med | Target desktop Chrome; in-memory fallback store behind same interface |
| 14 | Live demo machine/network failure | Med | Med | **Pre-recorded video is the submission**; rehearse twice |
| 15 | Key derivation / recovery bug → notes unrecoverable | Med | Low | Deterministic from seed; test seed→full-restore path |
| 16 | zkey too large to ship/load | Med | Low | Keep circuit small; CDN + Cache Storage; lazy-load on first prove |
| 17 | Testnet protocol/SDK drift | Med | Low | Pin stellar-cli/SDK versions; target current testnet protocol |
| 18 | UI polish crowds out core | Med | Med | Core flows before pixels; polish in Phase 5 only |
| 19 | Double-spend / nullifier check logic bug | High | Low | Explicit replay test in Phase 2 exit; never skip |
| 20 | Submission logistics (TZ, repo private, video length) | Med | Low | §14 checklist; submit with ≥3h buffer; repo public + fresh-clone build test |

---

## 14. Winning submission checklist

**Repo**
- [ ] Public GitHub repo; clean history; MIT/Apache license.
- [ ] Fresh-clone build works (`pnpm i && pnpm build`; contracts build; circuits build).
- [ ] `infra/deploy` lists **public testnet contract IDs** anyone can inspect.
- [ ] `docs/` includes ARCHITECTURE, FEASIBILITY_REVIEW, IMPLEMENTATION_PLAN, design-system.
- [ ] `infra/ceremony` transcript + `infra/benchmarks` recorded results (shows rigor).

**README (the judge's first 60 seconds)**
- [ ] One-line thesis + a 20-second "what it is."
- [ ] A diagram (client → proof → Soroban verify → pool) above the fold.
- [ ] "ZK is load-bearing": one paragraph stating exactly what the proof guarantees
      and where it is verified on-chain (with the contract ID + explorer link).
- [ ] Quickstart, testnet links, and the demo video embedded at the top.
- [ ] Honest scope: what ships (payer-unlinkability) vs. roadmap (recipient privacy).
- [ ] Design-system note reconciling the white-premium direction.

**Screenshots**
- [ ] Landing, shield (proving), pay-via-link (proving), the explorer "what the
      chain sees" split, activity. White-premium, signal only on proofs.

**Architecture diagrams**
- [ ] System diagram + the shield and withdraw flow diagrams (reuse ARCHITECTURE.md).

**Demo video**
- [ ] ~2:20, the §2 script, voiceover, always cutting to the explorer after each
      proof. Hosted (YouTube/Loom) + linked in README + attached to the submission.

**Judging alignment (single open-innovation track, top 5)**
- [ ] **On-chain verification is shown, not claimed** — explorer proof, contract ID.
- [ ] **Real-world framing** — private payments / donations, not a crypto toy.
- [ ] **Working live** — the whole journey runs on testnet end to end.
- [ ] **Technical depth signalled** — recipient binding, BLS12-381 host-fn verifier,
      the feasibility review, the benchmark results.
- [ ] **Premium product feel** — the wedge that separates Umbra from the CLI prototype.

---

## 15. Final recommendation

**If only one version of Umbra can ship, ship this:**

> **Umbra — private payments on Stellar.** A premium, white, institutional web app
> in which a user creates a local non-custodial wallet, **shields** XLM into a
> privacy pool, and makes a **private payment** — to any address, or via a
> shareable payment-request link — whose validity is enforced by a **Groth16 proof
> over BLS12-381, generated in the browser with Circom + snarkjs and verified
> inside a Soroban smart contract on testnet.** The proof guarantees the payer owns
> a real, unspent deposit and is not double-spending, while revealing **nothing**
> that links the payment back to the shield. Built **mixer-shaped** (shield inserts;
> withdraw verifies, nullifies, and pays — never both in one transaction) for live
> reliability, with the **recipient bound inside the proof** to close the
> front-running gap that Stellar's own privacy-pools prototype left open.

This is the single answer because it is the **intersection of "provably wins the
track" and "provably ships in nine days"**: the cryptography is de-risked by
existing Stellar prior art, every transaction stays well inside the instruction
budget, the proving stays on desktop where it works, and the privacy claim
(payer-unlinkability) is complete and honestly demoable. The in-pool private
transfer (bidirectional privacy) is the *only* feature held as a stretch — it is the
demo's climax if Phase 4 comes in green, and its absence does not weaken the thesis.

**Do not** broaden scope to multi-asset, mobile, relayers, or join-split before the
mandatory list (§1.A) is frozen and the §2 demo runs clean twice. The way to lose
this hackathon is to build the ambitious version badly; the way to win it is to
build the proven version flawlessly and make it feel like a product.

---

*Sources for the timeline, prize, and track requirements: DoraHacks —
[Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk).
Technical findings inherited from `docs/FEASIBILITY_REVIEW.md`.*
