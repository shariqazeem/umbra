import type { Benchmark, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import {
  addressToLimbs,
  fromBytesBE,
  g1FromSoroban,
  g1ToSoroban,
  g2FromSoroban,
  g2ToSoroban,
  G1Point,
  G2Point,
  limbsToAddress,
  nobleUncompressedCleared,
  randomFr,
  toBytesBE,
  FR_ORDER,
} from "@umbra/crypto-bls";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Deterministic non-trivial scalars for sampling curve points. */
const SCALARS = [1n, 2n, 3n, 7n, 0xdeadbeefn, 0x1234_5678_9abc_def0n];

export const b02EncodingRoundtrip: Benchmark = {
  id: "B02",
  title: "snarkjs ↔ Soroban serialization round-trip (G1/G2/Fr/address-limbs)",
  objective: "2-soroban-verification",
  purpose:
    "Validate the byte encodings the Soroban verifier and circuits depend on: 96-byte G1, " +
    "192-byte G2 (uncompressed big-endian), 32-byte Fr scalars, and the 2×128-bit address-limb " +
    "split. A silent encoding mismatch makes every on-chain verification fail (FEASIBILITY §1/§2).",
  successCriteria:
    "Every point/scalar/address round-trips to an equal value; G1 (and G2) bytes match " +
    "@noble/curves' uncompressed encoding with flag bits cleared (the IETF/host layout); each " +
    "address limb < 2^128 < r.",
  failureCriteria:
    "Any round-trip inequality; G1 layout disagrees with noble; a limb ≥ field modulus.",
  measurementMethod:
    "Encode→decode N curve points and scalars and compare; cross-check raw-coordinate bytes " +
    "against @noble's serialization; split/rejoin random 32-byte addresses.",
  outputFormat: "Booleans per structure + sample byte lengths; mismatches reported with detail.",
  requires: ["node"],

  async run(): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const notes: string[] = [];

    // ---- G1 ----
    let g1RoundtripOk = true;
    let g1MatchesNoble = true;
    for (const k of SCALARS) {
      const P = G1Point.BASE.multiply(k);
      const bytes = g1ToSoroban(P);
      if (bytes.length !== 96) g1RoundtripOk = false;
      const back = g1FromSoroban(bytes);
      if (!back.equals(P)) g1RoundtripOk = false;
      if (!bytesEqual(bytes, nobleUncompressedCleared(P))) g1MatchesNoble = false;
    }
    measurements.push({ name: "g1_roundtrip", value: g1RoundtripOk, threshold: "true" });
    measurements.push({ name: "g1_bytes", value: 96, unit: "bytes" });
    measurements.push({ name: "g1_matches_noble_uncompressed", value: g1MatchesNoble, threshold: "true" });

    // ---- G2 ----
    let g2RoundtripOk = true;
    let g2MatchesNoble = true;
    for (const k of SCALARS) {
      const P = G2Point.BASE.multiply(k);
      const bytes = g2ToSoroban(P);
      if (bytes.length !== 192) g2RoundtripOk = false;
      const back = g2FromSoroban(bytes);
      if (!back.equals(P)) g2RoundtripOk = false;
      if (!bytesEqual(bytes, nobleUncompressedCleared(P))) g2MatchesNoble = false;
    }
    measurements.push({ name: "g2_roundtrip", value: g2RoundtripOk, threshold: "true" });
    measurements.push({ name: "g2_bytes", value: 192, unit: "bytes" });
    measurements.push({ name: "g2_matches_noble_uncompressed", value: g2MatchesNoble, threshold: "true" });
    if (!g2MatchesNoble) {
      notes.push(
        "G2 byte layout disagrees with @noble's uncompressed encoding — the Fp2 (c0/c1) coordinate " +
          "order likely needs flipping in point-encoding.ts. Round-trip still self-consistent; the " +
          "host layout is the ground truth and is confirmed by B04 on testnet.",
      );
    }

    // ---- Fr scalars ----
    let frRoundtripOk = true;
    for (let i = 0; i < 64; i++) {
      const x = randomFr();
      const bytes = toBytesBE(x);
      if (bytes.length !== 32) frRoundtripOk = false;
      if (fromBytesBE(bytes) !== x) frRoundtripOk = false;
    }
    measurements.push({ name: "fr_scalar_roundtrip", value: frRoundtripOk, threshold: "true" });
    measurements.push({ name: "fr_bytes", value: 32, unit: "bytes" });

    // ---- Address limbs (32-byte address ↔ 2×128-bit Fr limbs) ----
    let addrRoundtripOk = true;
    let limbsInRange = true;
    const TWO_128 = 1n << 128n;
    for (let i = 0; i < 64; i++) {
      const addr = new Uint8Array(32);
      for (let j = 0; j < 32; j++) addr[j] = (i * 31 + j * 7 + 13) & 0xff;
      const limbs = addressToLimbs(addr);
      if (limbs.hi >= TWO_128 || limbs.lo >= TWO_128 || limbs.hi >= FR_ORDER || limbs.lo >= FR_ORDER) {
        limbsInRange = false;
      }
      if (!bytesEqual(limbsToAddress(limbs), addr)) addrRoundtripOk = false;
    }
    measurements.push({ name: "address_limb_roundtrip", value: addrRoundtripOk, threshold: "true" });
    measurements.push({ name: "limbs_below_2^128_and_r", value: limbsInRange, threshold: "true" });

    notes.push(
      "Round-trip self-consistency is proven here in Node; the canonical confirmation that these " +
        "exact bytes are accepted by the live host is B04 (gated on stellar-cli + testnet).",
    );

    const pass =
      g1RoundtripOk &&
      g1MatchesNoble &&
      g2RoundtripOk &&
      g2MatchesNoble &&
      frRoundtripOk &&
      addrRoundtripOk &&
      limbsInRange;

    return { status: pass ? "PASS" : "FAIL", measurements, notes };
  },
};
