# Umbra — Mainnet Canary Runbook

How to take the **hardened** UmbraPool live on Stellar **mainnet** as a small, capped,
self-reviewed canary. Everything below is ready to run — the only things left are **your
XLM** and **pulling the trigger**.

> ⚠️ **Honest risk statement.** This pool custodies **real XLM**. It is **self-reviewed**
> (C1/H1/M1/M2 fixed + tested, live evidence on testnet) but **NOT independently audited**,
> and it uses a **single-contributor Groth16 trusted setup** — if that ceremony's secret
> ("toxic waste") ever leaked, proofs could be forged. Treat this as an **experimental
> canary**: deposit only small amounts you can afford to lose, keep the cap low, and wind it
> down when the demo is over. This is exactly the posture the UI shows users — never "safe",
> never "audited". See `docs/SECURITY_REVIEW.md`.

## What's already done

- Contract hardened: **C1** (withdrawals bound to the payout address), **H1** (atomic
  constructor init), **M1/M2** (amount + tree-full guards). `cargo test` 9/9, live on
  testnet (pool `CCBNNCXZ…`), C1 rejection verified on-chain (`Error #8`).
- `infra/deploy/deploy-mainnet.sh` — one-shot mainnet deploy (build → upload → resolve
  native XLM SAC → deploy via constructor), with a typed confirmation and a funded-deployer
  check. Idempotent; `--force` to redeploy.
- App is mainnet-aware (`lib/umbra/network.ts`): set `NEXT_PUBLIC_UMBRA_NETWORK=mainnet` and
  the app talks to mainnet, but **money paths stay OFF** until you arm the canary flag + cap.
- The browser flows (shield / unshield / send / receive, and cross-session recovery from the
  same wallet/key) are **network-agnostic** and already proven on testnet — they behave
  identically on mainnet.

## Go-live steps

**1. Fund the deployer with real XLM.** Send a few XLM to the deployer address
(`stellar keys address umbra-deployer`) — enough for fees + your canary deposit.

**2. Pick a mainnet Soroban RPC.** Mainnet has no free friendbot RPC; use a provider
(Validation Cloud, Blockdaemon, QuickNode, or self-hosted):

```bash
export UMBRA_RPC_URL="https://<your-mainnet-soroban-rpc>"
export UMBRA_CANARY_CAP_XLM=25          # keep it small
```

**3. Deploy.** The script prints the deployer + balance and requires you to type
`DEPLOY MAINNET` to proceed:

```bash
bash infra/deploy/deploy-mainnet.sh
# → writes infra/deploy/deployment.mainnet.json with the pool id + deploy tx
```

**4. Point the app at mainnet** (production env — Vercel/Netlify env vars, or a local
`.env.production.local`; do **not** commit secrets):

```
NEXT_PUBLIC_UMBRA_NETWORK=mainnet
NEXT_PUBLIC_UMBRA_POOL_CONTRACT=<pool from deployment.mainnet.json>
NEXT_PUBLIC_UMBRA_RPC_URL=<your mainnet RPC>
NEXT_PUBLIC_UMBRA_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

**5. Arm the capped canary** (this is the switch that actually allows mainnet deposits):

```
NEXT_PUBLIC_UMBRA_ENABLE_CANARY=true
NEXT_PUBLIC_UMBRA_MAX_DEPOSIT_XLM=25     # must match your intent; hard per-deposit cap
```

`MainnetGate` now shows the honest amber "experimental canary, capped at N XLM, NOT audited"
banner. With the flag off (default), mainnet shows "money paths disabled".

**6. Smoke test with ONE tiny shield + withdraw** before anything else, and confirm both on
`stellar.expert/explorer/public`. Then do a cross-session recovery check (new browser, same
wallet) to confirm the private balance rebuilds from mainnet events.

## Before opening the canary to the public

The per-deposit cap above is enforced **client-side** — fine while **you** are the only
depositor. If you let others deposit, move the cap **on-chain**: add a `max_deposit`
constructor argument to `umbra-pool` and reject `amount > max_deposit` in `shield` (a small,
already-scoped change). That bounds the pool's blast radius regardless of how anyone calls
the contract. Ask and this can be added + redeployed in one pass.

## Wind-down

When the demo/canary is done: stop accepting deposits (set `NEXT_PUBLIC_UMBRA_ENABLE_CANARY=false`),
withdraw any remaining notes, and note the final state. The contract stays on-chain (immutable),
but with deposits disabled it holds nothing further.
