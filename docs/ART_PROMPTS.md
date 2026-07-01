# Umbra — AI Atmosphere Prompts (round 2)

Prompts for the remaining screen backdrops, in the **same dark cinematic language** as the
existing atmospheres (`public/art/hero.png`, `merkle.png`, `vault.png`, `surface.png`). Generate
each, drop it into `public/art/<name>.png`, and I'll wire it in (behind a scrim, so it sits
*under* the UI, never fighting it).

## House style (paste into every prompt)

> Cinematic abstract render, near-black background (#0A0A0A), minimalist and futurist, premium
> fintech / "privacy infrastructure" mood. Deep negative space, volumetric depth, fine detail,
> subtle film grain. A single restrained accent of signal orange (#FF3B00) used sparingly as
> light — never as fill. Matte, no gloss, no gradients-as-decoration. **No text, no letters, no
> numbers, no logos, no people, no UI, no watermark.** Shot on a wide cinematic frame, 16:9,
> centered composition with room for an overlay. High resolution, 4k.

Recommended settings: **16:9**, high quality/steps, low-to-medium "creativity" so it stays
minimal. If your tool has a negative prompt, use:
`text, words, letters, numbers, logo, watermark, people, faces, hands, UI, buttons, clutter, rainbow colors, neon overload, glossy, cartoon`.

---

## 1. `proof.png` — Proof Center ("don't trust us, verify")

> [House style] — A vast dark chamber of verification: thin luminous filament lines converging
> to a single point of truth, like a proof resolving. Faint concentric rings of light rippling
> outward from one bright #FF3B00 nucleus, suggesting a pairing check completing. Precise,
> mathematical, still, and certain. Mostly black with one focused orange glow at center-right.
> Architectural emptiness, cold light, a sense of something being *proven*.

## 2. `commerce.png` — Payment / donation / invoice links

> [House style] — An abstract private value transfer: two distant points connected by a single
> clean arc of light crossing a dark void, the path dissolving into particles at both ends so
> the endpoints stay unknowable. A quiet sense of money moving without a trail. One thin
> #FF3B00 thread of light along the arc; everything else near-black and calm. Elegant, sparse,
> trustworthy — Stripe-grade restraint, not crypto-flashy.

## 3. `mainnet.png` — Mainnet readiness

> [House style] — A monumental dark structure rising from fog: a single vast obsidian monolith
> or foundation slab, seen from below, conveying scale, permanence, and launch-readiness. A
> thin seam of #FF3B00 light runs up one edge like a reactor coming online. Weight, gravity,
> infrastructure. Mostly matte black stone and shadow; one disciplined orange seam. Awe without
> noise.

## 4. `audit.png` — Selective disclosure / auditor view

> [House style] — A single controlled beam of light passing through a narrow aperture in an
> otherwise sealed dark surface, illuminating just one small region — the visual of *disclosing
> exactly what you choose, nothing more*. Precise, restrained, a sense of a key turning. One
> #FF3B00 shaft of light; the rest in deep shadow. Clean, architectural, deliberate.

## 5. `shield.png` — Shield / deposit moment (optional, for `/shield` + shield success)

> [House style] — The instant a value becomes private: a small bright core being enveloped by
> smooth dark protective geometry folding around it, sealing it in. A sense of something
> valuable disappearing safely into shadow. One #FF3B00 core dimming as the dark shell closes.
> Smooth, calm, protective — not aggressive. Deep blacks, one fading orange center.

## 6. `og-refresh.png` — Social share card (optional, replaces/updates `og.png`)

> [House style] but **1200×630** — A single striking hero image for link previews: an abstract
> Merkle-tree-like constellation of dark nodes with one glowing #FF3B00 path climbing through
> them, on pure near-black, with generous empty space on the left third for a title overlay.
> Iconic, minimal, instantly "privacy + cryptography." No text baked in.

---

### Placement plan (once generated)

| File | Screen(s) | Notes |
| --- | --- | --- |
| `proof.png` | `/proof` | scrim ~0.5, aligned right |
| `commerce.png` | `/links`, `/donate`, `/invoice`, `/pay/[id]` | shared commerce backdrop |
| `mainnet.png` | `/mainnet` | full-bleed, heavier scrim |
| `audit.png` | `/audit` | subtle, low opacity |
| `shield.png` | `/shield` + shield success | optional |
| `og-refresh.png` | `app/layout.tsx` OG/Twitter meta | 1200×630 |

Tell me which ones you generated and I'll place + wire them (same `Atmosphere` component as the
hero/vault backdrops).
