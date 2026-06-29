import type { Benchmark, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import {
  FR_BITS,
  FR_ORDER,
  generateParams,
  isInField,
  poseidon,
  poseidon2,
} from "@umbra/crypto-bls";

/** The canonical BLS12-381 scalar field modulus, as a hard reference constant. */
const EXPECTED_FR =
  0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

/** Count differing bits between two field elements (over a 255-bit window). */
function bitDiff(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x > 0n) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

export const b01PoseidonConfig: Benchmark = {
  id: "B01",
  title: "Poseidon over BLS12-381 Fr — configuration validity",
  objective: "5-poseidon-config",
  purpose:
    "Prove the Umbra Poseidon parameter set is instantiated over the correct field " +
    "(BLS12-381 Fr, not BN254), is deterministic/reproducible, and provides sound " +
    "diffusion. This is the silent-failure risk flagged in FEASIBILITY_REVIEW.md §2.",
  successCriteria:
    "FR modulus == canonical BLS12-381 r; FR_BITS == 255; all round constants and MDS " +
    "entries ∈ Fr; param generation is deterministic; Poseidon is deterministic; a 1-bit " +
    "input change diffuses to ≥96 of 255 output bits.",
  failureCriteria:
    "Wrong/edited modulus; 254-bit width (BN254 leak); any constant ∉ Fr; non-deterministic " +
    "generation or hashing; weak diffusion (<96 bits changed).",
  measurementMethod:
    "Direct constant comparison; regenerate params twice and compare; hash fixed inputs " +
    "twice; compute avalanche over 64 single-bit input perturbations.",
  outputFormat: "Booleans + bit-diffusion statistics, plus canonical vectors emitted as evidence.",
  requires: ["node"],

  async run(): Promise<BenchmarkOutcome> {
    const notes: string[] = [];
    const measurements: Measurement[] = [];

    // 1. Field identity.
    const modulusOk = FR_ORDER === EXPECTED_FR;
    const widthOk = FR_BITS === 255;
    measurements.push({ name: "fr_modulus_matches_bls12_381", value: modulusOk, threshold: "true" });
    measurements.push({ name: "fr_bit_width", value: FR_BITS, unit: "bits", threshold: "255" });

    // 2. Constants in-field + deterministic generation (t = 3, the Merkle node width).
    const p1 = generateParams(3);
    const p2 = generateParams(3);
    const constantsInField = p1.c.every(isInField);
    const mdsInField = p1.m.every((row) => row.every((v) => isInField(v) && v !== 0n));
    const deterministicParams =
      p1.c.length === p2.c.length &&
      p1.c.every((v, i) => v === p2.c[i]) &&
      p1.m.every((row, i) => row.every((v, j) => v === p2.m[i]![j]));
    measurements.push({ name: "round_constants", value: p1.c.length, unit: "count" });
    measurements.push({ name: "all_constants_in_field", value: constantsInField, threshold: "true" });
    measurements.push({ name: "mds_entries_in_field_nonzero", value: mdsInField, threshold: "true" });
    measurements.push({ name: "param_generation_deterministic", value: deterministicParams, threshold: "true" });

    // 3. Hash determinism.
    const a = 1234567890123456789n;
    const b = 9876543210987654321n;
    const h1 = poseidon2(a, b);
    const h2 = poseidon2(a, b);
    const hashDeterministic = h1 === h2;
    const hashInField = isInField(h1) && h1 !== 0n;
    measurements.push({ name: "hash_deterministic", value: hashDeterministic, threshold: "true" });
    measurements.push({ name: "hash_in_field_nonzero", value: hashInField, threshold: "true" });

    // 4. Avalanche: flip each of 64 low bits of input `a`, measure output diffusion.
    const base = poseidon2(a, b);
    const diffs: number[] = [];
    for (let bit = 0; bit < 64; bit++) {
      const perturbed = poseidon2(a ^ (1n << BigInt(bit)), b);
      diffs.push(bitDiff(base, perturbed));
    }
    const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const minDiff = Math.min(...diffs);
    const diffusionOk = minDiff >= 96; // each single-bit flip must change ≥96/255 output bits
    measurements.push({ name: "avalanche_avg_bits_changed", value: Number(avgDiff.toFixed(1)), unit: "of 255" });
    measurements.push({ name: "avalanche_min_bits_changed", value: minDiff, unit: "of 255", threshold: "≥96" });

    // Canonical vectors → committed as the regression baseline for circom cross-check (B03/CI).
    const vectors = {
      "poseidon2(1,2)": "0x" + poseidon([1n, 2n]).toString(16),
      "poseidon2(0,0)": "0x" + poseidon([0n, 0n]).toString(16),
      "poseidon3(1,2,3)": "0x" + poseidon([1n, 2n, 3n]).toString(16),
      "poseidon1(42)": "0x" + poseidon([42n]).toString(16),
    };
    notes.push(
      "Canonical Poseidon vectors emitted as evidence; these are the regression baseline the " +
        "Circom witness must reproduce in the cross-impl gate (requires the circom toolchain).",
    );
    notes.push("Note: the contract performs NO Poseidon on-chain (K3), so no Rust Poseidon corner is needed.");

    const pass =
      modulusOk &&
      widthOk &&
      constantsInField &&
      mdsInField &&
      deterministicParams &&
      hashDeterministic &&
      hashInField &&
      diffusionOk;

    return {
      status: pass ? "PASS" : "FAIL",
      measurements,
      notes,
      evidence: { canonicalVectors: vectors, t3_rounds: { rf: p1.rf, rp: p1.rp }, avalancheDiffs: diffs },
    };
  },
};
