"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ACTIVE_NETWORK, isMainnetMoneySafe } from "@/lib/umbra/network";
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

  const safe = isMainnetMoneySafe();
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        safe ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-destructive/40 bg-destructive/[0.06]",
        className,
      )}
    >
      <ShieldAlert className={cn("mt-0.5 h-4 w-4 shrink-0", safe ? "text-amber-500" : "text-destructive")} />
      <div>
        <p className="text-sm font-medium text-foreground">
          {safe ? "Mainnet — capped canary (not for production)" : "Mainnet money paths are disabled"}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {safe
            ? "Deposits are hard-capped and experimental. Not safe for real value until the readiness checklist is complete."
            : "Security blockers are unresolved (audit, trusted setup). Deposits and withdrawals are disabled — not safe for real assets."}
        </p>
      </div>
    </div>
  );
}
