import { join } from "node:path";
import type { Benchmark, BenchmarkContext, BenchmarkOutcome, Measurement } from "@umbra/bench-harness";
import { groupDigits } from "@umbra/bench-harness";
import { lastJson, run } from "./_exec.js";

/** Soroban per-transaction CPU instruction limit (Protocol ≥22). */
const TX_LIMIT = 100_000_000;
/** Practical safety wall — transactions reportedly stall approaching ~80M. */
const PRACTICAL_WALL = 80_000_000;
/** Comfort target leaving headroom for SAC transfers + storage on a real spend. */
const COMFORT_TARGET = 70_000_000;

interface ResourceResult {
  cpuInsns: number;
  memBytes?: number;
  shape?: string; // e.g. "verify-only" | "withdraw-shaped"
  txHash?: string;
}

export const b05InstructionBudget: Benchmark = {
  id: "B05",
  title: "Instruction consumption of on-chain verification / withdraw-shaped tx",
  objective: "3-instruction-consumption",
  purpose:
    "Quantify the central risk from FEASIBILITY_REVIEW.md §1: the COMPOSITE transaction " +
    "(Groth16 verify ~40M + public-input MSM + SAC transfer(s) + storage) must fit the 100M " +
    "per-tx budget — and practically stay under ~80M.",
  successCriteria:
    `Measured CPU instructions < ${groupDigits(PRACTICAL_WALL)} (and ideally < ${groupDigits(COMFORT_TARGET)}).`,
  failureCriteria:
    `CPU instructions ≥ ${groupDigits(PRACTICAL_WALL)} (no headroom for the real withdraw tx) or ≥ ${groupDigits(TX_LIMIT)} (over budget).`,
  measurementMethod:
    "infra/deploy/measure-resources.sh invokes the verifier / withdraw-shaped contract and reads " +
    "cpu_insns from the transaction meta (RPC getTransaction / CLI resource report); prints JSON.",
  outputFormat: "cpu_insns (absolute + % of 100M budget), shape measured, headroom to the practical wall.",
  requires: ["stellar-cli", "testnet", "circuit-artifacts"],

  async run(ctx: BenchmarkContext): Promise<BenchmarkOutcome> {
    const measurements: Measurement[] = [];
    const script = join(ctx.rootDir, "infra", "deploy", "measure-resources.sh");
    const res = await run("bash", [script], { cwd: ctx.rootDir, timeoutMs: 300_000 });
    const j = lastJson<ResourceResult>(res.stdout);

    if (!j || typeof j.cpuInsns !== "number") {
      return {
        status: "ERROR",
        measurements,
        notes: ["measure-resources.sh did not emit cpuInsns JSON.", res.stderr.slice(-400)],
      };
    }

    const pct = (j.cpuInsns / TX_LIMIT) * 100;
    measurements.push({ name: "cpu_instructions", value: groupDigits(j.cpuInsns), unit: "insns", threshold: `< ${groupDigits(PRACTICAL_WALL)}` });
    measurements.push({ name: "pct_of_100M_budget", value: Number(pct.toFixed(1)), unit: "%" });
    measurements.push({ name: "headroom_to_practical_wall", value: groupDigits(PRACTICAL_WALL - j.cpuInsns), unit: "insns" });
    if (j.shape) measurements.push({ name: "tx_shape", value: j.shape });

    const notes: string[] = [];
    let pass: boolean;
    if (j.cpuInsns >= PRACTICAL_WALL) {
      pass = false;
      notes.push("Over the practical wall — the real withdraw tx (with SAC transfers) will not fit. Decouple insertion / drop the in-tx fee transfer / reduce public inputs (FEASIBILITY §1).");
    } else if (j.cpuInsns >= COMFORT_TARGET) {
      pass = true;
      notes.push("PASS but in the caution band (70–80M). Margin is thin; profile the full withdraw shape before committing.");
    } else {
      pass = true;
      notes.push("Comfortable headroom under the practical wall.");
    }

    return { status: pass ? "PASS" : "FAIL", measurements, notes, evidence: { raw: j } };
  },
};
