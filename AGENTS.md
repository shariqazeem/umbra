# AGENTS.md — Umbra

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

## Design system — Swiss Brutalist

The Umbra UI is **Swiss Brutalist**: structural, typographic, high-contrast, and
honest about what it is. No ornamentation. The interface should feel like a
precise financial instrument, not a marketing site.

### Palette

The entire product uses **three colors only**:

| Token          | Hex       | Usage                                                |
| -------------- | --------- | ---------------------------------------------------- |
| `umbra.black`  | `#000000` | Text, structural borders, primary surfaces           |
| `umbra.white`  | `#FFFFFF` | Backgrounds, inverted text                           |
| `umbra.signal` | `#FF3B00` | **Cryptographic actions ONLY** (shield, prove, send) |

> **`#FF3B00` is reserved.** It marks moments where a cryptographic operation
> happens — shielding, proof generation, private transfer. It is never used for
> decoration, hover states, generic CTAs, links, or emphasis. If an element is
> not performing a cryptographic action, it does not get the signal color.

No other colors. No tints, no shades beyond what is required for disabled/muted
text (neutral grays derived from black at low opacity are acceptable for
secondary text only).

### Typography

- **Inter** — all UI text (headings, body, labels, buttons).
- **JetBrains Mono** — all **addresses, hashes, proofs, balances**, and any
  other raw cryptographic / ledger data.

Crypto data is always monospaced. This is a hard rule: if a value is an address,
a transaction hash, a proof, a key, or a balance, it renders in JetBrains Mono.

### Monospaced crypto data + copy actions

Any monospaced crypto value (address, hash, proof, balance) **must offer a copy
action**. Use `hooks/use-copy-to-clipboard.ts` and the `components/copy-button.tsx`
affordance. Never present a hash or address the user cannot copy in one click.

### Shape & surface rules

- **Corner radius: 0–2px maximum.** Square by default. `--radius` is `2px` and is
  the ceiling. Never exceed it.
- **No gradients.** Flat fills only.
- **No glassmorphism.** No blur, no translucency-as-style.
- **No soft shadows.** No drop shadows for depth. Depth is communicated with
  **borders**, not shadows.
- **No illustrations.** No decorative imagery, mascots, or spot art.
- **Visible structural borders.** Borders are `2px`, solid, and high-contrast
  (black on white / white on black). Layout structure is expressed through
  visible borders and grid lines, not whitespace alone.

### Component conventions

- Default to `border-2 border-foreground`, square corners, flat fills.
- Buttons are uppercase, bordered, no shadow. The `signal` button variant is the
  only one using `#FF3B00` and is reserved for cryptographic actions.
- Tokens live in `styles/globals.css` (shadcn HSL variables) and
  `tailwind.config.ts` (brand tokens + radius + fonts). Change the system there,
  not ad hoc in components.

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
