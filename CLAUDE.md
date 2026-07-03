# CLAUDE.md — Umbra

Guidance for AI agents and contributors working in this repository.

## Product

**Umbra** is a privacy finance suite for **Stellar**, focused on:

- One-click **shielding**
- Private **transfers**
- Private **invoices**
- Private **donation links**

Built on **Nethermind SPP (Stellar Private Payments)**.

### Product thesis

> **Consumer privacy layer for Stellar commerce**

Every design and engineering decision should ladder up to this thesis. Umbra is
a consumer product first: privacy is the feature, not the configuration.

---

## Design system — Totality

Umbra's UI is **Totality**: a dark, cinematic "privacy-infrastructure" system. Obsidian
surfaces, monochrome glass structure, and a single sacred accent — **Ember** — that ignites
only where cryptography happens. The interface goes quiet and dark until a proof fires. This
system is **law**; it supersedes and replaces the earlier light "Swiss Brutalist" spec (its tokens
and components have been removed). Tokens live in `styles/globals.css` (CSS variables) and
`tailwind.config.ts` — change the system there, never ad hoc in components.

### Palette

Dark-only. Four roles: obsidian surfaces, monochrome ink/glass, **Ember** (crypto), **Verify**
(completed receipts).

| Token | Value | Role |
| --- | --- | --- |
| `--background` | `#0A0A0A` obsidian | Page |
| `--card` | `#121212` | Surfaces (`u-card`) |
| `--foreground` | `#FAFAFA` | Ink / text |
| `--muted-foreground` | `#999999` | Secondary text |
| `--border` | `#292929` | Hairline borders (glass structure) |
| **Ember** (`ember`) | `#FF3B00` · bright `#FF5A24` · deep `#FF4810` | Cryptographic signal — see the Ember rule |
| **Verify** (`--verify` / `verify`) | `#35B67F` | Completion green — completed receipts ONLY |
| `--destructive` | `~#E0464A` | Errors |

Glass = translucent white on obsidian (`bg-white/[0.04]`, `border-white/10`) — the material for
structure, secondary buttons, and nav.

### The Ember rule (the one rule that matters)

**Ember (`#FF3B00`) appears ONLY where cryptography happens or is invoked.** Nothing else is ever
Ember; it is earned:

- ✅ Proving (ProofViz, prover steppers), a completed crypto action (SuccessMark), the private
  **balance** card + glow, the **Pool** ember ring, **focus rings**, and **cryptographic commit
  CTAs** — buttons that actually prove or move value: *Shield, Send privately, Send, Unshield, Claim,
  Pay, Generate link, Decrypt, Connect, Generate viewing key.*
- ❌ **Navigation and secondary CTAs are monochrome glass** — never Ember. "Open the wallet", "Build
  with Umbra", "See live apps", "Open the Proof Center", "Create a payment link" and every other
  cross-surface link is the `secondary` glass button.

Hard invariant: **no primary-Ember button may navigate.** The primary (Ember gradient) `Button`
variant is reserved for the commit actions above; everything else is `secondary`/`ghost`/`link`.

### Verify green

`--verify` (`#35B67F`) is the ONLY non-Ember accent, and it appears ONLY on a **completed receipt**:
the `/claim` "Added to your wallet" state and a note's "Available" status. Every other success uses
Ember totality (SuccessMark). Never use Verify for a CTA, an in-progress state, or decoration.

### Typography

- **Inter** (`font-sans`) — all UI text.
- **JetBrains Mono** (`font-mono`) — **ALL cryptographic / ledger values**: addresses, hashes, proofs,
  keys, balances, amounts, contract ids, nullifiers, RPC urls, code. Hard rule: crypto/ledger data is
  always monospaced (slashed zero + tabular figures are set globally on `.font-mono`).
- **Archivo** (`font-display`, weights 800/900) — heavy display headlines (hero H1s).

### Monospaced crypto data + copy

Any monospaced crypto value **must offer a one-click copy** via the shared `components/copy-button.tsx`
(`CopyButton`) — one component everywhere, never a bespoke toggle. Never show a hash/address the user
cannot copy.

### Shape, surface & depth

- **Radius `--radius: 12px`.** Cards `rounded-2xl` (16px), buttons/inputs `rounded-xl` (12px), pills
  `rounded-full`. Nothing is square.
- **Depth is glow + soft shadow, not borders.** `u-card` = hairline border + `--shadow-sm` + an inset
  top highlight. The signature crypto depth cue is the **Ember glow** `--shadow-signal`
  (`0 0 32px -4px rgb(255 59 0 / 0.45)`, `.u-signal-glow`) on the balance card, SuccessMark, the Pool.
- **Gradients + glass are the language:** the Ember CTA is a vertical gradient; nav is
  `bg-background/80 backdrop-blur-md`. Structure is hairline borders + glass fills.

### The corona / ring motif

The signature geometry is the **corona**: rings, orbits, and radial glows around a dark center — the
Pool disc + spinning ember ring, the SuccessMark ring that draws itself, the Merkle-root pulse in
ProofViz, the focus ring. New cryptographic affordances should prefer ring/corona geometry over flat
fills.

### Motion

- Framer-motion springs at roughly **stiffness 260 / damping 28** for signature interactions; fades
  use `cubic-bezier(0.22,1,0.36,1)`, presses `active:scale-[0.98]`.
- **`prefers-reduced-motion` is always respected** — every animation (auroras, PoolScene, ProofViz,
  Lenis smooth-scroll, count-ups) has a reduced-motion path.

### Component conventions

- **Button** — `primary` (Ember gradient) = crypto commit only; `secondary` (glass) = navigation +
  everything else; `ghost`/`link` for tertiary. See the Ember rule.
- **Card** — `u-card` / `u-card-lg` (dark, rounded-2xl, hairline, soft shadow + inset highlight).
- **Field / AmountField** — dark inputs, Ember focus ring; `AmountField` denominates in **XLM**.
- Tokens live in `styles/globals.css` + `tailwind.config.ts`. Change the system there.

---

## Tech stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** (strict mode)
- **Tailwind CSS v3** + **shadcn/ui** (New York style, components in `components/ui`)
- **Vitest** + Testing Library (unit/component) — `tests/unit`
- **Playwright** (E2E) — `tests/e2e`
- **ESLint** (flat config, `next/core-web-vitals` + `next/typescript`) + **Prettier**

## Repository structure

```
app/         Next.js App Router routes, layout, pages
components/   React components (components/ui = shadcn primitives)
hooks/        Reusable React hooks
lib/          Framework-agnostic utilities & constants
styles/       Global CSS + design tokens
tests/        tests/unit (Vitest) + tests/e2e (Playwright)
docs/         Project documentation
```

## Commands

| Script              | Action                  |
| ------------------- | ----------------------- |
| `npm run dev`       | Start the dev server    |
| `npm run build`     | Production build        |
| `npm run lint`      | ESLint                  |
| `npm run typecheck` | `tsc --noEmit`          |
| `npm run test`      | Vitest (unit/component) |
| `npm run test:e2e`  | Playwright (E2E)        |
| `npm run format`    | Prettier write          |

## Scope guardrails

This repo is being built in phases. **Phase 0.1 is scaffolding only.** Do **not**
implement until the corresponding phase:

- ❌ Cryptography / proof systems
- ❌ Wallet logic / key management
- ❌ Supabase / persistence
- ❌ Stellar integration
- ❌ Nethermind SPP integration

Keep placeholders clearly marked as placeholders. Add real capability only when a
phase explicitly calls for it.
