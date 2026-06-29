import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchmarkResult, BenchmarkRunReport, Measurement, Status } from "./types.js";

const STATUS_GLYPH: Record<Status, string> = {
  PASS: "PASS ✓",
  FAIL: "FAIL ✗",
  SKIP: "SKIP −",
  ERROR: "ERR  !",
};

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function fmtMeasurement(m: Measurement): string {
  const unit = m.unit ? ` ${m.unit}` : "";
  const thr = m.threshold ? `  (threshold: ${m.threshold})` : "";
  return `${m.name} = ${m.value}${unit}${thr}`;
}

/** Human-readable console report. Returns a string (caller prints it). */
export function renderConsole(report: BenchmarkRunReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("═".repeat(78));
  lines.push("  UMBRA — PHASE 0 BENCHMARK HARNESS");
  lines.push(`  run ${report.runId}  ·  ${report.env.platform}  ·  node ${report.env.nodeVersion}`);
  lines.push("═".repeat(78));

  // Capability matrix
  lines.push("");
  lines.push("  Environment capabilities:");
  for (const cap of Object.values(report.env.capabilities)) {
    const mark = cap.available ? "available  " : "MISSING    ";
    lines.push(`    [${mark}] ${pad(cap.capability, 18)} ${cap.detail}`);
  }

  // Per-benchmark detail
  lines.push("");
  lines.push("  Results:");
  lines.push("  " + "─".repeat(74));
  for (const r of report.results) {
    lines.push(`  ${pad(r.id, 5)} ${pad(STATUS_GLYPH[r.status], 8)} ${r.title}`);
    if (r.measurements.length > 0) {
      for (const m of r.measurements) lines.push(`        · ${fmtMeasurement(m)}`);
    }
    if (r.status === "SKIP" && r.skipped) {
      for (const h of r.skipped.hints) lines.push(`        → enable ${h}`);
    }
    if (r.status === "ERROR" && r.error) {
      lines.push(`        ! ${r.error.message}`);
    }
    for (const n of r.notes) lines.push(`        i ${n}`);
    lines.push("  " + "─".repeat(74));
  }

  const s = report.summary;
  lines.push("");
  lines.push(
    `  SUMMARY  ${s.passed} passed · ${s.failed} failed · ${s.skipped} skipped · ${s.errored} errored  (of ${s.total})`,
  );
  lines.push(`  exit code ${s.exitCode}`);
  lines.push("═".repeat(78));
  lines.push("");
  return lines.join("\n");
}

function mdMeasurement(m: Measurement): string {
  const unit = m.unit ? ` ${m.unit}` : "";
  const thr = m.threshold ? ` _(threshold: ${m.threshold})_` : "";
  return `\`${m.name}\` = **${m.value}**${unit}${thr}`;
}

function mdResult(r: BenchmarkResult): string {
  const out: string[] = [];
  out.push(`### ${r.id} · ${r.title} — \`${r.status}\``);
  out.push("");
  out.push(`- **Objective:** ${r.objective}`);
  out.push(`- **Purpose:** ${r.criteria.purpose}`);
  out.push(`- **Success criteria:** ${r.criteria.successCriteria}`);
  out.push(`- **Failure criteria:** ${r.criteria.failureCriteria}`);
  out.push(`- **Measurement method:** ${r.criteria.measurementMethod}`);
  out.push(`- **Duration:** ${r.durationMs} ms`);
  if (r.measurements.length > 0) {
    out.push("- **Measurements:**");
    for (const m of r.measurements) out.push(`  - ${mdMeasurement(m)}`);
  }
  if (r.status === "SKIP" && r.skipped) {
    out.push("- **Skipped — enable with:**");
    for (const h of r.skipped.hints) out.push(`  - ${h}`);
  }
  if (r.status === "ERROR" && r.error) {
    out.push(`- **Error:** ${r.error.message}`);
  }
  if (r.notes.length > 0) {
    out.push("- **Notes:**");
    for (const n of r.notes) out.push(`  - ${n}`);
  }
  out.push("");
  return out.join("\n");
}

/** Markdown report body, suitable for committing as evidence. */
export function renderMarkdown(report: BenchmarkRunReport): string {
  const s = report.summary;
  const out: string[] = [];
  out.push(`# Umbra Phase-0 Benchmark Results`);
  out.push("");
  out.push(`- **Run:** \`${report.runId}\``);
  out.push(`- **Started:** ${report.startedAt}`);
  out.push(`- **Finished:** ${report.finishedAt}`);
  out.push(`- **Platform:** ${report.env.platform} · node ${report.env.nodeVersion}`);
  out.push(
    `- **Summary:** ${s.passed} passed · ${s.failed} failed · ${s.skipped} skipped · ${s.errored} errored (of ${s.total})`,
  );
  out.push("");
  out.push("| ID | Benchmark | Objective | Status |");
  out.push("|----|-----------|-----------|--------|");
  for (const r of report.results) {
    out.push(`| ${r.id} | ${r.title} | ${r.objective} | \`${r.status}\` |`);
  }
  out.push("");
  out.push("## Capability matrix");
  out.push("");
  out.push("| Capability | Available | Detail |");
  out.push("|------------|-----------|--------|");
  for (const c of Object.values(report.env.capabilities)) {
    out.push(`| \`${c.capability}\` | ${c.available ? "yes" : "**no**"} | ${c.detail} |`);
  }
  out.push("");
  out.push("## Detailed results");
  out.push("");
  for (const r of report.results) out.push(mdResult(r));
  return out.join("\n");
}

/** Persist JSON + Markdown reports. Returns the paths written. */
export function writeReports(report: BenchmarkRunReport, resultsDir: string): string[] {
  mkdirSync(resultsDir, { recursive: true });
  const stamp = report.runId;
  const jsonLatest = join(resultsDir, "latest.json");
  const mdLatest = join(resultsDir, "latest.md");
  const jsonStamped = join(resultsDir, `run-${stamp}.json`);

  const json = JSON.stringify(report, null, 2);
  writeFileSync(jsonLatest, json);
  writeFileSync(jsonStamped, json);
  writeFileSync(mdLatest, renderMarkdown(report));
  return [jsonLatest, jsonStamped, mdLatest];
}
