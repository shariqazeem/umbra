"use client";

import { cn } from "@/lib/utils";
import type { UseProver } from "@/hooks/use-prover";

// The full private-transaction lifecycle, surfaced as a premium vertical stepper:
//   generating proof → signing → submitting → confirming on Horizon.
export type TxStep = "proving" | "signing" | "submitting" | "confirming";

const STEPS: { key: TxStep; label: string }[] = [
  { key: "proving", label: "Generating zero-knowledge proof" },
  { key: "signing", label: "Signing transaction" },
  { key: "submitting", label: "Submitting to Stellar" },
  { key: "confirming", label: "Confirming on Horizon" },
];

const mb = (b: number) => (b / 1_048_576).toFixed(1);

function provingDetail(p: UseProver): string {
  const secs = (p.elapsedMs / 1000).toFixed(1);
  if (p.stage === "loading-key" && p.totalBytes) return `Loading proving key · ${mb(p.loadedBytes)} / ${mb(p.totalBytes)} MB`;
  if (p.stage === "proving") return `Computing constraints · ${secs}s`;
  return `${secs}s`;
}

function Node({ status, last }: { status: "done" | "active" | "pending"; last: boolean }) {
  return (
    <div className="flex flex-col items-center self-stretch">
      <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center">
        {status === "done" && <span className="h-3 w-3 rounded-full bg-[#FF3B00] shadow-[0_0_8px_rgba(255,59,0,0.8)]" />}
        {status === "active" && (
          <>
            <span className="u-animate-pulse absolute inline-flex h-[22px] w-[22px] rounded-full bg-[#FF3B00]/20" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF3B00]" />
          </>
        )}
        {status === "pending" && <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-border" />}
      </span>
      {!last && <span className={cn("w-px grow", status === "done" ? "bg-[#FF3B00]/40" : "bg-border")} />}
    </div>
  );
}

export function TxProgress({ step, prover, chain }: { step: TxStep; prover: UseProver; chain: boolean }) {
  const steps = chain ? STEPS : STEPS.slice(0, 1);
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === step));

  return (
    <div className="flex flex-col py-1">
      {steps.map((s, i) => {
        const status = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
        const last = i === steps.length - 1;
        return (
          <div key={s.key} className="flex gap-3">
            <Node status={status} last={last} />
            <div className={cn("flex-1", last ? "pb-1" : "pb-5")}>
              <p
                className={cn(
                  "text-[15px] leading-[22px]",
                  status === "active" ? "font-medium text-foreground" : status === "done" ? "text-muted-foreground" : "text-muted-foreground/50",
                )}
              >
                {s.label}
                {status === "active" && "…"}
              </p>
              {s.key === "proving" && status === "active" && !prover.error && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">{provingDetail(prover)}</p>
              )}
              {s.key === "confirming" && status === "active" && (
                <p className="mt-1 text-xs text-muted-foreground">A few seconds while the ledger applies it.</p>
              )}
              {s.key === "proving" && prover.error && (
                <p className="mt-1 text-xs text-destructive">{prover.error}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
