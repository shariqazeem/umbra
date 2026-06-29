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
| Live app pool (`.env.local`) | `CBT2YYN4YCBOB7HD6SYV3G33LA5CY4GHK5AWDEU54B53MGM6D2RTTNW3` |
| Canonical demo pool (`/proof`, deployment.json) | `CBGB5DAYD7RYIHDK2T6DE364VD3RJZGG5AUEQETW6LO3ZI4A5L3LSDV7` |
| Asset (native SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Deployer (public) | `GAHR34WCIIS4TQDGC362ETJSHXNLE6AF6ZDK3EPONNPFRIEXLWNOHYXQ` |

Real, Horizon-confirmed transactions (all `successful=true`):

- Shield deposit — https://stellar.expert/explorer/testnet/tx/9fb4dc1579df048b4a5c13b90e34f649c6a59f22e530a33192fdfdfcce7f8efc
- Withdraw (proof verified on-chain) — https://stellar.expert/explorer/testnet/tx/aa5cf13217212290728c9c264620003309664b1d8a0db8e816a1b59f4107c676
- Browser-driven shield — https://stellar.expert/explorer/testnet/tx/4798875e7835b2029bc49ced7b31e573b6c15a866a5a5f7efdcbd6be1e0c0846
- Browser-driven withdraw — https://stellar.expert/explorer/testnet/tx/0cf5517edac205b696ba0661b38f873db14ce63f831b8fb282bcbce2f6e63069

## Test results (this RC)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | ✅ clean |
| `next build` | ✅ 15/15 routes |
| `vitest` | ✅ 25/25 (7 files) |
| `cargo test -p umbra-pool` | ✅ 6/6 (real proofs vs real BLS host) |
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
  - `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` — a deployed testnet UmbraPool (e.g. `CBT2YYN4…`).
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
- **Unaudited.** Single-contributor trusted setup (Groth16). Testnet only; mainnet
  hard-disabled and security-gated (`/mainnet`).
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
