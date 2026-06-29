/**
 * Stellar address ↔ two Fr limbs.
 *
 * A Stellar account/contract id is a 32-byte key = 256 bits, which EXCEEDS the
 * ~255-bit Fr modulus and therefore cannot be a single field element. Umbra binds
 * a payout address inside a proof as two 128-bit limbs (hi ‖ lo), each comfortably
 * inside Fr, and the contract reconstructs the 32 bytes on-chain. This is what
 * prevents a relayer (or any resubmitter) from redirecting a payout. See
 * ARCHITECTURE.md §2 and FEASIBILITY_REVIEW.md §7.
 */
import { intToBytesBE, fromBytesBE } from "./field.js";

export interface AddressLimbs {
  readonly hi: bigint; // high 16 bytes (128 bits)
  readonly lo: bigint; // low 16 bytes (128 bits)
}

/** Split a 32-byte address into two 128-bit Fr limbs. */
export function addressToLimbs(address32: Uint8Array): AddressLimbs {
  if (address32.length !== 32) throw new Error("address must be 32 bytes");
  return {
    hi: fromBytesBE(address32.subarray(0, 16)),
    lo: fromBytesBE(address32.subarray(16, 32)),
  };
}

/** Reconstruct the 32-byte address from its two limbs. */
export function limbsToAddress(limbs: AddressLimbs): Uint8Array {
  const out = new Uint8Array(32);
  out.set(intToBytesBE(limbs.hi, 16), 0);
  out.set(intToBytesBE(limbs.lo, 16), 16);
  return out;
}
