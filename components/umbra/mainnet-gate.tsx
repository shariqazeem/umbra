"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ACTIVE_NETWORK, FLAGS, isCanaryActive } from "@/lib/umbra/network";
import { cn } from "@/lib/utils";

/**
 * Network safety banner. Testnet → a calm "safe demo mode" note. Mainnet → a hard
 * warning, and money paths stay disabled while security blockers are unresolved. This
 * component must never imply production safety for real assets.
 */
export function MainnetGate({ className }: { className?: string }) {
  if (ACTIVE_NETWORK === "testnet") {
    return (
      <div className={cn("flex items-start gap-3 rounded-xl border border-[#FF3B00]/25 bg-[#FF3B00]/[0.05] px-4 py-3", className)}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF3B00]" />
        <div>
          <p className="text-sm font-medium text-foreground">Safe demo mode — real Stellar testnet transactions</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Everything here is live on Stellar testnet. No real-asset risk. Mainnet money paths are disabled.
          </p>
        </div>
      </div>
    );
  }

  const canary = isCanaryActive();
  const capXlm = canary ? Number(FLAGS.MAX_MAINNET_DEPOSIT / 10_000_000n) : 0;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        canary ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-destructive/40 bg-destructive/[0.06]",
        className,
      )}
    >
      <ShieldAlert className={cn("mt-0.5 h-4 w-4 shrink-0", canary ? "text-amber-500" : "text-destructive")} />
      <div>
        <p className="text-sm font-medium text-foreground">
          {canary
            ? `Mainnet — experimental canary, capped at ${capXlm} XLM (self-reviewed, NOT audited)`
            : "Mainnet money paths are disabled"}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {canary
            ? "Real funds at risk. Self-reviewed (C1/H1/M1/M2), not independently audited, single-contributor trusted setup. Deposits are hard-capped per the figure above — deposit only what you can afford to lose."
            : "Security blockers are unresolved (audit, trusted setup). Deposits and withdrawals are disabled — not safe for real assets."}
        </p>
      </div>
    </div>
  );
}
