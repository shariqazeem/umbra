"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button, Eyebrow, Shell } from "@/components/umbra/ui";
import { isChainConfigured } from "@/lib/umbra/config";
import { IS_MAINNET } from "@/lib/umbra/network";

const APPS = [
  { name: "Payment Links", href: "/links", art: "/art/apps/links.png", desc: "Create a link, share it, get paid privately." },
  { name: "Private Donations", href: "/donate", art: "/art/apps/donate.png", desc: "Accept support without exposing your donors." },
  { name: "Private Invoices", href: "/invoice", art: "/art/apps/invoice.png", desc: "Bill a client; your revenue stays off the chain." },
  { name: "Private Wallet", href: "/wallet", art: "/art/apps/wallet.png", desc: "Shield funds, hold a private balance, cash out." },
];

/** Real deployment status — "Live on mainnet" only when the pool is configured AND on mainnet. */
function StatusPill() {
  const live = isChainConfigured() && IS_MAINNET;
  if (!live) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
        Demo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground backdrop-blur-sm">
      <span className="relative flex h-1.5 w-1.5">
        <span className="u-animate-pulse absolute inline-flex h-full w-full rounded-full bg-[#FF3B00]" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF3B00]" />
      </span>
      Live on mainnet
    </span>
  );
}

function AppCard({ app }: { app: (typeof APPS)[number] }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      <Link href={app.href} className="group block h-full">
        <div className="u-card overflow-hidden">
          <div className="relative aspect-[16/11] overflow-hidden">
            <Image
              src={app.art}
              alt=""
              fill
              sizes="(min-width: 640px) 40vw, 90vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
            <div className="absolute right-3 top-3">
              <StatusPill />
            </div>
          </div>
          <div className="p-5">
            <h2 className="flex items-center gap-1 text-lg font-semibold text-foreground">
              {app.name}
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{app.desc}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function AppsPage() {
  return (
    <Shell active="/apps">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Ecosystem</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground">
          Apps built on the Umbra privacy layer.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          One frozen, on-chain-verified protocol — many products. Each app below moves real value on
          Stellar privately, enforced by the same zero-knowledge proof the contract checks on-chain.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {APPS.map((app) => (
            <AppCard key={app.name} app={app} />
          ))}
        </div>

        {/* Your app could be next — quiet glass */}
        <div className="u-glass mt-4 flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your app could be next.</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            These are all built on <code className="font-mono text-[0.95em]">@umbra/sdk</code> — the same
            primitives are yours to ship with.
          </p>
          <Link href="/build" className="mt-2">
            <Button variant="secondary">Build with Umbra</Button>
          </Link>
        </div>
      </div>
    </Shell>
  );
}
