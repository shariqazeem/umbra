# #3 — Deeper tree (capacity) design

Branch: `feat/deeper-tree` · Fallback: tag `v0.1.0-testnet` (main). Status: **SHIPPED —
depth 13 (8,192 notes) live and verified on-chain.** A real shield, join-split transfer,
register-on-claim, and worst-case withdraw all fit Stellar's per-tx budget at depth 13 on
testnet (see the tx hashes in `infra/deploy/deployment.json` → `demoTxs`). A 128× capacity
increase over the depth-6 checkpoint, with zero change to the security model.

## The measurement (committed benchmark: `measure_depth_budget`)

| Thing | Cost |
| --- | --- |
| One Poseidon permutation (params reused) | **13.1M CPU** |
| Deserialize Poseidon constants | 0.76M CPU (negligible) |
| Verify + overhead (fixed per tx) | ~42M CPU |
| Transfer @ depth 6 (**2 inserts** = 12 permutations) | **208M CPU** (proven-good) |
| Soroban per-tx ceiling | **~250M** (depth-8 2-insert = 263M → the prior `TxSorobanInvalid`) |
| **Transfer @ depth 13 (1 insert = 13 permutations), measured** | **220.7M CPU** |
| **↳ real withdraw @ depth 13 (1 insert + token transfer), on-chain** | **SUCCEEDED** ✓ |

**Conclusion:** depth is **permutation-bound**. Each tree level = one 13.1M permutation; a
transfer pays for `2 × depth` of them. The floor can't drop without changing the hash (which
would break the on-chain ↔ circuit Poseidon match). **The only lever is 1 insert per tx.**

- 2 inserts (today): max ~depth 6–7 → **64–128 notes**.
- **1 insert: max ~depth 13–14 → 8,000–16,000 notes (128–256×).**
- Millions: **not reachable this way** — needs a rollup (batch many inserts into one proof so
  on-chain insert cost is O(1)). Separate, large architecture.

## The 1-insert redesign (defer the recipient's insert to claim time)

Today `transfer` inserts BOTH outputs (recipient `out1` + change `out2`) = 2 inserts. Change it
so **every operation inserts exactly one leaf**:

1. **`transfer`** — insert **only `out2` (the sender's change)** [1 insert]. Record `out1` in a
   **pending set** (`DataKey::Pending(out1) = true`) — this is the *backing*: `out1` may only be
   inserted later because a real spent input paid for it (**prevents inflation** — you can't
   mint a note without a matching deposit/spend).
2. **New `claim` circuit** — proves `commitment = Poseidon(secret, value)` with **`value`
   PRIVATE** (public inputs: `[commitment]` only, so the received amount stays hidden) + a
   64-bit range on `value`. This is the recipient proving they hold the opening.
3. **`claim_insert(proof, commitment, note_ct)`** — verify the claim proof (**knowledge of the
   opening → prevents tree-spam griefing**), check `Pending(commitment)` (backing), insert the
   commitment [1 insert], remove the pending flag, emit `NoteRegistered(leaf, note_ct)` for
   cross-device recovery. No token moves (value already in the pool).
4. **Wallet** — the private-send claim link carries the opening `{secret, value}` (no leafIndex
   yet); claiming proves + calls `claim_insert` and learns the leaf. Recovery already handles
   `NoteRegistered`.

Both **inflation** (pending-set backing) and **griefing** (claim proof) are closed. `shield`
and `withdraw` are already 1 insert, so with `transfer` at 1 insert the whole pool can run at
**depth ~13–14**.

## Safety

The contract's incremental-tree root must stay **byte-identical** to the wallet/circuit root —
the existing fixture tests fail loudly on any divergence, so a tree bug cannot ship silently.
`main` + the `v0.1.0-testnet` tag are the fallback if anything regresses.

## Implementation steps — ALL DONE ✓

1. ✓ Added `circuits/src/claim.circom` (commitment opening, value private) + build + trusted
   setup → `vk_claim`. Constructor gained a 4th VK.
2. ✓ Contract: `transfer` → 1 insert + pending; `claim_insert`; `DataKey::Pending`. 14/14 tests.
3. ✓ Wallet: transfer emits `out1` opening (no leaf) in the link; claim proves + `claim_insert`;
   recovery follows the `NoteRegistered` events. 30/30 unit.
4. ✓ Rebuilt circuits at **depth 13**, redeployed, and submitted **real transfer + claim +
   withdraw on testnet** — every op fit the budget (the true test, not just simulation). We
   stopped at 13 (not 14): the measured 1-insert transfer is 220.7M, comfortably below the
   ~250M ceiling; 14 (≈234M) is closer to the edge and buys only 2× for more risk.
5. ✓ Bumped `merkleDepth` to 13 in `deployment.json` (+ `demoTxs`); updated capacity copy.

## Realistic outcome

**8,000–16,000 notes** — enough for thousands of users with a few notes each; the honest answer
to "does it handle many people." **Not millions** — that remains the rollup roadmap. This is a
deliberate ~half-day pass, best done with you engaged (new circuit + new trusted-setup keys +
flow rework), not rushed. The branch + benchmark + this design are ready to execute on.
