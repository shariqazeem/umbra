"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ProverStage } from "@/lib/umbra/prover-protocol";

/**
 * The proving moment — driven by REAL progress from the proving Web Worker
 * (useProver), not a timer. Three staged lines:
 *   Loading proving key…           → live MB progress bar for the 3.9 MB zkey
 *   Generating zero-knowledge proof… → live elapsed-ms readout (JetBrains Mono)
 *   Constraints satisfied ✓
 * Signal #FF3B00 is reserved for the active cryptographic step and the final
 * tick. Motion is subtle (a real progress bar + a soft pulse) — no spinner.
 */

type NodeStatus = "pending" | "active" | "done";

const STEPS: { stage: Extract<ProverStage, "loading-key" | "proving" | "done">; label: string }[] = [
  { stage: "loading-key", label: "Loading proving key" },
  { stage: "proving", label: "Generating zero-knowledge proof" },
  { stage: "done", label: "Constraints satisfied" },
];

// How far the pipeline has advanced, as an index into STEPS.
const ADVANCE: Record<ProverStage, number> = {
  idle: -1,
  "loading-key": 0,
  proving: 1,
  done: 2,
  error: 1,
};

const fmtMB = (bytes: number): string => (bytes / 1_000_000).toFixed(1);
const fmtMs = (ms: number): string => Math.round(ms).toLocaleString();

function Node({ status, isFinal }: { status: NodeStatus; isFinal: boolean }) {
  if (status === "done") {
    if (isFinal) {
      return (
        <span className="u-animate-check relative flex h-[22px] w-[22px] items-center justify-center">
          <span className="absolute h-[22px] w-[22px] rounded-full bg-[#FF3B00]/25 blur-[3px]" />
          <span className="relative h-3 w-3 rounded-full bg-[#FF3B00] shadow-[0_0_10px_rgba(255,59,0,0.9)]" />
        </span>
      );
    }
    return (
      <span className="flex h-[22px] w-[22px] items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-[22px] w-[22px] items-center justify-center">
        <span className="u-animate-pulse absolute inline-flex h-[22px] w-[22px] rounded-full bg-[#FF3B00]/20" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF3B00]" />
      </span>
    );
  }
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-border" />
    </span>
  );
}

export function ProverProgress({
  stage,
  elapsedMs,
  loadedBytes,
  totalBytes,
  error,
  className,
}: {
  stage: ProverStage;
  elapsedMs: number;
  loadedBytes: number;
  totalBytes: number;
  error?: string | null;
  className?: string;
}) {
  const advance = ADVANCE[stage];
  const pct = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;

  return (
    <div className={cn("u-card p-6", className)}>
      <ol className="flex flex-col">
        {STEPS.map((step, i) => {
          const isFinal = i === STEPS.length - 1;
          let status: NodeStatus;
          if (isFinal) status = stage === "done" ? "done" : "pending";
          else if (stage === "done" || i < advance) status = "done";
          else if (i === advance && stage !== "error") status = "active";
          else status = "pending";

          const showKey = step.stage === "loading-key" && status !== "pending";
          const showProve = step.stage === "proving" && status !== "pending";

          return (
            <li key={step.label} className="relative flex gap-3.5">
              <div className="flex flex-col items-center">
                <Node status={status} isFinal={isFinal} />
                {!isFinal && (
                  <span className={cn("w-px flex-1", status === "done" ? "bg-foreground/25" : "bg-border")} />
                )}
              </div>
              <div className={cn("flex flex-1 flex-col pb-5", isFinal && "pb-0")}>
                <span
                  className={cn(
                    "text-[15px] leading-[22px] transition-colors duration-300",
                    status === "pending" && "text-muted-foreground",
                    status === "active" && "font-medium text-foreground",
                    status === "done" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {status === "active" ? "…" : ""}
                </span>

                {showKey && (
                  <div className="u-animate-fade-up mt-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-[#FF3B00] transition-[width] duration-200 ease-out"
                        style={{ width: `${status === "done" ? 100 : pct}%` }}
                      />
                    </div>
                    <span className="mt-1 block font-mono text-xs tabular-nums text-muted-foreground/80">
                      {totalBytes > 0
                        ? `${fmtMB(status === "done" ? totalBytes : loadedBytes)} / ${fmtMB(totalBytes)} MB`
                        : `${fmtMB(loadedBytes)} MB`}
                    </span>
                  </div>
                )}

                {showProve && (
                  <span
                    className={cn(
                      "u-animate-fade-up mt-1 font-mono text-xs tabular-nums text-muted-foreground/80",
                      status === "active" && "u-animate-pulse",
                    )}
                  >
                    {fmtMs(elapsedMs)} ms
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
