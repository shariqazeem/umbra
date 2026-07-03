"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The cryptography timeline — shown during proof generation for flows that don't surface
 * granular prover stages (payment links, funding). Rendered as the SAME live mono terminal
 * as the wallet's TxProgress, so every proving moment across the ecosystem reads identically.
 * Time-driven step advancement (calm, bank-grade), never a hacker firehose.
 */

export interface TimelineStep {
  label: string;
  mono?: boolean; // show a monospace working value for this step
}

export const SHIELD_STEPS: TimelineStep[] = [
  { label: "Generating your secret" },
  { label: "Computing the Poseidon commitment", mono: true },
  { label: "Building the zero-knowledge proof", mono: true },
  { label: "Proof generated" },
];

export const WITHDRAW_STEPS: TimelineStep[] = [
  { label: "Opening your note" },
  { label: "Proving ownership", mono: true },
  { label: "Building the zero-knowledge proof", mono: true },
  { label: "Verified on Stellar" },
];

export const FUND_STEPS: TimelineStep[] = [
  { label: "Checking the request" },
  { label: "Funding privately", mono: true },
  { label: "Verifying on Stellar" },
  { label: "Payment protected" },
];

function randHash(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex(4)}…${hex(4)}`;
}

export function CryptoTimeline({
  steps,
  running,
  done,
  error,
  className,
}: {
  steps: readonly TimelineStep[];
  running: boolean;
  done: boolean;
  error?: string | null;
  className?: string;
}) {
  const [current, setCurrent] = React.useState(0);
  const [hashes, setHashes] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Generate mono working values after mount (avoids any SSR mismatch).
    setHashes(steps.map((s) => (s.mono ? randHash() : "")));
  }, [steps]);

  React.useEffect(() => {
    if (done) {
      setCurrent(steps.length);
      return;
    }
    if (!running) {
      setCurrent(0);
      return;
    }
    setCurrent(1);
    const id = setInterval(() => setCurrent((c) => Math.min(c + 1, steps.length - 1)), 950);
    return () => clearInterval(id);
  }, [running, done, steps.length]);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-[#080808] p-4 font-mono text-[13px] leading-[1.7] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground/60">
        <span className="h-2 w-2 rounded-full bg-[#FF3B00]/70 shadow-[0_0_6px_rgba(255,59,0,0.7)]" />
        umbra · prover
      </div>
      {steps.map((step, i) => {
        const status = done || i < current ? "done" : i === current && running ? "active" : "pending";
        if (status === "pending") return null; // terminal reveals lines as they're reached
        const isFinal = i === steps.length - 1;
        const check = status === "done";
        const mono = step.mono && hashes[i] ? ` · ${hashes[i]}` : "";
        return (
          <div
            key={step.label}
            className={cn("flex items-baseline gap-2", status === "done" ? "text-muted-foreground/70" : "text-foreground")}
          >
            <span className="w-3 shrink-0 text-[#FF3B00]">{check ? "✓" : "›"}</span>
            <span className="flex-1 break-all">
              {step.label.toLowerCase()}
              {mono}
            </span>
            {status === "active" && !isFinal && <span className="u-animate-pulse text-[#FF3B00]">▍</span>}
          </div>
        );
      })}
      {error && (
        <div className="mt-1 flex gap-2 text-destructive">
          <span className="w-3 shrink-0">✕</span>
          {error}
        </div>
      )}
    </div>
  );
}
