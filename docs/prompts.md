Bro, I hear you. Use Yasira as fuel, but don’t let pressure make you ship something reckless. The way you win is not “fake mainnet.” The way you win is: **mainnet-serious, brutally honest, technically undeniable, and emotionally memorable.**

Your current Umbra state is already strong: real browser-generated Groth16 proofs, on-chain verification in Soroban, payment links, disclosure packets, and the new killer moment: **private balance follows your wallet across devices**. The honest gaps are also clear: trusted setup, amount privacy, audit, relayer/fee privacy, depth, and production indexing.  Stellar’s own docs confirm the important distinction: ZK primitives are building blocks, not finished private payments by themselves; Confidential Tokens hide balances/amounts while addresses remain visible; and prototype privacy pools are not audited for real assets. ([developers.stellar.org][1]) ([developers.stellar.org][2])

My strategic call: **do not pivot the whole product now.** Keep Umbra’s current rail, but ship it as:

> **Umbra — a consumer privacy wallet on Stellar where a real ZK proof is verified on-chain, and your private balance follows your wallet across devices. Mainnet path: security-gated, audit-ready, CT-compatible.**

That sounds serious. That sounds honest. That beats “random ZK demo.”

Use these prompts in order.

MASTER PROMPT — UMBRA MAINNET-CREDIBLE SPRINT

You are my Principal Engineer, Security Reviewer, Product Designer, and Release Lead for Umbra, a consumer privacy wallet on Stellar.

Context:
Umbra is already a working testnet product. It uses browser-generated Groth16 proofs, verifies them on-chain in Soroban, supports shield/send/unshield/payment links, has selective disclosure via encrypted audit packets, and now has wallet-linked cross-device recovery by rebuilding private balance from on-chain deposit/withdraw events.

The goal is NOT to fake mainnet. The goal is to make Umbra feel like a serious mainnet-ready privacy product: technically honest, security-gated, premium in UX, and impossible for judges to dismiss as a toy.

Non-negotiables:

1. Do not make false claims.
2. Do not claim confidential amounts; current pool hides deposit→withdraw linkage, not amounts.
3. Do not claim audited.
4. Preserve all working on-chain testnet flows.
5. Preserve existing product taste: premium, cinematic, clean, 2026-level design.
6. Any mainnet work must be explicitly safety-gated. If mainnet is added, it must be “canary / disabled / capped / not for production” unless all security blockers are resolved.
7. Every technical claim shown in the UI must be backed by actual code, contract IDs, transaction hashes, tests, or explicit roadmap labeling.
8. Do not rewrite the app from scratch. Strengthen what exists.
9. Run typecheck, tests, build, and targeted E2E after every major change.
10. Commit in small clean patches.

First, audit the repo and produce:

* Current routes and their real status.
* Contract/circuit state.
* What is working.
* What is dangerous to claim.
* What blocks mainnet.
* What can be shipped before the deadline.
* Exact implementation order.

Then implement the sprint in this priority:
P0 — Proof Center and Mainnet Readiness page.
P1 — Wallet “what Stellar sees vs what Umbra hides” clarity.
P2 — Cross-device recovery demo moment.
P3 — Relayer/indexer/CT-compatible architecture scaffolding.
P4 — README, submission copy, video script bullets.

Be ruthless. If something is fake, remove it or label it. If something is real, make it shine.

PROMPT 1 — BUILD THE MAINNET READINESS + SECURITY GATES

You are now implementing Umbra’s Mainnet Readiness layer.

Goal:
Create a world-class “Mainnet Readiness” experience that makes judges feel this is not a toy. It should clearly show that Umbra works today on Stellar testnet, while explaining exactly what remains before safe mainnet use.

Implement:

1. New route:

* `/mainnet` or `/security`
* Title: “Mainnet Readiness”
* Subtitle: “Real ZK payments today. Security-gated path to real assets.”
* Use the existing premium dark design system.
* No generic dashboard look. It should feel like Apple + crypto security lab.

2. Readiness scorecards:
   Create status cards:

* On-chain ZK verification: LIVE TESTNET
* Browser proving: LIVE
* Cross-device recovery: LIVE
* Selective disclosure: LIVE
* Mainnet deployment: SECURITY-GATED
* Trusted setup: REQUIRED
* Audit: REQUIRED
* Amount privacy: ROADMAP / CT-compatible
* Fee privacy relayer: ROADMAP
* Production indexer: ROADMAP
* Merkle depth 20: REQUIRED FOR SCALE

3. Safety gate component:
   Build a reusable component called `MainnetGate` or similar:

* Shows whether the current network is testnet/mainnet.
* If testnet: “Safe demo mode — real Stellar testnet transactions.”
* If mainnet: show hard warning, capped mode, disabled deposits unless explicitly enabled.
* Never let UI imply production safety if audit/trusted setup flags are false.

4. Network configuration:
   Create a typed network config module:

* testnet contract IDs
* optional mainnet contract IDs
* explorer base URLs
* feature flags:

  * ENABLE_MAINNET_CANARY
  * ENABLE_MAINNET_DEPOSITS
  * MAX_MAINNET_DEPOSIT
  * REQUIRE_SECURITY_ACK
* Default to safe values.

5. Mainnet checklist:
   Add a section:
   “Before real assets”

* independent audit
* MPC ceremony or transparent proof-system migration
* deployer/multisig controls
* relayer for fee privacy
* indexer for note discovery
* monitoring and incident response
* terms/compliance/disclosure story

6. Make this page linked from:

* landing nav
* wallet footer/status row
* proof center
* README

7. Add copy that is brutally honest:
   Umbra currently provides link privacy, not confidential amounts. Amounts remain visible on-chain. The current testnet pool is not audited and should not be used for real assets until the readiness checklist is complete.

Validation:

* Typecheck clean.
* Build clean.
* No broken routes.
* No fake mainnet claims.
* Screenshot the page mentally: it should look investor/judge-ready.

PROMPT 2 — MAKE THE PROOF CENTER UNDENIABLE

You are upgrading Umbra’s Proof Center into the strongest hackathon evidence page.

Goal:
When a judge opens `/proof`, they should instantly understand:

1. This is real ZK.
2. The proof is verified inside a Stellar smart contract.
3. The browser generates the proof.
4. The chain sees deposits/withdrawals but not the private link.
5. Cross-device recovery is real.
6. The team is honest about limitations.

Implement:

1. Hero:
   Title: “Don’t trust us. Verify the proof.”
   Subtitle: “Umbra generates a zero-knowledge proof in your browser and verifies it inside a Stellar smart contract.”

2. Evidence cards:
   Add cards for:

* Pool contract ID
* Verifier contract ID
* Shield transaction
* Withdraw transaction
* Current network
* Circuit type
* Proof system
* Curve
* Merkle depth
* Public inputs
* What is private
* What is public

Each card should have copy buttons and explorer links where available.

3. ZK pipeline visual:
   Create a beautiful horizontal/vertical flow:
   Wallet → Note → Commitment → Browser proof → Soroban verifier → Pool transfer → Explorer confirmation

Each step should have one sentence:

* “Secret never leaves browser.”
* “Proof proves membership without revealing which note.”
* “Contract checks proof before releasing funds.”
* “Nullifier prevents double spend.”

4. “What Stellar sees vs what Umbra hides”
   Create a comparison:
   Stellar sees:

* deposit amount
* withdraw amount
* pool contract
* recipient
* nullifier
* transaction timing

Umbra hides:

* which deposit funded which withdrawal
* note secret
* private wallet balance reconstruction
* local audit metadata unless disclosed

5. Cross-device recovery proof section:
   Add a section called:
   “Your private balance follows your wallet.”
   Explain:

* connect wallet
* derive deterministic seed from wallet signature
* scan pool events
* rebuild Merkle tree
* recover spendable notes
* no centralized account required

6. Real vs roadmap section:
   Real:

* shield
* withdraw/send
* payment links
* on-chain proof verification
* browser proving
* selective disclosure
* cross-device recovery

Roadmap:

* confidential amounts
* private transfer/join-split
* relayer
* production indexer
* audit
* mainnet release

7. Design:
   Make it premium and calm. No clutter. Use mono type for hashes. Use strong spacing. No “AI generated” gradients everywhere. This should feel like a security product.

Validation:

* No false claims.
* Existing proof links still work.
* Copy buttons work.
* Typecheck/build clean.

Now the rest of the sprint prompts, shorter but still powerful:

**Prompt 3 — Wallet clarity + “judge wow”**

```text
Upgrade `/wallet` so every successful action teaches the privacy model.

After shield/send/unshield success, show:
1. “What you did”
2. “What Stellar saw”
3. “What Umbra proved privately”

For send/withdraw, clearly explain:
- the contract verified a ZK proof
- the nullifier prevents double spend
- the recipient received funds
- observers cannot know which deposit funded the withdrawal
- amount is currently public

Add a “Recovery demo” card:
- Step 1: connect wallet
- Step 2: sync from chain
- Step 3: private balance rebuilt
- Step 4: withdrawable note found

Make the copy emotional but technical:
“Not an account. Not a server balance. A private note your wallet can recover from the chain.”

Keep all existing flows working. Do not break shield/send/unshield.
Run typecheck, tests, build.
```

**Prompt 4 — Contract/circuit audit notes**

```text
Act as a senior ZK/Soroban security reviewer.

Review:
- contracts/umbra-pool
- contracts/groth16-verifier
- circuits/shield.circom
- circuits/withdraw.circom
- TS wallet/prover/recovery code

Produce `docs/SECURITY_REVIEW.md`.

Cover:
1. Trust assumptions
2. Public inputs
3. Private witnesses
4. Invariants
5. Double-spend prevention
6. Root freshness / recent root ring
7. Recipient binding
8. Amount visibility
9. Merkle depth limitation
10. Trusted setup risk
11. Fee-payer privacy leak
12. Recovery scan assumptions
13. Storage/rent/TTL assumptions
14. Mainnet blockers
15. Recommended audits

Then add or improve tests for the highest-value invariants:
- invalid proof rejected
- unknown root rejected
- reused nullifier rejected
- wrong recipient rejected if test harness supports it
- amount mismatch rejected
- deterministic recovery does not mark others’ notes as owned
- tampered payment link rejected

Do not claim this replaces an audit. This is internal review documentation.
```

**Prompt 5 — Relayer + indexer architecture scaffold**

```text
Design and scaffold the production architecture without overbuilding it.

Add:
- `docs/RELAYER.md`
- `docs/INDEXER.md`
- optional placeholder packages/services if clean

Relayer goal:
Hide fee payer correlation for withdrawals by letting a relayer submit withdraw transactions after receiving a valid proof payload.

Indexer goal:
Make note discovery scalable by indexing DepositCreated and WithdrawalCompleted events from deploy ledger onward.

Do not implement a fake centralized custody service.
Do not store user secrets.
Do not break browser-only proving.

Define APIs:
- POST /relay/withdraw
- GET /pool/events
- GET /pool/roots
- GET /pool/nullifiers/:id

Explain abuse controls:
- proof verification before relay
- rate limits
- fee policy
- nullifier precheck
- no custody

Add UI roadmap cards linking to these docs from `/mainnet`.
```

**Prompt 6 — Confidential Tokens adapter strategy**

```text
Add an architecture document called `docs/CONFIDENTIAL_TOKENS_STRATEGY.md`.

Goal:
Explain how Umbra can become the consumer wallet layer for Stellar Confidential Tokens without abandoning the current privacy pool.

Structure:
1. Current Umbra rail:
- mixer-style unlinkability
- public amounts
- Groth16/BLS12-381
- testnet working today

2. Confidential Tokens rail:
- confidential balances and amounts
- public addresses
- CT-compatible asset privacy
- likely better mainnet path for amount privacy

3. Why they are complementary:
- Umbra pool hides linkability
- CT hides amounts
- wallet UX/disclosure/recovery/pay links are Umbra’s moat

4. Adapter plan:
Create an interface:
`PrivacyRail`
with methods:
- shield/deposit
- privateSend
- disclose
- recover
- getProofStatus
- getPublicVisibility

Implement current pool as `Groth16PoolRail`.
Stub future CT as `ConfidentialTokenRail`.

Do not fake CT integration. Make the interface and docs real, but label CT implementation as future/preview unless actual code exists.
```

**Prompt 7 — Submission README + judge narrative**

```text
Rewrite the README for judges.

It must answer in the first 20 seconds:
- What is Umbra?
- What does ZK do?
- What part touches Stellar?
- What works today?
- How do I run it?
- What are the proof/contract IDs?
- What is honest roadmap?

Use this positioning:

“Umbra is a consumer privacy wallet for Stellar. It lets a user shield funds into a pool, generate a zero-knowledge proof in the browser, and withdraw/send privately after a Soroban contract verifies the proof on-chain. The private link between deposit and withdrawal is hidden; the amount is currently public. Umbra also supports payment links, selective disclosure, and wallet-linked cross-device recovery.”

Add:
- demo script
- local setup
- env vars
- contract deployment notes
- test commands
- known limitations
- security warning
- roadmap to mainnet
- screenshots
- links to `/proof` and `/mainnet`

Tone:
Confident. Honest. Serious. No hype without evidence.
```

For the demo video, your winning story should be:

**“Everyone can build a ZK verifier. We built the wallet around it.”**

Show this sequence:

1. Open landing: **Private money on Stellar.**
2. Go to wallet, connect Freighter.
3. Shield funds.
4. Show browser proving lifecycle.
5. Show explorer proof.
6. Send privately / withdraw.
7. Show “What Stellar saw vs what Umbra hid.”
8. Wipe local storage / switch device moment.
9. Reconnect wallet.
10. Balance comes back from chain.
11. Open Proof Center.
12. End on Mainnet Readiness: honest blockers, serious path.

Final line for pitch:

> “Umbra is not a slide about privacy. It is a working private wallet where Stellar verifies the proof on-chain — and the user’s private balance follows their wallet anywhere.”

That is the angle, bro. Not desperate. Not fake. **Serious, beautiful, honest, and hard to ignore.**

[1]: https://developers.stellar.org/docs/build/apps/zk "ZK Proofs on Stellar | Stellar Docs"
[2]: https://developers.stellar.org/docs/build/apps/privacy "Privacy on Stellar | Stellar Docs"
