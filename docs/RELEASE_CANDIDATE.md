# Umbra — Release Candidate (hackathon submission)

_Stellar Hacks: Real-World ZK. Submission-mode RC. Scope is frozen: no new privacy
primitive, no Confidential-Tokens implementation, no mainnet deployment, no
swap/join-split. This documents the release, its validation, limits, and the demo plan._

## Fill before submitting

| Field | Value |
| --- | --- |
| **App URL** | `<DEPLOY_URL>` _(or run locally — see below)_ |
| **Repo URL** | https://github.com/shariqazeem/umbra |
| **Demo video URL** | `<YOUTUBE_OR_LOOM_URL>` |

## One-liner

A **consumer privacy wallet for Stellar**: shield funds, generate a ZK proof **in the
browser**, and send/withdraw **privately** after a Soroban contract **verifies the proof
on-chain**. The deposit↔withdrawal link is hidden; **amounts are public**. Plus payment
links, selective disclosure, and **wallet-linked cross-device recovery**.

---

## Validation (this RC)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `corepack pnpm typecheck` (`tsc --noEmit`) | ✅ clean |
| Build | `corepack pnpm build` (`next build`) | ✅ 15/15 routes |
| Unit/component tests | `corepack pnpm exec vitest run` | ✅ 25/25 (7 files) |
| Contract tests | `cd contracts && cargo test -p umbra-pool` | ✅ 9/9 (real proofs vs real BLS host; C1/H1/M1/M2) |
| Route smoke | curl `/ /wallet /proof /mainnet /audit /build /apps /links /donate /invoice` | ✅ all 200 |
| Proof explorer links | Horizon `successful` for the 4 `/proof` txs | ✅ 4/4 `successful=true` |
| **Live shield** | browser flow, testnet key | ✅ confirmed on Horizon |
| **Live send/withdraw** | browser flow, testnet key | ✅ confirmed (after the tree-resync fix below) |
| **Cross-device recovery** | fresh browser, same key → balance from chain | ✅ recovered 16 XLM |

Run all checks:

```bash
corepack pnpm install
corepack pnpm typecheck && corepack pnpm exec vitest run && corepack pnpm build
( cd contracts && cargo test -p umbra-pool )
corepack pnpm start   # → http://localhost:3000
```

## Reliability fixes in this RC (minimal)

- **`app/wallet/page.tsx` — `doWithdraw` re-syncs the full on-chain tree before
  proving.** On a shared pool (multiple users/judges), other writers add leaves between
  our last sync and a withdrawal; a stale tree produced an unknown root and the withdraw
  failed. Re-syncing first makes send/unshield reliable on a busy pool. (Verified: send
  went from FAIL → PASS on the live multi-writer pool.)
- **`app/build/page.tsx` — GitHub button points at a non-404 placeholder** (`https://github.com`)
  until the real repo URL is set, so judges never hit a dead link.

No other code changes; all existing flows preserved.

## Audit results (links / assets / claims)

- ✅ No `docs/assets/wow.gif` / broken image references in the README.
- ✅ All `/proof` explorer links resolve `successful=true` on Horizon.
- ✅ All referenced docs exist (`RELAYER`, `INDEXER`, `CONFIDENTIAL_TOKENS_STRATEGY`,
  `SECURITY_REVIEW`, `PRODUCT_STATE`, `BROWSER_E2E`, `SCOPE`).
- ✅ Nav + CTA buttons resolve to real routes (`/wallet /proof /mainnet /apps /build`).
- ✅ No claim of confidential amounts, audited status, or mainnet production safety
  anywhere — every such mention is a negation, a labeled roadmap item, or the CT preview.
- ⚠️ Repo/demo URLs are placeholders (table above).

## Known limitations (honest)

- **Link privacy, not confidential amounts.** Amounts are public on-chain.
- **Self-reviewed, not externally audited.** A self-review hardening pass fixed the
  exploitable money-path issues (C1/H1/M1/M2 — `docs/SECURITY_REVIEW.md` §0), live on
  testnet and tested; the circuits + verifier path + recovery still need an independent
  audit before unbounded mainnet use.
- **Single-contributor trusted setup** (Groth16) — demo-grade.
- **Testnet only.** Mainnet money paths are hard-disabled and security-gated (`/mainnet`).
- **Merkle depth 8** → 256 notes per pool.
- **Fee-payer privacy leak** — the withdrawal submitter's account is visible (relayer is
  roadmap; see `docs/RELAYER.md`).
- **Pre-deterministic notes** (shielded before the recovery feature, with random secrets)
  are not cross-device recoverable; new notes are.
- `/proof` and the running app now share **one hardened pool** (`CCBNNCXZ…`, C1/H1/M1/M2,
  in `deployment.json` + `.env.local`), with fresh confirmed shield/withdraw txs — real testnet.

## Final demo path (≈2.5 min)

1. Landing — **"Private money on Stellar."**
2. Wallet → connect Freighter (or "Testnet demo key").
3. **Shield** → watch the proving lifecycle (proving → signing → submitting → confirming).
4. Click the **explorer link** — proof verified on-chain.
5. **Send privately** → success shows **"What you did · What Stellar saw · What Umbra
   proved privately"** (amount public, link hidden).
6. **Wipe local storage** → reconnect wallet → **balance rebuilt from chain.**
7. **`/proof`** (evidence) → end on **`/mainnet`** (honest blockers, serious path).

Closing line: _"Umbra is not a slide about privacy. It's a working private wallet where
Stellar verifies the proof on-chain — and your private balance follows your wallet
anywhere."_

## Fallback demo plan (if something fails live)

- **Stellar RPC slow/down:** lead with the **recorded demo video**; `/proof` evidence is
  **static** (contract ids + confirmed tx links on **stellar.expert**, independent of our
  RPC); the app still loads and proves locally — only on-chain submission needs RPC.
- **Freighter / extension unavailable (e.g. incognito):** use the in-app **"Testnet demo
  key"** with a funded testnet secret — no extension required. (Get one from Friendbot.)
- **Recovery demo without two machines:** in DevTools console run
  `localStorage.removeItem("umbra.slice.notes.v1"); location.reload()`, then reconnect —
  the balance rebuilds from chain (this is exactly how recovery was verified).
- **Both wallet + RPC fail:** play the video, walk `/proof` (third-party explorer), and
  show `cargo test -p umbra-pool` (6/6) + `vitest` (25/25) — the crypto is provable offline.

## Submission checklist

- [ ] Fill App URL, Repo URL, Demo video URL (table above + 2 code placeholders).
- [ ] Record the demo video (script above).
- [ ] Confirm `.env.local` points at a live, initialized testnet pool.
- [ ] Re-run the validation block; confirm green.
