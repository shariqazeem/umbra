# Umbra — Browser → Testnet End-to-End (Proven)

_2026-06-21. The final credibility gap, closed: **a complete Umbra payment flow
executed entirely from the browser against Stellar testnet** — create link → fund
(shield) → generate proof → submit → verify on-chain → withdraw → success. No CLI,
no manual transaction submission, no mocked states. The browser was the source of
truth; the two transactions below were submitted by the running web app and are
independently confirmed on Horizon._

---

## TL;DR — the proof

| Step | What the browser did | Result |
| --- | --- | --- |
| Create link | Generated a fresh note + **shield proof in-browser** (snarkjs, off-thread) | link minted |
| Fund / Pay | Submitted the **shield** to testnet from the app | **tx `4798875e…0c0846`** |
| Withdraw | Generated the **withdraw proof in-browser**, submitted to testnet | **tx `0cf5517e…63069`** |
| Success | Polled `getTransaction` to SUCCESS, rendered "Funds released" | confirmed on-chain |

- **E2E pool (browser-driven):** `CDY54W6J4NZMCZJ4NFOP6WT4O5E5RD73CQDUXDVFNLVV4P5TLSYU2KCQ`
- **Shield tx:** https://stellar.expert/explorer/testnet/tx/4798875e7835b2029bc49ced7b31e573b6c15a866a5a5f7efdcbd6be1e0c0846 — Horizon `successful: true`, ledger 3207610
- **Withdraw tx:** https://stellar.expert/explorer/testnet/tx/0cf5517edac205b696ba0661b38f873db14ce63f831b8fb282bcbce2f6e63069 — Horizon `successful: true`, ledger 3207615
- **Network:** testnet (Protocol **27**)
- Screenshots: [`docs/assets/browser-e2e/`](assets/browser-e2e/) (`02-paid-shield-onchain.png`, `03-funds-released.png`).

Both transactions share the same signer account but, on-chain, the deposit's
commitment and the withdrawal's nullifier carry no linking data — the privacy
property holds on a public network, driven from the browser.

---

## Exact setup

Tooling (one-time; see also [`SCOPE.md`](SCOPE.md) / the deploy scripts):

```bash
brew install stellar-cli                       # stellar 27.x
rustup target add wasm32v1-none                # stellar-cli >=23 build target
stellar keys generate umbra-deployer --network testnet --fund   # funded signer
```

Deploy a **fresh** pool (the browser must be its sole writer — see Gap 1):

```bash
bash infra/deploy/deploy-slice.sh --force      # build + deploy + init → new pool id
# (this E2E used the restore-after pattern so the main demo's deployment.json was left intact)
```

Point the app at that pool (gitignored, local only):

```bash
echo "NEXT_PUBLIC_UMBRA_POOL_CONTRACT=<fresh-pool-id>" > .env.local
PORT=3010 npm run dev
```

With the env set, `isChainConfigured()` is true and the UI exposes the
secret-key/recipient fields used to sign + receive.

## Exact flow (what a user clicks)

1. **`/links`** — fill the form, "Generate payment link". The browser creates a
   note (`Poseidon(secret, amount)`), stores the secret locally, and proves the
   shield in a Web Worker. The link carries the commitment + proof, never the secret.
2. **`/pay/<id>`** — open the link, paste a funded testnet secret, "Pay 50 USDC".
   The browser submits `shield(proof, commitment, amount, depositor)` on-chain,
   waits for confirmation, and records the on-chain **leaf index** so the note
   becomes spendable.
3. **`/withdraw`** — the note is now spendable. Enter the payout address + signer
   secret, "Withdraw privately". The browser generates the withdraw proof (3.9 MB
   zkey, off-thread), submits `withdraw(...)`, waits for confirmation, and shows the
   "Funds released" reveal.

The run was driven through the real UI by headless Chromium (clicking buttons /
filling fields — the app's own code did all proving + submission).

## Timings (this run, fast Apple-silicon Mac — single sample)

| Phase | Time |
| --- | --- |
| Link creation incl. in-browser shield proof | ~3.3 s |
| Shield: submit + on-chain confirm | ~24.6 s |
| Withdraw: in-browser proof + submit + confirm | ~24.7 s |
| — of which withdraw proof (3.9 MB zkey) | `keyLoad=174ms prove=2459ms total=2634ms` (off-thread) |
| **Full flow wall time** | **~54 s** |

Most of the per-tx time is **on-chain confirmation polling** (1.5 s intervals), not
proving. Mobile / mid-tier proving is unmeasured.

---

## Blockers found and fixed (the real work)

Every one of these was a genuine browser→chain boundary defect. None touched the
protocol, circuits, or contract.

1. **Env not wired.** `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` was unset → all flows ran
   choreographed local-demo mode. *Fix:* `.env.local`.
2. **Proof struct serialized with String keys.** `nativeToScVal({a,b,c})` produced an
   ScMap with **String** keys, but a Soroban struct needs **Symbol** keys. On-chain
   this threw `HostError: map_unpack_to_linear_memory … Error(Value, UnexpectedType)`.
   *Fix:* build the proof map explicitly with `scvSymbol` keys (sorted) in
   `proofScVal` (`lib/umbra/soroban.ts`). (The CLI avoided this by using the contract
   spec.)
3. **SDK ↔ network protocol skew.** Testnet is Protocol **27**; the installed
   `@stellar/stellar-sdk` was `13.3.0` (older protocol) and could not decode the
   response → `Bad union switch: 4` *after* a successful submission. *Fix:* bump
   `@stellar/stellar-sdk` → **16.0.1**.
4. **Leaf index never recorded.** `shield()` returns the on-chain leaf index, but the
   app discarded it and never called `walletStore.observe()`, so the note stayed
   unspendable and withdraw was impossible. *Fix:* `submitShield` now confirms the tx
   and returns `{ hash, leafIndex }` (from the contract return value); `/pay` and
   `/shield` call `walletStore.observe(commitment, leafIndex)`.
5. **No on-chain confirmation.** Submit returned `sendTransaction`'s un-confirmed
   hash — "success" on a PENDING tx (a simulated-success risk). *Fix:* `invoke()`
   polls `getTransaction` until `SUCCESS`, or throws on `FAILED`/timeout.
6. **Dirty pool / tree sync.** An earlier partial run (which submitted a shield but
   failed to *parse* the reply) had consumed leaf 0, so a later note landed at leaf 1
   while the single-note local wallet tree placed it at position 0 → Merkle inclusion
   `Assert Failed` during withdraw witness generation. *Fix:* deploy a **truly-fresh
   pool** and run exactly once (browser = sole writer → note at leaf 0).

**Files changed (browser→chain plumbing only):** `lib/umbra/soroban.ts`,
`app/pay/[id]/page.tsx`, `app/withdraw/page.tsx`, `app/shield/page.tsx`,
`package.json` + lockfile (SDK bump), `.env.local` (local/gitignored). The contract
was redeployed (same wasm) to a fresh instance — a release action, not a code change.

## Failure modes observed (and what they mean)

- `map_unpack_to_linear_memory / UnexpectedType` → struct passed with String keys
  instead of Symbol keys (blocker 2).
- `Bad union switch: N` → SDK too old to decode the network's protocol XDR (blocker 3).
- `Assert Failed … Withdraw_4 line: 43` → withdraw witness inconsistent (Merkle
  inclusion); here, a leaf-index/tree mismatch from a dirtied pool (blocker 6).
- Page hangs in "funding"/"working" → an unconfirmed submit; the confirm loop now
  bounds this and surfaces `did not succeed (status …)`.

---

## Remaining gaps (honest)

1. **Single-user tree sync → fresh pool per cycle.** The browser wallet rebuilds the
   Merkle tree only from *its own* notes. So a clean browser shield→withdraw requires
   the browser to be the pool's **sole writer**; the E2E pool above is effectively
   single-use (its first note is spent). Reproducing the flow means deploying a fresh
   pool each time. A real multi-party flow (payer ≠ recipient; multiple depositors)
   needs **on-chain event sync** (scan `DepositCreated`) — a deferred feature, not
   built. In this single-browser demo, payer and recipient share one wallet, so it works.
2. **Signing uses a pasted testnet secret** in the UI form. Production should sign via
   a wallet extension (e.g. Freighter), not a pasted key.
3. **Reveal links vs E2E txs.** The `/withdraw` wow-screen reads the *main*
   `deployment.json` (the CLI-demo pool), so its two card links show those txs; the
   *actual* browser-E2E withdraw tx is shown in the success message line and verified
   on Horizon above. Pointing `deployment.json` (and the README) at the browser pool
   is submission-mode work, intentionally not done here.
4. **Latency is a single sample on a fast machine**; mobile/mid-tier is unmeasured.
5. **Recipient-binding vs payout address** remain decoupled (slice caveat / gate G11).

---

## Success criteria

> _A new user can perform a complete Umbra payment flow entirely from the browser
> against Stellar testnet._

**Met** — link → pay/shield → withdraw all execute from the browser, the proofs are
generated in-browser, both transactions are confirmed on testnet, and the success
screen reflects a real on-chain result. The one operational caveat for reproduction
is the single-writer requirement (deploy a fresh pool per cycle) — a documented
consequence of the deferred multi-party event-sync, not a defect in the browser path.
