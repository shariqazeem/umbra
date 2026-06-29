# Umbra Indexer — scalable note discovery

_Architecture spec (not yet implemented). The indexer is a **roadmap** component that
makes cross-device recovery scale. It reads only **public** chain data and stores **no
secrets** — every user still re-derives and matches their own notes locally._

## The problem

Cross-device recovery (`lib/umbra/recovery.ts`) works today by scanning the pool's
events directly from the Soroban RPC. That's fine for a fresh pool, but the RPC only
retains a recent window (~24h) and paginates slowly. For a long-lived pool with many
deposits, a client can't re-scan the whole history on every connect.

## The fix

A lightweight indexer that ingests `DepositCreated` / `WithdrawalCompleted` events
**from the deploy ledger onward** and serves them quickly. The client still does the
private part — re-derive its secrets and match commitments — locally. The indexer only
removes the "walk the chain slowly" cost.

```
Stellar pool ──events──▶ indexer (ingest from deploy ledger) ──fast queries──▶ client
                          stores PUBLIC commitments/leaves/nullifiers          matches locally
```

## What it stores (all public)

- `(leafIndex, commitment, amount, ledger)` per deposit — to rebuild the full Merkle tree.
- `(nullifier, ledger)` per withdrawal — to mark spent notes.
- The recent-roots ring (or recompute it from the leaves).

It stores **no secrets, no seeds, no balances, no user↔note mapping** — it cannot know
which notes belong to whom (that requires the wallet seed, which never leaves the client).

## API

```
GET /pool/events?from=<ledger>&cursor=<c>   → { deposits[], withdrawals[], cursor }
GET /pool/tree                              → { leaves: [commitment...] }  (ordered by index)
GET /pool/roots                             → recent-roots ring
GET /pool/nullifiers/:id                    → { spent: boolean }
```

The client flow becomes: `GET /pool/tree` → rebuild tree → re-derive secrets → match →
balance. Identical privacy to today; just fast and complete.

## Trust & integrity

- The indexer is **untrusted convenience**. A malicious indexer can omit or fake leaves,
  but the client can **verify** the rebuilt root against the contract's `current_root()`
  on-chain — a wrong tree won't match, and withdrawals would fail. So the indexer cannot
  steal or forge; at worst it can be unavailable (fall back to direct RPC scan).
- No write path, no auth that touches funds.

## Non-goals

- Not a custodian. Not a private database of who-owns-what. Not required for correctness
  (the direct RPC scan remains the fallback).

## Status

**Roadmap.** Specified here; not implemented. Linked from `/mainnet`.
