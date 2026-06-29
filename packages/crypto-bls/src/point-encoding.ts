/**
 * Soroban/CAP-0059 point serialization for BLS12-381.
 *
 * The host functions expect UNCOMPRESSED, big-endian points:
 *   - G1: 96 bytes  = X(48) ‖ Y(48), each a raw base-field element.
 *   - G2: 192 bytes = X(96) ‖ Y(96), each X/Y an Fp2 = (c0(48) ‖ c1(48)).
 * A compression flag set in the input is an error host-side. Subgroup membership
 * is checked automatically by the host (so the contract need not re-check), but we
 * still validate on-curve here to catch malformed test inputs early.
 *
 * The byte layout is validated two ways in B02: (1) a manual affine-coordinate
 * round-trip, and (2) cross-check against @noble/curves' own uncompressed encoding
 * (with the 3 metadata flag bits cleared). The ultimate ground truth — that these
 * bytes are what the live host accepts — is established by B04 on testnet.
 */
import { bls12_381 } from "@noble/curves/bls12-381";
import { intToBytesBE, fromBytesBE } from "./field.js";

const G1Point = bls12_381.G1.ProjectivePoint;
const G2Point = bls12_381.G2.ProjectivePoint;
type G1 = InstanceType<typeof G1Point>;
type G2 = InstanceType<typeof G2Point>;

export const FP_BYTES = 48;
export const G1_BYTES = 96;
export const G2_BYTES = 192;

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const fp = (x: bigint): Uint8Array => intToBytesBE(x, FP_BYTES);

/** G1 affine point → 96-byte Soroban encoding. */
export function g1ToSoroban(p: G1): Uint8Array {
  const a = p.toAffine();
  return concat(fp(a.x), fp(a.y));
}

/** 96-byte Soroban encoding → validated G1 point. */
export function g1FromSoroban(b: Uint8Array): G1 {
  if (b.length !== G1_BYTES) throw new Error(`G1 expects ${G1_BYTES} bytes`);
  const x = fromBytesBE(b.subarray(0, FP_BYTES));
  const y = fromBytesBE(b.subarray(FP_BYTES, G1_BYTES));
  const p = G1Point.fromAffine({ x, y });
  p.assertValidity();
  return p;
}

/**
 * Fp2 element (c0 + c1·u) → 96 bytes in IETF/Zcash order: the imaginary part c1
 * FIRST, then the real part c0. This matches the BLS12-381 serialization used by
 * @noble/curves and the Soroban host (verified by B02's noble cross-check).
 */
function fp2ToBytes(e: { c0: bigint; c1: bigint }): Uint8Array {
  return concat(fp(e.c1), fp(e.c0));
}

function fp2FromBytes(b: Uint8Array): { c0: bigint; c1: bigint } {
  return {
    c1: fromBytesBE(b.subarray(0, FP_BYTES)),
    c0: fromBytesBE(b.subarray(FP_BYTES, 2 * FP_BYTES)),
  };
}

/** G2 affine point → 192-byte Soroban encoding. */
export function g2ToSoroban(p: G2): Uint8Array {
  const a = p.toAffine() as unknown as { x: { c0: bigint; c1: bigint }; y: { c0: bigint; c1: bigint } };
  return concat(fp2ToBytes(a.x), fp2ToBytes(a.y));
}

/** 192-byte Soroban encoding → validated G2 point. */
export function g2FromSoroban(b: Uint8Array): G2 {
  if (b.length !== G2_BYTES) throw new Error(`G2 expects ${G2_BYTES} bytes`);
  const x = fp2FromBytes(b.subarray(0, G2_BYTES / 2));
  const y = fp2FromBytes(b.subarray(G2_BYTES / 2, G2_BYTES));
  const p = G2Point.fromAffine({ x, y } as unknown as Parameters<typeof G2Point.fromAffine>[0]);
  p.assertValidity();
  return p;
}

/** @noble's own uncompressed bytes with the 3 metadata flag bits cleared. */
export function nobleUncompressedCleared(p: G1 | G2): Uint8Array {
  const raw = p.toRawBytes(false);
  const out = raw.slice();
  out[0] = out[0]! & 0x1f; // clear compression/infinity/sort flags in the top 3 bits
  return out;
}

export { G1Point, G2Point };
export type { G1, G2 };
