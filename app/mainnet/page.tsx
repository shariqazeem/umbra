"use client";

import Link from "next/link";
import { ArrowUpRight, Eye, Lock } from "lucide-react";
import { Button, Card, Eyebrow, Shell } from "@/components/umbra/ui";
import { MainnetGate } from "@/components/umbra/mainnet-gate";
import { BEFORE_REAL_ASSETS, READINESS, type ReadinessStatus } from "@/lib/umbra/network";

const STATUS: Record<ReadinessStatus, { label: string; dot: string; text: string }> = {
  live: { label: "Live", dot: "bg-[#FF3B00]", text: "text-[#FF3B00]" },
  gated: { label: "Security-gated", dot: "bg-amber-500", text: "text-amber-500" },
  required: { label: "Required", dot: "bg-destructive", text: "text-destructive" },
  roadmap: { label: "Roadmap", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

function StatusChip({ status }: { status: ReadinessStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-white/[0.02] px-2.5 py-1">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={`font-mono text-[10px] uppercase tracking-wider ${s.text}`}>{s.label}</span>
    </span>
  );
}

export default function MainnetPage() {
  return (
    <Shell active="/mainnet">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <Eyebrow>Live on mainnet</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl">
          Live on Mainnet
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Umbra is live on Stellar mainnet — real zero-knowledge privacy, verified on-chain. Here&rsquo;s exactly
          what&rsquo;s real today and the roadmap to full scale.
        </p>

        <MainnetGate className="mt-6" />

        {/* Honest privacy callout */}
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-foreground">
              <Eye className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </span>
            <h2 className="text-[15px] font-semibold text-foreground">What Umbra hides — and what it doesn&rsquo;t</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Umbra currently provides <span className="text-foreground">link privacy</span>, not confidential amounts.
            On-chain, an observer can see a deposit and a withdrawal and their <span className="text-foreground">amounts</span> —
            what they cannot see is <span className="text-foreground">which deposit funded which withdrawal</span>. Umbra
            is <span className="text-foreground">early access</span>: deposits are capped while we harden, and an
            independent audit is on the roadmap. Everything below is exactly what&rsquo;s live now versus what&rsquo;s next.
          </p>
        </Card>

        {/* Readiness scorecards */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Readiness scorecard
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {READINESS.map((item) => (
            <Card key={item.label} className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-foreground">{item.label}</h3>
                <StatusChip status={item.status} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            </Card>
          ))}
        </div>

        {/* Architecture roadmap */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Production architecture (designed, not yet built)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Fee-privacy relayer", detail: "Submit withdrawals without exposing the fee-payer account. No custody, no secrets.", doc: "docs/RELAYER.md" },
            { title: "Note-discovery indexer", detail: "Scalable balance recovery from the deploy ledger onward. Public data only.", doc: "docs/INDEXER.md" },
            { title: "Confidential Tokens adapter", detail: "A PrivacyRail seam to sit the wallet on CT (confidential amounts, no ceremony).", doc: "docs/CONFIDENTIAL_TOKENS_STRATEGY.md" },
          ].map((a) => (
            <Card key={a.title} className="flex flex-col gap-2 p-5">
              <h3 className="text-[15px] font-semibold text-foreground">{a.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{a.detail}</p>
              <p className="font-mono text-[11px] text-[#FF3B00]">{a.doc}</p>
            </Card>
          ))}
        </div>

        {/* Before real assets */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Before real assets
        </h2>
        <Card className="divide-y divide-border overflow-hidden">
          {BEFORE_REAL_ASSETS.map((item) => (
            <div key={item} className="flex items-center gap-3 px-5 py-3.5">
              <span className="h-2 w-2 shrink-0 rounded-full border border-muted-foreground/50" />
              <span className="text-sm text-foreground">{item}</span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Pending</span>
            </div>
          ))}
        </Card>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-border bg-white/[0.02] px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3B00]/10 text-[#FF3B00]">
            <Lock className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Verify it for yourself.</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Every claim here is backed by code, contract ids, and real transactions. See the proof, then try the wallet.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href="/proof"><Button variant="secondary">Open the Proof Center</Button></Link>
            <Link href="/wallet"><Button variant="secondary">Open the wallet <ArrowUpRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
