/**
 * Grain LFSR — the standard deterministic source for Poseidon round constants
 * (Grassi–Khovratovich–Rechberger–Roy–Schofnegger, "Poseidon", §5 /
 * `generate_parameters_grain.sage`).
 *
 * We use it to derive the Umbra Poseidon parameter set over BLS12-381 Fr. The
 * generator is fully deterministic in (field-bits, t, R_F, R_P), so the SAME
 * constants are produced by the TypeScript wallet code and exported, verbatim,
 * to the Circom circuit (generate-once / consume-everywhere). Cross-implementation
 * agreement is then a property of construction, not of two generators coinciding.
 */

/** An 80-bit Grain LFSR with the Poseidon-specified feedback taps and output rule. */
export class GrainLFSR {
  private readonly state: number[]; // 80 bits; index 0 = oldest (next to feed back)

  constructor(fieldBits: number, t: number, rf: number, rp: number) {
    const bits: number[] = [];
    const push = (value: number, width: number) => {
      for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
    };
    push(1, 2); // field: 1 = prime field GF(p)
    push(0, 4); // s-box: 0 = exponentiation x^alpha
    push(fieldBits, 12); // n = bit length of p
    push(t, 12); // state width
    push(rf, 10); // full rounds
    push(rp, 10); // partial rounds
    while (bits.length < 80) bits.push(1); // pad remaining with 1s
    this.state = bits.slice(0, 80);
    // Warm-up: 160 clocks, output discarded.
    for (let i = 0; i < 160; i++) this.clock();
  }

  /** One LFSR step: compute feedback, shift, append; return the new bit. */
  private clock(): number {
    const s = this.state;
    const fb = s[0]! ^ s[13]! ^ s[23]! ^ s[38]! ^ s[51]! ^ s[62]!;
    s.shift();
    s.push(fb);
    return fb;
  }

  /** Filtered output bit: take a bit only when the preceding clock emitted a 1. */
  private outputBit(): number {
    for (;;) {
      const b1 = this.clock();
      const b2 = this.clock();
      if (b1 === 1) return b2;
      // b1 === 0: discard b2 and continue.
    }
  }

  /**
   * Next field element by rejection sampling: read `bitLen` filtered bits to form a
   * candidate; accept iff it is strictly less than the modulus `p`, else resample.
   */
  nextFieldElement(p: bigint, bitLen: number): bigint {
    for (;;) {
      let v = 0n;
      for (let i = 0; i < bitLen; i++) v = (v << 1n) | BigInt(this.outputBit());
      if (v < p) return v;
    }
  }
}
