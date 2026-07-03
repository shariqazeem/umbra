"use client";

import { cn } from "@/lib/utils";
import type { UseProver } from "@/hooks/use-prover";

// The full private-transaction lifecycle, surfaced as a live mono terminal that types out each
// real stage: proving key load → poseidon·merkle·groth16 → proof ready → signing → submitting →
// confirming. Every counter (MB loaded, seconds elapsed) is REAL prover telemetry — never faked.
export type TxStep = "proving" | "signing" | "submitting" | "confirming";

const mb = (b: number) => (b / 1_048_576).toFixed(1);

type Line = { id: string; text: string; milestone?: boolean };

/** Build the visible terminal lines from the real (step, prover.stage) state. */
function buildLines(step: TxStep, p: UseProver, chain: boolean): { lines: Line[]; activeIdx: number } {
  const secs = (p.elapsedMs / 1000).toFixed(1);
  const keyText = p.totalBytes
    ? `loading proving key · ${mb(p.loadedBytes)} / ${mb(p.totalBytes)} MB`
    : "loading proving key";

  const lines: Line[] = [
    { id: "key", text: keyText },
    { id: "prove", text: `poseidon · merkle · groth16 · ${secs}s` },
    { id: "ready", text: "groth16 proof ready", milestone: true },
  ];
  if (chain) {
    lines.push(
      { id: "signing", text: "signing transaction" },
      { id: "submitting", text: "submitting to stellar" },
      { id: "confirming", text: "confirming on horizon" },
    );
  }

  // Map the real state onto an index into `lines`.
  let activeIdx: number;
  if (step === "proving") {
    activeIdx = p.stage === "proving" ? 1 : p.stage === "done" ? 2 : 0; // loading-key/idle → 0
  } else {
    activeIdx = { signing: 3, submitting: 4, confirming: 5 }[step] ?? 2;
  }
  return { lines, activeIdx };
}

export function TxProgress({ step, prover, chain }: { step: TxStep; prover: UseProver; chain: boolean }) {
  const { lines, activeIdx } = buildLines(step, prover, chain);
  const failed = !!prover.error;

  return (
    <div className="rounded-xl border border-white/10 bg-[#080808] p-4 font-mono text-[13px] leading-[1.7] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground/60">
        <span className="h-2 w-2 rounded-full bg-[#FF3B00]/70 shadow-[0_0_6px_rgba(255,59,0,0.7)]" />
        umbra · prover
      </div>
      {lines.map((l, i) => {
        if (i > activeIdx) return null; // not reached yet
        const done = i < activeIdx;
        const active = i === activeIdx;
        const check = l.milestone || done;
        return (
          <div
            key={l.id}
            className={cn("flex items-baseline gap-2", done ? "text-muted-foreground/70" : "text-foreground")}
          >
            <span className="w-3 shrink-0 text-[#FF3B00]">{check ? "✓" : "›"}</span>
            <span className="flex-1 break-all">{l.text}</span>
            {active && !l.milestone && <span className="u-animate-pulse text-[#FF3B00]">▍</span>}
          </div>
        );
      })}
      {failed && <div className="mt-1 flex gap-2 text-destructive"><span className="w-3 shrink-0">✕</span>{prover.error}</div>}
    </div>
  );
}
