# Testnet deploy runbook (slice)

Push-button deploy of the UmbraPool slice to Stellar testnet, plus the two real
on-chain demo transactions (one shield, one withdraw) that anchor the demo.

Everything lands in **one machine-readable source of truth**:
[`deployment.json`](./deployment.json). Downstream steps consume only that file.

## What you need (one-time)

```bash
# 1. stellar CLI
brew install stellar-cli            # or: cargo install --locked stellar-cli

# 2. wasm build target
rustup target add wasm32-unknown-unknown

# 3. jq (parsing) + curl (funding check) — usually already present
brew install jq

# 4. a funded testnet deployer identity (this is the single deployer config var)
stellar keys generate umbra-deployer --network testnet --fund
#   already created but unfunded?  ->  stellar keys fund umbra-deployer --network testnet

# 5. the proof fixtures (already generated; only if circuits/build is empty)
bash circuits/scripts/build-slice.sh
```

The deployer identity name is the only config knob. Override the default
`umbra-deployer` by exporting `UMBRA_DEPLOYER=<name>` (or set it in repo-root
`.env`). See [`.env.example`](./.env.example). No `.env` is required.

## Run it

```bash
bash infra/deploy/deploy-slice.sh        # build + deploy + init  -> writes deployment.json
bash infra/deploy/capture-demo-txs.sh    # 1 shield + 1 withdraw  -> appends tx hashes + URLs
```

Both are idempotent:

- `deploy-slice.sh` reuses an existing pool contract and exits 0; pass `--force`
  to redeploy from scratch.
- `capture-demo-txs.sh` will not double-submit (the withdraw nullifier is
  single-use). After a fresh `deploy-slice.sh --force`, run it with `--force`.

If any prerequisite is missing, the script stops at preflight and prints the
exact command to fix it.

## Expected populated `deployment.json`

```json
{
  "network": "testnet",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "contractIds": {
    "pool": "CABC...POOL",
    "token": "CDEF...NATIVE_SAC"
  },
  "wasmHash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "deployTx": "3389d...<64 hex>",
  "deployTxUrl": "https://stellar.expert/explorer/testnet/tx/3389d...",
  "poolContractUrl": "https://stellar.expert/explorer/testnet/contract/CABC...POOL",
  "deployer": "GACE...DEPLOYER",
  "deployerId": "umbra-deployer",
  "explorerBase": "https://stellar.expert/explorer/testnet",
  "deployedAt": "2026-06-21T18:00:00Z",
  "shieldTx": "a1b2...<64 hex>",
  "withdrawTx": "c3d4...<64 hex>",
  "shieldExplorerUrl": "https://stellar.expert/explorer/testnet/tx/a1b2...",
  "withdrawExplorerUrl": "https://stellar.expert/explorer/testnet/tx/c3d4...",
  "demoCapturedAt": "2026-06-21T18:01:00Z"
}
```

The two explorer URLs (`shieldExplorerUrl`, `withdrawExplorerUrl`) are the
backbone of the demo's "can't-connect" reveal.

> If the CLI output format hides a tx hash, the script still submits the
> transaction and tells you where to find the hash
> (`…/explorer/testnet/account/<deployer>`); paste it into `deployment.json`.
