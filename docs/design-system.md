# Umbra Design System — Premium Financial

> Apple simplicity · Stripe trust · Linear precision · enterprise-financial quality.
> Light-first. The product should feel like a company a judge could believe shipped
> publicly tomorrow — not a hackathon demo. This document is the spec **and** a record
> of what is implemented (`styles/globals.css`, `tailwind.config.ts`,
> `components/umbra/*`). It supersedes the earlier Swiss-Brutalist direction; the one
> rule carried forward is **the signal color belongs to cryptographic moments only.**

---

## 1. Design principles

1. **Sell the outcome, not the cryptography.** Every primary surface leads with what
   the user gets ("get paid privately"), never with the mechanism (Groth16, Circom).
2. **One obvious action per screen.** Minimal ≠ empty. One primary button, sized
   confidently, everything else demoted.
3. **Calm by default, signal when it counts.** The interface is ink-on-paper and
   quiet; `#FF3B00` appears *only* during a cryptographic action and on its success.
4. **Trust through restraint.** Hairline borders, soft shadows, generous space, one
   typeface for UI and one for data. Consistency reads as expensive.
5. **Make the invisible legible.** The cryptography timeline and the "what the chain
   sees" panel turn abstract privacy into something a non-technical person can watch.

**Avoid:** crypto/hacker/terminal aesthetics, dashboard clutter, gradients, dark-mode
-as-default, tables of metrics, embedded block explorers, decorative color.

---

## 2. Color

| Token | Value | Use |
|-------|-------|-----|
| `background` (paper) | `#FAFAFA` | app background |
| `card` (surface) | `#FFFFFF` | every card, input, elevated surface |
| `foreground` (ink) | `#111111` | primary text, primary buttons |
| `muted-foreground` | `#6B7280` | secondary text, captions |
| `border` (hairline) | `#E5E7EB` | all borders, dividers |
| `muted` | `#F3F4F6` | subtle fills, hover |
| `success` | `#239A5B`-ish | confirmation only |
| `destructive` | calm red | errors only (never `#FF3B00`) |
| **`signal`** | **`#FF3B00`** | **cryptographic moments ONLY** — the proving timeline, the "verified on Stellar" tick, the one button that triggers a proof |

The signal color is a *meaning*, not a brand accent. If an element is not performing
or reporting a cryptographic action, it does not get the signal color.

---

## 3. Typography

- **Inter** — all UI. Tight tracking on display (`-0.035em`), `-0.011em` globally.
- **JetBrains Mono** — every address, hash, proof, amount, and balance. Tabular,
  `zero` feature on.

| Role | Size / class | Notes |
|------|--------------|-------|
| Display (hero) | `text-display` → `clamp(2.75rem, 6vw, 4.5rem)`, lh 1.02 | one per page, max |
| Display-sm (page H1) | `text-display-sm` → `clamp(2rem, 4vw, 2.75rem)` | screen titles |
| Section H2 | `text-2xl`–`3xl`, semibold | |
| Body large | `text-lg`–`xl`, `text-muted-foreground` | subheads |
| Body | `text-[15px]` | default |
| Eyebrow | `text-xs uppercase tracking-[0.14em] text-muted-foreground` | section labels |
| Data | `font-mono` | amounts/addresses/hashes always |

Weights: 400 body, 500 medium (buttons, labels), 600 semibold (headings). No black/900.

---

## 4. Spacing & layout

- **4px base grid.** Rhythm: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 80.
- **Shell width** `max-w-shell` = 1080px; **focused flows** `max-w-prose` = 560px
  (create/pay/withdraw are single-column and centered — Stripe-checkout discipline).
- **Page padding** `px-6`, vertical `py-12 sm:py-16`.
- **Card padding** 24px (`p-6`) standard, 32px (`p-8`) for hero/payment cards.
- Whitespace is the primary layout tool; borders are hairline accents, not structure.

---

## 5. Elevation, radius, motion tokens

- **Radius:** inputs/buttons `rounded-lg` (12px); cards `rounded-2xl` (16px); pills
  full. Nothing sharp, nothing pill-for-cards.
- **Shadows** (layered, low-opacity, slightly cool): `--shadow-sm` resting cards;
  `--shadow-md` hover/raise; `--shadow-lg` the focused payment card; `--shadow-signal`
  the one signal button. Depth is soft, never hard.
- **Motion:** ease `cubic-bezier(0.22,1,0.36,1)`, durations 150ms (interactions) /
  400–500ms (entrances). `prefers-reduced-motion` disables all of it.

---

## 6. Component hierarchy

```
Shell                app frame: sticky blurred TopBar + centered max-w-shell main
  TopBar             logo · Get paid · Activity · Withdraw
Card / Card(elevated)  the universal surface (u-card / u-card-lg)
Button               primary (ink) · secondary (surface) · signal (crypto only) · ghost · link
Field                label + hint + input (mono variant for crypto data)
Eyebrow / Pill       section labels · status chips (muted/signal/success)
Logo                 ink square with a signal-cut corner — the only mark, no illustration
CryptoTimeline       the signature proving experience (signal-colored)
ChainReveal          "what the blockchain sees" vs "what you see" — the privacy payload
```

Primary buttons are **ink**, not colored — color is reserved. The signal button exists
on exactly the screens that generate a proof (create link, pay, withdraw, shield).

---

## 7. The cryptography timeline (signature experience)

A vertical, choreographed sequence shown during proving. Steps advance on a calm
~900ms cadence while the real proof generates, then complete the instant the work
resolves. States per row: pending (dim dot) → active (pulsing signal ring) → done
(signal check, pop-in). This is the one place color and motion are spent, because it
is the cryptographic moment.

Copy per flow:
- **Create / Shield:** Preparing your note → Building the witness → Generating the
  zero-knowledge proof → Sealing the payment.
- **Pay:** Checking the request → Funding privately → Verifying on Stellar → Payment
  protected.
- **Withdraw:** Opening your note → Proving ownership → Generating the proof →
  Verifying on Stellar → Releasing funds.

---

## 8. Interaction principles

- **One primary action visible at a time.** During proving, the button is *replaced*
  by the timeline — never both.
- **Optimistic, honest states.** Buttons show `Proving…`/`Paying…`; success is a
  distinct screen state, not a toast.
- **Copyable crypto data, always.** Any mono value (link, address, hash) has a copy
  affordance with a 1.6s "Copied" confirmation.
- **Errors are calm and actionable**, in destructive-red (never signal): tampered
  links say *"This link can't be trusted — its amount doesn't match its proof."*
- **Focus is visible** (`u-focus` ring) for keyboard users.

---

## 9. State design (the polish judges grade subconsciously)

- **Empty:** Activity/Withdraw with no notes → a centered card with one sentence and
  the single next action ("Create a payment link"). Never a blank screen.
- **Loading/working:** the cryptography timeline (never a bare spinner).
- **Success:** a green check (pop-in), one outcome sentence, and — on withdraw — the
  `ChainReveal` panel as the payoff.
- **Error:** calm red line, plain-language cause, a way forward.

---

## 10. Screen-by-screen spec & exact copy

**Landing `/`** — server-rendered, five-second test.
- Eyebrow: *Private payments on Stellar* · H1: **Get paid privately on Stellar.** ·
  Sub: *Create a payment link. Share it with anyone. The blockchain can't see who paid
  you.* · Primary: **Create a payment link** · Secondary: *See how it works*.
- Below: `ChainReveal`, a 3-step "How it works", a 3-item trust strip (the technical
  truth, placed *below* the outcome). No "Phase 0.1", no "SPP".

**Create `/links`** — `max-w-prose`. H1 **Create a payment link**. Fields: *What's it
for? · Description · Your name · Amount.* Signal button **Create payment link** →
timeline → success: **Your payment link is live**, large QR, copyable URL, *Create
another link*. Caption: *Your payment is sealed with a zero-knowledge proof, in this
browser.*

**Pay `/pay/[id]`** — standalone checkout (no app nav). Eyebrow *Private payment
request*; a large mono amount; *to {name}*; title/description. Signal button **Pay
privately**; caption *🔒 The blockchain won't link your payment to {name}.* → timeline
→ **Paid privately** with the reassurance line. Tampered link → **This link can't be
trusted**.

**Withdraw `/withdraw`** — H1 **Cash out privately**. Note picker; *Where the money
goes* (address). Signal **Withdraw privately** → timeline → **Funds released** +
`ChainReveal`. Empty → **Nothing to withdraw yet** → Create-a-link CTA.

**Activity `/wallet`** — H1 **Your private balance**; an elevated balance card with a
**Withdraw** action; a hairline-divided **History** list (Received/Sent privately,
amount, status pill). Empty → **No activity yet**.

**Shield `/shield`** — demoted "Advanced" flow (*Most people just share a payment link
instead*), same premium treatment.

---

## 11. Mobile

Single-column flows are mobile-first by construction (`max-w-prose`, `px-6`). Hero CTAs
stack (`flex-col sm:flex-row`); `ChainReveal` collapses to one column (`sm:grid-cols-2`);
the TopBar stays compact. Touch targets ≥ 44px (button `h-11`+). No layout depends on
hover.

---

*Implemented and verified by `next build` (all 8 routes compile and prerender).
Visual QA in a browser is the remaining step before the demo recording.*
