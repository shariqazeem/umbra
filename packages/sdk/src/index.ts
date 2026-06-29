// @umbra/sdk — privacy primitives for Stellar.
//
// Plug private payments into any Stellar app using the exact, on-chain-verified
// primitives Umbra's own products run on: notes & Poseidon commitments, a Merkle
// tree that mirrors the contract, Groth16 witness inputs, the BLS12-381 Soroban
// encoding, and the self-contained payment-link codec.

// ── Notes, commitments, nullifiers, recipient binding ────────────────────────────
export {
  makeNote,
  commitment,
  nullifier,
  recipientField,
  type Note,
} from "@umbra/wallet-core";

// ── The Merkle tree that mirrors the on-chain Poseidon tree ──────────────────────
export { MerkleTree, DEPTH, type MerklePath } from "@umbra/wallet-core";

// ── Groth16 witness inputs for shield / withdraw ─────────────────────────────────
export {
  buildShieldInput,
  buildWithdrawInput,
  type ShieldInput,
  type WithdrawInput,
} from "@umbra/wallet-core";

// ── Poseidon over BLS12-381 Fr (contract ≡ circuit ≡ SDK) ────────────────────────
export { poseidon, poseidon2 } from "@umbra/crypto-bls";

// ── Soroban encoding: snarkjs proof / vk → the contract's byte layout ────────────
export {
  g1ToSoroban,
  g2ToSoroban,
  g1FromSoroban,
  g2FromSoroban,
  G1Point,
  G2Point,
  toBytesBE,
} from "@umbra/crypto-bls";

// ── Self-contained, integrity-checked payment links ──────────────────────────────
export {
  encodePaymentLink,
  decodePaymentLink,
  type PaymentLinkPayload,
  type Groth16ProofJson,
} from "./payment-link.js";

// ── Deployed pool contracts ──────────────────────────────────────────────────────
export { UMBRA_CONTRACTS, type UmbraNetwork, type UmbraDeployment } from "./contracts.js";
