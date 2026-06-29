# Umbra — Complete Technical State

_As of 2026-06-25. The single source of truth for what Umbra is, what's real, what's
mock, where zero-knowledge is used, the aim we're chasing, and every page's design.
Written to be honest — no spin. Supersedes earlier snapshots (`WHAT_WE_BUILT.md`,
`CURRENT_STATE.md`) where they conflict._

---

## 0. One honest paragraph

Umbra is a **privacy layer for Stellar**: a pool whose validity is enforced by a
**Groth16 zero-knowledge proof verified on-chain inside a Soroban smart contract**.
The cryptography is **real and proven** — circuits, the BLS12-381 verifier, the
on-chain Poseidon Merkle tree, nullifiers — and it is **live on Stellar testnet**,
where real **shield** and **withdraw** transactions have been submitted **from the
browser** and confirmed on a public explorer. The product is a **dark, cinematic
privacy wallet** (shield · private balance · send privately · unshield · pay links)
plus an **SDK** and a small **ecosystem of apps**. What is **not** built: private
**swaps**, shielded→shielded **transfers** (join-split), and **multi-user** shared
balances — these are honestly marked "coming soon" on the roadmap, because each is a
new cryptographic protocol, not a UI feature. So: _"does the ZK work, on-chain, from
the browser?"_ → **yes, proven.** _"Can a stranger swap/transfer privately or share a
pool with others today?"_ → **not yet.**

---

## 1. The idea & the aim we're chasing

**Thesis (5 words): _Share a link. Get paid privately._** — and more broadly:

> **Umbra is the privacy layer for Stellar.** One frozen, on-chain-verified protocol;
> many products on top of it.

The aim (the pivot we settled on) mirrors the winning "infrastructure + products"
shape of STRK20:

1. **A privacy wallet** as the flagship product — shield assets into a private pool,
   hold a private balance, send privately, unshield (cash out), and generate a pay link.
2. **An SDK** (`@umbra/sdk`) so any Stellar app can plug in privacy — the "build with
   us" funnel.
3. **Live apps** built on the same protocol — payment links, private donations,
   private invoices — proving it's infrastructure, not a one-off demo.
4. **A dark, cinematic, premium brand** — the look had to feel like a movement, not a
   fintech form: living animated background, smooth scroll, a 3D "enter the pool"
   scene, brutalist display type.
5. **Roadmap, marketed honestly** — Private Swap and shielded→shielded Private
   Transfer shown as "coming soon," because we deliberately did **not** unfreeze the
   proven core to chase them before the deadline.

We are **not** building a token standard. Umbra is a privacy **application layer + pool
contract + SDK**, built on Stellar's native BLS12-381 host functions.

---

## 2. Where zero-knowledge is used (and why it's load-bearing)

Money cannot move unless a Soroban contract verifies a proof on-chain. The pipeline:

- **A note is private money:** `commitment = Poseidon(secret, amount)`. Whoever knows
  `secret` owns it.
- **Shield circuit** (`shield.circom`): proves `commitment = Poseidon(secret, amount)`.
  Public inputs: `[commitment, amount]`.
- **Withdraw circuit** (`withdraw.circom`): proves, in zero knowledge — (1) Merkle
  inclusion of the commitment under a known `root`, (2) ownership (knows `secret`),
  (3) a one-time `nullifier = Poseidon(secret, leafIndex)`, (4) recipient binding,
  (5) amount conservation. Public inputs: `[root, nullifier, recipient, amount]`.
- **Verifier** (`contracts/groth16-verifier`): a BLS12-381 Groth16 verifier using
  Stellar/Soroban's **native host functions (CAP-0059)** — G1 MSM + a 4-term pairing
  check, in one host call (~40M of the 100M instruction budget).
- **Pool** (`contracts/umbra-pool`): `shield()` verifies the shield proof, pulls the
  token, inserts the commitment into an **on-chain Poseidon Merkle tree**, returns the
  leaf index, emits `DepositCreated`. `withdraw()` verifies the withdraw proof, rejects
  unknown roots (a recent-roots ring) and spent nullifiers, pays out, emits
  `WithdrawalCompleted`.
- **Proving runs in the browser** — snarkjs Groth16 over BLS12-381, in a **Web Worker**
  (off the main thread), artifacts served from `public/circuits/`.
- **Poseidon is identical** across the contract (Rust), the circuit (Circom), and the
  wallet (TS) — proven by a cross-implementation oracle test.

Privacy is the **mixer property**: on-chain an observer sees a deposit and a
withdrawal but cannot link them.

---

## 3. What is REAL (built, tested, and/or on-chain)

| Area | Status | Notes |
| --- | --- | --- |
| Circuits (shield, withdraw) | ✅ real | Circom 2.2.3, BLS12-381; real Groth16 proofs generate + verify. |
| Groth16 verifier contract | ✅ real | BLS12-381 via CAP-0059 host fns. |
| Pool contract (shield/withdraw) | ✅ real, tested | `cargo test -p umbra-pool` → **5/5** with real proofs vs the real host: happy path · double-spend rejected · invalid-proof rejected · wrong-recipient rejected · Poseidon≡oracle. (`bench-pool` 6/6.) |
| On-chain Poseidon Merkle tree + nullifiers | ✅ real | Incremental tree (frontier + recent-roots ring), persistent nullifier set. |
| crypto-bls (BLS12-381, Poseidon, encoding) | ✅ real | 13/13 unit tests. |
| wallet-core (notes, tree, witness) | ✅ real | Mirrors the contract. |
| In-browser Groth16 proving | ✅ real, measured | Off-thread Web Worker; withdraw zkey 3.9 MB; cold-start ~2.5s proving on a fast machine. |
| Browser → testnet submission | ✅ proven | Real shield + withdraw **submitted from the browser UI**, confirmed on Horizon (`docs/BROWSER_E2E.md`). |
| Wallet signing | ✅ real | Freighter ("Connect wallet", app never sees the key) + an in-app testnet-key fallback. |
| Shield / Unshield / Send | ✅ real | Shield = deposit; Unshield = withdraw to yourself; Send = withdraw to any address (unlinkable). All real on-chain. |
| Payment-link codec + integrity | ✅ real | Self-contained links; tampering the amount/commitment is rejected (proof public-signals mismatch). |
| `@umbra/sdk` | ✅ real (workspace) | Curated re-export of the proven primitives + payment-link codec + contracts. Typechecks. **Not yet published to npm.** |
| Deployed on testnet | ✅ live | Protocol 27 testnet; multiple pools deployed; real txs (see §10). |

---

## 4. What is MOCK / demo-grade / NOT built

| Thing | State | Why / honest detail |
| --- | --- | --- |
| **Private Swap** | ❌ roadmap | A multi-asset shielded pool + DEX integration — a whole new protocol (months). Shown as "Coming soon." |
| **Private Transfer (shielded→shielded)** | ❌ roadmap | True in-pool P2P needs a **join-split circuit** + new trusted setup; would unfreeze the proven core. Shown as "Coming soon." (Note: "Send privately" via withdraw-to-address **is** real — it's unlinkable, but the recipient receives public funds.) |
| **Multi-user shared pool** | ❌ not built | The wallet rebuilds its Merkle tree only from **its own notes**. So a clean flow needs the wallet to be the pool's **sole writer**. Many strangers sharing one pool needs **on-chain event-sync + note encryption/discovery** — deferred. |
| **Local-demo mode** | 🟡 mock (when enabled) | With **no** pool configured, `/pay`, `/shield`, `/withdraw` choreograph success after a timeout (nothing submitted). The current build has on-chain mode **ON** (`.env.local` set), so it's real now — but the mock path still exists for zero-setup clicking. |
| **Donations / Invoices** | 🟡 real-but-thin | They're **payment-link variants** on the same protocol (different create UX/copy), not separate protocols. Honest "one protocol, many products." |
| **Merkle depth 8** | 🟡 demo-grade | 256-note capacity (budget-driven). Mainnet target depth 20 (1M+). Isolated to a constant. |
| **Trusted setup** | 🟡 demo-grade | Single-contributor ceremony. Mainnet needs an MPC ceremony (p0tion). |
| **Test budget** | 🟡 caveat | Contract tests lift the host budget (`reset_unlimited`) to validate logic, so the **real per-tx testnet instruction cost is not formally benchmarked** (B03–B06 gated). |
| **Recipient binding vs payout address** | 🟡 decoupled | The proof binds a recipient field; coupling it to the literal payout address is deferred. |
| **wow-screen links vs live pool** | 🟡 cosmetic | The `/withdraw` reveal reads `deployment.json` (the CLI demo pool `CBGB5DAY…`), while the live wallet uses the pool in `.env.local`. Session txs show in the success line. |
| **Demo video / `wow.gif`** | ❌ not done | Placeholder; recording pending. |
| **Mobile proving** | 🟡 unmeasured | Latency numbers are from a fast arm64 Mac. |

---

## 5. Every page — what it is, the UI/UX, and real vs mock

The app is **dark, cinematic** (see §6). On-chain actions are real when a wallet/key
is connected; otherwise local-demo choreographs them.

### `/` — Landing (`components/umbra/landing-narrative.tsx`)
- **Design:** living **cinematic background** (drifting deep-tone washes + a faint
  ember, faint grid, film grain, vignette), **Lenis smooth scroll**, brutalist
  uppercase display hero **"PRIVATE MONEY ON STELLAR."** that **lifts/fades/scales on
  scroll**, then the signature **3D "ENTER THE POOL" scroll scene** (asset chips orbit
  a dark pool on a tilted plane and get absorbed as you scroll). Narrative sections
  (the problem → solution → "what the chain sees" ledger comparison → "built on real
  cryptography" → trust) animate in with **blur-up reveals**. Header: Apps · Build ·
  Open app.
- **Real/mock:** marketing; all real content. CTAs route into the app.

### `/wallet` — Privacy Wallet (the flagship; `app/wallet/page.tsx`)
- **Design:** "YOUR PRIVATE BALANCE" display heading; a **shielded-balance card** with
  a soft glow + "Private" pill; **Connect Freighter** (or testnet-key fallback); a 2×2
  **action grid** — **Shield · Send · Unshield · Pay link** (orange icons); two dashed
  **roadmap cards** — Private Swap / Private Transfer ("Coming soon"); an **Activity**
  feed of notes. Selecting an action opens a panel (form → proving readout → premium
  `SuccessMark`).
- **Real/mock:** Shield/Send/Unshield are **real on-chain** (verified). Pay link is
  real (generates a real payment link). Swap/Transfer are roadmap.

### `/shield` — Shield (standalone deposit; `app/shield/page.tsx`)
- **Design:** "Add funds privately" — amount + connect + Shield button → off-thread
  proving readout → SuccessMark.
- **Real/mock:** real on-chain shield.

### `/withdraw` — Withdraw / Unshield (`app/withdraw/page.tsx`)
- **Design:** "Cash out privately" — balance, "Cash out to" (prefilled with your
  wallet) + connect → proving → the **"What you did vs What Stellar sees" wow-screen
  reveal** (two unlinkable tx cards + "No shared key" + a ~1.5s signal shimmer).
- **Real/mock:** real on-chain withdraw; the reveal's headline links read from
  `deployment.json` (see §4 caveat); the session tx hash shows in the success line.

### `/links` — Create a payment link (`app/links/page.tsx`)
- **Design:** form (title/amount/recipient) → in-browser shield proof → QR + copyable
  link + SuccessMark.
- **Real/mock:** real (the link carries a real shield proof; the secret never leaves).

### `/pay/[id]` — Pay a link (`app/pay/[id]/page.tsx`)
- **Design:** decodes the link, shows the request; **integrity-checked** — a tampered
  link shows "This link can't be trusted." Pay → funds the shield on-chain → "Paid
  privately" with SuccessMark.
- **Real/mock:** real on-chain shield when a wallet/key is connected.

### `/donate` — Private donation link · `/invoice` — Private invoice
- **Design:** tailored create flows (donation framing / invoice fields) → real payment
  link + QR.
- **Real/mock:** real links, same protocol as `/links` (variants).

### `/apps` — Live apps gallery (`app/apps/page.tsx`)
- **Design:** ecosystem grid — Payment Links · Private Donations · Private Invoices ·
  Private Wallet, each "Live, built on Umbra", + a "Your app could be next → Build with
  Umbra" CTA.
- **Real/mock:** all link to real flows.

### `/build` — Developers / "Build with Umbra" (`app/build/page.tsx`)
- **Design:** "Plug privacy into your Stellar app" — SDK quickstart + code sample,
  "what you get" cards, how-a-private-payment-works steps, the live contract id, B2B CTA.
- **Real/mock:** real (the SDK exists); the code sample is illustrative.

### `/_not-found` — Next.js default 404 (unbranded — a known gap).

---

## 6. The design system (dark, cinematic, premium)

- **Theme:** dark. Background `#0A0A0A`, surface `#121212`, ink `#FAFAFA`, hairline
  `#292929`, accent/signal `#FF3B00` (promoted from "crypto-only" to the brand accent:
  CTAs + crypto moments). Tokens in `styles/globals.css` + `tailwind.config.ts`.
- **Type:** **Inter** (UI), **JetBrains Mono** (all crypto data — hashes, addresses,
  balances), **Archivo** (heavy uppercase display headlines).
- **Cinematic layer** (`components/umbra/cinematic.tsx`): `CinematicBackground`
  (drifting deep-indigo/plum washes + faint ember + grid + grain + vignette) and
  `SmoothScroll` (Lenis). Applied to the landing **and** every app page (via `Shell`).
- **Motion:** Framer Motion scroll-linked hero + the `PoolScene` 3D scroll scene;
  blur-up section reveals; `prefers-reduced-motion` respected.
- **Premium components** (`components/umbra/ui.tsx`): orange **gradient** primary
  buttons with inset highlight + glow; cards with a subtle top-light inner highlight;
  inputs with a soft ember focus glow.
- **`SuccessMark`** (`components/umbra/success-mark.tsx`): the success indicator — an
  ember ring that **draws on** + a check that **strokes in** over a soft glow
  (replaced the old flat green checkmark everywhere). The only remaining `Check` glyph
  is the transient "Copied" feedback on copy buttons.

---

## 7. Architecture & data flow

```
Browser (Next.js / React)
  hooks/use-prover.ts ──▶ lib/umbra/prover.worker.ts ──▶ snarkjs Groth16 (Web Worker)
        │ proof
        ▼
  hooks/use-wallet.ts ──▶ lib/umbra/signer.ts (Freighter | testnet key)
        │ signer
        ▼
  lib/umbra/soroban.ts ──▶ @stellar/stellar-sdk ──▶ Soroban RPC ──▶ UmbraPool contract
        │                                                              │ verifies proof on-chain
        ▼                                                              ▼
  lib/umbra/wallet.ts (note store, localStorage, cross-tab sync)   DepositCreated / WithdrawalCompleted
```

Key modules (`lib/umbra/`): `prover.ts` + `prover.worker.ts` + `prover-protocol.ts`
(off-thread proving), `signer.ts` + `wallet-session.ts` (wallet connect/sign),
`soroban.ts` (submit shield/withdraw, confirm on-chain, return leaf index),
`wallet.ts` (note store + tree + cross-tab `storage` sync), `payment-link.ts` (codec),
`config.ts` (pool/network env).

---

## 8. Tech stack & repo structure

**Stack:** Next.js 15.5 (App Router) · React 19 · TypeScript (strict) · Tailwind v3 ·
Framer Motion 12 · Lenis 1.3 · `@stellar/stellar-sdk` 16 · `@stellar/freighter-api` 6
· snarkjs 0.7.5 · Circom 2.2.3 · soroban-sdk 22 (Protocol 27 testnet) · `@noble/curves`
· pnpm + Cargo workspaces.

```
app/         routes: / · wallet · shield · withdraw · links · pay/[id] · donate · invoice · apps · build
components/umbra/  ui · cinematic · pool-scene · landing-narrative · prover-progress ·
                   crypto-timeline · withdraw-reveal · chain-reveal · wallet-connect · success-mark
hooks/       use-prover · use-wallet · use-copy-to-clipboard
lib/umbra/   prover(+worker+protocol) · signer · wallet-session · soroban · wallet · payment-link · config
packages/    crypto-bls · wallet-core · sdk · benchmarks · bench-harness
contracts/   umbra-pool · groth16-verifier · bench-pool (Rust/Soroban)
circuits/    shield · withdraw · merkle · poseidon (Circom) + build scripts
infra/deploy/  deploy-slice.sh · capture-demo-txs.sh · deployment.json
docs/        STATE.md (this) · BROWSER_E2E.md · SCOPE.md · SUBMISSION_MASTERPLAN.md · ARCHITECTURE.md · …
```

---

## 9. The SDK (`@umbra/sdk`)

A workspace package exposing the **proven** primitives so others can build private
payments on Stellar: `makeNote`/`commitment`/`nullifier`/`recipientField`,
`MerkleTree`/`DEPTH`, `buildShieldInput`/`buildWithdrawInput`, `poseidon`/`poseidon2`,
the Soroban encoding (`g1ToSoroban`/`g2ToSoroban`/…), the payment-link codec
(`encodePaymentLink`/`decodePaymentLink`), and `UMBRA_CONTRACTS`. Typechecks clean.
**Status:** real, workspace-local — **not yet published to npm** (a `private:false` +
`npm publish` away).

---

## 10. Deployed contracts & on-chain evidence (testnet, Protocol 27)

| Pool (purpose) | Contract id | Real txs |
| --- | --- | --- |
| **Demo** (in `deployment.json`, wow-screen) | `CBGB5DAY…SDV7` | shield `9fb4dc15…`, withdraw `aa5cf132…` |
| **Browser E2E** (proved browser→chain) | `CDY54W6J…2KCQ` | shield `4798875e…`, withdraw `0cf5517e…` |
| **Live wallet** (current `.env.local`) | `CCWIFQID…GZHU` | shield `daf74520…`, unshield `80e0b0d6…` |

All txs were confirmed `successful: true` on Horizon. Explorer base:
`https://stellar.expert/explorer/testnet`. (Multiple pools exist because of the
single-writer constraint in §4 — each clean run/demo used a fresh pool.)

---

## 11. Honest limitations & roadmap

**Limitations (today):** single-user pool (sole-writer required); no private swap; no
shielded→shielded transfer; depth-8 (256 notes); single-contributor trusted setup;
per-tx instruction cost not formally benchmarked; signing is Freighter or a pasted
testnet key (no other wallets yet); SDK not on npm; the in-app key path is **testnet
only** (never mainnet).

**Roadmap → mainnet (from `SCOPE.md`):** depth-20 recompile (G1) · MPC trusted-setup
ceremony via p0tion (G2) · external audit (G3) · on-chain instruction-budget proof
(G4) · relayer for fee-payer privacy (G5) · note discovery/event-sync at scale (G6) ·
multi-sig deployer (G7) · batched insertion (G8) · frontend OpSec (G9) · nullifier
accumulator + rent model (G10) · recipient↔payout coupling (G11).

**Product roadmap (marketed "coming soon"):** Private Swap, Private Transfer
(shielded→shielded), multi-user balances (event sync), published SDK.

---

## 12. Verification evidence (command → result)

| Check | Result |
| --- | --- |
| `cargo test -p umbra-pool` | 5/5 (real proofs, real BLS12-381 host) ✅ |
| `pnpm --filter @umbra/crypto-bls test` | 13/13 ✅ |
| `pnpm --filter @umbra/sdk run typecheck` | clean ✅ |
| `tsc --noEmit` (app) | clean ✅ |
| `next build` | 12/12 routes ✅ (benign ffjavascript warning) |
| Browser → testnet shield + withdraw | confirmed on Horizon ✅ (`docs/BROWSER_E2E.md`) |
| Curl Horizon for the demo/E2E/wallet txs | `successful: true` ✅ |

---

## 13. Bottom line

The hard, rare thing is **done and live**: real zero-knowledge private payments on
Stellar, verified on-chain, driven end-to-end **from a dark, cinematic privacy
wallet**, with an SDK and an app ecosystem framing it as infrastructure. What remains
is honestly scoped: the **swap/transfer/multi-user** features are new protocols on the
roadmap (not faked), and the path to mainnet is a **parameter bump + a ceremony + an
audit**, not a redesign. The strongest true claim: _"a private payment whose validity
a Stellar smart contract verifies on-chain — provably, from the browser, today."_
