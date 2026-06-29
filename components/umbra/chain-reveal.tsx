"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The privacy payoff, made visible. The gap between "what you did" and "what the
 * chain sees" IS the product — so we make that gap the loudest thing on screen, with
 * the signal color reserved for the one true statement: these cannot be connected.
 */

function Panel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("u-card overflow-hidden", className)}>
      <div className="border-b border-border px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Disconnect({ caption }: { caption: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 border-t border-dashed border-[#FF3B00]/35" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B00]/[0.08] px-2.5 py-1 text-xs font-medium text-[#FF3B00]">
        <Lock className="h-3 w-3" strokeWidth={2.5} /> {caption}
      </span>
      <span className="h-px flex-1 border-t border-dashed border-[#FF3B00]/35" />
    </div>
  );
}

function LedgerRow({ label, amount, who }: { label: string; amount: string; who: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-[15px] font-medium text-foreground">{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{who}</span>
      </div>
      <span className="font-mono text-[15px] font-medium text-foreground">{amount}</span>
    </div>
  );
}

/** Post-action reveal (after a successful pay / withdraw). */
export function ChainReveal({
  action,
  chainLabel,
  amount,
  hash = "0x7e3a…c1d9",
  className,
}: {
  action: string;
  chainLabel: string;
  amount: string;
  hash?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <Panel label="What you did">
        <p className="text-[15px] leading-relaxed text-foreground">{action}</p>
      </Panel>
      <Panel label="What the chain sees">
        <div className="space-y-3">
          <LedgerRow label={chainLabel} amount={amount} who={hash} />
          <Disconnect caption="Cannot be connected" />
          <p className="text-xs text-muted-foreground">No recipient. No link to any withdrawal.</p>
        </div>
      </Panel>
    </div>
  );
}

/** Landing comparison: the human story vs the on-chain footprint. */
export function LedgerComparison({ amount = "100", className }: { amount?: string; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <Panel label="What happens">
        <ol className="space-y-4">
          {[
            ["Alice", `creates a payment link`],
            ["Bob", `pays ${amount} USDC`],
            ["Alice", `withdraws ${amount} USDC — privately`],
          ].map(([who, what], i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] font-mono text-[10px] font-semibold text-foreground">
                {i + 1}
              </span>
              <p className="text-[15px] leading-snug text-foreground">
                <span className="font-medium">{who}</span> {what}
              </p>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel label="What the chain sees">
        <div className="space-y-3">
          <LedgerRow label="Deposit" amount={`+${amount}`} who="G7XQ…4F2A" />
          <Disconnect caption="No link between them" />
          <LedgerRow label="Withdrawal" amount={`−${amount}`} who="G9KP…1B7C" />
        </div>
      </Panel>
    </div>
  );
}
