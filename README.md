<div align="center">

# Umbra

### Private money on Stellar.

**Shield funds into a pool, generate a zero-knowledge proof _in your browser_, and send or cash out privately — a Soroban smart contract verifies every proof _on-chain_ before a single stroop moves.** The link between a deposit and a withdrawal is broken; a private send hides the amount entirely.

[![status](https://img.shields.io/badge/status-live_on_mainnet-FF3B00)](https://getumbra.xyz)
[![network](https://img.shields.io/badge/Stellar-Public_Network-111)](https://stellar.expert/explorer/public/contract/CBWIV33FQ27LOTA2LGM5SVL2WHAMBFLZTYOZXWKEMDBFCLU4BNIUQOLU)
[![app](https://img.shields.io/badge/app-getumbra.xyz-FF3B00)](https://getumbra.xyz)
[![proofs](https://img.shields.io/badge/proofs-Groth16_·_BLS12--381-635BFF)](https://getumbra.xyz/proof)

**[getumbra.xyz](https://getumbra.xyz)** · [verify it on-chain](https://getumbra.xyz/proof) · [mainnet readiness](https://getumbra.xyz/mainnet)

</div>

> Everyone can ship a ZK verifier. **We built the wallet around it** — and put it on mainnet.

---

## Live on Stellar mainnet (real, verifiable)

Umbra runs on the **Stellar Public Network** as an open, capped early-access canary. Every entrypoint has been exercised with real XLM — click through and check:

| | On-chain evidence |
| --- | --- |
| **Pool contract** | [`CBWIV33F…QOLU`](https://stellar.expert/explorer/public/contract/CBWIV33FQ27LOTA2LGM5SVL2WHAMBFLZTYOZXWKEMDBFCLU4BNIUQOLU) |
| **Shield** (private deposit) | [`9970804e…`](https://stellar.expert/explorer/public/tx/9970804ed373ac17f87ba92d1aaca7b6dc25abb7144438974a492619e40a7f80) |
| **Private send** (join-split, amount hidden) | [`0a65cf28…`](https://stellar.expert/explorer/public/tx/0a65cf2814985086c1f628a16a3ad9fdc3a6e5df8e4c98aa3849b3bc0cb62c08) |
| **Claim** (recipient, link only) | [`5e539120…`](https://stellar.expert/explorer/public/tx/5e539120be8389061b4c9d26bdd774af34b1da21644b5c7cbbbfcf04be5679f8) |
| **Deploy** | [`f3d0a294…`](https://stellar.expert/explorer/public/tx/f3d0a294bef424da8dce0c6ce7e4294d673bd496b22a05a57f4214f7409f5f62) · wasm `968eb0db…` |

On-chain, that shield and its later spend **share no linking data.** That is the product. Contract ids and live transactions are surfaced (and copyable) in-app at **[/proof](https://getumbra.xyz/proof)**.

---

## What you can do

- **Shield** — move public XLM into the privacy pool in one click. A Poseidon commitment is inserted into an on-chain Merkle tree; your note secret never leaves the browser.
- **Send privately** — a join-split spend where **the amount never touches the ledger.** The recipient receives a one-time **claim link** — no account, no address, nothing public.
- **Unshield** — cash out to any Stellar wallet. The payout is public; the change you keep stays hidden.
- **Payment links · invoices · donations** — get paid privately. The link is bound to your wallet, so whatever people pay lands in a note **you can withdraw on any device.**
- **Cross-device recovery** — your private balance **follows your wallet.** No account, no server, no custodian: notes are re-derived from a wallet signature and rediscovered by scanning the chain.
- **Selective disclosure** — you hold a viewing key and can export a signed audit packet to an accountant or auditor. Private by default; provable when _you_ choose.

Sign with **Freighter, xBull, Albedo, or LOBSTR** (Stellar Wallets Kit). Umbra never sees your secret key.

---

## How a private payment works

```
Wallet ─▶ Note ─▶ Commitment ─▶ Browser proof (snarkjs) ─▶ Soroban verifier (on-chain) ─▶ Pool ─▶ Explorer
          secret stays          proves ownership + membership       no valid proof,
          on your device        without revealing which note        no payout
```

- **`shield`** verifies a Groth16 proof, pulls the funds, and inserts a Poseidon commitment as a Merkle leaf.
- **`transfer`** (private send) verifies a join-split: one input note is spent, two output notes are created, value is conserved — **all amounts hidden.** The recipient's note is deferred and inserted only when they **`claim`** it.
- **`withdraw`** verifies inclusion + ownership + a one-time nullifier + **recipient binding** + amount conservation, rejects spent nullifiers and unknown roots, and pays out.

The Groth16 verifier is a Rust library compiled **into** the pool, so verification happens inside the same on-chain call — over **BLS12-381 via CAP-0059 host functions** (native pairings). Custom **Circom** circuits (shield · withdraw · transfer · claim); commitments and the tree use **Poseidon**.

**Depth-13 Merkle tree → 8,192 notes**, reached by a hard **≤1 leaf-insert-per-action** invariant so even a join-split fits Stellar's per-transaction budget. Withdrawals are **bound to the payout address** — a stolen proof aimed at a different address is rejected on-chain with `Error(Contract, #8) RecipientMismatch`.

---

## What's private, and what isn't

Umbra is honest about its boundaries — this matters more than the pitch.

| | Private | Public |
| --- | --- | --- |
| **Shield** (deposit) | which note you own, your future spends | the deposit amount (on/off-ramp) |
| **Private send** | sender, recipient, **and amount** | nothing links the two sides |
| **Unshield** (withdraw) | which note funded it, your change | the payout amount + destination |

So: a **private transfer is fully confidential**; the **on/off ramps move a public amount** (shield in, unshield out). Confidential ramp amounts are on the roadmap.

---

## Run it locally

Umbra is a **pnpm workspace** (Next.js 15 · React 19 · TypeScript). Use `corepack` so the pinned pnpm is used automatically.

```bash
corepack pnpm install     # workspace install (uses workspace:* deps — npm can't resolve these)
corepack pnpm dev         # app → http://localhost:3000
```

Without env vars the app still does **all local crypto** (wallet, commitment, witness, proof) — only on-chain submission needs a configured pool. To point it at the **live mainnet pool** (read + recover), create `.env.local`:

```bash
NEXT_PUBLIC_UMBRA_NETWORK=mainnet
NEXT_PUBLIC_UMBRA_POOL_CONTRACT=CBWIV33FQ27LOTA2LGM5SVL2WHAMBFLZTYOZXWKEMDBFCLU4BNIUQOLU
NEXT_PUBLIC_UMBRA_RPC_URL=https://mainnet.sorobanrpc.com
NEXT_PUBLIC_UMBRA_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_UMBRA_MAX_DEPOSIT_XLM=100   # arms the canary's hard per-deposit cap
```

> Freighter refuses to connect over plain `http://localhost` (no SSL). For a full on-chain run, use the deployed app at **[getumbra.xyz](https://getumbra.xyz)**; local dev is for the UI and in-browser proving.

**Checks:**

```bash
cargo test -p umbra-pool            # 14/14 — real Groth16 proofs against the real BLS12-381 host
corepack pnpm test                  # 33/33 — crypto, recovery, duplicate-note & payment-link regressions, components
corepack pnpm typecheck             # tsc --noEmit — clean
corepack pnpm build                 # next build — clean
```

### Recovery that survives forever

A spend must rebuild the full Merkle tree to prove inclusion, but Soroban RPC only retains events for ~24h–7d. A scheduled **snapshot indexer** ([`.github/workflows/pool-snapshot.yml`](.github/workflows/pool-snapshot.yml)) ingests the pool's events into a permanent, statically-served record before they expire, so recovery — and therefore every private spend — keeps working for the entire life of the pool.

---

## Security & honesty

This is an **experimental capped canary**, deliberately labelled as such everywhere — never "safe," never "audited."

- **Amounts are confidential on private sends, public on the on/off ramp** (shield/unshield).
- **Self-reviewed, _not_ professionally audited.** The contract, circuits, and verifier path have been reviewed internally (see [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md)) — that is not a substitute for an external audit.
- **Single-contributor Groth16 trusted setup.** Demo-grade until an MPC ceremony (or a transparent-proof migration).
- **Hard per-deposit cap** keeps real-money exposure small while the system earns trust.
- Withdrawals are **recipient-bound** (a stolen proof can't be redirected), nullifiers are one-time (no double-spend), and only the note-secret holder can ever withdraw.

Live readiness scorecard, with the honest blockers, is in-app at **[/mainnet](https://getumbra.xyz/mainnet)**.

---

## Repository structure

```
contracts/        Soroban (Rust): umbra-pool · groth16-verifier · bench-pool
circuits/         Circom (BLS12-381): shield · withdraw · transfer · claim · merkle (Poseidon via circomlib)
packages/         @umbra/crypto-bls · @umbra/wallet-core · @umbra/sdk · benchmarks
app/              Next.js routes: / · wallet · proof · mainnet · apps · shield · pay/[id] · claim/[code] · links · donate · invoice · audit · build
components/umbra/  UI system (Totality) · pool scene · proof lifecycle · wallet-connect · success mark
lib/umbra/        wallet store · prover (worker) · soroban client · signer + wallets-kit · note-derivation + recovery · pool-events (snapshot) · viewing-key + audit · payment links · network gates
hooks/            useProver · useWallet · useCopyToClipboard
scripts/          build-snapshot.mts (permanent event indexer)
infra/deploy/     mainnet deploy scripts + deployment.mainnet.json (on-chain source of truth)
docs/             ARCHITECTURE · SECURITY_REVIEW · UMBRA_MAINNET_SPEC · DEEPER_TREE · RELAYER · INDEXER · …
```

---

## Roadmap to production

Independent **security audit** · **MPC trusted-setup ceremony** (or transparent-proof migration) · **confidential ramp amounts** · **fee-privacy relayer** so gas doesn't deanonymize the payer · **deeper tree / rollup** beyond 8,192 notes ([`docs/DEEPER_TREE.md`](docs/DEEPER_TREE.md)) · deployer multisig. The full, honest scorecard lives at **[/mainnet](https://getumbra.xyz/mainnet)**.

---

<div align="center">

**[Open the app →](https://getumbra.xyz)**  ·  [Verify on-chain](https://getumbra.xyz/proof)  ·  [Architecture](docs/ARCHITECTURE.md)  ·  [Security review](docs/SECURITY_REVIEW.md)

<sub>Built on Stellar · Soroban · Groth16/BLS12-381. Private by default; provable when you choose.</sub>

</div>
