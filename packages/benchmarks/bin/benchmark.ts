#!/usr/bin/env tsx
/**
 * Umbra Phase-0 benchmark entry point.
 *
 *   pnpm benchmark                 run everything the environment supports
 *   pnpm benchmark -- --list       list benchmarks + their criteria, run nothing
 *   pnpm benchmark -- --filter=B01,B02
 *   pnpm benchmark -- --only=node  only run benchmarks that need nothing but Node
 *   pnpm benchmark -- --format=json
 *
 * Exit code is non-zero iff any benchmark FAILed or ERRORed. SKIP never fails CI.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectEnv, renderConsole, runAll, writeReports } from "@umbra/bench-harness";
import { BENCHMARKS } from "../src/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, "..", "..", ".."); // packages/benchmarks/bin → repo root
const resultsDir = join(rootDir, "infra", "benchmarks", "results");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function selectBenchmarks() {
  let list = BENCHMARKS;
  const filter = arg("filter");
  if (filter) {
    const ids = new Set(filter.split(",").map((s) => s.trim().toUpperCase()));
    list = list.filter((b) => ids.has(b.id));
  }
  if (arg("only") === "node") {
    list = list.filter((b) => b.requires.length === 1 && b.requires[0] === "node");
  }
  return list;
}

async function main(): Promise<void> {
  const selected = selectBenchmarks();

  if (has("list")) {
    for (const b of selected) {
      // eslint-disable-next-line no-console
      console.log(
        `${b.id}  ${b.title}\n     objective : ${b.objective}\n     requires  : ${b.requires.join(", ")}\n     success   : ${b.successCriteria}\n`,
      );
    }
    return;
  }

  const env = detectEnv(rootDir);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const report = await runAll(selected, env, { rootDir, resultsDir, runId });

  if (arg("format") === "json") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log(renderConsole(report));
  }

  if (!has("no-write")) {
    const paths = writeReports(report, resultsDir);
    if (arg("format") !== "json") {
      // eslint-disable-next-line no-console
      console.log(`reports written:\n  ${paths.join("\n  ")}\n`);
    }
  }

  process.exit(report.summary.exitCode);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("benchmark runner crashed:", err);
  process.exit(2);
});
