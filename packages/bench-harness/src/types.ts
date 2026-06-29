/**
 * Core contracts for the Umbra benchmark harness.
 *
 * A Benchmark is a self-describing unit of technical uncertainty reduction. Every
 * benchmark MUST declare — in machine-readable form — its purpose, success and
 * failure criteria, measurement method, and output format, so the emitted report
 * is auditable without reading the implementation.
 */

/** Capabilities a benchmark may require from the host environment. */
export type Capability =
  | "node" // always available; pure JS/TS, runs anywhere
  | "circom" // the `circom` compiler binary on PATH
  | "snarkjs" // the snarkjs library (installed as a dependency)
  | "circuit-artifacts" // compiled .wasm + .zkey + vkey present under circuits/build
  | "cargo" // Rust `cargo` on PATH (native Soroban contract tests)
  | "stellar-cli" // the `stellar` CLI on PATH (deploy/invoke on testnet)
  | "testnet"; // testnet RPC + a funded source key configured via env

/** Terminal status of a benchmark run. */
export type Status = "PASS" | "FAIL" | "SKIP" | "ERROR";

/** Which Phase-0 objective a benchmark validates (1..8 from the task brief). */
export type Objective =
  | "1-proof-generation"
  | "2-soroban-verification"
  | "3-instruction-consumption"
  | "4-transaction-resources"
  | "5-poseidon-config"
  | "6-nullifier-storage"
  | "7-replay-protection"
  | "8-reproducibility";

/** A single measured quantity. The unit makes the number self-documenting. */
export interface Measurement {
  readonly name: string;
  readonly value: number | string | boolean;
  readonly unit?: string;
  /** Optional threshold this measurement was judged against, for the report. */
  readonly threshold?: string;
}

/** What a benchmark's `run` returns. The benchmark judges its own PASS/FAIL. */
export interface BenchmarkOutcome {
  readonly status: Exclude<Status, "SKIP">;
  readonly measurements: Measurement[];
  /** Raw structured evidence persisted to the JSON report for reproducibility. */
  readonly evidence?: Record<string, unknown>;
  /** Human-readable observations (caveats, what the number means). */
  readonly notes?: string[];
}

/** Detection result for a single capability. */
export interface CapabilityStatus {
  readonly capability: Capability;
  readonly available: boolean;
  /** What was detected (e.g. a version string) or why it is missing. */
  readonly detail: string;
  /** Exact command/step a developer runs to enable this capability. */
  readonly enableHint: string;
}

export interface EnvReport {
  readonly capabilities: Record<Capability, CapabilityStatus>;
  readonly platform: string;
  readonly nodeVersion: string;
  /** ISO timestamp captured at detection time (passed in; never Date.now in pure code). */
  readonly detectedAt: string;
}

/** Context handed to every benchmark. */
export interface BenchmarkContext {
  readonly env: EnvReport;
  readonly rootDir: string; // repo root (absolute)
  readonly resultsDir: string; // where artifacts/results are written
  readonly runId: string; // stable id for this invocation
}

/** The full, self-describing benchmark definition. */
export interface Benchmark {
  readonly id: string; // e.g. "B01"
  readonly title: string;
  readonly objective: Objective;
  readonly purpose: string;
  readonly successCriteria: string;
  readonly failureCriteria: string;
  readonly measurementMethod: string;
  readonly outputFormat: string;
  readonly requires: Capability[];
  run(ctx: BenchmarkContext): Promise<BenchmarkOutcome>;
}

/** The recorded result of attempting a benchmark (run, skipped, or errored). */
export interface BenchmarkResult {
  readonly id: string;
  readonly title: string;
  readonly objective: Objective;
  readonly status: Status;
  readonly durationMs: number;
  readonly measurements: Measurement[];
  readonly notes: string[];
  readonly evidence?: Record<string, unknown>;
  /** Present when status === "SKIP": which capabilities were missing + hints. */
  readonly skipped?: { missing: Capability[]; hints: string[] };
  /** Present when status === "ERROR": the captured error message + stack. */
  readonly error?: { message: string; stack?: string };
  /** Echoed criteria so the report is auditable standalone. */
  readonly criteria: {
    purpose: string;
    successCriteria: string;
    failureCriteria: string;
    measurementMethod: string;
    outputFormat: string;
  };
}

export interface BenchmarkRunReport {
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly env: EnvReport;
  readonly results: BenchmarkResult[];
  readonly summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errored: number;
    /** Process exit code: non-zero iff any FAIL or ERROR. SKIP never fails CI. */
    exitCode: number;
  };
}
