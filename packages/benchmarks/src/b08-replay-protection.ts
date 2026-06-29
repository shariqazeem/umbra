import { join } from "node:path";
import type { Benchmark, BenchmarkContext, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import { run } from "./_exec.js";

function parseCargo(stdout: string): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const m of stdout.matchAll(/test result: \w+\. (\d+) passed; (\d+) failed/g)) {
    passed += Number(m[1]);
    failed += Number(m[2]);
  }
  return { passed, failed };
}

export const b08ReplayProtection: Benchmark = {
  id: "B08",
  title: "Replay / double-spend protection",
  objective: "7-replay-protection",
  purpose:
    "The security-critical assumption from FEASIBILITY_REVIEW.md §6/§7: a spend cannot be replayed. " +
    "Tests that re-submitting an already-spent nullifier is rejected, that domain separation is " +
    "enforced, and (where the test host allows) that an archived-then-restored nullifier cannot " +
    "enable a second spend.",
  successCriteria: "All `replay` unit tests pass (0 failures): second spend rejected; cross-domain proof rejected.",
  failureCriteria:
    "Any replay test fails — i.e. a double-spend or cross-deployment replay succeeds. This is a fund-loss-class defect.",
  measurementMethod: "`cargo test -p bench-pool replay` against the soroban-sdk test environment.",
  outputFormat: "tests passed / failed counts and the cargo exit code.",
  requires: ["cargo"],

  async run(ctx: BenchmarkContext): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const contractsDir = join(ctx.rootDir, "contracts");
    const res = await run("cargo", ["test", "-p", "bench-pool", "replay", "--", "--nocapture"], {
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
      notes: [
        "Archival-replay (TTL-lapse → restore → re-spend) is only partially observable in the test host; " +
          "the testnet variant in infra/deploy hardens this against the live archival lifecycle (FEASIBILITY §6).",
      ],
      evidence: { exitCode: res.code },
    };
  },
};
