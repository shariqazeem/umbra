import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Benchmark, BenchmarkContext, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import { sample, stats } from "@umbra/bench-harness";

const PROVE_SAMPLES = 5;

/** Locate the membership circuit artifacts; fall back to the tiny hash circuit. */
function pickCircuit(rootDir: string): { name: string; wasm: string; zkey: string; vkey: string; input: string } | null {
  const build = join(rootDir, "circuits", "build");
  for (const name of ["bench_membership", "bench_hash"]) {
    const wasm = join(build, `${name}_js`, `${name}.wasm`);
    const zkey = join(build, `${name}_final.zkey`);
    const vkey = join(build, `${name}_vkey.json`);
    const input = join(build, `${name}_input.json`);
    if (existsSync(wasm) && existsSync(zkey) && existsSync(vkey) && existsSync(input)) {
      return { name, wasm, zkey, vkey, input };
    }
  }
  return null;
}

export const b03ProofGeneration: Benchmark = {
  id: "B03",
  title: "Groth16/BLS12-381 proof generation end-to-end (Circom + snarkjs)",
  objective: "1-proof-generation",
  purpose:
    "Verify a real Groth16 proof can be generated over BLS12-381 from a Circom circuit and " +
    "verified off-chain, and measure proving latency (the desktop-only constraint from " +
    "FEASIBILITY_REVIEW.md §5). Establishes the proof/vk used by B02/B04.",
  successCriteria:
    "fullProve produces a proof that snarkjs.verify accepts; the proving curve is BLS12-381; " +
    "median proving latency is within the desktop budget (< 10s for the membership circuit).",
  failureCriteria:
    "Proof fails verification; curve != bls12381; proving errors or exceeds the latency budget.",
  measurementMethod:
    `snarkjs.groth16.fullProve over ${PROVE_SAMPLES} samples (witness+prove timed), then ` +
    "snarkjs.groth16.verify; curve read from the verification key.",
  outputFormat: "Latency stats (median/p95/min/max ms), verify result, curve, proof byte size.",
  requires: ["circuit-artifacts", "snarkjs"],

  async run(ctx: BenchmarkContext): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const notes: string[] = [];

    const circuit = pickCircuit(ctx.rootDir);
    if (!circuit) {
      return {
        status: "FAIL",
        measurements,
        notes: ["circuit-artifacts capability reported available but artifacts/input not found; rerun circuits/scripts/run-all.sh"],
      };
    }
    notes.push(`Circuit under test: ${circuit.name}`);

    // snarkjs is an ESM/CJS hybrid; import dynamically (optional dependency).
    const snarkjs = await import("snarkjs");
    const vkey = JSON.parse(readFileSync(circuit.vkey, "utf8")) as { curve?: string };
    const input = JSON.parse(readFileSync(circuit.input, "utf8")) as Record<string, unknown>;

    const curve = (vkey.curve ?? "unknown").toLowerCase();
    const curveOk = curve.includes("bls12381") || curve.includes("bls12-381");
    measurements.push({ name: "proving_curve", value: curve, threshold: "bls12381" });

    let lastProof: unknown = null;
    let lastPublic: unknown = null;
    const latencies = await sample(PROVE_SAMPLES, async () => {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, circuit.wasm, circuit.zkey);
      lastProof = proof;
      lastPublic = publicSignals;
    });

    const verified = await snarkjs.groth16.verify(vkey, lastPublic as string[], lastProof as object);
    const proofBytes = Buffer.byteLength(JSON.stringify(lastProof));
    const s = stats(latencies);

    measurements.push({ name: "prove_median", value: Math.round(s.median), unit: "ms", threshold: "< 10000" });
    measurements.push({ name: "prove_p95", value: Math.round(s.p95), unit: "ms" });
    measurements.push({ name: "prove_min", value: Math.round(s.min), unit: "ms" });
    measurements.push({ name: "prove_max", value: Math.round(s.max), unit: "ms" });
    measurements.push({ name: "verify_offchain", value: verified, threshold: "true" });
    measurements.push({ name: "proof_size", value: proofBytes, unit: "bytes (json)" });

    const latencyOk = s.median < 10_000;
    const pass = curveOk && verified && latencyOk;
    if (!curveOk) notes.push("Proving curve is not BLS12-381 — the Soroban host cannot verify this proof.");
    if (!latencyOk) notes.push("Proving exceeds the 10s desktop budget; circuit likely too large or rapidsnark not in use.");

    return {
      status: pass ? "PASS" : "FAIL",
      measurements,
      notes,
      evidence: { circuit: circuit.name, vkeyPath: circuit.vkey, sizeOfZkeyBytes: statSync(circuit.zkey).size },
    };
  },
};
