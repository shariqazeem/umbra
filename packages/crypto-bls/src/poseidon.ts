/**
 * Poseidon hash over BLS12-381 Fr (canonical, unoptimized formulation).
 *
 * Hash convention matches circomlib's `Poseidon(nInputs)`: the state is
 * [0, in_0, …, in_{t-2}] (a zero capacity element first), the permutation is
 * applied, and state[0] is returned. The S-box is x^5; full rounds S-box the whole
 * state, partial rounds S-box only state[0]; the linear layer is the MDS matrix.
 */
import { add, fr, mul, pow5 } from "./field.js";
import { paramsForT, type PoseidonParams } from "./poseidon-params.js";

/** Apply the full Poseidon permutation to a state vector of length `t`. */
export function poseidonPermute(state: bigint[], p: PoseidonParams): bigint[] {
  if (state.length !== p.t) throw new Error(`state must have length t=${p.t}`);
  const { t, rf, rp, c, m } = p;
  const rounds = rf + rp;
  let s = state.map(fr);

  for (let r = 0; r < rounds; r++) {
    // Add round constants.
    for (let i = 0; i < t; i++) s[i] = add(s[i]!, c[r * t + i]!);
    // S-box: full rounds hit every lane; partial rounds hit only lane 0.
    const isFull = r < rf / 2 || r >= rf / 2 + rp;
    if (isFull) {
      for (let i = 0; i < t; i++) s[i] = pow5(s[i]!);
    } else {
      s[0] = pow5(s[0]!);
    }
    // Mix with the MDS matrix.
    const next = new Array<bigint>(t).fill(0n);
    for (let i = 0; i < t; i++) {
      let acc = 0n;
      for (let j = 0; j < t; j++) acc = add(acc, mul(m[i]![j]!, s[j]!));
      next[i] = acc;
    }
    s = next;
  }
  return s;
}

/** Poseidon hash of `inputs` (1 ≤ inputs.length ≤ 5). Returns an Fr element. */
export function poseidon(inputs: bigint[]): bigint {
  if (inputs.length < 1) throw new Error("poseidon needs at least one input");
  const t = inputs.length + 1;
  const p = paramsForT(t);
  const state = [0n, ...inputs.map(fr)];
  return poseidonPermute(state, p)[0]!;
}

/** 2-to-1 Poseidon compression (state width t=3) — the Merkle node hash. */
export const poseidon2 = (a: bigint, b: bigint): bigint => poseidon([a, b]);
