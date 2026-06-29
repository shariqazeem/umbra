import { missingCapabilities } from "./env.js";
import { timed } from "./measure.js";
import type {
  Benchmark,
  BenchmarkContext,
  BenchmarkResult,
  BenchmarkRunReport,
  EnvReport,
} from "./types.js";

function criteriaOf(b: Benchmark): BenchmarkResult["criteria"] {
  return {
    purpose: b.purpose,
    successCriteria: b.successCriteria,
    failureCriteria: b.failureCriteria,
    measurementMethod: b.measurementMethod,
    outputFormat: b.outputFormat,
  };
}

/** Run one benchmark, honoring capability gating and capturing errors. */
export async function runOne(b: Benchmark, ctx: BenchmarkContext): Promise<BenchmarkResult> {
  const base = {
    id: b.id,
    title: b.title,
    objective: b.objective,
    criteria: criteriaOf(b),
  } as const;

  const gate = missingCapabilities(ctx.env, b.requires);
  if (gate.missing.length > 0) {
    return {
      ...base,
      status: "SKIP",
      durationMs: 0,
      measurements: [],
      notes: [`Skipped: missing capabilities [${gate.missing.join(", ")}].`],
      skipped: gate,
    };
  }

  try {
    const { value: outcome, ms } = await timed(() => b.run(ctx));
    return {
      ...base,
      status: outcome.status,
      durationMs: Math.round(ms),
      measurements: outcome.measurements,
      notes: outcome.notes ?? [],
      ...(outcome.evidence ? { evidence: outcome.evidence } : {}),
    };
  } catch (err) {
    const e = err as Error;
    return {
      ...base,
      status: "ERROR",
      durationMs: 0,
      measurements: [],
      notes: ["Benchmark threw before producing a verdict."],
      error: { message: e?.message ?? String(err), ...(e?.stack ? { stack: e.stack } : {}) },
    };
  }
}

/** Run the selected benchmarks sequentially (deterministic ordering for repro). */
export async function runAll(
  benchmarks: Benchmark[],
  env: EnvReport,
  ctx: Omit<BenchmarkContext, "env">,
): Promise<BenchmarkRunReport> {
  const startedAt = new Date().toISOString();
  const full: BenchmarkContext = { ...ctx, env };

  const results: BenchmarkResult[] = [];
  for (const b of benchmarks) {
    results.push(await runOne(b, full));
  }

  const finishedAt = new Date().toISOString();
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  const errored = results.filter((r) => r.status === "ERROR").length;

  return {
    runId: ctx.runId,
    startedAt,
    finishedAt,
    env,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      errored,
      exitCode: failed + errored > 0 ? 1 : 0,
    },
  };
}
