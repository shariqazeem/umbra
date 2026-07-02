// Browser-side Groth16 proving (snarkjs over BLS12-381). The withdraw witness
// carries the spending secret, so proving MUST happen here, in the user's browser,
// never on a server (FEASIBILITY_REVIEW.md §5). Artifacts are fetched from /public.
import type { ShieldInput, TransferInput, WithdrawInput } from "@umbra/wallet-core";
import { UMBRA_CONFIG } from "./config";

export interface Groth16ProofJson {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[];
}

async function prove(
  input: Record<string, unknown>,
  wasmUrl: string,
  zkeyUrl: string,
): Promise<Groth16ProofJson> {
  const snarkjs = await import("snarkjs");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmUrl, zkeyUrl);
  return { proof: proof as Groth16ProofJson["proof"], publicSignals };
}

export function proveShield(input: ShieldInput): Promise<Groth16ProofJson> {
  return prove(input as unknown as Record<string, unknown>, UMBRA_CONFIG.shieldWasmUrl, UMBRA_CONFIG.shieldZkeyUrl);
}

export function proveWithdraw(input: WithdrawInput): Promise<Groth16ProofJson> {
  return prove(input as unknown as Record<string, unknown>, UMBRA_CONFIG.withdrawWasmUrl, UMBRA_CONFIG.withdrawZkeyUrl);
}

export function proveTransfer(input: TransferInput): Promise<Groth16ProofJson> {
  return prove(input as unknown as Record<string, unknown>, UMBRA_CONFIG.transferWasmUrl, UMBRA_CONFIG.transferZkeyUrl);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Off-thread proving seam (ADDITIVE — the proving math above is unchanged).
 *
 * The Web Worker (lib/umbra/prover.worker.ts) lazy-loads the circuit artifacts
 * and calls `proveWithArtifacts`, which runs the SAME snarkjs.groth16.fullProve
 * with the SAME inputs / witness / outputs as `prove`. The only difference is
 * that the wasm + zkey may arrive as already-fetched bytes instead of URLs —
 * snarkjs/fastfile accepts either, so the proof is byte-for-byte identical.
 * `prove` / `proveShield` / `proveWithdraw` stay as the untouched reference path.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ProverVariant = "shield" | "withdraw" | "transfer" | "claim";

export const PROVER_ARTIFACTS: Record<ProverVariant, { wasmUrl: string; zkeyUrl: string }> = {
  shield: { wasmUrl: UMBRA_CONFIG.shieldWasmUrl, zkeyUrl: UMBRA_CONFIG.shieldZkeyUrl },
  withdraw: { wasmUrl: UMBRA_CONFIG.withdrawWasmUrl, zkeyUrl: UMBRA_CONFIG.withdrawZkeyUrl },
  transfer: { wasmUrl: UMBRA_CONFIG.transferWasmUrl, zkeyUrl: UMBRA_CONFIG.transferZkeyUrl },
  claim: { wasmUrl: UMBRA_CONFIG.claimWasmUrl, zkeyUrl: UMBRA_CONFIG.claimZkeyUrl },
};

/**
 * Identical proof to `prove`, but the wasm/zkey may be passed as pre-fetched
 * bytes (Uint8Array). The worker uses this so the 3.9 MB withdraw zkey loads
 * once, with progress, off the main thread. Same circuit, inputs, witness, output.
 */
export async function proveWithArtifacts(
  input: Record<string, unknown>,
  wasm: string | Uint8Array,
  zkey: string | Uint8Array,
): Promise<Groth16ProofJson> {
  const snarkjs = await import("snarkjs");
  // snarkjs/fastfile accepts a URL string OR pre-fetched bytes for wasm/zkey; the
  // ambient typing (shared with the frozen benchmarks package) only spells the
  // string form, so widen the call signature locally. Same runtime behavior.
  const fullProve = snarkjs.groth16.fullProve as unknown as (
    input: Record<string, unknown>,
    wasm: string | Uint8Array,
    zkey: string | Uint8Array,
  ) => Promise<{ proof: unknown; publicSignals: string[] }>;
  const { proof, publicSignals } = await fullProve(input, wasm, zkey);
  return { proof: proof as Groth16ProofJson["proof"], publicSignals };
}

/**
 * Path A (video recording): fetch a pre-generated proof shipped at
 * /circuits/<variant>_demo_proof.json. Returns null when absent so callers fall
 * back to live proving. Never throws.
 */
export async function loadDemoProof(variant: ProverVariant): Promise<Groth16ProofJson | null> {
  try {
    const res = await fetch(`/circuits/${variant}_demo_proof.json`, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as Groth16ProofJson;
  } catch {
    return null;
  }
}
