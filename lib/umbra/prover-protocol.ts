// Message protocol shared by the proving Web Worker (prover.worker.ts) and the
// useProver hook. Kept in its own module so both sides import the same types
// without the hook pulling in the worker bundle.
import type { Groth16ProofJson, ProverVariant } from "./prover";

export type { ProverVariant };

export type ProverStage = "idle" | "loading-key" | "proving" | "done" | "error";

/** Main thread → worker. */
export interface ProverRequest {
  kind: "prove";
  id: number;
  variant: ProverVariant;
  input: Record<string, unknown>;
}

export interface ProverTimings {
  keyLoadMs: number;
  proveMs: number;
  totalMs: number;
  /** true when the artifact bytes were already cached in the worker (warm run). */
  cached: boolean;
}

/** Worker → main thread. */
export interface ProverProgressMsg {
  kind: "progress";
  id: number;
  stage: Extract<ProverStage, "loading-key" | "proving">;
  elapsedMs: number;
  loadedBytes?: number;
  totalBytes?: number;
}

export interface ProverDoneMsg {
  kind: "done";
  id: number;
  proof: Groth16ProofJson;
  timings: ProverTimings;
}

export interface ProverErrorMsg {
  kind: "error";
  id: number;
  message: string;
}

export type ProverWorkerMessage = ProverProgressMsg | ProverDoneMsg | ProverErrorMsg;

/** Human-facing copy for each stage — the "crypto moment" readout. */
export const STAGE_LABEL: Record<ProverStage, string> = {
  idle: "Ready",
  "loading-key": "Loading proving key…",
  proving: "Generating zero-knowledge proof…",
  done: "Constraints satisfied ✓",
  error: "Proof failed",
};
