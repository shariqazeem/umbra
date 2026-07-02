# Mainnet launch — invite-only capped canary

**Honest status.** This ships Umbra to **Stellar mainnet** as an **experimental, invite-only,
hard-capped canary**. It is **self-reviewed, NOT independently audited**, and uses a
**single-contributor trusted setup**. Every surface labels it as such. Keep the cap small and
only expose funds you can afford to lose. The audit, MPC ceremony, relayer, indexer, and
multisig remain on the roadmap (`/mainnet` scorecard, `docs/DEEPER_TREE.md`).

The contract is the exact code verified on-chain at depth 13 (8,192 notes) — shield, join-split
transfer, register-on-claim, and withdraw all confirmed live on testnet.

---

## What gates access (two independent layers)

1. **Invite gate (app-level).** `NEXT_PUBLIC_UMBRA_INVITE_REQUIRED=true` puts `/wallet` behind a
   code screen (Solana-perps style) with a "request access" mailto (DEFA style). Codes are matched
   by SHA-256 — plaintext codes never ship in the bundle. **This is a UX funnel, not an on-chain
   control:** the pool contract is public; anyone who crafts a transaction can call it directly.
2. **Hard per-deposit cap (real bound).** `NEXT_PUBLIC_UMBRA_MAX_DEPOSIT_XLM` caps every deposit
   client-side. This is what actually bounds real-world exposure: the pool can only ever hold small
   amounts, so the worst case (a circuit/ceremony flaw) is bounded to what's in the pool.

> An honest launch tells invitees: *unaudited canary, small amounts, you could lose your deposit.*
> That's the informed-consent bar these early-access launches (Naoris, TxFlow, Midnight) clear.

---

## Prerequisites

- **RPC — SOLVED.** Public, no-signup mainnet Soroban RPC (tested healthy):
  `https://soroban-rpc.mainnet.stellar.gateway.fm` (Gateway.fm). Fallbacks:
  `https://mainnet.sorobanrpc.com`, `https://rpc.lightsail.network/`, or your own provider.
- **Funded deployer — the only thing left.** The identity `umbra-deployer-mainnet` is already
  created locally (secret in the Stellar keystore). Fund its address with **~15 XLM** (deploy
  fees + demo deposits + reserve):
  ```
  stellar keys address umbra-deployer-mainnet   # → send ~15 XLM here from Freighter/an exchange
  ```

## Deploy (one command once funded)

```bash
# fixtures must exist (depth-13); rebuild if needed:
bash circuits/scripts/build-slice.sh

# deploy the hardened wasm + 4-VK constructor to mainnet (typed confirmation, real money):
UMBRA_DEPLOYER=umbra-deployer-mainnet \
UMBRA_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm \
UMBRA_CANARY_CAP_XLM=5 \
  bash infra/deploy/deploy-mainnet.sh
# → writes infra/deploy/deployment.mainnet.json with the pool contract id
```

## Arm the app

Copy `.env.mainnet.example` into `.env.local` **and** your Vercel project env, then fill in:

- `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` — the pool id from `deployment.mainnet.json`
- `NEXT_PUBLIC_UMBRA_RPC_URL` — the same provider RPC
- `NEXT_PUBLIC_UMBRA_INVITE_HASHES` — the SHA-256 of each issued code (see below)
- `NEXT_PUBLIC_UMBRA_MAX_DEPOSIT_XLM` — keep it small (e.g. 5)

NEXT_PUBLIC_* vars are inlined at build time → **rebuild/redeploy the site** after changing them.

## Issue invite codes

Codes are `UMBRA-XXXX-XXXX`, matched case-insensitively by SHA-256. Generate a code + its hash:

```bash
CODE="UMBRA-$(openssl rand -hex 2 | tr a-f A-F)-$(openssl rand -hex 2 | tr a-f A-F)"
echo "$CODE"; printf '%s' "$CODE" | shasum -a 256 | cut -d' ' -f1
```

Put the **hashes** (comma-separated) in `NEXT_PUBLIC_UMBRA_INVITE_HASHES`; hand out the **codes**.
An initial batch is already issued for this launch (kept out of git — see the launch note).

## Prove it on mainnet

After arming, run one real cycle with your own funds → real mainnet explorer links for the demo:
**shield (small) → private send → claim → unshield.** Record the tx hashes in
`deployment.mainnet.json` (or `capture-demo-txs.sh` adapted to the mainnet pool).

---

## Wind-down

It's a canary. When the demo is done, unshield everything, and either drop
`NEXT_PUBLIC_UMBRA_ENABLE_CANARY` (freezes new deposits behind the gate) or point the app back at
testnet. Nothing about the contract needs to change.
