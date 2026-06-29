# Umbra — What We Built (Honest State)

_As of 2026-06-21. A plain-spoken, end-to-end account of the project: the core
idea, what is genuinely built and verified, the UI/UX as it actually exists, every
user flow, and the honest caveats. No spin. Where a claim is verified this is
stated; where something is demo-grade or unverified, that is stated too._

This document complements three others and tries not to contradict them:
[`CURRENT_STATE.md`](CURRENT_STATE.md) (pre-deploy snapshot),
[`SCOPE.md`](SCOPE.md) (demo-grade parameters + mainnet gates), and
[`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) (the full picture). The big change
since `CURRENT_STATE.md` was written: **it is now deployed and verified on testnet,
and the frontend has been driven in a real browser.**

---

## 1. The main idea

**Umbra is a private payment-link product for Stellar.** Create a link → share it →
someone pays you → you withdraw — and on-chain, an observer can see a deposit and a
withdrawal but **cannot draw the line between them.**

The non-negotiable design principle: **zero-knowledge is load-bearing.** Money
cannot move unless a Stellar (Soroban) smart contract verifies a Groth16 proof
**on-chain**. Privacy is not a UI trick or an off-chain promise — it is enforced by
the contract.

The product framing is "consumer privacy layer for Stellar commerce": the
Stripe-payment-link pattern, made private by ZK. It is meant to feel like a real
financial product (Apple/Stripe/Linear polish), not a cryptography demo — for
freelancers, creators, and NGOs who want to be paid without the whole chain
watching. It is built on the **mixer shape** (shield → private withdraw to a fresh
address), which is the proven, budget-safe design, and on **Nethermind SPP /
Stellar Private Payments** prior art.

> Note on "main idea, like strk20": Umbra is **not a token standard** (it is not an
> ERC-20/STRK-20-style fungible-token spec). It is a privacy **application + pool
> contract**. The closest "standard" it leans on is Soroban's BLS12-381 host
> functions (CAP-0059) and the Groth16/Poseidon toolchain. If a token-standard
> framing was intended, that is not what this is — stated plainly for honesty.

---

## 2. What is real and verified (high confidence)

### 2.1 The cryptography + contract — proven by tests AND now on-chain

- **Contracts** (`contracts/umbra-pool`, `contracts/groth16-verifier`, Rust/Soroban
  SDK 22): `shield()` + `withdraw()`, an on-chain Poseidon Merkle tree, a nullifier
  set, and events. `cargo test -p umbra-pool` → **5/5 pass with real
  snarkjs-generated Groth16 proofs verified by the real BLS12-381 host functions**:
  happy path · double-spend rejected · invalid proof rejected on-chain ·
  wrong-recipient rejected (recipient binding) · on-chain Poseidon ≡ circuit
  Poseidon. (`bench-pool` 6/6.)
- **Circuits** (`circuits/`, Circom 2.2.3, `--prime bls12381`): `shield` + `withdraw`
  compile; real Groth16 proofs generate and verify end-to-end.
- **crypto-bls** (`packages/crypto-bls`): 13/13 unit tests; Poseidon oracle confirms
  Rust ≡ circuit ≡ TS.
- **wallet-core** (`packages/wallet-core`): note model, incremental Merkle tree
  mirroring the contract, witness construction.
- **Payment-link integrity**: amount/commitment tampering is rejected (proof binds
  them) — verified in Node and visible in the UI (`/pay` shows "This link can't be
  trusted" on tampering).

### 2.2 Live on Stellar testnet — NEW, verified this session

Deployed with `infra/deploy/deploy-slice.sh` + `infra/deploy/capture-demo-txs.sh`;
the canonical record is `infra/deploy/deployment.json`.

| Item | Value | Verified |
| --- | --- | --- |
| Network | testnet | — |
| Pool contract | `CBGB5DAYD7RYIHDK2T6DE364VD3RJZGG5AUEQETW6LO3ZI4A5L3LSDV7` | `api.stellar.expert/.../contract/<pool>` → HTTP 200, exists, wasm `6cc6890a…` |
| Native SAC token | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | deployed as demo asset |
| Deploy tx | `d4f96c05…f82d660` | confirmed |
| **Shield deposit tx** | `9fb4dc15…ce7f8efc` | Horizon → `successful: true`, ledger 3205871 |
| **Withdraw tx** | `aa5cf132…107c676` | Horizon → `successful: true`, ledger 3205873 |
| Deployer | `GAHR34WC…HYXQ` | friendbot-funded |

Both demo transactions are **real on-chain proof verifications**: the shield emitted
`DepositCreated{commitment 058253df…, leaf 0}`, and the withdraw emitted
`WithdrawalCompleted{nullifier 5fd65cea…}`. On-chain, the deposit's commitment and
the withdrawal's nullifier share **no linking data** — that is the entire product,
now demonstrable on a public network.

> Honest precision: these two testnet transactions were submitted by the **capture
> script via the stellar CLI**, not through the browser UI (see §5.2).

### 2.3 In-browser proving — NEW, works off-thread, measured

- Groth16 proving runs in a **Web Worker** (`lib/umbra/prover.worker.ts` driven by
  `hooks/use-prover.ts`), so the main thread never freezes. The big 3.9 MB withdraw
  proving key lazy-loads inside the worker on first prove.
- Verified in a real headless Chromium: a real shield proof completes, the page
  stays responsive (requestAnimationFrame keeps ticking during proving).
- **Measured cold-start (single samples, fast Apple-silicon Mac — see caveat):**
  - shield: `keyLoad≈237ms · prove≈2176ms · total≈2413ms`
  - withdraw (3.9 MB zkey): `keyLoad≈117ms · prove≈1261ms · total≈1378ms`
  - These are noisy single runs (file caching makes keyLoad vary); they show the
    3.9 MB key is **not** a multi-second freeze or OOM here. **Mobile / mid-tier
    laptops are unmeasured.**

### 2.4 The frontend renders in a real browser — NEW, QA'd

All routes were driven in headless Chromium at **375px and 1440px**: every route
returns HTTP 200 (404 route correctly 404s), **no horizontal overflow at 375**, and
the console is clean after one trivial fix (a `useSyncExternalStore` server-snapshot
caching warning on `/wallet` and `/withdraw`). The wow-screen shows **3 real
stellar.expert links and 0 PENDING placeholders** at both widths.

---

## 3. Technical architecture (what works, plainly)

| Layer | What it is | Status |
| --- | --- | --- |
| Curve | **BLS12-381** (Soroban CAP-0059 native host functions; the only pairing curve with an on-chain verifier on Stellar) | ✅ |
| Proof system | **Groth16** (constant 3–4 pairing check → one host call; ~288-byte proofs) | ✅ |
| Hash | **Poseidon over BLS12-381 Fr**, constants regenerated for BLS12-381, byte-identical across contract / circuit / wallet | ✅ |
| Tree | On-chain **incremental Poseidon Merkle tree** (frontier + recent-roots ring) | ✅ (depth 8 — demo-grade, §6) |
| Anti-double-spend | Persistent **nullifier set** | ✅ |
| Shape | **Mixer** (shield → private withdraw); withdraw verifies but does not insert, so no single tx pays for verify + tree-hash together | ✅ |
| Contracts | `umbra-pool`, `groth16-verifier` (+ `bench-pool` for benchmarks) | ✅ tested + deployed |
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind v3 · shadcn/ui | ✅ builds 8/8, browser-QA'd |
| Proving | snarkjs in a **Web Worker**, artifacts in `public/circuits` | ✅ off-thread, measured |
| On-chain client | `lib/umbra/soroban.ts` (lazy stellar-sdk, browser-safe) | 🟡 wired; browser→testnet round-trip not exercised in UI (§5.2) |
| Deploy infra | `infra/deploy/*` → `deployment.json` (single evidence source) | ✅ run, live |

`lib/umbra/` files: `config.ts`, `wallet.ts` (local note store), `payment-link.ts`,
`prover.ts` + `prover.worker.ts` + `prover-protocol.ts`, `soroban.ts`.

---

## 4. UI / UX (honest)

### 4.1 The design language actually shipped

The **implemented** design system is **"Premium Financial"** (per
`styles/globals.css` and `tailwind.config.ts`): light-first, background `#FAFAFA`,
surface `#FFFFFF`, ink `#111111`, hairline `#E5E7EB`, **Inter** for UI text,
**JetBrains Mono** for all crypto data (hashes, addresses, balances), soft radii
(`rounded-2xl`), layered low-opacity shadows, generous whitespace. The **signal
color `#FF3B00` is reserved for cryptographic moments only** (the proving step, the
"cannot be connected" reveal, the verified-on-chain link) — never for generic CTAs.

> **Honesty flag — a real divergence:** `CLAUDE.md` (and the original README)
> describe the design as **"Swiss Brutalist"** (square corners, three colors, hard
> borders, no shadows). **The product as built is NOT that** — it is the soft,
> light, premium-financial direction above. The repo's guidance doc and the shipped
> UI disagree; the shipped UI is the source of truth. This should be reconciled in
> the docs (pick one), but it is not a bug.

### 4.2 Component inventory (`components/umbra/`)

- `ui.tsx` — Shell/TopBar, Button (ink primary; never signal), Card, Field,
  AmountField, Eyebrow, Pill, Logo.
- `crypto-timeline.tsx` — the staged "cryptography timeline" (used on the `/pay`
  local path).
- `prover-progress.tsx` — the **real** off-thread proving readout: "Loading proving
  key…" → "Generating zero-knowledge proof…" → "Constraints satisfied ✓", with a
  live MB / ms readout and a signal-colored progress bar (no spinner).
- `withdraw-reveal.tsx` — the **wow-screen**: split-screen "What you did" (human) vs
  "What Stellar sees" (two unlinkable tx cards), with a ~1.5s signal shimmer; reads
  `deployment.json` and shows real explorer links when populated, a tasteful
  "awaiting testnet deploy" placeholder when not.
- `chain-reveal.tsx`, `landing-narrative.tsx` — the landing's "what the chain sees"
  comparison and scroll-revealed narrative.

### 4.3 Responsiveness + polish

- Verified no horizontal overflow at 375px on every route.
- The landing uses scroll-reveal sections (content reveals on scroll — verified
  working; a static full-page screenshot looks empty below the hero, which is an
  artifact of the animation, not a break).
- The 404 page is Next.js's default unbranded screen (a known, listed gap — a custom
  `app/not-found.tsx` would be on-brand but is a new feature, not done).

---

## 5. Every flow

### 5.1 The core protocol flow (what the crypto does)

1. **A note is private money** — `Poseidon(secret, amount)`. Whoever holds `secret`
   owns it.
2. **Shield** moves public funds into the pool under a commitment; a ZK proof
   guarantees the commitment really holds the deposited amount. The commitment is
   inserted into the on-chain tree (`DepositCreated`).
3. **Withdraw** spends a note. A ZK proof proves — without revealing which note —
   Merkle inclusion, note ownership, a one-time **nullifier**, **recipient binding**,
   and amount conservation. The contract verifies the proof on-chain, rejects spent
   nullifiers / unknown roots, pays out (`WithdrawalCompleted`).
4. **Privacy** comes from the pool: a withdrawal cannot be linked to the deposit that
   funded it.

### 5.2 The product flows (routes)

- **`/` Landing** — narrative: the hero ("Public money. Private lives."), the
  "Bob pays → Alice withdraws → CANNOT BE CONNECTED" ledger comparison, and a "Built
  on real cryptography" section (ZK proofs · on-chain verification · Poseidon).
- **`/links` Get paid** — create a payment link. The recipient pre-generates the
  note secret and the **shield proof at link-creation time**; the link carries the
  commitment + proof but **never the secret**. (A "pre-authorized shield.")
- **`/pay/[id]` Pay** — the payer opens the link and funds it. Integrity is
  enforced: tampering with amount/commitment yields **"This link can't be trusted."**
  The default/local path is **choreographed** (it shows success after a timeout; the
  proof is already in the link — nothing is submitted on-chain in local mode).
- **`/shield` Add funds (advanced)** — move funds into the pool directly; the shield
  proof is generated **in the browser, off-thread**.
- **`/withdraw` Withdraw** — prove ownership of a note (real 3.9 MB withdraw proof,
  off-thread), then land on the **wow-screen reveal** showing the two real,
  unlinkable testnet transactions with live stellar.expert links.
- **`/wallet` Activity** — private balance + a history of notes (received / available
  / withdrawn).

> **Honest gap (browser ↔ chain):** `lib/umbra/soroban.ts` (`submitShield` /
> `submitWithdraw`) is written, typechecks, and is browser-safe, but the **full
> browser → testnet submission round-trip has not been exercised end-to-end in the
> UI.** The two live testnet txs (§2.2) were submitted by the CLI capture script. In
> the browser, proving runs for real; on-chain submission from the UI is wired but
> unproven. Connecting `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` to the live pool and driving
> a shield→withdraw through the UI is the next honest milestone.

---

## 6. Honest caveats / demo-grade / not done

- **Merkle depth 8** (256-note capacity), not the architecture's depth 20 — a
  budget-driven slice constant. Fix = gate **G1** (depth-20 recompile) in
  [`SCOPE.md`](SCOPE.md).
- **Single-contributor trusted setup** (a demo ceremony, one file) — not
  production-secure. Fix = gate **G2** (MPC ceremony via p0tion).
- **Tests lift the host budget** (`reset_unlimited`) to validate logic, so the **real
  per-tx testnet instruction cost is not formally benchmarked** (benchmarks B03–B06
  are gated/unrun). The demo txs did confirm on testnet, but a measured cost report
  is still owed.
- **Recipient binding vs. payout address are decoupled** in the slice (the proof
  binds a recipient field; coupling it to the literal payout address is deferred —
  gate G11).
- **Browser wallet assumes a single user** — it rebuilds the tree from its own notes;
  multi-party deposits would need event sync.
- **Proving latency is single-sample on a fast Mac**; mobile / mid-tier is unmeasured.
- **Browser → testnet on-chain submission** not exercised end-to-end in the UI (§5.2).
- **Demo video / `docs/assets/wow.gif`** — not recorded / not created.
- **Design-doc divergence** (Swiss Brutalist vs the shipped Premium Financial) —
  unreconciled (§4.1).
- **`CLAUDE.md` "Phase 0.1 scaffolding only" guardrail is stale** — the project is
  far past scaffolding (crypto, contract, deploy, UI all built).

---

## 7. Verification evidence (command → result)

| Command / check | Result |
| --- | --- |
| `cargo test -p umbra-pool` | 5/5 (real proofs, real BLS12-381 host) ✅ |
| `cargo test` (all contracts) | umbra-pool 5, bench-pool 6 ✅ |
| `pnpm --filter @umbra/crypto-bls test` | 13/13 ✅ |
| `tsc --noEmit` | clean ✅ |
| `next build` | 8/8 routes (benign ffjavascript/web-worker dep warning) ✅ |
| `curl api.stellar.expert/.../contract/<pool>` | HTTP 200, contract exists ✅ |
| `curl horizon-testnet/.../transactions/<shieldTx>` | `successful: true` ✅ |
| `curl horizon-testnet/.../transactions/<withdrawTx>` | `successful: true` ✅ |
| Headless browser — 8 routes × {375, 1440} | render OK, no overflow, console clean ✅ |
| In-browser Groth16 proof (shield) | completes off-thread, main thread responsive ✅ |
| wow-screen | 3 real stellar.expert links, 0 PENDING ✅ |
| Demo video / browser→testnet submit | **not done** ❌ |

---

## 8. Bottom line

The hard, rare thing is done **and now demonstrable on a public network**: a real
zero-knowledge private-payments protocol on Stellar, with proofs verified on-chain,
wrapped in a build-clean, browser-verified premium product, and **live on testnet
with two real, unlinkable transactions you can open in a block explorer.** What
remains is honest finishing work, not core engineering: drive the on-chain submit
through the browser UI, record the demo video, and (for production, not the demo)
clear the depth-20 / MPC-ceremony / audit gates in `SCOPE.md`.
