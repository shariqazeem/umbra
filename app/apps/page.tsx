"use client";

import Link from "next/link";
import { ArrowUpRight, FileText, HandCoins, Link2, Wallet } from "lucide-react";
import { Button, Card, Eyebrow, Pill, Shell } from "@/components/umbra/ui";

const APPS = [
  {
    name: "Payment Links",
    href: "/links",
    icon: Link2,
    status: "live" as const,
    blurb: "Create a link, share it, get paid privately. The chain sees a deposit and a withdrawal — never the line between them.",
    who: "Freelancers · creators",
  },
  {
    name: "Private Donations",
    href: "/donate",
    icon: HandCoins,
    status: "live" as const,
    blurb: "Accept support without exposing your supporters — or your income — on a public ledger.",
    who: "NGOs · open source · creators",
  },
  {
    name: "Private Invoices",
    href: "/invoice",
    icon: FileText,
    status: "live" as const,
    blurb: "Bill a client with a private invoice link. They pay; your revenue stays off the public chain.",
    who: "Contractors · agencies",
  },
  {
    name: "Private Wallet",
    href: "/wallet",
    icon: Wallet,
    status: "live" as const,
    blurb: "Shield funds into the pool, hold a private balance, and unshield to any address when you want out.",
    who: "Everyone",
  },
];

export default function AppsPage() {
  return (
    <Shell active="/apps">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Ecosystem</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
          Apps built on the Umbra privacy layer.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          One frozen, on-chain-verified protocol — many products. Each app below moves real value on
          Stellar privately, enforced by the same zero-knowledge proof the contract checks on-chain.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {APPS.map((app) => (
            <Link key={app.name} href={app.href} className="group">
              <Card className="flex h-full flex-col p-6 transition-colors hover:border-foreground/30">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.06] text-foreground">
                    <app.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <Pill tone="ink">● Live</Pill>
                </div>
                <h2 className="mt-4 inline-flex items-center gap-1 text-lg font-semibold text-foreground">
                  {app.name}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{app.blurb}</p>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/80">{app.who}</p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-border bg-white/[0.04] px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your app could be next.</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            These are all built on <code className="font-mono text-[0.95em]">@umbra/sdk</code> — the same
            primitives are yours to ship with.
          </p>
          <Link href="/build" className="mt-2"><Button variant="secondary">Build with Umbra</Button></Link>
        </div>
      </div>
    </Shell>
  );
}
