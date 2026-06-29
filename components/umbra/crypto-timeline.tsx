"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The cryptography timeline — shown during proof generation. Reads like a bank's
 * security verification, not a hacker terminal: a calm vertical commit-history of
 * steps, mono values for the computational ones, the signal color reserved for the
 * active step and the final "generated" tick (the one genuine cryptographic moment).
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

type Status = "pending" | "active" | "done";

function randHash(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex(4)}…${hex(4)}`;
}

function Node({ status, isFinal }: { status: Status; isFinal: boolean }) {
  if (status === "done") {
    if (isFinal) {
      return (
        <span className="u-animate-check relative flex h-[22px] w-[22px] items-center justify-center">
          <span className="absolute h-[22px] w-[22px] rounded-full bg-[#FF3B00]/25 blur-[3px]" />
          <span className="relative h-3 w-3 rounded-full bg-[#FF3B00] shadow-[0_0_10px_rgba(255,59,0,0.9)]" />
        </span>
      );
    }
    return <span className="flex h-[22px] w-[22px] items-center justify-center"><span className="h-2.5 w-2.5 rounded-full bg-foreground" /></span>;
  }
  if (status === "active") {
    return (
      <span className="relative flex h-[22px] w-[22px] items-center justify-center">
        <span className="u-animate-pulse absolute inline-flex h-[22px] w-[22px] rounded-full bg-[#FF3B00]/20" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF3B00]" />
      </span>
    );
  }
  return <span className="flex h-[22px] w-[22px] items-center justify-center"><span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-border" /></span>;
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
    <div className={cn("u-card p-6", className)}>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const status: Status = done || i < current ? "done" : i === current && running ? "active" : "pending";
          const isFinal = i === steps.length - 1;
          const showMono = step.mono && (status === "active" || status === "done") && hashes[i];
          return (
            <li key={step.label} className="relative flex gap-3.5">
              <div className="flex flex-col items-center">
                <Node status={status} isFinal={isFinal} />
                {!isFinal && (
                  <span className={cn("w-px flex-1", i < current ? "bg-foreground/25" : "bg-border")} />
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
                </span>
                {showMono && (
                  <span
                    className={cn(
                      "mt-1 font-mono text-xs text-muted-foreground/80",
                      status === "active" && "u-animate-pulse",
                      "u-animate-fade-up",
                    )}
                  >
                    {hashes[i]}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
