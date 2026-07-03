"use client";

import { ArrowUpRight, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeDeployment as deployment } from "@/lib/umbra/deployment";

/**
 * The wow-moment, on /withdraw success — the demo's climax.
 *
 * Left  ("What you did")     — the warm, human truth: you got paid, you cashed out.
 * Right ("What Stellar sees") — two real testnet transactions (a shield deposit and a
 *                              withdrawal) that look like two strangers' activity. No
 *                              shared key links them.
 * A ~1.5s signal-colored shimmer crosses the seam between the panels on entry — the
 * separation being ENFORCED, not decorated — then settles into a static boundary.
 *
 * Data comes from infra/deploy/deployment.json. While that file is PENDING (not yet
 * deployed) the tx cards show a tasteful "awaiting testnet deploy" placeholder — never
 * a fabricated hash. Once the deploy scripts populate it, real stellar.expert links
 * appear with NO code change here.
 *
 * G9 (frontend OpSec) seam: external links carry rel="noreferrer noopener" +
 * referrerPolicy="no-referrer", and this component loads NO analytics / third-party
 * scripts. Hardening beyond that is deferred — do not implement, do not block.
 */

type Deployment = {
  network?: string;
  shieldTx?: string;
  withdrawTx?: string;
  shieldExplorerUrl?: string;
  withdrawExplorerUrl?: string;
};

const D = deployment as Deployment;

/** A real testnet tx is only "real" when both its hash and explorer URL are present. */
function isReal(tx?: string, url?: string): boolean {
  return Boolean(tx && url);
}

function truncHash(h: string): string {
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

function Panel({
  label,
  meta,
  className,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("u-card u-animate-fade-up overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        {meta}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function TxCard({
  kind,
  sublabel,
  tx,
  url,
}: {
  kind: string;
  sublabel: string;
  tx?: string;
  url?: string;
}) {
  // PENDING — tasteful placeholder, never a fake hash or dead link. Stacked so the
  // status never collides with the label.
  if (!isReal(tx, url)) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3.5">
        <span className="block text-[15px] font-medium text-foreground">{kind}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{sublabel}</span>
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" strokeWidth={2.25} /> Awaiting mainnet deploy
        </span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      referrerPolicy="no-referrer"
      className="group block rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-medium text-foreground">{kind}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          stellar.expert
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
      </div>
      <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">{truncHash(tx!)}</span>
    </a>
  );
}

/** The signal motif: these two records cannot be linked. */
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

/** Vertical seam shimmer for the side-by-side (sm+) layout. */
function DesktopSeam() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-3 left-1/2 hidden w-px -translate-x-1/2 overflow-hidden sm:block"
    >
      <span className="absolute inset-0 bg-[#FF3B00]/20" />
      <span className="u-animate-separation-y absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-[#FF3B00] to-transparent shadow-[0_0_6px_rgba(255,59,0,0.6)]" />
    </div>
  );
}

/** Horizontal seam shimmer for the stacked (<sm) layout. */
function MobileSeam() {
  return (
    <div aria-hidden className="relative h-px overflow-hidden sm:hidden">
      <span className="absolute inset-0 bg-[#FF3B00]/20" />
      <span className="u-animate-separation-x absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#FF3B00] to-transparent shadow-[0_0_6px_rgba(255,59,0,0.6)]" />
    </div>
  );
}

export function WithdrawReveal({
  amount,
  asset = "XLM",
  className,
}: {
  amount: string;
  asset?: string;
  className?: string;
}) {
  const network = D.network || "mainnet";
  const withdrawReal = isReal(D.withdrawTx, D.withdrawExplorerUrl);

  return (
    <section className={cn("text-left", className)}>
      <div className="relative grid gap-4 sm:grid-cols-2">
        {/* LEFT — human, warm */}
        <Panel label="What you did">
          <div className="flex h-full flex-col justify-center gap-3 py-1">
            <p className="text-[22px] font-semibold leading-snug tracking-tight text-foreground">
              You received {amount} {asset} from a private link.
            </p>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Someone paid you, and you cashed out to your own wallet. That&rsquo;s the whole story —
              nothing else to keep track of.
            </p>
          </div>
        </Panel>

        {/* Stacked-layout seam (hidden side-by-side) */}
        <MobileSeam />

        {/* RIGHT — what the chain sees: two strangers' transactions */}
        <Panel
          label="What Stellar sees"
          meta={
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{network}</span>
          }
        >
          <div className="space-y-3">
            <TxCard
              kind="Pool deposit"
              sublabel="Funds shielded into the pool"
              tx={D.shieldTx}
              url={D.shieldExplorerUrl}
            />
            <Disconnect caption="No shared key" />
            <TxCard
              kind="Pool withdrawal"
              sublabel="Funds released to a fresh address"
              tx={D.withdrawTx}
              url={D.withdrawExplorerUrl}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Two independent transactions. No address, amount, or key ties one to the other.
            </p>
          </div>
        </Panel>

        {/* Side-by-side seam shimmer (hidden when stacked) */}
        <DesktopSeam />
      </div>

      {/* Closing line — the cryptographic payoff (signal permitted) */}
      <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
        This separation is enforced by a proof the contract verified on-chain
        {withdrawReal ? (
          <>
            {" — "}
            <a
              href={D.withdrawExplorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              referrerPolicy="no-referrer"
              className="font-medium text-[#FF3B00] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B00] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              here it is
              <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5 align-text-bottom" strokeWidth={2.25} />
            </a>
          </>
        ) : (
          <span className="text-muted-foreground/70">. The live link appears once deployed to mainnet.</span>
        )}
      </p>
    </section>
  );
}
