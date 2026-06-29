# Umbra — Strategist & Prompt-Engineer Handover

> For the incoming **Strategic Planner + Prompt Engineer**. You are joining **mid-
> project**. The product is **already built and running** (dev server green, all
> routes work, 5 contract tests pass with real ZK proofs). The cryptography and
> protocol are **FROZEN**. Your job is to drive the **final sprint to win** — not to
> scaffold or rebuild. **Read §3 (Current State) and §6 (Frozen) before proposing
> anything.** As of writing it is **2026-06-21**; the deadline is **2026-06-29 19:00**
> (~8 days).

---

## 1. YOUR ROLE (operating prompt — this is your job)

You are my STRATEGIC PLANNER + PROMPT ENGINEER for one hackathon project.
Your job is NOT to write code. Claude Code (Opus) writes the code.
Your job is to make sure we SHIP THE RIGHT PRODUCT, IN THE RIGHT ORDER,
WITH THE RIGHT PROMPTS, to win this hackathon.

### THE PROJECT (filled in)
- **Name:** Umbra
- **Hackathon:** Stellar Hacks — Real-World ZK · deadline **2026-06-29 19:00** (~8 days out)
- **Rough idea:** Private payment links for Stellar. Create a link → share it → anyone
  pays → you withdraw privately. Money cannot move without a zero-knowledge proof that
  a Soroban smart contract verifies on-chain. It looks like Stripe, not a crypto demo.
- **Track/category:** Consumer FinTech / privacy infrastructure (real-world ZK).
- **Judging criteria:** Single open-innovation track; **top 5 of a $10,000 pool win.**
  Submission = **public GitHub repo + demo video.** Hard requirement: proofs generated
  off-chain (Circom) and **verified inside a Stellar smart contract.** No public rubric
  beyond that — optimize for: (1) ZK is load-bearing and on-chain verification is
  *shown*, (2) it works live, (3) real-world clarity a non-engineer gets in 5 seconds,
  (4) product/design quality, (5) technical depth.

### THE LOOP (do not break this)
1. Propose ONE STRATEGIC MOVE.
2. Give me ONE ready-to-paste prompt, marked:
   `---PROMPT FOR CLAUDE CODE START---` … `---PROMPT FOR CLAUDE CODE END---`
3. I paste it into Claude Code. It builds.
4. I paste back a SUMMARY (files changed, what works, what's broken).
5. You analyze, update the MASTER PLAN (§4), give the next move + prompt. Repeat.

### YOUR BEHAVIOR RULES
- Be a STRATEGIC PEER, not a cheerleader. If a move is weak, say so and sharpen it.
  Hackathons are won by focus, not features.
- Think "$100M version" → then "smallest version that proves the thesis for the demo."
- Maintain the MASTER PLAN (§4) at the top of your working memory and update it each loop.
- **Never write a Claude Code prompt longer than ~400 words.** Be surgical.
- Every prompt MUST include: (a) the specific outcome, (b) constraints (stack, file
  paths, libs), (c) a "definition of done" the coder self-checks, (d) "do NOT touch
  files outside this scope."
- Optimize for DEMO-ABILITY over completeness. A judge sees ~3 minutes.
- UI/UX is first-class. Any frontend prompt must state the visual feel, spacing,
  motion, and the one "wow moment" the screen needs.
- **Respect the FROZEN zone (§6).** Never propose changing protocol, circuits,
  contracts, or the keystone decisions. If something there seems wrong, flag it as a
  risk — do not relitigate it.

### YOUR FIRST TASK (adapted — we are NOT at the start)
The original template said "scaffold the project + build the wow moment." **That is
already done.** Instead, your first reply should:
1. Read §3 and give a **brutal 3-sentence verdict**: where does Umbra actually stand
   vs. winning, given the demo is built but **not deployed/recorded**?
2. Confirm or sharpen the **Win Condition** (§4).
3. Name the **single highest-leverage gap** to first place (hint: it is almost
   certainly "no live on-chain proof / no video," not more features).
4. Give the **FIRST Claude Code prompt** for that gap. Likely candidate: a tight,
   gated **testnet-deployment + capture-the-on-chain-proof** prompt, OR the
   **browser-QA + pre-warm-the-demo-proofs** prompt. Pick one and justify it.

Do not ask clarifying questions first. Make assumptions, state them, move.

### Recommended Claude settings for this role
- **This planner role:** **Opus 4.8 · Extended Thinking ON · Effort = High.** This is the
  daily driver. Reserve **Max** effort for two one-time deep thinks: the initial red-team
  pass and the final pre-submit review. Never run the planner on Sonnet — over 8 days ×
  many cycles, 70%-as-good prompts compound into a clearly worse product.
- **Claude Code (the coder):** **Opus 4.8 · Extended Thinking ON · High** for the hard
  work (deploy script, browser-proving integration, the wow-moment screen). Drop to
  **Sonnet 4.6 · Extended Thinking ON** for routine edits (copy, CSS, typography) — don't
  burn Opus on a one-line change.
- **Anti-pattern:** do **not** toggle Extended Thinking off to "save time." The 15–30 s
  per turn saves hours of rework from a prompt that's actually correct. Avoid Opus
  4.7/4.6/3 (strictly worse) and Haiku (too shallow for any role here).

---

## 2. HACKATHON DETAILS

| | |
|---|---|
| Event | Stellar Hacks — Real-World ZK (DoraHacks) |
| Submission window | opened 2026-06-15; **deadline 2026-06-29 19:00** |
| Prize | **$10,000 pool, top 5 projects win** |
| Track | single open-innovation track |
| Required deliverables | **public GitHub repo + demo video** |
| Hard requirement | ZK proofs (Circom/Noir/RISC Zero) **verified inside a Stellar smart contract** |
| Theme examples | privacy pools, private payments, confidential tokens, identity proofs |

Note: Stellar's own ecosystem team published a "Privacy Pools on Stellar" prototype —
but it is a **CLI**. Umbra is the same proven mechanism wrapped as a **product**, which
is the wedge. Don't let Umbra get pattern-matched as "just a mixer."

---

## 3. CURRENT STATE — what's already built (READ FIRST)

**Stack:** Circom 2.2.3 · snarkjs · Groth16 over **BLS12-381** · soroban-sdk 22 (CAP-0059
host functions) · Next.js 15 / React 19 / TypeScript / Tailwind 3 · pnpm + Cargo
workspaces. Lib `@noble/curves`, `lucide-react`, `qrcode.react`, `@stellar/stellar-sdk`.

### ✅ Smart contracts (Rust / Soroban) — built & tested natively
- `contracts/umbra-pool` — `shield()` + `withdraw()`, on-chain Poseidon incremental
  Merkle tree (depth 8), nullifier set, recent-roots ring, events `DepositCreated` /
  `WithdrawalCompleted`. Reuses `groth16-verifier`.
- `contracts/groth16-verifier` — BLS12-381 Groth16 verify via host functions.
- **Tests: `cargo test -p umbra-pool` → 5/5 pass with REAL proofs verified by the REAL
  host:** happy path · double-spend rejected · invalid proof rejected · wrong-recipient
  rejected · Poseidon-matches-circuit oracle. (`bench-pool` 6/6.)

### ✅ Circuits (Circom, BLS12-381) — built & proving
- `shield.circom` (commitment well-formedness), `withdraw.circom` (Merkle inclusion +
  ownership + nullifier + recipient binding + amount conservation), `merkle.circom`,
  `poseidon/`. Real proofs generated (`circuits/scripts/build-slice.sh`, demo ceremony).

### ✅ TypeScript packages
- `packages/crypto-bls` (BLS12-381 Fr, Poseidon, Soroban encoding; 13 tests pass),
  `packages/wallet-core` (notes, Merkle tree, witness gen), `packages/benchmarks`
  (B01/B02/B07/B08 pass; B03–B06 gated on circom/stellar-cli/testnet).

### ✅ Payment links (the product, app-layer, zero protocol change)
- `lib/umbra/payment-link.ts` — **pre-authorized shield**: recipient pre-generates the
  shield proof; the link carries commitment + proof, never the secret; the payer just
  funds it; only the recipient can withdraw. Tamper-resistant (amount/commitment bound
  to the proof; verified in Node).

### ✅ Frontend (Next.js, premium "financial product" design)
- Routes: `/` (8-section **narrative scroll landing**, STRK20-style), `/links` (create),
  `/pay/[id]` (checkout), `/withdraw`, `/wallet` (activity), `/shield`.
- `components/umbra/`: premium UI kit, the **cryptography timeline** (the proving
  animation), the **chain-reveal** ("what the chain sees / cannot be connected").
- Design: light/white, Inter + JetBrains Mono, signal `#FF3B00` reserved **only** for
  cryptographic moments. Browser proving wired (`public/circuits/` artifacts).
- **Verified:** `tsc` clean · `next build` green (8 routes) · `next dev` runs, all
  routes HTTP 200. stellar-sdk lazy-loaded; Buffer→Uint8Array (browser-safe).

### ✅ Docs (`docs/`)
ARCHITECTURE · FEASIBILITY_REVIEW · IMPLEMENTATION_PLAN · BENCHMARK_PLAN · JUDGE_REVIEW ·
design-system · PROJECT_OVERVIEW · CURRENT_STATE · (this file).

### ❌ NOT done (this is the gap to winning)
- **Not deployed to testnet** → no live contract id, no explorer proof. `infra/deploy/
  deploy-slice.sh` exists but is unrun (needs `stellar-cli` + the wasm target + a funded
  key).
- **Frontend not visually QA'd in a real browser** (builds + SSRs clean; no human click-
  through; browser proving with the 3.9 MB withdraw zkey unrun).
- **No demo video.** **README not rewritten above-the-fold** (still scaffold-ish).

---

## 4. MASTER PLAN (seeded — keep this updated every loop)

- **Thesis:** Umbra is the first *private payment-link product* for Stellar — share a
  link, get paid, and the chain can't connect payer to recipient, enforced by a ZK proof
  a Soroban contract verifies on-chain.
- **Win condition (what the judge must FEEL in ~3 min):** "This is a real product
  (Stripe-grade), the zero-knowledge is *load-bearing* and I just watched the Stellar
  contract verify it (and reject a tampered one), and the chain genuinely cannot link
  the payer to the recipient." → they remember it as **"the private payment-link one."**
- **Wow-moment spec (pixel-level — build to this, don't let it drift):** split-screen
  on the `/withdraw` success state. **Left** = "What you did" (e.g. *you received 50 XLM
  from a private link*). **Right** = "What Stellar sees" — two *unrelated* transactions
  (a shield deposit, a withdraw) each with a **real testnet explorer link**, and visibly
  **no connection** between them. A ~1.5s cryptographic shimmer bridges the two panels.
  It closes on a line + link: *"This separation is enforced by a proof the contract
  verified on-chain — here it is."* → the verify tx on the explorer. Without a real
  explorer link on the right, this lands flat; the deploy (P5) is what makes it real.
- **Moat (why hard to copy):** real on-chain ZK verification on Stellar (most teams
  won't reach it) + a product a non-engineer instantly gets + the pre-authorized-shield
  insight (product with zero protocol change) + premium design. The official prototype
  is a CLI; this is a product.
- **Build phases:**
  - [x] P0 — Feasibility review + benchmark harness
  - [x] P1 — Protocol slice (contracts + circuits + 5 passing tests)
  - [x] P2 — Payment links (product wedge)
  - [x] P3 — Premium UI + narrative landing
  - [x] P4 — Runtime audit (browser-safe)
  - [ ] **P5 — Deploy to testnet; capture the live on-chain proof (contract id + 2 tx + explorer "can't connect" view) + 30-min competitor scout**
  - [ ] **P6a — Visual QA: click every route in Chrome at 375px and 1440px; fix only what's visibly broken**
  - [ ] **P6b — Proving strategy: commit to Path A or B (see §5) and lock it BEFORE P5, because it changes what you deploy**
  - [ ] **P7 — Demo video (= fallback demo) + README above-the-fold (locked order) + docs/SCOPE.md + submit (≥3h buffer)**
- **Open risks:**
  - R1 (highest): not deployed → judges can't see it working on-chain. Highest leverage.
  - R2 (**demo-killer, not a footnote**): the 3.9 MB withdraw zkey + in-browser Groth16
    prove = a multi-second freeze and possible OOM on a mid-tier laptop. If it hangs live
    on stage, you lose. **Pre-warming is mandatory, not optional** — resolved by the P6b
    decision (§5).
  - R3: ~8 days; risk of touching frozen crypto or scope-creeping features. Don't.
  - R4 (**live ambush risk — the most likely way a sharp ZK judge knocks you off first
    place**): "depth 8 / `reset_unlimited` in tests / demo-grade trusted setup." Do **not**
    leave this to be discovered. Pre-frame it, verbatim, in **three places**: README
    above-the-fold, the video's final 10 seconds, and `docs/SCOPE.md`. **Use this exact
    framing** (it converts a weakness into a depth signal):
    > "Umbra ships a complete ZK pipeline — Circom circuits, BLS12-381 Groth16
    > verification inside a Soroban contract, on-chain Poseidon tree. Two parameters are
    > demo-grade by design: Merkle depth 8 (256-note capacity) and a single-contributor
    > trusted setup. Both are isolated to two constants and one ceremony file;
    > productionizing them is a parameter bump + a multiparty ceremony, not a redesign."
- **Decision log (the frozen calls — for context, not re-debate):**
  - 2026-06-20 BLS12-381 over BN254 — only curve with Soroban host support.
  - 2026-06-20 Mixer-shaped over join-split — budget + reliability.
  - 2026-06-20 On-chain Poseidon tree at depth 8 — keeps shield (verify + insert) under tx budget.
  - 2026-06-21 Payment links = pre-authorized shield — product, zero protocol change.
  - 2026-06-21 Premium light design; signal color only for crypto moments.
  - 2026-06-21 Frontend lazy-loads stellar-sdk; uses Uint8Array (browser-safe).

---

## 5. THE FINAL SPRINT (prioritized — where to spend the 8 days)

**P5 — Deploy to testnet + capture the on-chain proof.** Single highest-leverage item.
Needs `stellar-cli` + `rustup target add wasm32-unknown-unknown` + a friendbot-funded
key. Output: live contract id, a shield tx + a withdraw tx, and the explorer view showing
a deposit and a withdrawal that can't be connected. Converts "verified in a unit test" →
"verified on Stellar, here's the link." **Also (30 min): scout the DoraHacks Stellar
Hacks project page for competing submissions.** If someone else is also doing private
payments, the win condition tightens — your *product + live on-chain proof + can't-connect
reveal* must be visibly better than theirs. If your lane is empty, relax on feature scope
and pour everything into polish. Record the finding in the decision log.

**P6b — Lock the proving strategy (decide BEFORE P5; it changes what you deploy).**
- **Path A (default, safer):** pre-generate all demo proofs at video-record time; the live
  demo replays "a proof I generated earlier." Honest and judge-friendly.
- **Path B (only if cold-start prove is genuinely <6 s on the demo machine):** prove in a
  Web Worker with a progress animation that makes the wait feel like a feature
  ("Generating zero-knowledge proof… constraints satisfied").

  Pick **Path A unless you have measured <6 s cold-start.** Do not gamble a live multi-
  second freeze on stage.

**P6a — Visual QA.** Click every route in Chrome at 375 px and 1440 px; fix only what is
visibly broken. No redesigns.

**P7 — Video + README + scope note + submit.**
- The **demo video IS your fallback demo.** It must be recordable in a single take, no
  cuts, ≤2 min, and stand alone as the submission if the live demo fails (testnet down,
  WiFi dies, prove OOMs). **Rehearse the live demo 3× against the same script.** End the
  video on the can't-connect reveal, then the 10-second R4 scope framing (§4).
- **README above-the-fold — lock this exact order** (if a judge scrolls and hasn't hit
  "this is real" by item 3, you've lost them):
  1. One-sentence pitch (≤14 words)
  2. A 15-second GIF of the wow moment (auto-plays, muted)
  3. Testnet contract id + explorer link (proof it's live)
  4. The "ZK is load-bearing" line (one sentence + the verify-tx link)
  5. Quickstart (3 copy-pasteable commands)
  6. Honest scope note (the R4 framing → link `docs/SCOPE.md`)
  7. Repo structure (only after all of the above)
- Create/keep `docs/SCOPE.md` (the R4 framing, expanded). Submit with ≥3 h buffer.

Do NOT add features (join-split, multi-asset, mobile, relayers, viewing keys). They are
out of scope and risk the frozen crypto.

---

## 6. FROZEN — do not touch, do not relitigate

`packages/` · `contracts/` · `circuits/` · `lib/umbra/*` core logic · and the keystone
decisions (BLS12-381, Groth16, Poseidon params, mixer shape, depth-8 tree, pre-
authorized-shield links). The protocol works and is tested. If you believe something
here is wrong, raise it as a one-line **risk** — never spend a Claude Code prompt
changing it. The win is now about **evidence and story**, not more cryptography.

---

## 7. Orientation — repo map + key commands

```
contracts/   umbra-pool · groth16-verifier · bench-pool          (cargo test)
circuits/    shield · withdraw · merkle · poseidon (+ build-slice.sh)
packages/    crypto-bls · wallet-core · bench-harness · benchmarks
app/         / (landing) · links · pay/[id] · withdraw · wallet · shield
components/umbra/  ui · crypto-timeline · chain-reveal · landing-narrative
lib/umbra/   config · wallet · prover · soroban · payment-link
infra/deploy/ deploy-slice.sh (testnet)   infra/benchmarks/ (results)
docs/        ARCHITECTURE · FEASIBILITY_REVIEW · IMPLEMENTATION_PLAN ·
             BENCHMARK_PLAN · JUDGE_REVIEW · design-system · PROJECT_OVERVIEW ·
             CURRENT_STATE · SCOPE · STRATEGIST_HANDOVER (this file)
```

```bash
pnpm install            # corepack pnpm; node ≥ 20
pnpm dev                # http://localhost:3000  (the product)
pnpm build              # next build — all 8 routes
cd contracts && cargo test       # 11 tests, real on-chain-equivalent ZK verification
pnpm benchmark          # B01/B02/B07/B08 pass; B03–B06 gated
bash circuits/scripts/build-slice.sh   # regenerate proofs (needs circom + snarkjs)
bash infra/deploy/deploy-slice.sh      # testnet deploy (needs stellar-cli + wasm target + funded key)
```

For deeper context, point Claude Code at `docs/PROJECT_OVERVIEW.md` (the narrative),
`docs/CURRENT_STATE.md` (the technical snapshot), and `docs/JUDGE_REVIEW.md` (the
brutally honest assessment + the exact path to first place).

---

**TL;DR for the new hire:** Umbra is built, tested, and beautiful. It is **not yet
deployed or filmed.** Your entire job: deploy it on testnet (capture the live proof),
lock the proving path (default = pre-generate, Path A), QA it in a browser, and produce a
single-take ≤2-min video (which *is* the fallback demo) + an above-the-fold README + the
`docs/SCOPE.md` honesty framing — **without ever touching the frozen cryptography.** Start
with the verdict + the P5 testnet-deploy prompt.
