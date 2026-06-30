# Umbra — Full Product & Technical State (for brainstorming → mainnet)

_Written 2026-06-27. The complete, honest picture: product, UX, design, contracts
(translated to plain English), circuits, SDK, the new cross-device recovery, what's
real vs roadmap, the concrete gap to **mainnet**, and a strategic read on the new
OpenZeppelin/SDF Confidential Tokens preview. Supersedes `docs/STATE.md`._

---

## 0. One-paragraph reality check

Umbra is a **consumer privacy wallet for Stellar**. Money moves through a **pool whose
validity is enforced by a Groth16 zero-knowledge proof verified on-chain inside a
Soroban contract** (BLS12-381, via Stellar's CAP-0059 host functions). The crypto is
real and **live on testnet** — real shield/withdraw transactions, generated **in the
browser** and confirmed on a public explorer. As of this week it also has the feature
that makes it feel like a real wallet: **your private balance follows your wallet
across devices** (deterministic note derivation + on-chain recovery), proven with
Freighter. What it is **not** yet: it hides the **link** between deposits and
withdrawals (mixer-style) but **not the amounts** (those are public); it's
**single-asset**; the proof system needs a **trusted-setup ceremony** for mainnet; and
there's no audit. Those are the mainnet gaps, detailed in §11–12.

---

## 1. Product thesis & what exists

> **Private money on Stellar. Shield. Pay. Disclose only when you choose.**

Umbra is positioned as **the privacy layer for Stellar**, shaped like STRK20:
infrastructure (a proven on-chain-verified pool + an SDK) wrapped in a **premium
consumer product** (a privacy wallet) plus a small ecosystem of apps.

Working today, end-to-end, on testnet:

- **Shield** — deposit XLM into the pool privately.
- **Send privately** — withdraw to any address, unlinkable from your deposit.
- **Unshield** — cash out to your own wallet.
- **Pay links / donations / invoices** — pre-authorized private payment links.
- **Selective disclosure** — export an encrypted audit packet for an accountant/auditor.
- **Cross-device recovery** — connect your wallet anywhere; your balance is rebuilt
  from chain (also removed the old single-writer limitation).
- **Multi-wallet** — Freighter (direct), xBull/Albedo/LOBSTR (via Stellar Wallets Kit),
  + a testnet demo key.
- **`@umbra/sdk`** — the primitives, for other builders.

---

## 2. The full UX — every page

The app is **dark, cinematic** (living animated background, smooth scroll, a 3D pool
scene). Chain mode is **on**, so every action is a real testnet transaction.

| Route | What it is | Real / notes |
| --- | --- | --- |
| `/` | **Landing** — brutalist hero "PRIVATE MONEY ON STELLAR." + "Shield. Pay. Disclose only when you choose."; the **3D "ENTER THE POOL"** scroll scene (tokens absorbed); problem → solution (Shield/Send/Disclose) → "Built for real money" (freelancer/donor/business) → "what the chain sees" → trust. | marketing, real content |
| `/wallet` | **Privacy Wallet** (the product) — shielded balance, connect, **Shield/Send/Unshield/Pay-link**, **lifecycle stepper** (proving → signing → submitting → confirming), **"What you did vs What Stellar sees"** on success, activity, **Disclosure Kit**, **sync-from-chain** row. Private Swap / Private Transfer shown "coming soon". | all real on-chain |
| `/proof` | **Proof Center** — "Don't trust us. Verify." Copyable contract ids, live explorer links, two real txs, the ZK pipeline, test results, selective-disclosure card, real-vs-roadmap. | real evidence |
| `/audit` | **Auditor view** — paste an audit packet + viewing key → decrypts a timeline ("what Stellar saw" vs "what you disclosed"). Labelled sample when empty. | real client-side crypto |
| `/build` | **For developers** — premium (Apple-grade) SDK page: install, two code examples, "what's in the box", contract ids, real-vs-roadmap. | real (SDK unpublished) |
| `/apps` | Ecosystem gallery (payment links · donations · invoices · wallet). | links to real flows |
| `/shield`, `/withdraw` | Standalone deposit / cash-out (superseded by `/wallet`; `/withdraw` still says "USDC" — legacy). | real |
| `/pay/[id]` | Pay a private link; integrity-checked (tamper → rejected). | real on-chain |
| `/links`, `/donate`, `/invoice` | Create payment / donation / invoice links. | real |

---

## 3. Design system

- **Dark, cinematic.** Background `#0A0A0A`; surface `#121212`; ink `#FAFAFA`; signal
  `#FF3B00` (CTAs + crypto moments only). Tokens in `styles/globals.css` +
  `tailwind.config.ts`.
- **Type:** Inter (UI), **JetBrains Mono** (all crypto data — hashes/addresses/
  balances), **Archivo** (heavy uppercase display headlines).
- **Motion:** Lenis smooth scroll + Framer Motion scroll-linked hero + the `PoolScene`
  3D scroll scene + blur-up reveals. Respects `prefers-reduced-motion`.
- **Premium components:** gradient-orange buttons, top-light cards, soft-glow inputs,
  an animated **`SuccessMark`** (ring draws on + check strokes in — replaced the flat
  green checkmark), the **TxProgress** lifecycle stepper.
- The **`/build` page** uses the same dark palette but a cleaner, Apple-grade,
  developer-docs layout (window-chrome code blocks, generous spacing).

---

## 4. End-to-end data flow

```
Browser (Next.js / React 19)
  hooks/use-prover → prover.worker → snarkjs Groth16 (Web Worker, off-thread)
        │ proof
        ▼
  hooks/use-wallet → signer.ts (Freighter | Wallets-Kit | testnet key)
        │ signer
        ▼
  lib/umbra/soroban.ts → @stellar/stellar-sdk → Soroban RPC → UmbraPool contract
        │                                                       │ verifies proof ON-CHAIN
        ▼                                                       ▼
  lib/umbra/wallet.ts (notes; deterministic;            DepositCreated / WithdrawalCompleted
   tree rebuilt from chain) ◄── recovery.ts ◄── getEvents() ◄──┘
```

---

## 5. THE CONTRACTS, IN PLAIN ENGLISH

Two Rust/Soroban contracts (`contracts/`). Below is what they actually do, translated
from the code.

### 5a. `umbra-pool` — the privacy pool

State it keeps:
- **Two verifying keys** (one for the shield circuit, one for the withdraw circuit) —
  pinned at init so only proofs from *our* circuits are accepted.
- **The pooled asset** (a token address; today the native XLM SAC wrapper).
- **An incremental Merkle tree of commitments** — stored compactly as a "frontier"
  (the running edge of the tree) + a **`next_index`** counter, not the whole tree.
- **A ring of recent roots** (the last 32) — a withdrawal may prove against any of them.
- **A nullifier set** (persistent) — every spent note's nullifier, so nothing is spent
  twice.

The three functions:

**`init(token, vk_shield, vk_withdraw)` — one-time setup.**
> "Bind the asset and both verification keys, and start an empty tree." It refuses to
> run twice (`AlreadyInitialized`). It seeds the frontier with the precomputed
> zero-subtree hashes and records the empty-tree root as the first known root.

**`shield(proof, commitment, amount, depositor) → leaf_index` — deposit privately.**
> 1. Load the shield verifying key (error if not initialized).
> 2. **Verify the proof** that `commitment` is a well-formed note for this **public**
>    `amount` (so nobody can mint a note claiming more than they deposit). Public
>    inputs, in pinned order: `[commitment, amount]`. Invalid → `InvalidProof`.
> 3. Require the depositor's authorization and **pull `amount` tokens** from them into
>    the pool.
> 4. **Insert the commitment** into the Merkle tree (advancing `next_index` and the
>    frontier, computing the new root, appending it to the recent-roots ring).
> 5. Emit **`DepositCreated(commitment, leaf_index, amount)`** and return the leaf index.

**`withdraw(proof, root, nullifier, recipient, amount, to)` — exit privately.**
> 1. Load the withdraw verifying key.
> 2. **Verify the proof.** Public inputs, pinned order: `[root, nullifier, recipient,
>    amount]`. The proof attests (without revealing which note): the note is included
>    under `root`, the prover owns it, the `nullifier` is correctly derived, the
>    `recipient` is bound in, and the withdrawn `amount` equals the note's hidden value.
> 3. **Check `root` is one the contract actually produced** (in the recent ring) →
>    else `UnknownRoot`.
> 4. **Check the nullifier hasn't been spent** → else `NullifierAlreadySpent`; then
>    record it as spent (with a long storage TTL).
> 5. **Pay `amount` to `to`.**
> 6. Emit **`WithdrawalCompleted(nullifier, to, amount)`**.

Read-only views: `current_root()`, `is_spent(nullifier)`, `next_index()`.

The tree insert (`insert_commitment`, internal) is a **Tornado-style incremental
Poseidon Merkle tree**, depth **8** (so **256 notes** per pool today). It walks from
the leaf to the root once per insert, hashing with Poseidon and the stored zero-subtree
hashes — O(depth) work, no full-tree storage.

**The crucial honesty point:** the **amount is a public input** and is in the events +
the token transfer. So an observer sees *"someone deposited 100 XLM"* and *"someone
withdrew 100 XLM to address G…"* — what they **cannot** see is **which deposit funded
which withdrawal** (that link is hidden by the proof). Umbra is a **mixer** (link
privacy), **not** confidential-amount money. (This is the key contrast with the new
Confidential Tokens — see §13.)

### 5b. `groth16-verifier` — the on-chain proof checker

A reusable library (the pool calls it directly). It checks a **Groth16 proof over
BLS12-381** using Stellar's native **CAP-0059 host functions** — the reason Umbra can
verify a real ZK proof on-chain cheaply (~40M of the 100M instruction budget,
**constant in circuit size**).

In plain English: it computes one combined point from the public inputs (a
multi-scalar multiplication: `vk_x = IC[0] + Σ pubᵢ·IC[i]`), negates the proof's `A`
point, and then asks the host to check **one product of four pairings equals 1**:

```
e(−A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
```

If that holds, the proof is valid. The host validates that all points are on-curve and
in the right subgroup automatically, so malformed proofs are rejected for free.

### 5c. The circuits (what the proofs actually prove)

Circom (`pragma circom 2.1.6`), compiled to Groth16/BLS12-381.

- **`shield.circom`** — proves `commitment = Poseidon(secret, amount)`. Public:
  `[commitment, amount]`; private: `secret`. (Stops over-minting: the hidden note can't
  claim more than the public amount deposited.)
- **`withdraw.circom`** (depth 8) — proves all five properties at once:
  (1) Merkle **inclusion** of `Poseidon(secret, value)` under the public `root`;
  (2) **ownership** (knows `secret`); (3) **nullifier** `= Poseidon(secret, leafIndex)`
  where `leafIndex` is derived from the path bits; (4) **recipient binding** (the public
  `recipient` is forced into the constraint system, so a proof can't be redirected);
  (5) **amount conservation** (`amount == value`, full-note withdrawal). Public:
  `[root, nullifier, recipient, amount]`.

Poseidon is **byte-identical** across the contract (Rust), the circuit (Circom), and
the wallet (TS) — proven by a cross-implementation oracle test.

---

## 6. Cross-device wallet-linked recovery (new — the breakthrough)

The thing that makes it feel like a real wallet. Three parts:

1. **Deterministic notes** (`lib/umbra/note-derivation.ts`) — a note's secret is derived
   from a per-wallet seed instead of being random. Seed = `H(raw ed25519 key)` for the
   testnet key, or `H(signMessage("Umbra · …"))` for Freighter / kit (Ed25519
   signatures are deterministic, **verified with Freighter**). Same wallet → same seed →
   same note secrets.
2. **On-chain discovery** (`lib/umbra/recovery.ts`) — scans the pool's `DepositCreated`
   / `WithdrawalCompleted` events, **rebuilds the full Merkle tree** (so withdrawal
   paths are correct regardless of other writers — this **removed the single-writer
   limitation**), and re-identifies the wallet's own notes by re-deriving secrets and
   matching commitments (+ spent status).
3. **Wired into the wallet** — auto-sync on connect; new notes are deterministic.

**Proven:** wipe local + session storage (a genuinely fresh "device"), reconnect
Freighter → the shielded balance is rebuilt from chain → withdrawable from there.

**Honest limits:** notes shielded *before* this upgrade used random secrets and stay
device-local. The encrypted **audit log is local-only** (it's private metadata, not on
chain) — balance follows the wallet automatically; the disclosure trail follows your
exported viewing key + packets. The recovery scan looks back ~6h of ledgers (tunable);
production wants an indexer or a stored deploy-ledger.

---

## 7. Selective disclosure (the Audit Packet)

`lib/umbra/viewing-key.ts` + `audit-store.ts` + `/audit`. Every action is logged
locally and **AES-GCM-encrypted under a viewing key only the user holds**. The user can
**export an audit packet** (and the key, separately) to disclose to an accountant or
auditor; the `/audit` page decrypts it into a timeline. **v1 is symmetric** —
encryption-based, no backdoor, no auditor public key, no ZK disclosure proof (those are
roadmap). 6 unit tests + a live export→decrypt E2E.

---

## 8. SDK (`@umbra/sdk`)

Curated re-exports of the proven primitives: `makeNote`/`commitment`/`nullifier`/
`recipientField`, `MerkleTree`/`DEPTH`, `buildShieldInput`/`buildWithdrawInput`,
`poseidon`/`poseidon2`, the BLS12-381→Soroban encoding, the payment-link codec,
`UMBRA_CONTRACTS`. Typechecks clean. **Not published** (`private:true`) — it depends on
two workspace packages via `workspace:*`, so it ships once those are published/bundled
(documented honestly).

---

## 9. Wallet / signing layer

- **Freighter** — direct path (proven; signs real txs; never exposes the key).
- **xBull / Albedo / LOBSTR** — via `@creit.tech/stellar-wallets-kit` (lazy-loaded,
  shown by real availability). Wired; not all connect-tested headlessly.
- **Testnet demo key** — clearly labelled "testnet only", for judges without an
  extension. Signer abstraction: `{ kind: "key" | "freighter" | "kit" }` → one
  `signTransactionXdr` dispatcher; the submission pipeline is unchanged.

---

## 10. Deployed contracts & evidence (testnet, Protocol 27)

| Pool | Contract id | Notes |
| --- | --- | --- |
| **Hardened pool** (C1/H1/M1/M2) | `CCBNNCXZ…JHX` | current `.env.local` + `deployment.json` + `/proof`; wasm `fe2f6379…`; shield `ef25404c…`, withdraw `a37f97c2…` (bound to payee — C1) |
| _superseded_ — canonical demo | `CBGB5DAY…SDV7` | prior (pre-hardening) pool; its txs remain on-chain but are no longer referenced |
| _superseded_ — live wallet pool | `CBT2YYN4…TTNW3` | prior `.env.local` pool |

Token: native SAC `CDLZFC3S…`. All txs confirmed on Horizon. Tests: `umbra-pool` 9/9
(real proofs vs the real BLS host), `crypto-bls` 13/13, app `vitest` 18/18, `tsc`
clean, `next build` 14/14.

**Known deploy gotcha (fixed):** fresh-pool `init` can fail on the first try with
`Storage MissingValue` (RPC hadn't indexed the new contract instance) — retrying init
binds the keys. Worth scripting a retry for mainnet.

---

## 11. What's REAL vs ROADMAP

**Real, on-chain, today:** shield · withdraw · send (unlinkable withdraw-to-address) ·
unshield · payment/donation/invoice links · in-browser proving · Freighter + kit + key
signing · selective disclosure (encryption-based) · **cross-device wallet-linked
recovery** · full-tree-from-chain (no more single-writer limit) · SDK primitives.

**Roadmap / not built:** confidential **amounts** (today amounts are public) ·
shielded→shielded **private transfer** (join-split circuit) · private **swap**
(multi-asset) · **multi-asset** pool · auditor public keys / scoped viewing keys / ZK
disclosure proofs · fee-payer privacy (relayer) · published SDK.

---

## 12. The gap to MAINNET (the part to brainstorm)

You want mainnet, no compromises. The concrete blockers, roughly in priority:

1. **Trusted setup (the big one).** Groth16 needs a **per-circuit trusted-setup
   ceremony**. Today it's single-contributor (demo-grade). Mainnet needs a real **MPC
   ceremony** (e.g. p0tion) — OR a **proof-system change to a transparent setup**
   (PLONK/Halo2/**UltraHonk**), which removes the ceremony entirely. This is a fork in
   the road (see §13).
2. **Amount privacy.** Today amounts are public (mixer, not confidential balances). For
   "real privacy" this is the biggest product gap. Options: range-proof'd confidential
   amounts (bigger circuits), or **build on Confidential Tokens** (§13).
3. **Merkle depth.** 8 → ~20 (≈1M notes). One constant + a recompile + a new ceremony.
4. **Audit.** Contract + circuits + the BLS verifier path. Non-negotiable for mainnet.
5. **Fee-payer privacy.** The account that submits `withdraw` pays the fee and appears
   on-chain — partially de-anonymizing. Needs a **relayer** / fee abstraction.
6. **Note discovery at scale.** The recovery scan works for a fresh pool; at scale it
   needs an **indexer** and likely **encrypted on-chain notes** (so amounts/recipients
   aren't derivable, and discovery is efficient).
7. **Multi-asset** (SEP-41 generality), **recipient↔payout coupling**, **nullifier
   accumulator / rent model**, **multi-sig deployer**, **frontend OpSec**.
8. **Compliance.** Viewing keys → auditor public keys, scoped disclosure, maybe
   programmable compliance hooks.

---

## 13. Strategic read: Umbra vs OZ/SDF **Confidential Tokens** (June 2026 preview)

What was just announced (per the update): OpenZeppelin + SDF shipped a **developer
preview of Confidential Tokens** — private balances **and transfer amounts** for any
**SEP-41** token, using **Noir + UltraHonk** proofs verified on-chain (**verifier by
Nethermind**), wrapped over existing assets, with **compliance hooks**. Testnet only,
unaudited, mainnet ~August.

Why this matters to us (be honest, this is a real strategic fork):

- **It solves two of our hardest mainnet blockers for free.** UltraHonk is a
  **transparent** proof system → **no trusted-setup ceremony** (kills blocker #1). And
  it **hides amounts** (kills blocker #2 / the biggest privacy gap). Both are exactly
  what Umbra would otherwise spend weeks on.
- **Nethermind alignment.** Umbra's stated foundation is "Nethermind SPP", and the CT
  verifier is by Nethermind — there's a coherent story to tell either way.
- **Different privacy shapes.** CT gives **confidential balances/amounts on a token**;
  Umbra gives **unlinkability** (mixer: you can't tell which deposit funded which
  withdrawal) **plus a consumer product** (wallet, pay links, selective disclosure,
  cross-device recovery). These are **complementary**, not the same thing.

Three strategic options to brainstorm:

1. **Build the product ON Confidential Tokens.** Keep everything that's uniquely
   Umbra — the **wallet UX, payment links, selective disclosure, cross-device
   recovery, the SDK, the brand** — and swap the privacy *rail* underneath from "our
   Groth16 mixer" to "Confidential Tokens." You inherit confidential amounts + no
   trusted setup + SEP-41 multi-asset + compliance hooks, and you ship the thing
   **only we have: a beautiful consumer privacy wallet**. Fastest path to a credible
   mainnet story.
2. **Keep the mixer, adopt UltraHonk.** Stay a mixer (unlinkability is a real, distinct
   property CT doesn't give), but migrate the proof system to UltraHonk/Noir to drop the
   trusted setup, and add confidential amounts ourselves. More differentiated, much more
   work, needs an audit of new circuits.
3. **Combine.** Mixer-style unlinkability **layered with** confidential amounts — the
   strongest privacy, the most work. Probably a v2.

My read (for discussion, not a decision): for a hackathon→mainnet path with "no
compromises but real shipping," **Option 1** is the strongest — it turns the new
preview from a threat into our rails, and leans on the one thing we've actually built
that nobody else has: **the product**. Worth a serious brainstorm before we commit.

---

## 14. Open questions to brainstorm

- **Privacy model:** do we need **confidential amounts** for the target user (freelancer
  getting paid in USDC), or is **unlinkability** enough for v1? This decides §13.
- **Build-on-CT vs own-rail:** adopt Confidential Tokens as the primitive, or keep/evolve
  our pool?
- **Asset:** XLM-only, or USDC/SEP-41 first (real-world payments framing)?
- **Compliance:** how far do we take selective disclosure for a mainnet/regulated story?
- **Differentiator:** if CT becomes the standard privacy primitive, Umbra's moat is the
  **product + UX + cross-device + disclosure + SDK** — do we double down there?
- **What's the demo that wins?** The cross-device "your private balance follows your
  wallet" moment is uniquely ours and very showable.

---

## 15. Bottom line

The rare, hard thing is **done and live**: real on-chain-verified ZK private payments on
Stellar, driven from a polished consumer wallet, now with **wallet-linked cross-device
recovery**. The honest gaps to mainnet are **trusted setup, amount privacy, depth,
audit, fee privacy** — and the new **Confidential Tokens** preview happens to erase the
two hardest ones if we build on it. The strongest claim we can make, truthfully:
_"a private payment whose validity a Stellar smart contract verifies on-chain — and a
balance that follows your wallet to any device — today."_
