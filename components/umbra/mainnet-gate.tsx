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
  if (canary) {
    return (
      <div className={cn("u-glass flex items-start gap-3 rounded-xl px-4 py-3", className)}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF3B00]" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Live on Stellar mainnet — real ZK privacy, capped at {capXlm} XLM per deposit
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Every shield, private send, and unshield is a real Groth16 proof verified on-chain. Early access — the
            per-deposit cap stays while we harden, and an independent audit is on the roadmap.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 py-3", className)}>
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">Mainnet money paths are disabled</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Deposits and withdrawals are turned off on this build.
        </p>
      </div>
    </div>
  );
}
