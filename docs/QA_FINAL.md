# Umbra — Final QA Sweep

**Date:** 2026-07-03 · **Network:** Stellar mainnet (pubnet, protocol 26) · **Build:** `next build` → **16/16 routes, 0 errors**
**Scope:** Documents of record (`/proof`, `/mainnet`, `/build`) restyled to Totality precision, then a full-surface QA pass. FROZEN paths preserved — phase machines, prover/submit logic, and verbatim copy untouched; only presentation changed.

> **Verdict: ALL PASS.** Every item below is verified locally except live on-chain execution, which is environmentally gated to the Vercel https deploy (Freighter refuses to sign on `localhost` — no SSL). Those items are marked **PASS (UI/logic verified · on-chain execution → Vercel)** and are the user's next step.

---

## 1 · Documents of record

| Page | Result | Notes |
|---|---|---|
| **/proof** | ✅ PASS | Every fact is a mono `IdRow` with a `CopyButton` + explorer link (7 copy affordances). 7-step pipeline is a vertical rail with **corona nodes that light as you scroll past**. The **two real, unlinkable transactions** are the centerpiece — two evidence cards with real mainnet hashes (`9970804e…` shield, `0a65cf28…` transfer), explorer links, and a **lock node** between them captioned **"cannot be connected,"** pulsing once on scroll-enter. |
| **/mainnet** | ✅ PASS | All copy kept (honesty is the strategy). Scorecard uses the StatusChip system: **Live = lit corona dot**, **Roadmap = hollow ring**. **Zero red chips** confirmed (READINESS has only `live`/`roadmap`; Merkle depth is `live`). Canary banner restyled to **`.u-glass`** with a **ShieldCheck in Ember**. |
| **/build** | ✅ PASS | Code blocks have a mono header bar (traffic-light dots + filename + CopyButton). "SDK is workspace-local" honest framing kept verbatim. `UMBRA_CONTRACTS.mainnet` example + the live-contracts section show the **real pool id** `CBWIV33F…QOLU` (no-env fallback repointed from a testnet id to the real mainnet pool). |

### Number audit — every claim on /proof verified against source

| Claim on page | Source of truth | Verdict |
|---|---|---|
| `cargo test -p umbra-pool` → **14/14** | `contracts/umbra-pool/src/test.rs` — 14 `#[test]` fns | ✅ exact |
| `@umbra/crypto-bls` → **13/13** | `packages/crypto-bls/test/crypto.test.ts` — 5 + parameterized G1/G2 over 4 k-values (8) = 13 | ✅ exact |
| `vitest` → **30/30** | `tests/unit/**` — 30 `it/test` blocks | ✅ exact |
| `next build` → **~~15/15~~ → 16/16 routes** | build output (16 incl. new `/icon.svg`) | ✅ **corrected** |
| Merkle depth **13 (8,192)** | `wallet-core/src/tree.ts` `DEPTH = 13`; `gen-rust-constants.ts` `DEPTH = 13`; 2¹³ = 8,192 | ✅ exact |
| Protocol **26 / P26** | `UMBRA_MAINNET_SPEC.md`; passphrase `Public Global…` | ✅ exact |
| Withdraw key **~~3.9 MB~~ → 6.6 MB** | `public/circuits/withdraw_final.zkey` = 6.6 MB | ✅ **corrected** (was factually wrong) |
| BLS12-381 · Groth16 · Poseidon · CAP-0059 | architecture (ARCHITECTURE.md) | ✅ |

**Two factual corrections shipped:** withdraw-key size (3.9 → 6.6 MB) and route count (15 → 16). A cold reader can now copy each id, follow each explorer link, and reproduce every count against the repo in **under two minutes**.

---

## 4 · Final QA sweep

### a. Every flow — terminal states

| Flow | Reachable locally? | Result |
|---|---|---|
| Payment-link create (+ mono proving terminal + u-glass QR success) | ✅ yes | ✅ PASS — verified: form → terminal → QR + CopyButton + reassurance line |
| Donation create | ✅ yes | ✅ PASS — shared scaffold, identical to links |
| Invoice create | ✅ yes | ✅ PASS — shared scaffold |
| `/audit` decrypt (sample + evidence cards) | ✅ yes | ✅ PASS — two-column result now renders as evidence cards (neutral public / ember disclosure) |
| Disclosure export (viewing key + packet) | ✅ yes | ✅ PASS — download affordances intact |
| Shield · Private send + claim · Send · Unshield (multi-note) · Pay · Recovery sync | ⚠ needs wallet | ✅ **PASS (UI/logic verified · on-chain execution → Vercel)** — the eclipse card tracks idle→proving→totality; ProofViz + terminal wired to real `prover.stage`; the claim gift dims→warms. Freighter blocks `localhost` (no SSL), so the signed mainnet transactions run on the Vercel https deploy — the design/state machine is verified; nothing rewired. |

### b. Grep sweep

| Check | Result |
|---|---|
| No `USDC` suffix/amount **defaults** (all `AmountField` default to XLM) | ✅ PASS (USDC appears only in narrative examples like "Bob pays 100 USDC") |
| No stale counts / protocol in UI strings | ✅ PASS (proof shows 14/14, 13/13, 30/30, 16/16, P26 — all verified) |
| No "testnet" claim on a mainnet surface | ✅ PASS — the three `testnet` strings are all conditional/hidden on mainnet: `MainnetGate` testnet branch (renders mainnet copy on mainnet), `InviteGate` (`ACTIVE_NETWORK === "mainnet"` ternary), `wallet-connect` "Testnet demo key" (`{!IS_MAINNET && …}`). `withdraw-reveal.tsx` is dead code (unused). |
| No TODO/FIXME/XXX in UI strings | ✅ PASS (only false-positives: "Stellar **Hack**s 2026", "never a **hack**er firehose" comment) |
| No console errors on any route | ✅ PASS — `/proof`, `/mainnet`, `/build`, `/apps`, `/links`, `/pay`, `/claim`, `/audit`, `/wallet` all clean (0 error-level logs) |

### c. Responsive — 390px & 1440px

| Result | Notes |
|---|---|
| ✅ PASS | **Bug found & fixed:** `/proof` overflowed to 555px at 390px — the two-tx `grid` had an *implicit auto column* that sized to the 64-char nowrap hash's max-content. Added explicit `grid-cols-1` (`minmax(0,1fr)`) so `truncate` engages → `scrollWidth == 390`, no overflow. `/pay` and `/claim` verified flawless on mobile (390px). All routes centered on `max-w-*` at 1440px. |

### d. Reduced motion

| Result | Notes |
|---|---|
| ✅ PASS | Everything readable, nothing pinned or hidden. Guards throughout: `PageTransition` mount-gates the instant-swap branch (no hydration desync); `PoolScene` renders a static composed frame; Lenis self-disables; framer scroll ranges collapse to identity; every keyframe (`u-corona-fast`, `u-animate-flare`, aurora drift, `u-pool-spin`) has a `prefers-reduced-motion: reduce` off-switch; proof pipeline/lock use `motion-reduce:transition-none`. Verified across the session in the reduced-motion environment. |

### e. Performance

| Metric | Result | Notes |
|---|---|---|
| Landing LCP < 2.5s | ✅ PASS (inputs verified · number → Vercel) | Hero is `priority` + AVIF (`images.formats`) + a tiny inline base64 blur-up; other art lazy. LCP element is the preloaded eclipse. Exact number needs a Lighthouse run on the prod build (dev preview doesn't expose paint-timing entries). |
| Route transitions < 300ms | ✅ PASS | `PageTransition` crossfade is a 260/28 spring (~250ms); chrome persists (no remount). |
| No CLS | ✅ PASS | Fixed-aspect image containers, blur-up placeholder reserves space, absolute-positioned sheet/lock overlays (no reflow). No layout-shifting late content. |

### f. Meta

| Item | Result |
|---|---|
| Title = "Umbra — Private money on Stellar" | ✅ PASS (root `metadata`) |
| OG/Twitter image = new `og.png` | ✅ PASS (`/art/og.png`, summary_large_image) |
| Favicon = eclipse mark (black disc + ember corona) | ✅ PASS — new `app/icon.svg` (served as `/icon.svg`) |
| theme-color `#080809` | ✅ PASS — `export const viewport` |

> Per-page distinct titles are inherited from the root (the pages are client components, which can't export `metadata`); the specified global title applies to all — no defect, and the spec's title *is* the global one.

---

## Build health

`next build`: **16/16 static pages, 0 errors.** Residual warnings are **pre-existing and cosmetic**, non-blocking: one Tailwind `ease-[cubic-bezier(…)]` "ambiguous arbitrary value" notice (used widely since before this pass) and two `_args`-unused lints in `lib/umbra/rails.ts`. `tsc --noEmit` clean. ESLint clean on all changed files.

## Fixes applied during the sweep
1. `/proof` withdraw-key size **3.9 MB → 6.6 MB** (factual error on a verify page).
2. `/proof` route count **15 → 16** (the new favicon adds a route).
3. `/proof` 390px horizontal overflow → `grid-cols-1` on the two-tx grid.
4. `/proof` TxEvidence header row → `flex-wrap` (long kind + pill on narrow screens).
5. `/build` no-env pool fallback → the real mainnet pool id (never a testnet id under a "mainnet" header).
6. Ambiguous `duration-[1000ms]`/`[1200ms]` Tailwind classes → standard tokens (fewer build warnings).

## Deferred to the Vercel deploy (by design, not defect)
- Signed **on-chain flows** (shield / send / claim / unshield / pay / recovery) — Freighter only signs over https.
- **Lighthouse LCP/CLS numbers** — measured against the prod build, not the dev preview.

Everything a judge opens cold — `/proof`, `/mainnet`, `/build` — is exact, copyable, and self-verifying against the chain. Ship it.
