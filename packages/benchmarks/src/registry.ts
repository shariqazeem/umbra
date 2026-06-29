import type { Benchmark } from "@umbra/bench-harness";
import { b01PoseidonConfig } from "./b01-poseidon-config.js";
import { b02EncodingRoundtrip } from "./b02-encoding-roundtrip.js";
import { b03ProofGeneration } from "./b03-proof-generation.js";
import { b04SorobanVerification } from "./b04-soroban-verification.js";
import { b05InstructionBudget } from "./b05-instruction-budget.js";
import { b06ResourceUsage } from "./b06-resource-usage.js";
import { b07NullifierStorage } from "./b07-nullifier-storage.js";
import { b08ReplayProtection } from "./b08-replay-protection.js";

/** All Phase-0 benchmarks, in execution order (cheap/local first, network last). */
export const BENCHMARKS: Benchmark[] = [
  b01PoseidonConfig,
  b02EncodingRoundtrip,
  b03ProofGeneration,
  b04SorobanVerification,
  b05InstructionBudget,
  b06ResourceUsage,
  b07NullifierStorage,
  b08ReplayProtection,
];
