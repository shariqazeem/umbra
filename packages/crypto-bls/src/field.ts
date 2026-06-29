/**
 * BLS12-381 scalar field (Fr) arithmetic.
 *
 * Fr is the field the Umbra circuits operate over and the field Poseidon must be
 * parameterized for. We delegate the actual modular arithmetic to the audited
 * @noble/curves implementation and expose a thin, explicit surface so the rest of
 * the codebase never hand-rolls field math.
 *
 * r = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
 *   ≈ 2^255  (so a canonical Fr element fits in 32 bytes; ~255-bit, NOT 254 like BN254)
 */
import { bls12_381 } from "@noble/curves/bls12-381";
import { randomBytes } from "@noble/hashes/utils";

const NFr = bls12_381.fields.Fr;

/** The Fr modulus r. */
export const FR_ORDER: bigint = NFr.ORDER;

/** Number of bytes in a canonical Fr serialization (big-endian). */
export const FR_BYTES = 32;

/** Bit length of r (used to size in-circuit range checks correctly: 255, not 254). */
export const FR_BITS = FR_ORDER.toString(2).length;

/** Reduce an arbitrary bigint into Fr. */
export const fr = (x: bigint): bigint => NFr.create(x);

export const add = (a: bigint, b: bigint): bigint => NFr.add(a, b);
export const sub = (a: bigint, b: bigint): bigint => NFr.sub(a, b);
export const mul = (a: bigint, b: bigint): bigint => NFr.mul(a, b);
export const neg = (a: bigint): bigint => NFr.neg(a);
export const inv = (a: bigint): bigint => NFr.inv(a);
export const eq = (a: bigint, b: bigint): boolean => NFr.eql(NFr.create(a), NFr.create(b));
export const isInField = (x: bigint): boolean => x >= 0n && x < FR_ORDER;

/** x^5 — the Poseidon S-box for BLS12-381 (gcd(5, r-1) = 1). */
export function pow5(x: bigint): bigint {
  const x2 = NFr.mul(x, x);
  const x4 = NFr.mul(x2, x2);
  return NFr.mul(x4, x);
}

/** General exponentiation in Fr. */
export const pow = (x: bigint, e: bigint): bigint => NFr.pow(NFr.create(x), e);

/** Big-endian fixed-width serialization of a non-negative bigint (no reduction). */
export function intToBytesBE(x: bigint, len: number): Uint8Array {
  if (x < 0n) throw new Error("intToBytesBE: negative");
  const out = new Uint8Array(len);
  let n = x;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) throw new Error(`value does not fit in ${len} bytes`);
  return out;
}

/** Big-endian fixed-width serialization of an Fr element (reduced; default 32 bytes). */
export function toBytesBE(x: bigint, len = FR_BYTES): Uint8Array {
  return intToBytesBE(NFr.create(x), len);
}

/** Parse a big-endian byte array into a bigint (no reduction). */
export function fromBytesBE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

/** A uniformly random Fr element (CSPRNG-backed). */
export function randomFr(): bigint {
  // 64 bytes of entropy reduced mod r → negligible modulo bias.
  return NFr.create(fromBytesBE(randomBytes(64)));
}

/** Deterministic Fr element from a label — useful for reproducible test vectors. */
export function frFromLabel(label: string): bigint {
  const bytes = new TextEncoder().encode(label);
  return NFr.create(fromBytesBE(bytes));
}
