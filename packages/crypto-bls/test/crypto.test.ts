import { describe, expect, it } from "vitest";
import {
  addressToLimbs,
  FR_BITS,
  FR_ORDER,
  g1FromSoroban,
  g1ToSoroban,
  g2FromSoroban,
  g2ToSoroban,
  G1Point,
  G2Point,
  isInField,
  limbsToAddress,
  nobleUncompressedCleared,
  poseidon,
  poseidon2,
} from "../src/index.js";

const EXPECTED_FR =
  0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

describe("field", () => {
  it("is the BLS12-381 scalar field, 255-bit", () => {
    expect(FR_ORDER).toBe(EXPECTED_FR);
    expect(FR_BITS).toBe(255);
  });
});

describe("poseidon", () => {
  it("is deterministic and in-field", () => {
    const h = poseidon2(1n, 2n);
    expect(h).toBe(poseidon2(1n, 2n));
    expect(isInField(h)).toBe(true);
    expect(h).not.toBe(0n);
  });
  it("is sensitive to input order", () => {
    expect(poseidon2(1n, 2n)).not.toBe(poseidon2(2n, 1n));
  });
  it("supports 1, 2 and 4 inputs", () => {
    expect(isInField(poseidon([42n]))).toBe(true);
    expect(isInField(poseidon([1n, 2n, 3n, 4n]))).toBe(true);
  });
});

describe("point encoding (Soroban layout)", () => {
  for (const k of [1n, 2n, 7n, 0xdeadbeefn]) {
    it(`G1 round-trips and matches noble for k=${k}`, () => {
      const P = G1Point.BASE.multiply(k);
      const bytes = g1ToSoroban(P);
      expect(bytes.length).toBe(96);
      expect(g1FromSoroban(bytes).equals(P)).toBe(true);
      expect(Buffer.from(bytes)).toEqual(Buffer.from(nobleUncompressedCleared(P)));
    });
    it(`G2 round-trips and matches noble for k=${k}`, () => {
      const P = G2Point.BASE.multiply(k);
      const bytes = g2ToSoroban(P);
      expect(bytes.length).toBe(192);
      expect(g2FromSoroban(bytes).equals(P)).toBe(true);
      expect(Buffer.from(bytes)).toEqual(Buffer.from(nobleUncompressedCleared(P)));
    });
  }
});

describe("address limbs", () => {
  it("round-trips a 32-byte address through two 128-bit Fr limbs", () => {
    const addr = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
    const limbs = addressToLimbs(addr);
    expect(limbs.hi < 1n << 128n).toBe(true);
    expect(limbs.lo < 1n << 128n).toBe(true);
    expect(Buffer.from(limbsToAddress(limbs))).toEqual(Buffer.from(addr));
  });
});
