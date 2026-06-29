# @umbra/sdk

**Plug private payments into your Stellar app.**

Umbra is a privacy layer for Stellar: money moves through a pool whose validity is
enforced by a **Groth16 proof verified on-chain inside a Soroban smart contract**.
This SDK exposes the exact, on-chain-verified primitives Umbra's own products run on
— so you can build private payments, donations, invoices, or your own flows on the
same protocol.

> Same curve, same Poseidon constants, same Merkle tree, same verifier the live
> testnet pool uses. Nothing here is a reimplementation — it's the production path.

## Install

```bash
pnpm add @umbra/sdk
```

## What's in the box

| Primitive | What it does |
| --- | --- |
| `makeNote`, `commitment`, `nullifier` | Private money: a note is `Poseidon(secret, amount)`; the nullifier spends it once. |
| `recipientField` | Bind a recipient into a withdrawal proof. |
| `MerkleTree`, `DEPTH` | The append-only Poseidon tree that **mirrors the on-chain tree** — compute roots & paths that the contract accepts. |
| `buildShieldInput`, `buildWithdrawInput` | Ready-to-prove Groth16 witness inputs for shield / withdraw. |
| `poseidon`, `poseidon2` | Poseidon over BLS12-381 Fr (contract ≡ circuit ≡ SDK). |
| `g1ToSoroban`, `g2ToSoroban`, … | Encode a snarkjs proof / verifying key into the contract's exact byte layout. |
| `encodePaymentLink`, `decodePaymentLink` | Self-contained, integrity-checked payment links (a pre-authorized shield). |
| `UMBRA_CONTRACTS` | The deployed pool contract id + network config. |

## Example — create a private payment link

```ts
import {
  makeNote, commitment, buildShieldInput,
  encodePaymentLink, UMBRA_CONTRACTS,
} from "@umbra/sdk";

// 1. The recipient mints a note (the secret stays with them, never in the link).
const note = makeNote(50n);
const cm = commitment(note);

// 2. Generate the shield proof for it (Groth16, in the browser — see the prover ref).
const input = buildShieldInput(note);
const proof = await proveShield(input); // your snarkjs prover; artifacts in /circuits

// 3. Package a shareable, tamper-evident link — no backend.
const id = encodePaymentLink({
  v: 1, title: "Design work", description: "Logo + brand kit",
  recipientName: "Alex", amount: "50", commitment: cm.toString(), proof,
});
const url = `https://yourapp.com/pay/${id}`;
```

## Example — verify a link's integrity (payer side)

```ts
import { decodePaymentLink } from "@umbra/sdk";

// Throws if the amount/commitment was tampered (the proof's public signals won't match).
const payload = decodePaymentLink(idFromUrl);
console.log(`Pay ${payload.amount} to ${payload.recipientName}`);
```

## On-chain

```ts
import { UMBRA_CONTRACTS } from "@umbra/sdk";
const { pool, rpcUrl, networkPassphrase, explorer } = UMBRA_CONTRACTS.testnet;
// Encode your proof with g1ToSoroban/g2ToSoroban, then invoke shield()/withdraw()
// on `pool` via @stellar/stellar-sdk. The contract verifies the proof on-chain.
```

## Selective disclosure (related)

Umbra is **private by default, accountable by choice**. The app layer pairs these
primitives with an encrypted **audit packet** (AES-GCM under a user-held viewing key)
so a user can disclose their history to an accountant or auditor when *they* choose —
no backdoor, no automatic access. See `lib/umbra/viewing-key.ts` and the `/audit` page
in the repo. (v1 is encryption-based; auditor public keys + scoped viewing keys are
roadmap.)

## Publishing

This package is currently `private: true`. It depends on two workspace packages
(`@umbra/crypto-bls`, `@umbra/wallet-core`) via the `workspace:*` protocol, so before
it can ship to npm you must either publish those two packages as well, or bundle them
into the SDK's build. Once that's resolved, drop `private`, run `tsc` to emit `dist/`,
point `main`/`types`/`exports` at it, and `npm publish` (config is already set to
`access: public`). We've deliberately **not** published a half-wired package.

## Status

Testnet. The pool, circuits, and verifier are frozen and proven (5/5 contract tests
with real proofs against the real BLS12-381 host; a live testnet shield + withdraw,
and the same flow proven end-to-end from the browser — see the repo's `docs/`).

**Want privacy in your Stellar product?** This is the toolkit. Build with it.
