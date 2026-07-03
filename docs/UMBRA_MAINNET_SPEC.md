# UMBRA — Complete Product, Design & Architecture Spec (Mainnet)

> **What this file is.** A single, authoritative reference for Umbra as it is **live on Stellar
> mainnet today**: the product, every page (layout + verbatim copy + components), the design
> system as actually shipped, every user flow, the on-chain contract + circuits + cryptography,
> and an honest findings / fix-list. Hand this to any agent or designer and they will understand
> the whole product and be able to advise on it. Last synthesized 2026-07-03.

---

## Table of contents

1. [TL;DR](#1-tldr)
2. [Product overview & thesis](#2-product-overview--thesis)
3. [Live mainnet deployment (facts)](#3-live-mainnet-deployment-facts)
4. [Tech stack & repo map](#4-tech-stack--repo-map)
5. [Design system (as shipped)](#5-design-system-as-shipped)
6. [Navigation & information architecture](#6-navigation--information-architecture)
7. [Every page](#7-every-page)
8. [Features & end-to-end flows](#8-features--end-to-end-flows)
9. [The protocol — contract, circuits, crypto](#9-the-protocol--contract-circuits-crypto)
10. [Proving pipeline](#10-proving-pipeline)
11. [Findings & polish fix-list](#11-findings--polish-fix-list)
12. [Roadmap & honest limitations](#12-roadmap--honest-limitations)

---

## 1. TL;DR

**Umbra is a consumer ZK privacy wallet on Stellar.** Users shield funds into a shared pool as
private "notes," send/receive with amounts hidden on-chain, and cash out unlinkably — every move
enforced by a **Groth16 zero-knowledge proof generated in the browser and verified on-chain inside
a Soroban smart contract** (BLS12-381, CAP-0059 host functions). It is **live on Stellar mainnet**,
open access, capped at 100 XLM per deposit, honestly labeled as early access (audit on the roadmap).

The whole system rests on one engineering invariant: **every state-changing entrypoint inserts at
most ONE Merkle leaf**, which lets the on-chain tree be deep (depth 13, 8,192 notes) while a spend
still fits Stellar's per-tx compute budget.

Public site: **https://umbra-phi.vercel.app**

---

## 2. Product overview & thesis

- **Thesis:** *Consumer privacy layer for Stellar commerce.* Privacy is the feature, not the
  configuration. Umbra is a consumer product first.
- **Four headline products**, all built on one frozen, on-chain-verified protocol:
  1. **Private Wallet** — shield, hold a private balance, send privately, unshield.
  2. **Payment Links** — a shareable link that gets you paid privately.
  3. **Private Donations** — accept support without exposing supporters or income.
  4. **Private Invoices** — bill a client; revenue never lands on a public ledger.
- **Trust model:** non-custodial, no server sees secrets, no trusted relayer. Secrets and note
  openings never leave the browser. Recovery is from-chain (no account, no server balance).
- **Privacy boundary (be precise):** Umbra provides **link privacy** on shield + withdraw (amounts
  are public, but the deposit↔withdrawal link is broken), and **full amount privacy** on
  shielded→shielded transfers (the "private send" — no amount ever touches the chain, only a
  nullifier + two commitments). Withdrawals keep their **change** private.

---

## 3. Live mainnet deployment (facts)

| Field | Value |
| --- | --- |
| Network | Stellar **mainnet** (pubnet), passphrase `Public Global Stellar Network ; September 2015`, protocol 26 |
| **Pool contract** | `CBWIV33FQ27LOTA2LGM5SVL2WHAMBFLZTYOZXWKEMDBFCLU4BNIUQOLU` |
| Asset (token) | native XLM SAC `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| WASM hash | `968eb0db459a2b610a32079b0b5c66b9fc768747474b704c0a8bf339cee79334` |
| Deployer | `GDGVKQBH5QUFULVRIMAHDYXZ3IJWPAZWKOCCHQSZJ3LPA64AHZMFMFE4` |
| RPC | `https://mainnet.sorobanrpc.com` (public, no signup; fallbacks: gateway.fm, rpc.lightsail.network) |
| Merkle depth / capacity | **13 / 8,192 notes** |
| Per-deposit cap | **100 XLM** (client-side), access gate **open** |
| Inclusion fee | **1,000,000 stroops** on mainnet (beats surge; 100 on testnet) |
| Real demo txs | shield `9970804e…`, transfer `0a65cf28…`, claim `5e539120…` (+ deploy `f3d0a294…`, wasm upload `b441cd13…`) |
| Records | `infra/deploy/deployment.mainnet.json` |
| Testnet pool | `CBA5KVEZQLFGYGGK6Z3HPWBGYVZVDXAL5LNQIS7ISHVGBNB2V43DVXYA` (`infra/deploy/deployment.json`) |

The Vercel build is armed via `NEXT_PUBLIC_*` env: `NETWORK=mainnet`, the pool id, the RPC,
`ENABLE_CANARY=true`, `MAX_DEPOSIT_XLM=100`, `INVITE_REQUIRED=false`. Template: `.env.mainnet.example`.
Runbook: `docs/MAINNET_READINESS.md`.

---

## 4. Tech stack & repo map

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript (strict). Tailwind CSS v3 +
  shadcn/ui primitives. framer-motion for motion. Lenis for smooth scroll. qrcode.react.
- **Crypto/proving:** snarkjs (Groth16, BLS12-381) in a Web Worker; Circom 2.1.6 circuits
  (`--prime bls12381`); Poseidon t=3.
- **Contracts:** Rust Soroban (`soroban-sdk`), `wasm32v1-none`. Groth16 verifier is a Rust lib
  compiled into the pool contract.
- **Workspaces:** pnpm (JS: `packages/*`) + cargo (Rust: `contracts/*`). `circuits/` (Circom) is
  **not** a pnpm member (driven by scripts/snarkjs).
- **Deploy:** Vercel (web), stellar-cli (contract). Tests: Vitest + Playwright.

```
app/          Next.js routes (see §7)
components/   React components; components/umbra/* = the product's design-system components
hooks/        use-wallet, use-prover, use-copy-to-clipboard
lib/umbra/    framework-agnostic core: soroban, prover, recovery, note-crypto, private-send,
              payment-link, wallet (walletStore), config, network, note-derivation, viewing-key,
              audit-store, units, deployment
packages/
  crypto-bls/     Poseidon (poseidon2), BLS G1/G2↔Soroban encoding, constants generators
  wallet-core/    makeNote, commitment, nullifier, MerkleTree(depth 13), build*Input witnesses
circuits/src/     shield.circom, withdraw.circom, transfer.circom, claim.circom, poseidon/, merkle.circom
contracts/
  umbra-pool/       the pool (lib.rs, poseidon.rs, poseidon_constants.rs, test.rs)
  groth16-verifier/ the on-chain Groth16 verifier (lib.rs)
public/circuits/  served proving artifacts (*_final.zkey, *_js/*.wasm)
infra/deploy/     deploy-slice.sh (testnet), deploy-mainnet.sh, deployment*.json, MAINNET_READINESS
docs/             this file + design/architecture docs
```

---

## 5. Design system (as shipped)

> ⚠️ **Design-truth note (read first).** The repo contains **two design languages**, and the
> documented one is NOT the shipped one:
> - **Documented / legacy (`CLAUDE.md`):** light "Swiss Brutalist" — three colors, square 0–2px
>   corners, `border-2`, no gradients, no shadows, no blur, signal `#FF3B00` reserved for
>   cryptographic actions ONLY. Still literally coded in `components/section-card.tsx` and the
>   `umbra.*` Tailwind tokens.
> - **Shipped / actual:** a dark "privacy-infrastructure" theme — near-black surfaces, rounded
>   12–16px, soft + signal-orange **glow** shadows, **gradient** CTAs, `backdrop-blur` nav, Lenis
>   smooth scroll, and `#FF3B00` promoted to the **primary brand accent** (used on CTAs, focus
>   rings, icon tiles — far beyond "crypto only").
>
> **For any design work, treat the dark shipped system below as ground truth and treat `CLAUDE.md`
> as stale.** Reconciling these two (or deciding which to commit to) is the first design decision.

### 5.1 Color palette (shipped, `styles/globals.css :root`, HSL → hex from comments)

| Token | HSL | Hex | Use |
| --- | --- | --- | --- |
| `--background` | `0 0% 4%` | `#0A0A0A` | Page/body |
| `--foreground` | `0 0% 98%` | `#FAFAFA` | Primary text/ink |
| `--card` | `0 0% 7%` | `#121212` | Card surfaces |
| `--primary` / `--accent` / `--ring` | `14 100% 50%` | **`#FF3B00`** | Brand signal (CTAs, accents, focus) |
| `--secondary` / `--muted` | `0 0% 12%` | `#1F1F1F` | Subtle fills / pills |
| `--muted-foreground` | `0 0% 60%` | `#999999` | Secondary text |
| `--border` / `--input` | `0 0% 16%` | `#292929` | Hairline borders |
| `--destructive` | `0 72% 56%` | ~`#E0464A` | Errors |
| `--success` | `152 55% 46%` | ~`#35B67F` | Confirmation green (off-palette; only /claim done + note "Available") |

**Signal `#FF3B00` — the full accent family:** CTA gradient `from-[#FF5A24] to-[#FF3B00]`, hover
`from-[#FF6A38] to-[#FF4810]`; glow shadow `rgba(255,59,0,0.6)`; the reserved
`--shadow-signal: 0 0 32px -4px rgb(255 59 0 / 0.45)` (`.u-signal-glow`); signal pill
`bg-[#FF3B00]/10 text-[#FF3B00]`; focus rings `ring-[#FF3B00]/50`, input `border-[#FF3B00]/60`.
Cinematic background washes use off-palette deep blue `#0e1530` + plum `#170d22` at `blur-[150px]`
over base `#080809`.

### 5.2 Typography

- **Inter** (`--font-inter`, `font-sans`) — all UI text.
- **JetBrains Mono** (`--font-jetbrains-mono`, `font-mono`) — ALL crypto/ledger data (addresses,
  hashes, proofs, balances, amounts, code). Override sets slashed zero + tabular figures
  (`"zero" 1, "calt" 0`, `letter-spacing: 0`).
- **Archivo** (`--font-display`, `font-display`, weights 800/900) — heavy display headlines.
- Global body tracking `-0.011em`; Inter stylistic sets on. Eyebrow labels:
  `text-xs font-semibold uppercase tracking-[0.14em]`.
- Custom sizes: `text-display` = `clamp(2.75rem, 6vw, 4.5rem)` (lh 1.02, tracking -0.035em);
  `text-display-sm`.

### 5.3 Shape & surface

- **Radius `--radius: 12px`.** `rounded-sm=6px`, `rounded-md=8px`, `rounded-lg=12px`,
  `rounded-xl=12px` (buttons/inputs), `rounded-2xl=16px` (cards), `rounded-full` (pills/glows).
- **Borders:** hairline `border border-border` (`#292929`); buttons/nav use translucent
  `border-white/10`. (Legacy brutalist uses `border-2 border-foreground`.)
- **Shadows (soft, layered — the opposite of the CLAUDE.md rule):** `--shadow-sm/md/lg` +
  `--shadow-signal`. Cards add an inset top highlight `inset 0 1px 0 0 rgb(255 255 255 / 0.05)`.
- **Gradients + glassmorphism ARE used:** gradient CTAs; `backdrop-blur-md` sticky nav; blur washes.
- **Utilities:** `.u-card` (rounded-2xl + border + card bg + shadow-sm + inset highlight),
  `.u-card-lg` (shadow-lg), `.u-elevate`, `.u-signal-glow`, `.u-focus`.
- **Widths:** `max-w-shell = 1080px` (page), `max-w-prose = 560px`.

### 5.4 Shared components (`components/umbra/ui.tsx`)

- **`Button`** — cva. Base: `rounded-xl font-medium transition-all duration-200
  ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] focus-visible:ring-2 ring-[#FF3B00]/50`.
  Variants: **primary** (default) `bg-gradient-to-b from-[#FF5A24] to-[#FF3B00] text-white
  shadow-[0_6px_26px_-8px_rgba(255,59,0,0.6),inset_0_1px_0_rgba(255,255,255,0.22)]` + hover shift;
  **secondary** `border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]`; **ghost**; **link**.
  Sizes `sm/md/lg/block`. `loading` prop → spinner + disabled.
- **`Card`** — `.u-card` or `.u-card-lg` (elevated).
- **`Field` / `Textarea` / `AmountField`** — dark inputs (`bg-[#0e0e10]`, focus grows a 4px signal
  ring, bg → `#121214`). `AmountField` has a unit suffix badge (**default `"USDC"` — see fix-list**).
- **`Eyebrow`** — uppercase tracked kicker. **`Pill`** — tones `muted` / `ink` / `signal`.
- **`Logo`** — a white rounded square with a black inset notch (ink, no signal).
- **`TopBar` / `Shell`** — see §6. **`CopyButton`** (`components/copy-button.tsx`) — the mandated
  copy affordance for crypto data (bordered, invert-on-hover).

### 5.5 Motion

- Easing signatures: `cubic-bezier(0.22,1,0.36,1)` (fades) and `cubic-bezier(0.16,1,0.3,1)`
  (buttons/success). Everything gated behind `prefers-reduced-motion`.
- Keyframes: `u-fade-up`, `u-check-pop`, `u-pulse-soft`, `u-separation-x/y` (the withdraw-reveal
  "enforced separation" scan), `u-drift-1/2/3` (aurora washes), `u-pool-spin` (pool ember ring).
- Framer: `AnimatedNumber` (balance count-up, change-only), `SuccessMark` (ember ring draws +
  white check strokes over a signal glow). Lenis smooth scroll (`duration 1.15`), disabled under
  reduced motion.
- Signature experiences: the **landing PoolScene** (260vh pinned 3D token-absorption scene) and the
  wallet's **ProofViz** (live Merkle-inclusion "crypto as art" SVG driven by real prover stage).

---

## 6. Navigation & information architecture

- **`Shell({ children, active, atmosphere })`** wraps most pages: `SmoothScroll` (Lenis) +
  `CinematicBackground` (aurora washes) + optional `Atmosphere` (AI-art layer) + `TopBar` +
  `<main class="animate-fade-up mx-auto max-w-shell px-6 py-12 sm:py-16">`.
- **`TopBar`** — sticky, `border-b bg-background/80 backdrop-blur-md`, 64px tall, `max-w-shell`.
  Left: `Logo` + "Umbra" → `/`. **Nav (exactly 5):** `Wallet · Proof · Mainnet · Apps · Build`.
  Active item gets `bg-white/[0.04] text-foreground`.
- **Routes NOT in the nav** (reached via `/apps` cards or shared links): `/links`, `/donate`,
  `/invoice`, `/audit`, `/shield`, `/claim/[code]`, `/pay/[id]`. `/pay/[id]` renders **no Shell/nav**
  (a focused standalone receipt); `/claim/[code]` adds a fixed vault atmosphere image.
- **Root** (`app/layout.tsx`): loads Inter + JetBrains Mono + Archivo via `next/font`; metadata
  title `"Umbra — Private money on Stellar"`; OG/Twitter image `/art/og.png`.

---

## 7. Every page

> Copy below is **verbatim**. `#FF3B00` = signal orange. All crypto values render in JetBrains Mono.

### 7.1 `/` — Home / landing (`app/page.tsx` → `components/umbra/landing-narrative.tsx`)

Scroll-driven cinematic marketing narrative. Own sticky header (`bg-background/60 backdrop-blur-xl`,
ghost nav **Proof · Mainnet · Build** + secondary **Open app**→/wallet). Sections top→bottom:

1. **Hero** (full-screen): art `/art/hero.png` + radial `#FF3B00/10` glow. Scroll-linked lift/scale/fade.
   - Eyebrow `The privacy layer for Stellar`. H1 `Private money` / `on Stellar.`
   - Bold `Shield. Pay. Disclose only when you choose.` Sub: *"Hold a private balance, send with the
     amount hidden on-chain, and cash out unlinkably — every move enforced by a zero-knowledge proof
     a Stellar smart contract verifies on-chain."* CTAs `Open the wallet` / `See how it works`.
2. **`PoolScene`** (260vh pinned): 5 token chips (XLM/USDC/BTC/ETH/SOL) orbit + get absorbed into a
   tilted "Pool" disc with a spinning ember ring. Label `01 — Enter the pool`; caption *"Shield any
   asset into one private pool. Once inside, deposits and withdrawals can't be linked."*
3. **Problem** — H2 `Every payment you receive is public.` `Your freelance invoice.` **`Visible.`** ·
   `Your donation.` **`Traced.`** · `Your salary.` **`Searchable.`** Close: *"Blockchains are
   transparent by design. That transparency comes at a cost: your financial privacy."*
4. **Solution** — H2 `Umbra makes payments private on Stellar.` 3 cards **Shield / Send / Disclose**;
   italic footnote *"Non-custodial. No trusted relayers. Our own zero-knowledge circuits — verified
   by a Stellar smart contract."*
5. **Real money** (`/art/surface.png`) — H2 `Built for real money.` 3 personas (freelancer / donor / business).
6. **Reveal** (`/art/merkle.png`) — H2 `What the chain sees.` Left `What happened` (Alice/Bob/withdraw)
   vs right `What Stellar sees` (two deposits split by a `Lock` node + signal caption `cannot be connected`).
7. **How it works** — H2 `Built on real cryptography.` 5 items (Zero-knowledge proofs / On-chain
   verification / Confidential transfers / Poseidon commitments / Nullifier protection). Mono footnote
   *"Circom circuits. BLS12-381. Soroban smart contracts. Verified on Stellar."*
8. **Use cases** — H2 `Private finance for Stellar.` 6 cards (Freelance / Donations / Payroll /
   Commerce / Treasury / Creator payments).
9. **Trust** — badges `Proofs verified on-chain · Open source · Built on Stellar` + `View the source code`.
10. **Close** (`/art/og.png`) — H2 `Get paid privately.` Sub `Create your first payment link in 30
    seconds.` CTA `Create a payment link` → /links.
11. **Footer** — `Built for Stellar Hacks 2026 · Powered by zero-knowledge proofs`.

*Design:* signal used sparingly (eyebrow, hero glow, "cannot be connected", pool ember). Signature
motion: hero parallax, `Reveal` blur-in fade-up, the pinned PoolScene absorption.

### 7.2 `/wallet` — the main product (`app/wallet/page.tsx`)

`Shell active="/wallet" atmosphere="/art/vault.png"`, `max-w-xl`. Two views (`Home` dashboard,
`ActionPanel` one flow) with a `phase` machine `form → working → done | error`. `View =
"home"|"shield"|"send"|"transfer"|"unshield"|"paylink"`. Demo mode when `!isChainConfigured()`
(sleeps instead of submitting; proving still real).

**Home:**
- Eyebrow `Privacy wallet`; H1 `Your private balance`.
- **Balance card** (`.u-card .u-signal-glow`): `Shielded balance`, signal pill `Lock · Private`, big
  mono `<AnimatedNumber>` + `XLM` count-up.
- `WalletConnect` (if chain-configured). **Sync strip:** `Recovering your private balance from chain…`
  / `Balance synced from chain — follows your wallet` + `Sync`.
- **Actions grid** (2-col): **Private send** (spans both cols, orange-accented) `Hidden amount → a
  private claim link`; `Shield` `Deposit privately`; `Send` `Public amount → any Stellar wallet`;
  `Unshield` `Cash out to your own wallet`; `Pay link` `Request a payment`. Dashed `Private Swap`
  `Coming soon`.
- **Activity** — empty: `No activity yet` / `Shield some funds to get started.` / `Shield funds`.
  Note rows via `describe()`: spent → `Sent privately` / `Spent` / `−`; available → `Shielded` /
  `Available` / `+` (green accent); pending → `Awaiting funding` / `Pending`.
- **RecoveryCard** — `Your balance follows your wallet` + signal pill `Cross-device`; 4 numbered
  steps (Connect / Sync from chain / Private balance rebuilt / Withdrawable note found); `Sync from chain`.
- **DisclosureKit** — `Disclosure Kit` + pill `Private by default`; tiles `Viewing key` / `Encrypted
  records`; actions Generate / Export viewing key / Export audit packet / Clear records; footer
  `Encryption-based selective disclosure (v1). No backdoor; no automatic access.` + `Auditor view`.

**ActionPanel** — back button `← Wallet`, per-flow title/sub/CTA:
- shield `Shield funds` / `Move public funds into the privacy pool.` / `Shield privately`
- transfer `Private send` / `Send to anyone via a private claim link — the amount is hidden on-chain
  and the funds stay shielded until they claim.` / `Send privately`
- send `Send to address` / `Pay any Stellar wallet real XLM. The amount is public, but it can't be
  linked to you — and your change stays private.` / `Send`
- unshield `Unshield` / `Cash out to your own wallet. The amount is public but unlinkable to you;
  your change stays private.` / `Unshield`
- paylink `Request a payment` / `Generate a private link anyone can pay.` / `Generate link`

*form:* private-balance readout (send/unshield/transfer), `AmountField` (label varies, suffix `XLM`),
a flow callout (transfer: *"Send any amount — your **change comes back to you**, and both amounts are
**hidden on-chain**…"*; send/unshield: *"…the **amount is public**, but it's unlinkable… **change
stays private**…"*), recipient field (send/unshield), `WalletConnect`, CTA. Errors render here (e.g.
`No single note covers {x} XLM — your largest is {y}…`).

*working:* the emotional centerpiece — `<ProofViz stage=…>` (live Merkle-inclusion SVG: inclusion
path climbs leaf→root in orange, siblings pulse, root flashes; mono caption `poseidon · merkle ·
groth16` → `✓ groth16 proof ready`) + `<TxProgress step=…>` (proving→signing→submitting→confirming,
with `Loading proving key · X/Y MB`, `Computing constraints · Ns`). Multi-note cash-out shows
`Cashing out across notes — i of n`. Paylink uses `CryptoTimeline` instead.

*done:* three `Success` variants — (1) transfer+claim: SuccessMark, `Sent privately · amount hidden`,
QR of the claim URL + copy, `Bearer claim — whoever opens it receives the funds. Share it privately.`;
(2) paylink: QR + copy; (3) generic: SuccessMark + a 3-box evidence grid (`What you did` / `What the
Stellar ledger sees` / signal box `What Umbra proved privately`) + explorer link or `Demo mode…`.

*Design:* signal is heaviest here (balance glow, Private-send tile, all action-icon tiles, recovery
badges, sync spinner, proof viz, success). All crypto values mono.

### 7.3 `/proof` — Proof Center (`app/proof/page.tsx`), `max-w-3xl`

"Don't trust us, verify." Data-driven from `activeDeployment` (mainnet/testnet JSON per network).
- Hero: eyebrow `Proof Center`; H1 `Don't trust us. Verify the proof.`; lede about proving in your
  browser + verifying inside a Stellar smart contract. Pills `Live on mainnet` (signal) ·
  `BLS12-381 · Groth16` · `10/10 contract tests` · `Proven from the browser`. **(count is stale — §11)**
- Pipeline `How a private payment is verified` — 7 steps (Wallet / Note / Commitment / Browser proof
  / Soroban verifier / Pool transfer / Explorer confirmation).
- `Live on Stellar mainnet` — copyable `IdRow`s for pool / token / deployer / deploy tx / wasm hash.
- `The protocol, in facts` — 10 tiles: Network `Stellar mainnet · P27` **(P27 stale — §11)**, Proof
  system `Groth16`, Curve `BLS12-381`, On-chain verify `CAP-0059 host fns`, Hash `Poseidon`, Circuits
  `Circom (shield · withdraw · transfer · claim)`, Merkle depth `13 (8,192 notes)`, + the public-input
  lists.
- `Two real, unlinkable transactions` — **currently shows the fallback** `Freshly redeployed —
  generate your own evidence.` because the page reads top-level `D.shieldTx`/`D.transferTx` which are
  `undefined` (the JSON stores them under `demoTxs.shield/.transfer`). **(§11)**
- `What Stellar sees vs what Umbra hides` — two lists (public vs private).
- Recovery, Under the hood (6 cards), `Verified` (6 test rows — **counts stale, §11**), Disclosure,
  Real-vs-roadmap, CTA `See it move, privately.`

### 7.4 `/mainnet` — Readiness (`app/mainnet/page.tsx`), `max-w-3xl`

Honest status page. Hero eyebrow `Live on mainnet`; H1 `Live on Mainnet`; lede *"Umbra is live on
Stellar mainnet — real zero-knowledge privacy, verified on-chain. Here's exactly what's real today
and the roadmap to full scale."*
- **`MainnetGate`** (3 states): testnet → `Safe demo mode…`; **mainnet canary (current)** → signal
  `ShieldCheck` `Live on Stellar mainnet — real ZK privacy, capped at {N} XLM per deposit` / *"Every
  shield, private send, and unshield is a real Groth16 proof verified on-chain. Early access — the
  per-deposit cap stays while we harden, and an independent audit is on the roadmap."*; mainnet-off → red.
- Callout `What Umbra hides — and what it doesn't` (link privacy, early access, audit on roadmap).
- **Readiness scorecard** (`StatusChip`: Live=orange, Security-gated=amber, Required=red,
  Roadmap=muted): On-chain ZK verification (Live), Browser proving (Live), Cross-device recovery
  (Live), Selective disclosure (Live), **Mainnet deployment (Live)**, Trusted setup (Roadmap),
  Independent audit (Roadmap), Amount privacy (Roadmap), Fee-privacy relayer (Roadmap), Production
  indexer (Roadmap), Merkle depth (**Required — should be Live, §11**).
- Production architecture (relayer / indexer / CT adapter). Before-real-assets checklist (7 Pending).
  CTA `Verify it for yourself.`

### 7.5 `/apps` — Ecosystem (`app/apps/page.tsx`), `max-w-3xl`

Eyebrow `Ecosystem`; H1 `Apps built on the Umbra privacy layer.`; lede about one protocol, many
products. 2-col grid of 4 "● Live" cards → `/links` (Payment Links), `/donate` (Private Donations),
`/invoice` (Private Invoices), `/wallet` (Private Wallet). CTA card `Your app could be next.` /
`Build with Umbra` → /build. *(All status pills hard-coded "● Live".)*

### 7.6 `/build` — Developer / SDK (`app/build/page.tsx`), `max-w-3xl`

Eyebrow `For developers · @umbra/sdk`; H1 `Build private payments on Stellar.`; 3 pills. Install bar
`$ npm i @umbra/sdk` + `mainnet` pill. Two code blocks (`create-link.ts` using `UMBRA_CONTRACTS.mainnet`,
`verify-link.ts`). 6 feature cards. 3 numbered steps. `Live on Stellar mainnet` config rows
(pool/network/RPC, env-driven). Real-vs-roadmap. CTA (Open the wallet / See live apps / GitHub).
*(SDK is workspace-local, not yet on npm — honestly stated.)*

### 7.7 `/links` · `/donate` · `/invoice` — link creators

Same engine (`createPaymentLink` → pre-authorized shield proof → base64url link + QR). `max-w-prose`,
form → (proving `CryptoTimeline` SHIELD_STEPS) → success (SuccessMark / HandCoins / FileText badge + QR
+ copyable URL).
- **/links:** eyebrow `Get paid`; H1 `Create a payment link`; button `Generate payment link`; reassurance
  `A zero-knowledge proof is generated in your browser to secure this link.`
- **/donate:** eyebrow `Private donations`; H1 `Accept donations privately`; button `Generate donation link`.
- **/invoice:** eyebrow `Private invoices`; H1 `Bill a client privately`; button `Generate invoice link`.

### 7.8 `/pay/[id]` — Pay a link (`app/pay/[id]/page.tsx`)

**No Shell** — own minimal header, `max-w-md`. Phase `review → funding → paid → error` + a decode-error
branch (`This link can't be trusted` / tamper message). Review: header `{title} · to {recipient}` + big
mono `{amount} XLM` + `WalletConnect` + `Pay {amount} XLM`. Funding: `CryptoTimeline` FUND_STEPS. Paid:
SuccessMark `Paid privately` + `{recipient} can withdraw whenever they like…`. Footer `Powered by Stellar`.

### 7.9 `/claim/[code]` — Claim a private send (`app/claim/[code]/page.tsx`)

`Shell atmosphere="/art/vault.png"`, `max-w-md`. States: invalid / claimable / claimed. Claimable:
signal `ShieldCheck` badge, H1 `A private payment is waiting`, mono `{value} XLM`, body about a hidden
confidential transfer, `WalletConnect`, `Claim into my wallet` (→ `Claiming…`), footnote about bearer
claim. Claimed: green Check badge, H1 `Added to your wallet`, `Open wallet` → /wallet.

### 7.10 `/audit` — Auditor view (`app/audit/page.tsx`), `max-w-2xl`

Client-side selective-disclosure viewer. Eyebrow `Auditor view`; **display-font** H1 `Disclose by
choice.` (the one page closest to the brutalist voice); lede about decrypting in your browser.
Inputs: packet textarea + `Upload .json`, viewing-key Field, `Decrypt audit packet`. Results: per-record
`What public Stellar saw` vs `What you disclosed`. Shows 2 sample records until a real packet decrypts;
status pill `Sample format — not live data` / `Decrypted locally`.

### 7.11 `/shield` — Add funds (Advanced) (`app/shield/page.tsx`), `max-w-prose`

Eyebrow `Advanced`; H1 `Add funds privately`; lede `Move funds into the privacy pool directly. Most
people just share a payment link instead.` Form (`AmountField`, `WalletConnect`, `Shield funds`) →
`ProverProgress` (real Web-Worker progress: MB bar + `Ns` + tick) → SuccessMark `Funds shielded`.

---

## 8. Features & end-to-end flows

All proving is **client-side only** (the witness carries the spending secret). Orchestrator:
`app/wallet/page.tsx`; proving: `hooks/use-prover.ts` → `lib/umbra/prover.worker.ts`; submit:
`lib/umbra/soroban.ts`. Building blocks (`packages/wallet-core`): `makeNote(value)`,
`commitment=poseidon2(secret,value)`, `nullifier=poseidon2(secret,leafIndex)`, `MerkleTree(depth 13)`,
`build{Shield,Withdraw,Transfer,Claim}Input`. `walletStore` persists notes to localStorage and builds
the tree from the full synced on-chain leaf set.

- **(a) Shield** — mint note → `buildShieldInput` → prove `shield` → `submitShield({proof, commitment,
  amount})` → contract verifies `[commitment, amount]`, pulls XLM, inserts leaf, emits `DepositCreated`.
- **(b) Private send = transfer + claim_insert** (join-split, **amounts hidden**, register-on-claim):
  sender picks one note ≥ amount, makes `out1` (recipient, fresh secret) + `out2` (change, seed-derived),
  proves `transfer`, encrypts the change opening as `change_ct`, `submitTransfer` → contract spends
  nullifier, **inserts only out2**, records **out1 as Pending**, emits `TransferCompleted`. Sender gets a
  **bearer claim link** `/claim/<code>` (base64url `{s,v}`). Recipient proves `claim` → `submitClaimInsert`
  → contract checks `Pending`, verifies `[commitment]`, inserts out1, clears Pending, emits `NoteRegistered`.
  No amount ever on-chain.
- **(c) Send / Unshield = withdraw** (join-split, **public amount + private change**): "Send" pays any
  address; "Unshield" defaults payout to the connected wallet — same path. Cashing out more than one
  note spends **several notes greedily (largest-first)**; every note but the last is a **full exit**
  (whole note, no change, no insert → root unchanged → proofs stay valid), the last keeps private change.
  `recipient = addressToField(to)` (C1 binding). `submitWithdraw` → contract verifies, checks
  `recipient == field(to)`, spends nullifier, inserts change iff `has_change`, transfers XLM out, emits
  `WithdrawalCompleted`.
- **(d) Pay link** — a **pre-authorized shield**: recipient mints a note, pre-generates the shield proof,
  packs `{v:1, title, description, recipientName, amount, commitment, proof}` base64url (secret never
  leaves them). Payer opens `/pay/<id>`, `decodePaymentLink` verifies the proof's public signals match
  the displayed amount/commitment (tamper check), then `submitShield` funds it. Only the recipient can
  withdraw.
- **(e) Donation / (f) Invoice** — thin UX wrappers over `createPaymentLink` (donation: `title:"Support
  {name}"`; invoice: `title:"Invoice #{n}"`). Same pay flow. No new circuit/contract.
- **(g) Cross-device recovery** — deterministic seed from a wallet signature (`signMessage("Umbra ·
  deterministic note seed · v1")` → Ed25519 sigs are deterministic → same wallet, same seed, any device).
  `recoverFromChain(seed)` scans pool events (`DepositCreated/WithdrawalCompleted/TransferCompleted/
  NoteRegistered`), rebuilds the dense leaf set by on-chain index, re-derives deposit secrets (match
  `commitment(secret,amount)`), and **trial-decrypts** each `change_ct`/`note_ct` with the AES-GCM note
  key (`deriveNoteKey(seed)`) — a ciphertext that authenticates AND matches the on-chain commitment is
  yours (Zcash/Orchard-style). Spent status from the nullifier set.
- **(h) Disclosure kit / viewing key** — every action appends an AES-GCM-256 `AuditRecord` under a
  locally-held viewing key (`umbra-vk-v1:…`). `exportPacket()` bundles the ciphertexts; the user shares
  the **packet and key separately** for selective disclosure. `/audit` decrypts client-side. v1 is
  symmetric (no auditor pubkey, no ZK disclosure proof — roadmap).

---

## 9. The protocol — contract, circuits, crypto

### 9.1 Soroban contract (`contracts/umbra-pool/src/lib.rs`)

**Invariant:** every state-changing entrypoint inserts **at most one** Merkle leaf.

**Storage (`DataKey`):** `VkShield/VkWithdraw/VkTransfer/VkClaim` (the 4 Groth16 VKs), `Token`,
`NextIndex (u32)`, `Frontier (Vec<BytesN<32>>)`, `Roots (Vec<BytesN<32>>, ≤32)`, `Nullifier(BytesN<32>)
→ bool` (spent set), `Pending(BytesN<32>) → bool` (transfer output awaiting claim). Constants:
`MERKLE_DEPTH=13` (8,192 notes), `ROOT_HISTORY=32`, `ZERO_HASHES[0..=13]`.
**Errors:** AlreadyInitialized(1) NotInitialized(2) InvalidProof(3) UnknownRoot(4)
NullifierAlreadySpent(5) InvalidAmount(6) TreeFull(7) RecipientMismatch(8) NotPending(9).

**Entrypoints:**
- `__constructor(token, vk_shield, vk_withdraw, vk_transfer, vk_claim)` — one-time; pins 4 VKs + token,
  seeds frontier/roots. Atomic init closes the front-run window (**H1**). VKs/asset immutable.
- `shield(proof, commitment, amount: i128, depositor) -> u32` — pub `[commitment, amount]`. Guards
  amount>0 (**M1**) + tree-not-full (**M2**); verifies; `depositor.require_auth()`; **CEI**: insert leaf
  BEFORE token pull; `token.transfer(depositor→contract, amount)`; emits `DepositCreated`.
- `withdraw(proof, root, nullifier, recipient, amount, change_commitment, has_change, change_ct, to) ->
  u32` — pub `[root, nullifier, recipient, amount, change_commitment, has_change]`. Verifies; **C1**:
  `recipient == address_to_field(to)` else RecipientMismatch; known-root check; tree-full only if
  has_change; spend nullifier once; if has_change insert change else emit zero-sentinel (full-exit
  escape hatch); `token.transfer(contract→to)`; emits `WithdrawalCompleted(… change_ct)`.
- `transfer(proof, root, nullifier, out_commitment1, out_commitment2, change_ct) -> u32` — pub
  `[root, nullifier, out1, out2]`. **No require_auth — the proof IS authorization.** Verifies; spends
  nullifier; **inserts only out2**; records out1 as `Pending`; emits `TransferCompleted`. No token moves.
- `claim_insert(proof, commitment, note_ct) -> u32` — pub `[commitment]`. Requires `Pending(commitment)`
  else NotPending; verifies opening; inserts leaf; removes Pending; emits `NoteRegistered(… note_ct)`.
- Views: `current_root()`, `is_spent(nullifier)`, `next_index()`.

**Incremental tree:** Tornado-style; builds `PoseidonParams::new` **once per call** (deserializing ~204
Fr constants once, not per hash — the dominant on-chain cost). Walks 13 levels using `frontier` +
`ZERO_HASHES`; trims `Roots` to 32.

**`address_to_field(addr)`** = SHA-256(addr XDR) with the top byte cleared (always < r). Recomputed
byte-identically in TS (`soroban.ts::addressToField`).

**Groth16 verifier + canonical gate (`contracts/groth16-verifier/src/lib.rs`):** `VerifyingKey` =
alpha(G1 96B), beta/gamma/delta(G2 192B), ic(Vec<G1>, len = #pub+1); `Proof` = a(96) b(192) c(96),
uncompressed big-endian. **Canonical-input gate (Critical fix):** `fr_is_canonical(x)` rejects any
public input ≥ r (compare against `FR_NEG_ONE = r-1`). Rationale: Soroban's `Fr::from_bytes` silently
reduces mod r, so `n` and `n+r` map to the same scalar but different bytes — and the pool keys nullifiers
by raw bytes, so without the gate `n`/`n+r` are two "different" nullifiers → **double-spend**. Verify eq
(one `pairing_check`): `e(-A,B)·e(alpha,beta)·e(vk_x,gamma)·e(C,delta) == 1`, `vk_x = IC[0] + Σ pub_i·IC[i+1]`.

### 9.2 The four circuits (`circuits/src/`, Poseidon t=3, depth 13)

- **`shield` — Shield():** pub `commitment, amount`; priv `secret`. Proves `commitment ==
  Poseidon(secret, amount)`.
- **`transfer` — Transfer(13):** pub `root, nullifier, outCommitment1, outCommitment2`. Proves inclusion
  + ownership + nullifier + both outputs well-formed + **conservation `value == outValue1 + outValue2`**
  (no amount public) + 64-bit range on all three (anti field-wrap forgery).
- **`withdraw` — Withdraw(13):** pub `root, nullifier, recipient, amount, changeCommitment, has_change`.
  Same core + change well-formed + `value == amount + changeValue` + 64-bit ranges + recipient binding
  (`recipientSq <== recipient*recipient`) + full-exit flag (`(1-has_change)*changeValue === 0`).
- **`claim` — Claim():** pub `commitment`; priv `secret, value`. Proves `commitment ==
  Poseidon(secret, value)` (value hidden) + 64-bit range. Anti-griefing (anti-inflation is the contract's
  `Pending` check).

### 9.3 Key cryptography

- **Poseidon t=3** (R_F=8 + R_P=57 = 65 rounds, x^5 S-box, 3×3 MDS, 195 round constants). Same constants
  back Circom + TS (`packages/crypto-bls`) + Rust (`poseidon_constants.rs`) → off-chain roots equal
  on-chain roots and proofs verify.
- **Note scheme:** `commitment = Poseidon(secret, value)`; `nullifier = Poseidon(secret, leafIndex)`.
- **Curve BLS12-381**, scalar field `r ≈ 2^255` (255-bit). Groth16 verified on-chain via Stellar
  **CAP-0059** host fns (`g1_msm, g1_add, g1_mul, pairing_check`); verify cost ~40M instr, constant in
  circuit size — the reason on-chain verification is feasible.
- **AES-GCM-256** (Web Crypto, non-extractable keys) for note ciphertexts (recovery) + audit records.
- **Units:** on-chain values are **stroops** (1 XLM = 10^7); converted at every UI boundary.

---

## 10. Proving pipeline

- `snarkjs.groth16.fullProve(input, wasm, zkey)` in a **module Web Worker** (`prover.worker.ts`):
  lazy-loads artifacts on first prove (streams real byte/elapsed progress), caches bytes per variant.
- Artifacts in `public/circuits/`: `shield_final.zkey` (~427KB), `claim_final.zkey` (~466KB),
  `withdraw_final.zkey` (~6.9MB), `transfer_final.zkey` (~7.3MB) + `<v>_js/<v>.wasm`.
- Proof → Soroban: `proofScVal` builds an `ScMap` with **symbol** keys `a/b/c`; `g1ToSoroban`→96B,
  `g2ToSoroban`→192B (asserting affine z=1). Submit: `prepareTransaction` (simulate) → sign
  (Freighter/Wallets-Kit; app never sees secret) → `sendTransaction` → poll `getTransaction` until SUCCESS.
- **Mainnet surge:** `inclusionFee()` bids **1,000,000 stroops** on mainnet (100 on testnet; overridable
  via `NEXT_PUBLIC_UMBRA_INCLUSION_FEE`). The large resource fee is added by simulation.

---

## 11. Findings & polish fix-list

Concrete issues surfaced while mapping the app — a ready-made backlog for the perfection pass.

**Design-language coherence (biggest):**
1. **Two conflicting design systems.** Shipped = dark/rounded/glow/gradient; `CLAUDE.md` + `umbra.*`
   tokens + `components/section-card.tsx` = light/square/brutalist. Decide one and delete/retire the
   other so the codebase + docs tell one story.
2. **Signal `#FF3B00` scope creep.** It's the default primary-button color app-wide (incl. pure-nav
   CTAs like "Build with Umbra", "Open the wallet"), contradicting the "crypto actions only" rule. Either
   embrace it as the brand accent (update the doc) or reserve it (introduce a neutral primary).

**Real bugs / inaccuracies:**
3. **`AmountField` shows "USDC" while the app is XLM** on `/links`, `/donate`, `/invoice`, `/shield`
   (default `suffix="USDC"` never overridden). Pass `suffix="XLM"` (or change the default).
4. **`/proof` "Two real, unlinkable transactions" shows the fallback**, not the real evidence cards,
   because it reads top-level `D.shieldTx`/`D.transferTx` (undefined) instead of `D.demoTxs?.shield` /
   `.transfer`. The real mainnet hashes ARE in the JSON — wire them and the section shows live proof.
5. **Stale stats on `/proof`:** pills/tests say `10/10 contract tests`, `13/13`, `25/25 vitest`,
   `Protocol 27`. Actual: **14/14 contract tests, 30/30 vitest, protocol 26**. Update to match (a
   "verify" page must be exact).
6. **`/mainnet` "Merkle depth" is tagged `Required` (red)** but it's live at depth 13 — should be `Live`.
7. **Off-palette success green** (`--success`) on `/claim` done state + note "Available" accent — either
   formalize green as a token or replace with signal/ink.
8. **Copy-affordance inconsistency:** `/build` uses the `CopyButton` component; link/donate/invoice/pay
   use a bespoke secondary Button toggle. Standardize.

**Stale prose / labels (not user-facing correctness, but tidy):**
9. `packages/wallet-core/src/tree.ts` doc comments say "depth 20" / "Slice depth = 8 (256 leaves)" — the
   exported constant is **13**. Fix comments.
10. `lib/umbra/network.ts` header comment says "Umbra runs on Stellar TESTNET today … Mainnet is
    intentionally NOT enabled" — contradicts the live mainnet deployment.
11. `lib/umbra/audit-store.ts` hard-codes `network: "testnet"` on logged records — mainnet audit packets
    would be mislabeled. Make it network-aware.

**UX opportunities (for the perfection pass):**
- The 7 non-nav routes (links/donate/invoice/audit/shield/claim/pay) are only reachable via `/apps`
  cards or shared links — consider surfacing key ones.
- `AmountField` unit + a live USD/asset conversion; clearer note-selection UI for multi-note cash-outs.
- Empty/loading/error states are functional but terse — a design pass could make them delightful.

---

## 12. Roadmap & honest limitations

**Live today (mainnet):** on-chain ZK verify, browser proving, shield, private send (hidden amounts),
send/unshield (private change), pay/donation/invoice links, cross-device recovery, encrypted selective
disclosure.

**Honest limitations (positively framed, never claim "audited"):**
- **Trusted setup** is single-contributor today → MPC ceremony (or UltraHonk / transparent system) on
  the roadmap.
- **No independent audit yet** → a professional audit is the roadmap's next step (the code is
  self-reviewed: an AI adversarial pass found + fixed 2 Criticals — a nullifier double-spend via
  non-canonical inputs, and a stuck-funds full-tree case).
- **Amount privacy** is full on transfers, but shield + the withdrawn amount are public (link privacy).
- **Capacity ceiling** 8,192 notes total → a rollup / in-circuit insertion for millions.
- **Fee payer visible** on-chain → a relayer removes that correlation.
- **Note discovery** scans events → a production indexer at scale.
- The **invite gate** (currently off) is an app-level UX funnel, not on-chain access control; the
  per-deposit **cap is the real bound**. The disclosure viewing key is also stored locally (the real
  boundary is the *exported* packet).

**Design north star for the next phase:** commit to the dark "privacy-infrastructure" system, make the
signal-orange language intentional and consistent, fix the fix-list, and elevate the proving moment
(ProofViz / PoolScene) as the signature — the thing users screenshot.
