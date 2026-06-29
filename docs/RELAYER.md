# Umbra Relayer — fee-payer privacy for withdrawals

_Architecture spec (not yet implemented). The relayer is a **roadmap** component that
closes the fee-payer privacy leak (`docs/SECURITY_REVIEW.md` §11). It is **not** a
custodian and never holds user funds or secrets._

## The problem

A `withdraw` transaction is submitted by some Stellar account, which pays the fee and
appears on-chain as the tx source. If a user shields and later withdraws from the **same
account**, an observer can correlate them — defeating the point. Umbra's proof hides the
*deposit→withdrawal link*; it does not hide *who submitted the withdrawal*.

## The fix

Let a **relayer** submit the withdrawal on the user's behalf. The user generates the
proof locally (as today) and hands the relayer only the **public** withdraw payload; the
relayer pays the fee and broadcasts. The user's account never touches the chain for that
withdrawal.

```
user browser ──(proof + public inputs + `to`)──▶ relayer ──submits withdraw()──▶ Stellar
   keeps secret                                   pays fee, no custody
```

What the relayer receives is **already public** (it's the contract's public input set):
`proof`, `root`, `nullifier`, `recipient`, `amount`, `to`. It learns nothing it couldn't
read from the chain after the fact — except it doesn't see the user's IP-less submitter
account, which is the whole point.

## API

```
POST /relay/withdraw
  body: { proof, root, nullifier, recipient, amount, to }
  → 200 { txHash }            // relayer simulated, verified, signed, submitted
  → 400 { error }             // malformed / invalid proof / spent nullifier / fee policy
```

Read endpoints the relayer (or any client) may expose for convenience — all derivable
from the chain, nothing private:

```
GET /pool/events?from=<ledger>     → DepositCreated / WithdrawalCompleted (for indexing)
GET /pool/roots                    → the contract's recent-roots ring
GET /pool/nullifiers/:id           → { spent: boolean }   (proxy of is_spent)
```

## Abuse controls (must-haves)

- **Verify before relay.** The relayer simulates the `withdraw` (which runs the on-chain
  Groth16 check) and only submits if it would succeed — no spam onto the chain.
- **Nullifier precheck.** Reject if `is_spent(nullifier)` is already true.
- **Rate limits** per IP / per nullifier / global, to bound griefing of the fee budget.
- **Fee policy.** The relayer fronts the fee; recover it via a small in-pool fee taken
  from the withdrawn amount (a circuit/contract change — roadmap), or a sponsor model.
- **No custody, ever.** The relayer holds **no user funds and no secrets**. It only ever
  sees public proof payloads. It cannot move funds anywhere except as the proof dictates.
- **Censorship resistance.** The direct (self-submitted) path stays available, so a
  relayer can never hold a withdrawal hostage — it's an optional privacy upgrade.

## Non-goals

- Not a custodial wallet. Not a mixer operator with discretion. Not a KYC chokepoint.
- Does not store user secrets, derive seeds, or reconstruct balances.
- Does not break browser-only proving — proofs are still generated client-side.

## Status

**Roadmap.** Specified here; not implemented. Linked from `/mainnet`.
