import { join } from "node:path";
import type { Benchmark, BenchmarkContext, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import { lastJson, run } from "./_exec.js";

/** SLP-0001 (2025-01-22) per-transaction entry limits. */
const MAX_READ_ENTRIES = 100;
const MAX_WRITE_ENTRIES = 50;

interface ResourceResult {
  cpuInsns?: number;
  readEntries?: number;
  writeEntries?: number;
  readBytes?: number;
  writeBytes?: number;
  resourceFeeStroops?: number;
  rentFeeStroops?: number;
  txHash?: string;
}

export const b06ResourceUsage: Benchmark = {
  id: "B06",
  title: "Transaction resource usage (ledger entries, bytes, fees)",
  objective: "4-transaction-resources",
  purpose:
    "Measure the non-CPU resources a verify/withdraw transaction consumes and confirm they sit " +
    "inside Soroban's per-tx ledger-entry limits, and quantify the fee (incl. nullifier rent) — " +
    "the storage-cost questions from FEASIBILITY_REVIEW.md §6.",
  successCriteria:
    `read entries ≤ ${MAX_READ_ENTRIES}, write entries ≤ ${MAX_WRITE_ENTRIES}; resource + rent fees reported.`,
  failureCriteria:
    "read/write entries exceed the per-tx limits, or the script cannot report resource usage.",
  measurementMethod:
    "infra/deploy/measure-resources.sh reports footprint entry counts, R/W bytes, resource fee, and " +
    "(for a nullifier write) the rent fee, parsed from the transaction meta.",
  outputFormat: "read/write entry counts vs limits, R/W bytes, resource fee (stroops), rent fee (stroops).",
  requires: ["stellar-cli", "testnet", "circuit-artifacts"],

  async run(ctx: BenchmarkContext): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const script = join(ctx.rootDir, "infra", "deploy", "measure-resources.sh");
    const res = await run("bash", [script], { cwd: ctx.rootDir, timeoutMs: 300_000 });
    const j = lastJson<ResourceResult>(res.stdout);

    if (!j) {
      return { status: "ERROR", measurements, notes: ["measure-resources.sh produced no JSON.", res.stderr.slice(-400)] };
    }

    const readEntries = j.readEntries ?? -1;
    const writeEntries = j.writeEntries ?? -1;
    measurements.push({ name: "read_entries", value: readEntries, threshold: `≤ ${MAX_READ_ENTRIES}` });
    measurements.push({ name: "write_entries", value: writeEntries, threshold: `≤ ${MAX_WRITE_ENTRIES}` });
    if (j.readBytes !== undefined) measurements.push({ name: "read_bytes", value: j.readBytes, unit: "bytes" });
    if (j.writeBytes !== undefined) measurements.push({ name: "write_bytes", value: j.writeBytes, unit: "bytes" });
    if (j.resourceFeeStroops !== undefined) measurements.push({ name: "resource_fee", value: j.resourceFeeStroops, unit: "stroops" });
    if (j.rentFeeStroops !== undefined) measurements.push({ name: "nullifier_rent_fee", value: j.rentFeeStroops, unit: "stroops" });

    const withinLimits =
      readEntries >= 0 && writeEntries >= 0 && readEntries <= MAX_READ_ENTRIES && writeEntries <= MAX_WRITE_ENTRIES;

    return {
      status: withinLimits ? "PASS" : "FAIL",
      measurements,
      notes: [
        "Nullifier rent is a perpetual, monotonically-growing liability (FEASIBILITY §6/§8); the rent fee here is the per-spend increment.",
      ],
      evidence: { raw: j },
    };
  },
};
