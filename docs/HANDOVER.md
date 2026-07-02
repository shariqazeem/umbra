# Umbra — Technical & Product Handover

_A consumer privacy layer for Stellar commerce._
**Last updated:** July 2026 · **Status:** live on Stellar **testnet**, mainnet-gated ·
**Audience:** anyone picking this project up (engineer, judge, collaborator).

This is the single source of truth for **what Umbra is, what works today, how it works, how
it looks, and what's next.** It supersedes the older scattered state docs.

---

## 1. TL;DR

Umbra is a **non-custodial privacy wallet for Stellar**. You move public XLM into a shielded
pool, then move value **privately** — with a real, in-browser zero-knowledge proof verified
**on-chain** by a Soroban smart contract. No mixer service, no custodian, no trusted server.

**Three things work end-to-end, live on testnet, verified by real BLS12-381 proofs:**

1. **Shield** — deposit public XLM into the pool (becomes a private note).
2. **Private send** — a confidential shielded→shielded transfer where **the amount is hidden
   on-chain**; the recipient receives a one-time claim link.
3. **Unshield / Send** — cash out an **arbitrary amount** to any Stellar address; the amount is
   public but **unlinkable to your deposit**, and the **change stays private** in the pool.

Plus: private payment/donation/invoice **links**, **cross-device recovery** (your balance
follows your wallet, not a server), and **selective disclosure** (encrypted local audit
packets you can choose to share).

---

## 2. What Umbra is (product thesis)

> **The consumer privacy layer for Stellar commerce.** Privacy is the feature, not the
> configuration.

Stellar is fast and cheap but **radically transparent** — every payment, amount, and
counterparty is public forever. Umbra adds a privacy layer on top: shield once, then transact
without publishing who-paid-whom (and, for private sends, without publishing the amount at
all). The target user is a **person or small business** — freelancers, NGOs, merchants — who
wants normal payments without a public financial history.

Built on the shape of **Nethermind SPP (Stellar Private Payments)**: a Groth16 + Poseidon
shielded pool, but with our **own circuits, our own contract, and our own confidential
transfer** (not a wrapper over anyone's token).

---

## 3. Live deployment (Stellar testnet)

| Thing | Value |
| --- | --- |
| Network | `testnet` (`Test SDF Network ; September 2015`), Protocol 27 |
| **Pool contract** | `CBD37QCPJD4QPK6G7N4HBOPOERG7QWUBHQMVUILI3TQKHOWBL2PKSGXL` |
| Asset (native SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Deployer | `GAHR34WCIIS4TQDGC362ETJSHXNLE6AF6ZDK3EPONNPFRIEXLWNOHYXQ` |
| WASM hash | `17de8641aa0a115f6f23b3e15e2368498e6a2798bee7815e11e061ffa305121c` |
| Deploy tx | `1a7f4a3edcc6e13a3cddbb27bb7077682dd194164a2e1f4c83dc476e3b9cf247` |

Machine-readable source of truth: `infra/deploy/deployment.json`.
The app reads the pool id from `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` (in `.env.local`).

> **Note on redeploys:** the pool is initialized atomically by its constructor (token + all
> three verifying keys bound in the deploy tx — see H1 below), so changing any circuit means a
> **new pool** with an **empty tree**. Old shielded balances live on the old pool; users
> re-shield into the new one. This is expected on testnet.

---

## 4. The three privacy flows (and exactly what each hides)

This is the heart of the product. All three break the link between your deposit and your
activity — they differ in **what else** is hidden and **who can receive**.

| | **Shield** | ✦ **Private send** | **Send / Unshield** |
| --- | --- | --- | --- |
| Direction | public → pool | pool → pool | pool → public address |
| Amount on-chain | **public** (you're depositing) | **hidden** | **public** (only the withdrawn part) |
| Change | — | hidden (private note) | **hidden** (private note) |
| Destination | your note | an Umbra **claim link** | **any** Stellar wallet |
| Recipient needs Umbra? | — | yes (claims the link) | **no** — real XLM lands in any wallet |
| Linkable to your deposit? | n/a | **no** | **no** |
| What the ledger sees | a commitment + amount | a nullifier + 2 commitments (no number) | "a withdrawal of X to address Y" |

**Mental model:**
- **Private send** = a sealed envelope — no one sees the amount, but the recipient must be "in
  the club" (they open a claim link into their own Umbra wallet, funds stay shielded).
- **Send** = an anonymous drop — the amount is visible, but it can't be traced to you, and it
  pays any normal wallet.
- **Unshield** = Send, but to **your own** address (cashing out).

Both Send and Unshield are the **same on-chain mechanism** (a public withdrawal with private
change); they differ only in whether the destination is you or someone else.

---

## 5. Architecture

Four layers, each testable in isolation, sharing **one** definition of the crypto primitives
so the browser, the fixtures, and the on-chain contract can never disagree.

```
┌─────────────────────────────────────────────────────────────────┐
│  app/  — Next.js 15 App Router (React 19). The consumer UI.       │
│  Wallet, flows, proving (Web Worker), Freighter signing, recovery.│
└───────────────▲─────────────────────────────────────┬───────────┘
                │ witness inputs / notes               │ signed tx
┌───────────────┴───────────────┐        ┌─────────────▼───────────┐
│ packages/wallet-core (TS)     │        │ Stellar testnet (RPC)   │
│ notes, commitments,           │        │  ┌───────────────────┐  │
│ nullifiers, Merkle tree,      │        │  │ contracts/umbra-  │  │
│ witness builders              │        │  │ pool (Soroban)    │  │
└───────────────▲───────────────┘        │  │  verify + tree +  │  │
                │ same Poseidon           │  │  nullifiers       │  │
┌───────────────┴───────────────┐        │  └─────────▲─────────┘  │
│ packages/crypto-bls (TS)      │        │            │ Groth16     │
│ Poseidon constants + oracle   │───────▶│  contracts/groth16-     │
│ (Rust ≡ circuit ≡ TS)         │  gen   │  verifier (BLS12-381)   │
└───────────────────────────────┘        └─────────────────────────┘
                ▲
┌───────────────┴───────────────┐
│ circuits/ — Circom 2 (bls12381)│  shield · withdraw · transfer · merkle · poseidon
│ Groth16 proving keys + wasm    │  → served to the browser under public/circuits/
└───────────────────────────────┘
```

**Why the shared core matters:** Poseidon is byte-identical across Rust (contract), Circom
(circuit), and TypeScript (wallet). A test (`poseidon_matches_ts_oracle`) pins the Rust hash
to the TS oracle, so an off-chain-computed Merkle root always equals the on-chain root.

---

## 6. How it works, end to end

### 6.1 Shield (deposit)
1. Wallet mints a **note** locally: `{ secret, value }`, secret derived from a wallet
   signature seed (so it's recoverable). Nothing about the secret leaves the browser.
2. Compute `commitment = Poseidon(secret, value)`.
3. Prove the `shield` circuit in a **Web Worker** (snarkjs, ~fast — small circuit).
4. Submit `shield(proof, commitment, amount, from)`. The contract verifies, transfers the
   public XLM in, **inserts the commitment** into the on-chain Poseidon Merkle tree, and emits
   `DepositCreated(commitment, leafIndex, amount)`.

### 6.2 Private send (confidential transfer, 1-in / 2-out join-split)
1. Pick a note that covers the amount. Build **two** output notes: recipient (`out1`) + change
   (`out2`), with `value == out1 + out2`.
2. Prove the `transfer` circuit: inclusion of the input note, its nullifier, both output
   commitments are well-formed, **value conservation**, and a **64-bit range** on every amount
   (this is what stops field-overflow value forgery).
3. Submit `transfer(proof, root, nullifier, out_commitment1, out_commitment2)`. The contract
   verifies, spends the nullifier, and **inserts both commitments**. **No token moves and no
   amount appears** — the ledger sees only a nullifier and two commitments.
4. The app hands the recipient a **bearer claim link** (`/claim/<code>`, base64url of
   `{secret, value, leafIndex}`). They import it and, after a sync, it's a spendable private
   note in their wallet.

### 6.3 Send / Unshield (withdrawal with private change, 1-in / 1-public-out / 1-change)
1. Pick the **smallest note that covers** the requested amount. Build a **change** note for the
   remainder (seed-derived).
2. Prove the `withdraw` circuit: inclusion + nullifier + a well-formed change commitment +
   `value == amount + change` + 64-bit ranges + **recipient binding** (C1).
3. Submit `withdraw(proof, root, nullifier, recipient, amount, change_commitment, to)`. The
   contract verifies, checks the payee binding, spends the nullifier, **inserts the change
   note**, and **pays the public `amount`** out to `to`. Emits
   `WithdrawalCompleted(nullifier, to, amount, change_commitment, change_leaf)`.
4. The withdrawn amount is public; the **change is a new private note** (value hidden on-chain).

### 6.4 Recovery (your balance follows your wallet)
1. Reconnect a wallet → derive the **same deterministic seed** from a signature.
2. Scan the pool's events (`DepositCreated`, `WithdrawalCompleted`, `TransferCompleted`).
3. Rebuild the **full Merkle tree densely by leaf index** (so inclusion paths match on-chain).
4. Re-derive note secrets from the seed and match commitments → your spendable balance
   reappears, withdrawable, on any device. No server, no account.

---

## 7. Cryptography

- **Proof system:** Groth16 over **BLS12-381**, verified on-chain via Stellar's native host
  functions (CAP-0059) — a G1 MSM + a 4-term pairing check in a single host call.
- **Hash:** Poseidon (t=3), identical across Rust / Circom / TS. On-chain, `PoseidonParams`
  deserializes the round constants + MDS matrix **once per call** (not per hash) — the
  optimization that lets two Merkle inserts fit Stellar's per-tx compute budget.
- **Commitments:** `Poseidon(secret, value)`. **Nullifiers:** `Poseidon(secret, leafIndex)` —
  one-time spend tags; the contract rejects any it has seen (no double-spend, no deposit link).
- **Merkle tree:** on-chain Poseidon tree, **depth 6 (64 notes)**, with a recent-roots ring so
  a proof can prove inclusion against any recently-valid root.
- **Join-split conservation + range proofs:** for both `transfer` and `withdraw`, every amount
  is range-checked to 64 bits so sums cannot wrap the field — conservation therefore holds over
  the integers, not just mod p. This is the classic confidential-transaction safety property.

### Circuits (`circuits/src/`)
| Circuit | Shape | Public inputs |
| --- | --- | --- |
| `shield` | commitment well-formedness | `[commitment, amount]` |
| `withdraw` | 1-in / 1-public-out / 1-change | `[root, nullifier, recipient, amount, changeCommitment]` |
| `transfer` | 1-in / 2-out (confidential) | `[root, nullifier, outCommitment1, outCommitment2]` |

Proving keys + wasm are served to the browser from `public/circuits/` (the withdraw key is
~3.9 MB; proving runs off the main thread).

---

## 8. The smart contract (`contracts/umbra-pool`)

Rust / Soroban. Embeds the `groth16-verifier` library so **verification happens in the same
on-chain call** as the state change — money cannot move without an on-chain-verified proof.

**Entrypoints**
- `__constructor(token, vk_shield, vk_withdraw, vk_transfer)` — binds the asset + all three
  verifying keys **atomically** at deploy time.
- `shield(proof, commitment, amount, from) -> u32` — verify, pull funds in, insert, return leaf.
- `withdraw(proof, root, nullifier, recipient, amount, change_commitment, to) -> u32` — verify,
  C1 payee check, spend nullifier, insert change, pay out, return change leaf.
- `transfer(proof, root, nullifier, out1, out2) -> (u32, u32)` — verify, spend nullifier,
  insert both outputs (no token movement).
- Views: `current_root`, `is_spent(nullifier)`, `next_index`.

**Events:** `DepositCreated`, `WithdrawalCompleted`, `TransferCompleted` — enough to rebuild
the whole tree from chain (used by recovery).

**Hardened invariants (self-reviewed, tested):**
- **C1 — payee binding:** the withdrawal proof's `recipient` public input must equal
  `field(to)`; a stolen/observed proof can't be redirected to another address (front-running
  theft). A rejected redirect does **not** burn the nullifier.
- **H1 — atomic init:** no separate `init()` to front-run; keys are bound in the constructor tx.
- **M1 — non-positive amounts rejected** before any token movement.
- **M2 — tree-full rejected** once the fixed-depth tree is at capacity.

---

## 9. Security posture (honest)

**Real today:** real Groth16 verification on-chain (not stubbed); C1/H1/M1/M2 hardened and
covered by tests that run against the **real BLS12-381 host**; non-custodial keys; nullifier
double-spend protection; recipient binding; non-canonical public inputs rejected.

**AI audit (Fable 5), July 2026 — 3 surfaces, both Criticals found and fixed:**
An adversarial review by three independent Fable 5 agents (contract, circuits, verifier +
encoding) found **two Critical bugs**, both since fixed, re-verified, and live on-chain:
- **C-A · Non-canonical nullifier double-spend (theft).** `Fr::from_bytes` reduces mod r, so
  `n` and `n+r` are the same scalar (a valid proof verifies for both) but different raw bytes,
  and the pool keyed the nullifier set on raw bytes → replay a spent proof with `n+r` and get
  paid twice; on `transfer` (no auth) anyone could do it → insolvency. **Fix:** a canonical-form
  gate in `verify_groth16` rejecting any public input ≥ r. (commit `af5007f`)
- **C-B · Tree-full stuck funds (liveness).** Every spend inserted a leaf and gated on capacity,
  so once the 64-leaf tree filled, all withdraw/transfer reverted forever, freezing funds.
  **Fix:** a full-exit path (`has_change` flag) — a note can always be withdrawn *in full* with
  no insert, even at a full tree. (commit `46622e7`)
Both have dedicated tests against the real host (`noncanonical_nullifier_rejected`,
`full_exit_works_when_tree_full`); a re-audit confirmed both closed and hardened the first test
so it genuinely pins the gate. Circuit review returned **sound** (no forgeable-proof path).
Minor items fixed in the same pass: shield CEI ordering, instance-TTL, amount-encoding guard.

**Explicitly NOT claimed:**
- **Not independently (human) audited.** Self-reviewed + AI-audited (Fable 5) only. An
  independent professional audit is still required before mainnet with real user funds.
- **Trusted setup is a demo ceremony** (single contributor), not a multi-party MPC — fine for
  testnet, **not** for mainnet keys.
- **Small anonymity set:** depth-6 tree = 64 notes. Real privacy needs a larger tree + traffic.
  (Once full, only full-exits work — funds are recoverable, but transfers/partial-withdraws
  revert until a deeper tree ships. Not a stuck-funds bug; a scale limit.)
- **Amounts:** shield and the withdrawn portion are **public**. Only private sends (and change)
  hide amounts. We do **not** claim confidential amounts on shield/withdraw.
- **Residual Low:** nullifier and commitment share a Poseidon domain (a dust-only linkability
  leak); domain-separation is tracked for the next circuit redeploy.
- **Testnet only.** Mainnet is intentionally gated behind the items in §12.

---

## 10. Design system & UI/UX

**Aesthetic:** dark, minimal, cinematic — "privacy infrastructure," Apple-simplicity /
Linear-precision. The interface should feel like a precise financial instrument.

**Palette (three colors, dark theme):**
| Token | Hex | Use |
| --- | --- | --- |
| Background | `#0A0A0A` (near-black) | surfaces |
| Foreground | `#FAFAFA` | text |
| **Signal** | `#FF3B00` | **cryptographic actions ONLY** (shield, prove, send) + primary CTA |

Cards `#121212`, hairline borders `#292929`, radius `12px`. **No shadows for depth — glow**
(`--shadow-signal`) marks cryptographic moments. `#FF3B00` is reserved for crypto actions and
is never decoration.

**Typography:** **Inter** for all UI; **JetBrains Mono** for every address, hash, proof, key,
and balance. Any monospaced crypto value ships with a one-click **copy** affordance.

**Motion & atmosphere:** `framer-motion` for transitions; **Lenis** smooth-scroll on the
cinematic landing; full-bleed AI-generated **Atmosphere** backdrops (`public/art/`) with a
scrim behind key surfaces (hero, wallet vault, claim). Modals portal to `document.body` so
they always center on the viewport.

**Key screens (routes):**
- `/` — cinematic landing (narrative + atmosphere).
- `/wallet` — the privacy wallet: shielded balance, and the five actions (Private send · Shield
  · Send · Unshield · Pay link), each with success cards that explain *what you did / what the
  ledger sees / what Umbra proved privately*.
- `/proof` — **Proof Center** ("don't trust us, verify"): live contract ids, copyable hashes,
  the ZK pipeline, what's real vs roadmap, and the verify commands.
- `/claim/[code]` — recipient claims a private send.
- `/shield`, `/withdraw` (→ redirects into `/wallet`), `/links`, `/donate`, `/invoice`,
  `/pay/[id]` — commerce link flows.
- `/mainnet`, `/audit`, `/build`, `/apps` — readiness, auditor view, build info, app index.

**Units:** the UI speaks **XLM**; on-chain everything is **stroops** (1 XLM = 10,000,000
stroops). Conversion happens at every boundary (`lib/umbra/units.ts`).

---

## 11. Repo, stack, and how to run

**Stack:** Next.js 15.5 (App Router) · React 19 · TypeScript (strict) · Tailwind v3 +
shadcn/ui · framer-motion · Lenis · `@stellar/stellar-sdk` 16 · `@creit.tech/stellar-wallets-kit`
+ Freighter · snarkjs 0.7.5 (browser Groth16). Monorepo via **pnpm workspaces** (JS) + **cargo
workspaces** (Rust).

```
app/         Next.js routes, layout, pages
components/   React components (components/ui = shadcn primitives)
hooks/        Reusable hooks (use-prover, use-wallet, use-copy-to-clipboard)
lib/umbra/    Framework-agnostic app glue (soroban, wallet, recovery, units, config, ...)
packages/     wallet-core · crypto-bls · sdk · benchmarks · bench-harness (workspaces)
circuits/     Circom sources + build scripts (build-slice.sh) + fixtures
contracts/    umbra-pool · groth16-verifier · bench-pool (cargo workspace)
infra/deploy/ deploy-slice.sh + deployment.json (source of truth)
public/       art/ (atmosphere) + circuits/ (served proving keys + wasm)
docs/         this file + architecture/security/product docs
tests/        tests/unit (Vitest) + tests/e2e (Playwright)
```

**Commands**
| Script | Action |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright |
| `bash circuits/scripts/build-slice.sh` | compile circuits + trusted setup + fixtures |
| `bash infra/deploy/deploy-slice.sh --force` | build + deploy the pool to testnet |
| `cargo test -p umbra-pool` | contract tests (real BLS12-381 proofs) |

**Local run:** set `NEXT_PUBLIC_UMBRA_POOL_CONTRACT` in `.env.local`, connect Freighter on
testnet, `npm run dev`. Without a pool id the UI still does all local crypto (proofs included);
only on-chain submission needs the contract.

---

## 12. Verification / test status

| Suite | Result |
| --- | --- |
| `cargo test -p umbra-pool` | **10 / 10** — real Groth16 vs the real BLS12-381 host |
| `@umbra/crypto-bls` | 13 / 13 — Poseidon: Rust ≡ circuit ≡ TS |
| `vitest` (unit/component) | **25 / 25** |
| `tsc --noEmit` | clean |
| `next build` | 15 / 15 routes |
| browser → testnet shield · transfer · unshield | confirmed on Horizon |

The contract tests exercise the happy paths **and** the attacks: wrong-payee redirect (C1),
double-spend, tampered proof, wrong-recipient, amount-mismatch, non-positive amount, tree-full.

---

## 13. Known limitations (be clear-eyed)

- **Hidden-value change is session-local.** The change note from a private send or a withdrawal
  has a value that's hidden on-chain, so seed-based recovery (which matches deposits by amount)
  can't recover it. It lives in the browser (`localStorage`). Clearing storage mid-session loses
  the change value. Fix on the roadmap: **encrypted note backup** (on-chain memo or off-chain).
- **Depth-6 tree (64 notes).** Chosen so two Merkle inserts fit the per-tx compute budget.
  Small anonymity set. A production tree needs to be deeper (and inserts batched/optimized).
- **Public amounts on shield/withdraw.** Only private sends and change are amount-hidden.
- **Single demo-contributor trusted setup.** Not an MPC ceremony.
- **Recovery event window** is time-bounded for speed; a production indexer removes this.
- **Testnet only.**

---

## 14. What we can do next (roadmap, not faked)

**Near-term / achievable:**
1. **Encrypted note backup** so hidden-value change/received notes recover cross-device.
2. **Deeper Merkle tree + batched inserts** for a real anonymity set.
3. **Confidential amounts on shield + withdraw** (private sends already hide them).
4. **Fee-privacy relayer** (`docs/RELAYER.md`) so the gas payer doesn't deanonymize the user,
   and a **production indexer** (`docs/INDEXER.md`) for instant, complete recovery.

**Before mainnet (security-gated):**
5. **Multi-party trusted-setup ceremony** (replace the demo key).
6. **Independent audit** of the circuits + contract.
7. **Mainnet release** with a real anonymity set and monitoring.

**Product surface already scaffolded to grow:** private invoices, donation links, and payment
links (each backed by an in-browser proof); an **SDK** (`packages/sdk`) surface for embedding;
selective disclosure toward **scoped viewing keys / auditor public keys**.

---

## 15. Glossary

- **Note** — a private `{secret, value}` you own; its `Poseidon(secret, value)` commitment is
  the only part on-chain.
- **Nullifier** — a one-time `Poseidon(secret, leafIndex)` tag revealed when spending; prevents
  double-spend without revealing which note.
- **Shield / Unshield** — move value into / out of the pool.
- **Join-split** — spend one note into multiple outputs (used by transfer and withdraw) so
  arbitrary amounts + change work without revealing balances.
- **Claim link** — a bearer link that carries a private send's note opening to the recipient.
- **C1 / H1 / M1 / M2** — the hardened contract invariants (payee binding, atomic init,
  positive-amount, tree-full).
