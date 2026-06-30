# Umbra — Final Submission

_Stellar Hacks: Real-World ZK. This is the submission cover sheet. Items marked **TODO**
require a URL/asset only the team can provide (real repo, deployed app, recorded video) —
they are **not** filled with fake links._

## Project

- **Name:** Umbra
- **One-liner:** A consumer privacy wallet for Stellar — shield funds, generate a
  zero-knowledge proof **in the browser**, and send/withdraw **privately** after a
  Soroban contract **verifies the proof on-chain**. The deposit↔withdrawal link is
  hidden; amounts are public. Plus payment links, selective disclosure, and
  **wallet-linked cross-device recovery**.
- **Tagline:** _Everyone can build a ZK verifier. We built the wallet around it._

## URLs

| Field | Value |
| --- | --- |
| **Public repo** | https://github.com/shariqazeem/umbra |
| **Live app** | **TODO** — not yet deployed. Deploy (Vercel/Netlify, see below), then paste `https://<app>`. |
| **Demo video** | **TODO** — record using the script in `docs/RELEASE_CANDIDATE.md`, then paste. |
| **Proof Center** | `https://<app>/proof` (in-app today: `/proof`) |
| **Mainnet Readiness** | `https://<app>/mainnet` (in-app today: `/mainnet`) |

> Repo URL is set in code: `components/umbra/landing-narrative.tsx` (`REPO_URL`) and the
> `app/build/page.tsx` GitHub button both point at the repo above.

## On-chain evidence (Stellar testnet, Protocol 27 — real)

| Item | Id / hash |
| --- | --- |
| Live pool — **hardened** (C1/H1/M1/M2), `.env.local` + `/proof` | `CCBNNCXZCRAEFMHNHKTDK6G2P2LRYWS7SDKGMJABSPO34223Y75HFJHX` |
| Pool wasm hash | `fe2f637953950baf357ce34b8fc9462b91def1e7460d1213663c2234edfc778c` |
| Asset (native SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Deployer (public) | `GAHR34WCIIS4TQDGC362ETJSHXNLE6AF6ZDK3EPONNPFRIEXLWNOHYXQ` |

Real, Horizon-confirmed transactions on the hardened pool (all `successful=true`):

- Shield deposit — https://stellar.expert/explorer/testnet/tx/ef25404c5fadf4b4ab4c071bbea608811bf1dcad13535e0d47893f1f7f742597
- Withdraw — proof verified on-chain **and bound to the payout address (C1)** — https://stellar.expert/explorer/testnet/tx/a37f97c22147998eaddf1cff1a98b1ba6318361e663072b2d1a41805a15a4e73
- **C1 enforced live:** resubmitting that same proof with a different `--to` is rejected
  on-chain with `Error(Contract, #8) RecipientMismatch` (fails at simulation — a stolen
  proof cannot be redirected). H1: the pool was initialized **by its constructor**, not a
  separate `init()` call.

## Test results (this RC)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | ✅ clean |
| `next build` | ✅ 15/15 routes |
| `vitest` | ✅ 25/25 (7 files) |
| `cargo test -p umbra-pool` | ✅ 9/9 (real proofs vs real BLS host; incl. C1/M1/M2 guards) |
| Route smoke (localhost, 10 routes) | ✅ all 200 |
| `/proof` explorer links | ✅ 4/4 `successful=true` |
| Live shield · send · recovery | ✅ all confirmed (recovered 16 XLM on a fresh device) |

```bash
corepack pnpm install
corepack pnpm typecheck && corepack pnpm exec vitest run && corepack pnpm build
( cd contracts && cargo test -p umbra-pool )
corepack pnpm start            # → http://localhost:3000
```

## Production deploy (what's required)

- **Required env vars** (public; see `.env.example`):
  - `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` — a deployed testnet UmbraPool (e.g. `CCBNNCXZ…`).
  - `NEXT_PUBLIC_UMBRA_RPC_URL` (default `https://soroban-testnet.stellar.org`).
  - `NEXT_PUBLIC_UMBRA_NETWORK_PASSPHRASE` (default `Test SDF Network ; September 2015`).
  - `NEXT_PUBLIC_UMBRA_PROOF_MODE=live`.
- **Deploy:** standard Next.js 15 (`pnpm build` / `pnpm start`) on Vercel or Netlify.
- **Status:** **TODO** — not deployed yet. The deployed-URL checks (route smoke on the
  live URL, wallet connect on the live URL, live shield/send on the live URL, recovery on
  the live URL) are **pending deployment**; they pass on localhost today.

## Public-repo readiness

- ✅ **No secrets in source** — scanned for Stellar secret keys (`S…`), mnemonics, and
  private-key material: none. The deployer key lives in the Stellar CLI keystore (outside
  the repo); the public deployer address only is referenced.
- ✅ **.gitignore** covers `.env*` (keeps `.env.example`), `node_modules`, `.next`,
  `contracts/target`. `.env.local` (public pool id only) is ignored.
- ✅ **README** renders cleanly; all relative `docs/*.md` links resolve; the one
  localhost hyperlink was removed.
- ✅ **`.env.example`** added (public placeholders, no secrets).
- ⚠️ **Not a git repo yet** — `git init`, commit, and push to a public repo is the
  team's remaining step.

## Known limitations (honest)

- **Link privacy, not confidential amounts** — amounts are public on-chain.
- **Self-reviewed, not externally audited.** A focused adversarial self-review fixed the
  exploitable money-path issues — C1 (withdrawals bound to the payout address), H1 (atomic
  constructor init), M1/M2 (amount + tree-full guards), all live on testnet and tested
  (`docs/SECURITY_REVIEW.md` §0). This is **not** a substitute for an independent audit,
  which remains the top mainnet blocker. Single-contributor trusted setup (Groth16).
- Merkle depth 8 (256 notes/pool). Fee-payer privacy leak (relayer is roadmap).
- Pre-recovery (random-secret) notes aren't cross-device recoverable; new notes are.
- See `docs/SECURITY_REVIEW.md` (incl. the nullifier-TTL/double-spend caveat) and
  `docs/PRODUCT_STATE.md` (plain-English contracts).

## Fallback demo plan (if something fails live)

- **RPC slow/down:** lead with the recorded video; `/proof` evidence is static (contract
  ids + confirmed tx links on **stellar.expert**, independent of our RPC); the app still
  loads and proves locally.
- **No Freighter / incognito:** use the in-app **"Testnet demo key"** with a funded
  testnet secret (Friendbot) — no extension needed.
- **No second device for recovery:** DevTools console →
  `localStorage.removeItem("umbra.slice.notes.v1"); location.reload()` → reconnect → the
  balance rebuilds from chain.
- **Wallet + RPC both fail:** play the video, walk `/proof`, show `cargo test` (6/6) +
  `vitest` (25/25) — the crypto is provable offline.

## Remaining TODO (team)

1. ~~`git init` → commit → push to a public repo~~ ✅ done — https://github.com/shariqazeem/umbra
2. **Deploy** the app; paste the live URL; re-run route smoke + a live shield/send on it.
3. **Record** the demo video; paste the URL.
4. Optionally point `.env.local`'s pool at a fresh pristine pool for the recorded demo.
