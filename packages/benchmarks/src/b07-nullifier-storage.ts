import { join } from "node:path";
import type { Benchmark, BenchmarkContext, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import { run } from "./_exec.js";

/** Parse `cargo test` summary lines for the passed/failed counts. */
function parseCargo(stdout: string): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const m of stdout.matchAll(/test result: \w+\. (\d+) passed; (\d+) failed/g)) {
    passed += Number(m[1]);
    failed += Number(m[2]);
  }
  return { passed, failed };
}

export const b07NullifierStorage: Benchmark = {
  id: "B07",
  title: "Nullifier storage behavior (Soroban persistent entries)",
  objective: "6-nullifier-storage",
  purpose:
    "Validate the spent-nullifier set: an inserted nullifier is observed as spent; an absent one " +
    "is not; insertion is idempotent in effect and double-insert is rejected. Runs against the " +
    "Soroban test host natively (no testnet needed), exercising the real storage semantics.",
  successCriteria: "All `nullifier` unit tests in the bench-pool contract pass (0 failures).",
  failureCriteria: "Any nullifier-storage test fails, or the contract fails to build natively.",
  measurementMethod:
    "`cargo test -p bench-pool nullifier` against the soroban-sdk test environment; pass/fail from " +
    "the cargo summary and exit code.",
  outputFormat: "tests passed / failed counts and the cargo exit code.",
  requires: ["cargo"],

  async run(ctx: BenchmarkContext): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const contractsDir = join(ctx.rootDir, "contracts");
    const res = await run("cargo", ["test", "-p", "bench-pool", "nullifier", "--", "--nocapture"], {
      cwd: contractsDir,
      timeoutMs: 600_000,
    });
    const { passed, failed } = parseCargo(res.stdout + res.stderr);
    measurements.push({ name: "tests_passed", value: passed });
    measurements.push({ name: "tests_failed", value: failed, threshold: "0" });
    measurements.push({ name: "cargo_exit_code", value: res.code, threshold: "0" });

    const pass = res.code === 0 && failed === 0 && passed > 0;
    return {
      status: pass ? "PASS" : "FAIL",
      measurements,
      notes:
        passed === 0 && res.code !== 0
          ? ["cargo could not build/run the contract tests; see stderr.", res.stderr.slice(-500)]
          : ["Persistent-entry semantics validated against the soroban-sdk test host."],
      evidence: { exitCode: res.code },
    };
  },
};
