# Umbra — Submission Masterplan

_The plan to win Stellar Hacks. Protocol is frozen, code is frozen — this is a
perception, story, and execution document. Everything here is grounded in what is
actually built and verified (see [`BROWSER_E2E.md`](BROWSER_E2E.md),
[`WHAT_WE_BUILT.md`](WHAT_WE_BUILT.md), [`SCOPE.md`](SCOPE.md)). Assume a first-place
decision rides on this._

> **The thesis to protect, in five words: _Share a link. Get paid privately._**
> Everything below serves that sentence. Cryptography is the proof, not the pitch.

---

## 1. Winning Narrative

**One sentence:**
> Umbra lets anyone get paid privately on Stellar — share a payment link, and the
> blockchain can't link who paid you to where it went.

**One paragraph:**
> Every Stellar payment is public forever — your salary, your donations, your
> invoices, all traceable by anyone. Umbra fixes that with a Stripe-simple payment
> link. You create a link, share it, someone pays, and you withdraw to your own
> wallet — but on-chain, the deposit and the withdrawal **cannot be connected**.
> The privacy isn't a promise or an off-chain mixer; it's enforced by a
> zero-knowledge proof that a Stellar smart contract verifies **on-chain** before
> any money moves. It's live on testnet today, end-to-end, from the browser.

**One page** (the arc, in order):
1. **The problem everyone feels.** Public ledgers are a privacy disaster for normal
   money. A freelancer's client can see every other invoice. A donor is exposed. A
   payroll is a spreadsheet anyone can read.
2. **The product, not the protocol.** Umbra is a payment link. Create → share → get
   paid → withdraw. A non-technical person understands it in five seconds.
3. **The magic moment.** After withdrawal, Umbra shows "what you did" (you got paid)
   next to "what Stellar sees" (two unrelated transactions) — and proves they can't
   be linked. That contrast *is* the product.
4. **The proof it's real.** Zero-knowledge (Groth16, BLS12-381) verified inside a
   Soroban contract. Real testnet transactions, real explorer links, generated and
   submitted **from the browser** — no terminal, no trusted server.
5. **The honest ceiling.** Two parameters are demo-grade (tree depth, trusted setup),
   both isolated, both with a costed mainnet path. The cryptography is finished.
6. **The category.** This isn't "a privacy pool." It's the **private-payments layer
   for Stellar commerce** — links today; donations, payroll, treasury tomorrow, on
   the same frozen protocol.

---

## 2. Demo Video Script (2:30, second-by-second)

Format: screen recording with voiceover. Three acts — *product story* → *the
reveal* → *on-chain proof*. Keep narration calm and confident; let the product do
the talking. Cut/speed-ramp every on-chain wait (never show dead air).

| Time | Screen / action | Narration | Camera / cut |
| --- | --- | --- | --- |
| 0:00–0:08 | Black → the landing hero "Get paid privately on Stellar." | "Every payment on a blockchain is public. Forever." | Slow fade in on hero |
| 0:08–0:18 | Hero subheadline + the one-line value prop | "Your salary, your donations, your invoices — anyone can trace them. Umbra fixes that." | Hold on hero |
| 0:18–0:30 | Click **Get paid** → `/links` form ("Design work", 50, recipient) | "You create a payment link. Like Stripe — but private." | Cut to /links |
| 0:30–0:42 | Click **Generate payment link** → proving readout → link + QR | "The zero-knowledge proof is generated right here in your browser." | Hold on the proving line, then the QR |
| 0:42–0:52 | Copy link → open `/pay/[id]` (payer's view) | "You share the link. Anyone can pay it." | Cut to /pay |
| 0:52–1:05 | Click **Pay** → funding → **Paid privately** ✓ (speed-ramp the confirm) | "They pay. The funds enter the privacy pool on Stellar." | Speed-ramp 0:55–1:02 |
| 1:05–1:18 | Go to `/withdraw` → balance shows → **Withdraw privately** | "Only you can withdraw — you hold the secret. Watch." | Cut to /withdraw |
| 1:18–1:32 | Proving readout ("Generating zero-knowledge proof…") → speed-ramp | "Another proof — proving you own funds without revealing which deposit was yours." | Hold on the mono ms counter briefly |
| 1:32–1:48 | **Funds released** → the split-screen reveal animates in | "Here's the moment." | Let the ~1.5s signal shimmer play fully |
| 1:48–2:05 | Hold on "What you did" vs "What Stellar sees" + "No shared key" | "You got paid. But on Stellar, these are two strangers' transactions. No address, amount, or key ties them together." | Slow push-in on the right panel |
| 2:05–2:20 | Click **here it is ↗** → stellar.expert opens the real withdraw tx | "And this isn't a mockup. Real proof, verified on-chain. Here it is on the explorer." | Cut to the explorer, highlight `successful` |
| 2:20–2:30 | Back to hero / wordmark + tagline | "Umbra. Get paid privately on Stellar." | Fade to wordmark |

**Optional 10s coda (strong):** a quick "no terminal" beat — show the browser DevTools
console printing the prover timing and the submitted tx hash, then the explorer. It
kills the "is this faked?" doubt instantly.

---

## 3. Demo Recording Plan

**Environment**
- Browser window **1280×800** (or 1440×900) — clean Chrome profile, no extensions
  bar, no bookmarks, hide the Next.js dev indicator (build with `next build && next
  start`, not `next dev`, so the floating dev badge is gone).
- Record at 1080p, 30fps. Use a screen recorder that supports speed-ramps (or edit
  after).

**Data to preload (do this before you hit record)**
- Deploy a **fresh pool** and point the app at it (`.env.local` +
  `NEXT_PUBLIC_UMBRA_POOL_CONTRACT`), then run **one** clean shield→withdraw so the
  pool and `deployment.json` are populated with real, matching, working explorer
  links. The browser must be the pool's sole writer (see
  [`BROWSER_E2E.md`](BROWSER_E2E.md) Gap 1). Re-deploy fresh before the *real* take.
- Pre-fund the signer account (friendbot) and **pre-fill the secret field off-camera**
  (or blur it) — never type a secret key on screen.
- Pre-open a stellar.expert tab on the withdraw tx so the "here it is" cut is instant.

**Proofs**
- The withdraw proof is ~2.5s off-thread — fast enough to show **live** (more
  authentic). If you want zero risk of a stutter on a slow machine, the app already
  supports a pre-generated path (`NEXT_PUBLIC_UMBRA_PROOF_MODE=pregen` + a demo proof)
  that replays the identical UX. Prefer live; keep pregen as the safety net.

**Mistakes to avoid while recording**
- No dead air during the ~20s on-chain confirmations — speed-ramp or cut.
- Don't show a secret key. Don't show the terminal (except the optional "proof" coda).
- Don't let the **USDC/XLM label mismatch** show in a confusing way (see §9) — keep
  the camera on the flow, not the unit.
- Don't over-explain cryptography. One sentence each for "proof in browser" and
  "verified on-chain." That's it.

---

## 4. README Rewrite (above-the-fold)

The README is already authored to the locked order; this is the submission polish.
Keep it ruthlessly short above the fold.

**Order (top to bottom):**
1. **Hero line (≤14 words):** `Get paid privately on Stellar — the chain can't link
   payer to recipient.`
2. **One-line subhead:** Create a payment link, share it, withdraw privately — proven
   by zero-knowledge proofs verified on Stellar.
3. **The wow GIF** (`docs/assets/wow.gif`): the link → pay → withdraw → reveal loop.
   This is the single most important asset; it must autoplay and loop.
4. **Live proof block:** the testnet contract id + **two real explorer links** (shield
   + withdraw), labelled "testnet", sourced from `deployment.json`. Put a one-liner:
   "Generated and submitted from the browser — see `docs/BROWSER_E2E.md`."
5. **The "ZK is load-bearing" line** + the verify-tx link.
6. **Quickstart** (3 commands).
7. Honest scope (link `SCOPE.md`), then repo structure.

**Screenshot placement:** GIF first (above the fold). One still of the "What Stellar
sees" reveal immediately under the proof block. Architecture diagram lives *below*
the fold, near the repo structure — judges who want it will scroll.

---

## 5. Landing Page Messaging

> Apply these as copy-only edits (no logic). They sharpen comprehension to ~2 seconds.

- **Headline:** `Get paid privately on Stellar.`
  _(Replaces "Public money. Private lives." — poetic, but slower to parse. Keep the
  old line as a secondary/closing line if you love it.)_
- **Subheadline:** `Create a payment link. Share it with anyone. Withdraw privately
  with zero-knowledge proofs verified on Stellar.`
- **Primary CTA:** `Create a payment link` → `/links`. **Secondary:** `See how it
  works` → scrolls to the "Bob pays → Alice withdraws → CANNOT BE CONNECTED" panel.
- **Social proof / trust signals (the row judges scan):**
  - "✓ Live on Stellar testnet" (links to the contract on stellar.expert)
  - "✓ Real Groth16 proofs verified on-chain"
  - "✓ Proven end-to-end from the browser"
  - "✓ Open source"
- **Trust framing:** lead with the outcome ("the chain can't link them"), back it with
  the mechanism ("a proof the Stellar contract verifies on-chain"). Never lead with
  BLS12-381.

---

## 6. Screenshot Plan

Capture at 1280×800, clean build (no dev badge), on the populated demo pool. In order:

1. **Landing hero** — the new headline + subhead + CTAs.
2. **/links — the form** filled ("Design work", 50, recipient).
3. **/links — link ready** with the QR code (shows "proof generated in your browser").
4. **/pay — the payment request** card (the payer's clean view).
5. **/pay — Paid privately ✓** (the success state).
6. **/withdraw — the proving readout** ("Generating zero-knowledge proof…", mono ms).
7. **/withdraw — the reveal** ("What you did" vs "What Stellar sees", "No shared key").
   _This is the hero screenshot — also the one under the README proof block._
8. **stellar.expert** — the withdraw tx page showing `successful`, as on-chain proof.
9. **(repo/README)** — the architecture diagram, for the technically-curious judge.

Data: use the real demo amounts; ensure the reveal's two cards show **real, clickable**
explorer links (deploy + populate `deployment.json` first).

---

## 7. Judge Psychology

**What judges care about (optimize for these):**
- _Is the ZK real and load-bearing, or decorative?_ → Lead with "money can't move
  without an on-chain proof," show the 5/5 adversarial tests and a real verify tx.
- _Does it actually run, or is it slides?_ → The browser E2E + explorer links are your
  trump card. Most submissions can't show a live, judge-clickable on-chain flow.
- _Is it a product or a tech demo?_ → The payment-link framing and the reveal make it
  a product. Hammer "share a link."
- _Is the team honest?_ → `SCOPE.md` (demo-grade params + costed gates) signals
  maturity. Judges trust teams that name their own limits.

**What judges will ignore:** curve choice rationale, constant counts, proof byte
sizes, your benchmark harness internals. Don't spend airtime there.

**What judges will misunderstand (pre-empt these):**
- "Mixer = sketchy." → Frame as *privacy for honest commerce* (freelancers, NGOs,
  payroll), not coin-mixing. The recipient binding + on-chain verification are your
  legitimacy.
- "Is the success screen faked?" → The explorer click and the optional console coda
  remove all doubt. Show the hash on-screen matching the explorer.
- "Why USDC and XLM both?" → Reconcile the label (see §9) before they notice.

**How to avoid confusion:** one idea per screen, one sentence per cryptographic claim,
and always end a claim with evidence a judge can click.

---

## 8. Competitive Positioning

| Competitor type | Their pitch | Why Umbra wins |
| --- | --- | --- |
| **Privacy wallets** | "Hold/transfer privately" | They protect a *balance*; Umbra delivers a *use case anyone wants* — getting paid — with a shareable link. Product, not plumbing. |
| **ZK demos / verifiers** | "We verify a Groth16 proof on-chain" | Umbra *also* does that — but it's load-bearing inside a real product flow with real testnet money moving, not a toy circuit. ZK as feature, not as exhibit. |
| **Identity / proof-of-X** | "Prove an attribute privately" | Different job. Umbra moves *value* privately and shows the unlinkability visually. Closer to what "private payments" means to a normal person. |
| **Compliance / RWA privacy** | "Selective disclosure for institutions" | Enterprise, slow, abstract. Umbra is consumer, immediate, and demoable in 90 seconds. Different lane, easier to *feel*. |

**The one-line wedge:** _"Everyone else shows you privacy infrastructure. Umbra shows
you a payment link your mom could use — backed by the same cryptography."_

---

## 9. Top 10 Submission Mistakes (specific to Umbra)

1. **Leading with cryptography.** Open with "share a link, get paid privately," not
   "BLS12-381 Groth16." The proof is the *backup*, not the *hook*.
2. **A demo with dead air.** ~20s on-chain confirms will kill momentum — speed-ramp
   or cut every wait.
3. **The USDC/XLM label mismatch.** The UI says "USDC" (balance/withdraw) but the
   on-chain asset is native **XLM** and the reveal says "XLM". Pick one label and make
   the demo consistent — a sharp judge will notice. (Copy-only fix.)
4. **Wow-screen links not matching the demo.** The reveal reads `deployment.json`; if
   you record on a different pool than it points to, the explorer links won't match
   your session. Populate `deployment.json` on the recorded pool first.
5. **Showing a secret key on camera.** Pre-fill or blur. Never type an `S…` on screen.
6. **The dev-mode "Issue/N" badge** in screenshots/video. Record a production build.
7. **Over-claiming.** Don't say "production-ready" or "fully decentralized." Say
   "live on testnet, end-to-end, with an explicit mainnet path." Honesty scores.
8. **Burying the on-chain proof.** The clickable explorer tx is your strongest asset —
   put it above the fold in the README and as the climax of the video.
9. **Explaining the tree depth / trusted setup unprompted.** It's in `SCOPE.md` if they
   ask. Volunteering caveats mid-demo undercuts momentum; have them ready, don't lead.
10. **No GIF above the fold.** A judge skims 50 repos. If the README's first screen
    isn't a looping demo of link→pay→withdraw→reveal, you've lost the skim.

---

## 10. Final Submission Checklist

**Artifacts**
- [ ] `docs/assets/wow.gif` recorded (link → pay → withdraw → reveal), autoplay+loop.
- [ ] Demo video (2:30) recorded, edited, uploaded (unlisted link ready).
- [ ] 9 screenshots captured (§6) at 1280×800, production build.
- [ ] README above-the-fold finalized (§4): hero + subhead + GIF + live proof links +
      quickstart.
- [ ] Architecture diagram embedded (below the fold).

**Consistency (do these before recording)**
- [ ] Fresh pool deployed; `deployment.json` populated with real, matching explorer
      links; README contract id + tx links updated to that pool.
- [ ] USDC/XLM label reconciled across UI + reveal (§9.3).
- [ ] Production build used everywhere a camera points (no dev badge).
- [ ] Hero copy updated to "Get paid privately on Stellar." (§5).

**Proof (the trust layer)**
- [ ] Contract resolves on stellar.expert (testnet) — link verified.
- [ ] Shield + withdraw txs resolve `successful: true` on Horizon — links verified.
- [ ] `cargo test -p umbra-pool` → 5/5 (mention in README).
- [ ] `docs/BROWSER_E2E.md` linked from the README as the "no terminal" evidence.

**Submission form**
- [ ] One-sentence pitch matches §1.
- [ ] Live demo URL (if hosting) OR the video as the primary demo.
- [ ] Repo link, clean `main`, no secrets committed (`.env.local` gitignored ✓).
- [ ] Team + track + "what we'd build next" = the category story (links → donations →
      payroll → treasury, same frozen protocol).
- [ ] License present.

**The 60-second self-test before you press Submit:**
Open the README cold. Can a stranger, in 30 seconds, (a) say what Umbra does, (b) see
it's real on Stellar, and (c) click one link that proves it? If yes — submit.

---

### Appendix — the assets you already have (use them)

- **Live testnet demo:** pool `CBGB5DAY…SDV7`; shield `9fb4dc15…`, withdraw `aa5cf132…`
  (in `deployment.json`, Horizon-confirmed).
- **Browser-driven E2E proof:** shield `4798875e…`, withdraw `0cf5517e…` on pool
  `CDY54W6J…2KCQ` — documented in `BROWSER_E2E.md`, Horizon-confirmed.
- **The reveal component** (`/withdraw` success) — your single best visual.
- **Measured proving:** withdraw 3.9 MB zkey, ~2.5s off-thread; main thread stays
  responsive — say "instant private payments in the browser," it's true.
- **The honesty doc** (`SCOPE.md`) — bring it out only if a judge probes limits; it
  turns a weakness into a credibility win.
