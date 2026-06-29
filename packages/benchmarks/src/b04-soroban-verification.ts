import { join } from "node:path";
import type { Benchmark, BenchmarkContext, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import { lastJson, run } from "./_exec.js";

interface VerifyResult {
  verified: boolean;
  contractId?: string;
  txHash?: string;
  error?: string;
}

export const b04SorobanVerification: Benchmark = {
  id: "B04",
  title: "Groth16/BLS12-381 verification inside a Soroban contract (testnet)",
  objective: "2-soroban-verification",
  purpose:
    "The load-bearing claim of the whole project (and the hackathon track requirement): a real " +
    "Groth16 proof verifies INSIDE a Soroban contract on testnet, using the CAP-0059 BLS12-381 " +
    "host functions. This is ground truth for B02's encoding and B03's proof.",
  successCriteria:
    "The deployed verifier returns true for a valid proof AND false for a tampered proof " +
    "(soundness sanity), with no host error (correct serialization, in-subgroup points).",
  failureCriteria:
    "Host error (bad encoding / off-curve), verifier returns false for a valid proof, or returns " +
    "true for a tampered proof.",
  measurementMethod:
    "infra/deploy/run-verification.sh deploys (or reuses) the groth16-verifier contract and " +
    "invokes `verify` with the artifacts from circuits/build, then again with a corrupted proof; " +
    "the script prints a JSON result line consumed here.",
  outputFormat: "verified (valid proof), rejected (tampered proof), contract id, tx hash.",
  requires: ["stellar-cli", "testnet", "circuit-artifacts"],

  async run(ctx: BenchmarkContext): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const script = join(ctx.rootDir, "infra", "deploy", "run-verification.sh");

    // Valid proof.
    const ok = await run("bash", [script, "--valid"], { cwd: ctx.rootDir, timeoutMs: 300_000 });
    const okJson = lastJson<VerifyResult>(ok.stdout);
    // Tampered proof (soundness sanity).
    const bad = await run("bash", [script, "--tampered"], { cwd: ctx.rootDir, timeoutMs: 300_000 });
    const badJson = lastJson<VerifyResult>(bad.stdout);

    if (!okJson || !badJson) {
      return {
        status: "ERROR",
        measurements,
        notes: [
          "run-verification.sh did not emit a parseable JSON result.",
          `valid stderr: ${ok.stderr.slice(-400)}`,
          `tampered stderr: ${bad.stderr.slice(-400)}`,
        ],
      };
    }

    const validAccepted = okJson.verified === true;
    const tamperedRejected = badJson.verified === false;
    measurements.push({ name: "valid_proof_accepted", value: validAccepted, threshold: "true" });
    measurements.push({ name: "tampered_proof_rejected", value: tamperedRejected, threshold: "true" });
    if (okJson.contractId) measurements.push({ name: "verifier_contract", value: okJson.contractId });
    if (okJson.txHash) measurements.push({ name: "verify_tx", value: okJson.txHash });

    const pass = validAccepted && tamperedRejected;
    return {
      status: pass ? "PASS" : "FAIL",
      measurements,
      notes: pass
        ? ["On-chain BLS12-381 Groth16 verification confirmed on testnet — the core thesis holds."]
        : ["On-chain verification did not behave as required; inspect the contract id / tx on the explorer."],
      evidence: { valid: okJson, tampered: badJson },
    };
  },
};
