/**
 * The Umbra Poseidon parameter set over BLS12-381 Fr.
 *
 * Round constants come from the Grain LFSR (see grain.ts). The MDS matrix is a
 * Cauchy matrix over Fr, which is provably MDS (every square submatrix is
 * invertible) — the diffusion requirement Poseidon places on the linear layer.
 *
 * These parameters are DEFINED here (not copied from circomlib, whose constants
 * are BN254-specific and would be silently insecure over BLS12-381 — see
 * FEASIBILITY_REVIEW.md §2). The Circom circuit consumes the exact same values via
 * `scripts/gen-constants.ts`, so circom and TS agree by construction.
 */
import { GrainLFSR } from "./grain.js";
import { FR_BITS, FR_ORDER, fr, inv } from "./field.js";

export interface PoseidonParams {
  /** State width (= number of inputs + 1 capacity element). */
  readonly t: number;
  /** Full rounds. */
  readonly rf: number;
  /** Partial rounds. */
  readonly rp: number;
  /** Flat round-constant array, length t*(rf+rp). */
  readonly c: bigint[];
  /** t×t MDS matrix. */
  readonly m: bigint[][];
  /** Bit length used for rejection sampling (= FR_BITS). */
  readonly bitLen: number;
}

/**
 * Partial-round counts for 128-bit security with the x^5 S-box, by state width.
 * Conservative, widely-cited values; the exact figure is not load-bearing for the
 * harness (all three implementations consume the same set), but is documented so
 * the parameter set is fully specified and reproducible.
 */
const RP_BY_T: Record<number, number> = { 2: 56, 3: 57, 4: 56, 5: 60, 6: 60 };
const RF = 8;

function cauchyMDS(t: number): bigint[][] {
  // x_i = i, y_j = t + j  →  all x_i + y_j distinct and nonzero ⇒ Cauchy ⇒ MDS.
  const m: bigint[][] = [];
  for (let i = 0; i < t; i++) {
    const row: bigint[] = [];
    for (let j = 0; j < t; j++) {
      row.push(inv(fr(BigInt(i) + BigInt(t + j))));
    }
    m.push(row);
  }
  return m;
}

/** Deterministically generate the parameter set for a given state width `t`. */
export function generateParams(t: number, rf = RF, rp = RP_BY_T[t] ?? 57): PoseidonParams {
  const grain = new GrainLFSR(FR_BITS, t, rf, rp);
  const rounds = rf + rp;
  const c: bigint[] = [];
  for (let i = 0; i < t * rounds; i++) c.push(grain.nextFieldElement(FR_ORDER, FR_BITS));
  return { t, rf, rp, c, m: cauchyMDS(t), bitLen: FR_BITS };
}

// Memoized parameter sets keyed by state width.
const cache = new Map<number, PoseidonParams>();

/** Parameter set for state width `t` (memoized). */
export function paramsForT(t: number): PoseidonParams {
  let p = cache.get(t);
  if (!p) {
    p = generateParams(t);
    cache.set(t, p);
  }
  return p;
}
