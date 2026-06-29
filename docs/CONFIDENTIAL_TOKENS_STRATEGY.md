# Umbra × Stellar Confidential Tokens — strategy

_How Umbra becomes the consumer **wallet layer** for Stellar Confidential Tokens (CT)
without abandoning its current privacy pool. Code seam: `lib/umbra/rails.ts`
(`PrivacyRail`). Status: the CT rail is **preview/roadmap** — not implemented._

## TL;DR

CT (OpenZeppelin + SDF, developer preview) gives **confidential balances and amounts**
for any SEP-41 token, using **UltraHonk (Noir)** proofs verified on-chain (verifier by
Nethermind), with compliance hooks. It happens to solve Umbra's two hardest mainnet
blockers — **no trusted-setup ceremony** (UltraHonk is transparent) and **amount
privacy**. The move: keep everything that's uniquely Umbra (the product) and make the
privacy **rail** swappable.

## 1. Current Umbra rail (`Groth16PoolRail`, live)

- Mixer-style **unlinkability** — hides which deposit funded which withdrawal.
- **Amounts are public.**
- Groth16 / BLS12-381, verified on-chain via CAP-0059.
- Working on testnet today; needs an MPC ceremony for mainnet.
- `getPublicVisibility()` → `{ amountsVisible: true, linkageHidden: true }`.

## 2. Confidential Tokens rail (`ConfidentialTokenRail`, preview)

- **Confidential balances and amounts** on a SEP-41 token.
- **Addresses remain visible** (it hides amounts, not the participant graph).
- **UltraHonk** → transparent setup, **no per-circuit ceremony**.
- Compliance hooks; the likely better mainnet path for *amount* privacy.
- `getPublicVisibility()` → `{ amountsVisible: false, linkageHidden: false }`.

## 3. Why they're complementary (not the same thing)

| Property | Umbra pool | Confidential Tokens |
| --- | --- | --- |
| Hides deposit↔withdrawal link | ✅ | ❌ (addresses visible) |
| Hides amounts | ❌ | ✅ |
| Trusted setup | required (Groth16) | none (UltraHonk) |
| Multi-asset | single asset today | any SEP-41 |
| Product (wallet, links, disclosure, recovery) | ✅ Umbra | n/a — a primitive |

The two privacy properties are **different**. CT is a privacy *primitive*; Umbra is a
*product* — the wallet UX, payment links, selective disclosure, and **cross-device
wallet-linked recovery** are Umbra's moat regardless of the rail underneath.

## 4. The adapter plan

`PrivacyRail` (real interface, `lib/umbra/rails.ts`):

```ts
interface PrivacyRail {
  getProofStatus(): ProofStatus;           // system, trustedSetup, verifiedOnChain
  getPublicVisibility(): PublicVisibility;  // amountsVisible, linkageHidden, ...
  shield(args): Promise<{ txHash }>;
  privateSend(args): Promise<{ txHash }>;
  recover(signer): Promise<{ balance }>;
  disclose(): Promise<AuditPacket>;
}
```

- `Groth16PoolRail` — **implemented & live.** `recover()` and `disclose()` are wired to
  the real code; `shield()`/`privateSend()` are driven by the wallet UI today (browser
  proving), and the rail formalizes that seam.
- `ConfidentialTokenRail` — **preview stub.** Every action throws "not implemented";
  only its `getProofStatus()` / `getPublicVisibility()` describe CT's properties
  honestly. No faked CT integration.

The product code (wallet, links, disclosure, recovery) targets `PrivacyRail`, so adding
the CT rail is an integration, not a rewrite.

## 5. Strategic options

1. **Build the product on CT.** Swap the rail to Confidential Tokens; inherit
   confidential amounts + no ceremony + SEP-41 multi-asset + compliance hooks; ship the
   thing only Umbra has — a polished consumer privacy wallet. **Fastest credible mainnet
   path.**
2. **Keep the mixer, adopt UltraHonk.** Stay a mixer (unlinkability is a distinct
   property CT doesn't give), drop the trusted setup, add confidential amounts ourselves.
   More differentiated, much more work, new audit.
3. **Combine.** Unlinkability layered with confidential amounts — strongest privacy, most
   work; a v2.

## 6. Honesty guardrails

- Do **not** claim CT is integrated. It is preview/roadmap.
- Do **not** claim confidential amounts on the current rail — amounts are public.
- The `PrivacyRail` interface is real and typechecks; the CT implementation is an
  explicit stub until real code exists (and CT itself is unaudited, testnet-only,
  mainnet ~August).

## Status

Interface + strategy: **real, today.** CT rail: **preview.** Linked from `/mainnet`.
