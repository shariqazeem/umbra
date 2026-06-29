# Umbra

**A consumer privacy wallet for Stellar.** Shield funds into a pool, generate a
zero-knowledge proof **in your browser**, and withdraw/send **privately** after a
Soroban smart contract verifies the proof **on-chain**. The private link between a
deposit and a withdrawal is hidden; the **amount is currently public**. Umbra also has
payment links, **selective disclosure**, and **wallet-linked cross-device recovery**.

> Everyone can build a ZK verifier. **We built the wallet around it.**

---

## In 20 seconds

| Question | Answer |
| --- | --- |
| **What is Umbra?** | A consumer privacy wallet on Stellar — shield, send privately, unshield, pay links. |
| **What does ZK do?** | Money can't move without a Groth16 proof. Shield proves a note is well-formed; withdraw proves you own a note (Merkle inclusion + ownership + nullifier + recipient + amount) **without revealing which note**. |
| **What touches Stellar?** | A **Soroban contract verifies the proof on-chain** (BLS12-381 via CAP-0059 host functions) before any funds move. |
| **What works today?** | Shield · send · unshield · payment/donation/invoice links · in-browser proving · multi-wallet signing · selective disclosure · **cross-device recovery** — all live on **testnet**. |
| **What's the honest limit?** | **Link privacy, not confidential amounts** (amounts are public). **Unaudited.** Single-contributor trusted setup. Not for real assets yet. |
| **Verify it?** | In-app **`/proof`** (copyable contract ids + real tx links) and **`/mainnet`** (security-gated readiness). |

---

## Live on Stellar testnet (real, verifiable)

- **Pool contract:** [`CBGB5DAY…SDV7`](https://stellar.expert/explorer/testnet/contract/CBGB5DAYD7RYIHDK2T6DE364VD3RJZGG5AUEQETW6LO3ZI4A5L3LSDV7)
- **Real shield deposit:** [`9fb4dc15…`](https://stellar.expert/explorer/testnet/tx/9fb4dc1579df048b4a5c13b90e34f649c6a59f22e530a33192fdfdfcce7f8efc)
- **Withdraw where the proof was verified on-chain:** [`aa5cf132…`](https://stellar.expert/explorer/testnet/tx/aa5cf13217212290728c9c264620003309664b1d8a0db8e816a1b59f4107c676)
- The **same flow driven entirely from the browser** (no terminal): see [`docs/BROWSER_E2E.md`](docs/BROWSER_E2E.md).

On-chain, the deposit and the withdrawal **share no linking data** — that is the
product. (Values mirror `infra/deploy/deployment.json`; the running app uses its own
fresh pool, surfaced in `/proof`.)

## How a private payment works

```
Wallet → Note → Commitment → Browser proof (snarkjs) → Soroban verifier (on-chain) → Pool transfer → Explorer
         secret stays local        proves membership without        no valid proof,
                                    revealing which note             no payout
```

`shield()` verifies a Groth16 proof, pulls funds, and inserts a Poseidon commitment into
an on-chain Merkle tree. `withdraw()` verifies a proof of inclusion + ownership + a
one-time nullifier + recipient binding + amount conservation, rejects spent nullifiers
and unknown roots, and pays out. The Groth16 verifier is a Rust library compiled into
the pool, so verification happens inside the same on-chain call. Plain-English contract
walkthrough: [`docs/PRODUCT_STATE.md` §5](docs/PRODUCT_STATE.md).

## Demo script (≈2.5 min)

1. Open the landing — **“Private money on Stellar.”**
2. Open the **wallet**, connect **Freighter**.
3. **Shield** funds → watch the **browser proving lifecycle** (proving → signing → submitting → confirming).
4. Click the **explorer link** — the proof, verified on-chain.
5. **Send privately** / unshield → success shows **“What you did · What Stellar saw · What Umbra proved privately.”**
6. **Wipe local storage** (or switch device) → reconnect the wallet → **balance comes back from the chain.**
7. Open **`/proof`** (evidence) and end on **`/mainnet`** (honest blockers, serious path).

> “Umbra is not a slide about privacy. It’s a working private wallet where Stellar
> verifies the proof on-chain — and your private balance follows your wallet anywhere.”

## Run it locally

```bash
corepack pnpm install        # workspace install (uses workspace:* deps)
corepack pnpm dev            # app → http://localhost:3000
```

**Environment** (`.env.local`, optional — without it the app does all local crypto and
only on-chain submission is disabled):

```bash
NEXT_PUBLIC_UMBRA_POOL_CONTRACT=<C...>   # a deployed UmbraPool on testnet
# defaults: RPC = soroban-testnet.stellar.org, passphrase = Test SDF Network ; September 2015
```

**Deploy a fresh pool** (Stellar CLI + a funded `umbra-deployer` testnet key):

```bash
bash infra/deploy/deploy-slice.sh --force   # builds, deploys, inits (binds vk + token)
# if init reports "Storage MissingValue" (RPC lag), re-run the init invoke once — see PRODUCT_STATE §10
```

**Tests / checks:**

```bash
cargo test -p umbra-pool          # 6/6 — real Groth16 proofs vs the real BLS12-381 host
corepack pnpm exec vitest run     # 25/25 — crypto, recovery non-collision, payment-link tamper, components
corepack pnpm typecheck           # tsc --noEmit, clean
corepack pnpm build               # next build, 15/15 routes
```

## ⚠️ Security & honesty

- **Link privacy, not confidential amounts.** Amounts are **public** on-chain; only the
  deposit↔withdrawal link is hidden.
- **Unaudited.** The contract, circuits, and verifier path have **not** been audited.
- **Single-contributor trusted setup** (Groth16) — demo-grade.
- **Testnet only.** Mainnet money paths are hard-disabled and **security-gated**
  (the in-app `/mainnet` page). Do **not** use for real assets.
- Internal review: [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) (incl. the
  fee-payer privacy leak and a nullifier-TTL/double-spend caveat).

## Roadmap to mainnet

Independent **audit** · **MPC trusted-setup ceremony** (or transparent-proof migration)
· **confidential amounts** (or build on [Stellar Confidential Tokens](docs/CONFIDENTIAL_TOKENS_STRATEGY.md))
· **fee-privacy relayer** ([`docs/RELAYER.md`](docs/RELAYER.md)) · **production indexer**
([`docs/INDEXER.md`](docs/INDEXER.md)) · Merkle depth 20 · deployer multisig. Full
scorecard in-app at `/mainnet`.

## Repository structure

```
contracts/        Soroban (Rust): umbra-pool · groth16-verifier · bench-pool
circuits/         Circom (BLS12-381): shield · withdraw · merkle · poseidon
packages/         crypto-bls · wallet-core · sdk (@umbra/sdk) · benchmarks · bench-harness
app/              Next.js routes: / · wallet · proof · mainnet · audit · build · apps · pay/[id] · links · donate · invoice
components/umbra/  premium UI · cinematic bg · pool scene · proof/lifecycle · wallet-connect · success mark
lib/umbra/        wallet store · prover (worker) · soroban client · signer + wallets-kit · note-derivation + recovery · viewing-key + audit · payment links · network/gates · rails (PrivacyRail)
hooks/            useProver · useWallet · useCopyToClipboard
infra/deploy/     testnet deploy scripts + deployment.json (live-evidence source of truth)
docs/             PRODUCT_STATE · SECURITY_REVIEW · RELAYER · INDEXER · CONFIDENTIAL_TOKENS_STRATEGY · BROWSER_E2E · SCOPE · …
```

## Key docs

- [`docs/PRODUCT_STATE.md`](docs/PRODUCT_STATE.md) — full technical state + plain-English contracts.
- [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) — internal review (not an audit).
- [`docs/CONFIDENTIAL_TOKENS_STRATEGY.md`](docs/CONFIDENTIAL_TOKENS_STRATEGY.md) — the CT adapter strategy.
- In-app: `/proof` (verify everything), `/mainnet` (readiness & gates).
