"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown, Github, Lock } from "lucide-react";
import { Button, Logo } from "@/components/umbra/ui";
import { CinematicBackground, SmoothScroll } from "@/components/umbra/cinematic";
import { Atmosphere } from "@/components/umbra/atmosphere";
import { PoolScene } from "@/components/umbra/pool-scene";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/shariqazeem/umbra";

/* ───────────────────────  scroll primitives  ─────────────────────── */

function useInView(threshold = 0.15) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none motion-reduce:blur-0",
        inView ? "translate-y-0 scale-100 opacity-100 blur-0" : "translate-y-10 scale-[0.97] opacity-0 blur-[8px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("flex min-h-[85vh] scroll-mt-16 flex-col items-center justify-center px-6 py-24", className)}>
      {children}
    </section>
  );
}

/* ───────────────────────  the narrative  ─────────────────────── */

export function LandingNarrative() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const enter = (delay: number): React.CSSProperties => ({
    transitionDelay: `${delay}ms`,
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
  });

  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  // Scroll-linked hero: the headline lifts, fades and recedes as you scroll past.
  const heroRef = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.2]);

  return (
    <div className="relative">
      <SmoothScroll />
      <CinematicBackground />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-6">
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <Logo /> Umbra
          </span>
          <nav className="flex items-center gap-1">
            <Link href="/proof" className="hidden sm:inline-flex"><Button size="sm" variant="ghost">Proof</Button></Link>
            <Link href="/mainnet" className="hidden sm:inline-flex"><Button size="sm" variant="ghost">Mainnet</Button></Link>
            <Link href="/build" className="hidden sm:inline-flex"><Button size="sm" variant="ghost">Build</Button></Link>
            <Link href="/wallet"><Button size="sm" variant="secondary">Open app</Button></Link>
          </nav>
        </div>
      </header>

      {/* ── Section 1 · Hero ── */}
      <section ref={heroRef} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
        {/* cinematic hero backdrop — the dawn-glow void (align bottom so the ember sits low) */}
        <motion.div aria-hidden style={{ opacity: heroOpacity }} className="absolute inset-0 -z-10">
          <Atmosphere src="/art/hero.png" align="bottom" opacity={0.92} scrim="none" priority />
        </motion.div>
        {/* signal glow */}
        <motion.div
          aria-hidden
          style={{ opacity: glowOpacity }}
          className="pointer-events-none absolute left-1/2 top-[42%] h-[360px] w-[560px] max-w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF3B00]/10 blur-[140px]"
        />
        <motion.div style={{ y: heroY, scale: heroScale, opacity: heroOpacity }} className="relative max-w-5xl">
          <span
            className="mb-7 inline-block font-mono text-[11px] uppercase tracking-[0.32em] text-[#FF3B00] transition-all duration-700 ease-out"
            style={enter(0)}
          >
            The privacy layer for Stellar
          </span>
          {["Private money", "on Stellar."].map((line, i) => (
            <h1
              key={line}
              className="font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-tight text-foreground transition-all duration-700 ease-out md:text-8xl"
              style={enter(150 + i * 200)}
            >
              {line}
            </h1>
          ))}
          <p
            className="mx-auto mt-6 max-w-2xl text-xl font-semibold tracking-tight text-foreground transition-all duration-700 ease-out sm:text-2xl"
            style={enter(650)}
          >
            Shield. Pay. Disclose only when you choose.
          </p>
          <p
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground transition-all duration-700 ease-out md:text-lg"
            style={enter(800)}
          >
            Hold a private balance, send with the amount hidden on-chain, and cash out unlinkably —
            every move enforced by a zero-knowledge proof a Stellar smart contract verifies on-chain.
          </p>
          <div
            className="mt-10 flex flex-col items-center justify-center gap-3 transition-all duration-700 ease-out sm:flex-row"
            style={enter(900)}
          >
            <Link href="/wallet">
              <Button size="lg" variant="secondary">Open the wallet</Button>
            </Link>
            <Button size="lg" variant="secondary" onClick={scrollTo("problem")}>
              See how it works
            </Button>
          </div>
        </motion.div>
        <div className="absolute bottom-10 transition-opacity duration-700" style={{ opacity: mounted ? 1 : 0, transitionDelay: "1200ms" }}>
          <ChevronDown className="u-animate-pulse h-6 w-6 text-muted-foreground/50" />
        </div>
      </section>

      {/* ── Signature scroll scene · Enter the pool ── */}
      <PoolScene />

      {/* ── Section 2 · The Problem ── */}
      <Section id="problem">
        <div className="max-w-3xl text-center">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Every payment you receive is public.
            </h2>
          </Reveal>
          <div className="mt-12 space-y-4">
            {[
              ["Your freelance invoice.", "Visible."],
              ["Your donation.", "Traced."],
              ["Your salary.", "Searchable."],
            ].map(([a, b], i) => (
              <Reveal key={b} delay={i * 180}>
                <p className="text-xl text-muted-foreground">
                  {a} <span className="font-medium text-foreground">{b}</span>
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <p className="mx-auto mt-14 max-w-xl text-lg leading-relaxed text-[#9CA3AF]">
              Blockchains are transparent by design. That transparency comes at a cost: your financial privacy.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── Section 3 · The Solution ── */}
      <Section>
        <div className="w-full max-w-4xl text-center">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Umbra makes payments private on Stellar.
            </h2>
          </Reveal>
          <div className="mt-14 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
            {[
              { word: "Shield", desc: "Move funds into the pool — a deposit no one can link to you later." },
              { word: "Send", desc: "Transfer a shielded note privately — the amount hidden on-chain — or cash out, unlinkable from where the money came." },
              { word: "Disclose", desc: "Export an encrypted audit packet. Private by default, accountable by choice." },
            ].map((c, i) => (
              <React.Fragment key={c.word}>
                <Reveal delay={i * 150} className="flex-1">
                  <div className="u-card h-full p-8 text-left">
                    <h3 className="text-2xl font-semibold text-foreground">{c.word}</h3>
                    <p className="mt-2 text-base leading-relaxed text-muted-foreground">{c.desc}</p>
                  </div>
                </Reveal>
                {i < 2 && (
                  <div className="hidden shrink-0 items-center md:flex">
                    <span className="h-px w-6 bg-border" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          <Reveal delay={200}>
            <p className="mt-12 text-base italic text-[#9CA3AF]">
              Non-custodial. No trusted relayers. Our own zero-knowledge circuits — verified by a Stellar smart contract.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── Real-world money ── */}
      <Section className="relative isolate overflow-hidden">
        <Atmosphere src="/art/surface.png" align="bottom" opacity={0.4} scrim="vertical" />
        <div className="w-full max-w-4xl">
          <Reveal>
            <h2 className="text-center text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Built for real money.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground">
              Stablecoins and cross-border payments — what people actually use Stellar for — without
              putting your whole financial life on a public ledger.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { who: "A freelancer", line: "invoices a client abroad and gets paid in USDC — without exposing their rate, their volume, or every other client." },
              { who: "A donor", line: "funds a cause without broadcasting their wallet history to anyone who cares to look." },
              { who: "A business", line: "pays suppliers privately — then discloses the records to its accountant, by choice, with a viewing key." },
            ].map((p, i) => (
              <Reveal key={p.who} delay={i * 140}>
                <div className="u-card h-full p-6 text-left">
                  <p className="text-base leading-relaxed text-foreground">
                    <span className="font-semibold">{p.who}</span> {p.line}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Section 4 · The Reveal ── */}
      <Section className="relative isolate overflow-hidden bg-white/[0.02]">
        <Atmosphere src="/art/merkle.png" align="bottom" opacity={0.55} scrim="vertical" />
        <div className="w-full max-w-3xl text-center">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">What the chain sees.</h2>
          </Reveal>
          <Reveal delay={150}>
            <div className="u-card-lg mt-14 grid grid-cols-1 gap-y-10 p-8 text-left sm:grid-cols-2 sm:gap-x-10 sm:gap-y-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">What happened</p>
                <div className="mt-5 space-y-3 text-base leading-loose text-foreground">
                  <p>Alice creates a payment link.</p>
                  <p>Bob pays 100 USDC.</p>
                  <p>Alice withdraws 100 USDC.</p>
                </div>
              </div>
              <div className="border-t border-border pt-8 sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">What Stellar sees</p>
                <div className="mt-5">
                  <p className="text-base text-foreground">
                    Deposit: <span className="font-mono">100 USDC</span> → Pool
                  </p>
                  <div className="relative my-12 flex items-center justify-center">
                    <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
                      <Lock className="h-4 w-4 text-foreground" strokeWidth={2} />
                    </span>
                  </div>
                  <p className="-mt-9 mb-9 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#FF3B00]">
                    cannot be connected
                  </p>
                  <p className="text-base text-foreground">
                    Withdrawal: <span className="font-mono">100 USDC</span> → Alice
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <p className="mt-10 text-base leading-relaxed text-muted-foreground">
              The blockchain can verify every transaction is valid — without knowing who paid whom.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── Section 5 · How it works ── */}
      <Section>
        <div className="w-full max-w-3xl">
          <Reveal>
            <h2 className="text-center text-4xl font-bold tracking-tight text-foreground">Built on real cryptography.</h2>
          </Reveal>
          <div className="mt-14 space-y-8">
            {[
              ["Zero-knowledge proofs", "Every transaction includes a Groth16 proof: mathematical evidence that the rules were followed, with nothing else revealed."],
              ["On-chain verification", "The Stellar smart contract verifies each proof before releasing funds. No trusted servers. No relayers."],
              ["Confidential transfers", "Send a shielded note with the amount hidden on-chain — our own zero-knowledge circuit, not a third-party token. The chain sees a nullifier and a commitment, never a number."],
              ["Poseidon commitments", "Your funds become sealed commitments — cryptographic locks that only you can open."],
              ["Nullifier protection", "One-time nullifiers prevent double-spending. The math enforces it, not a company."],
            ].map(([title, desc], i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="flex gap-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] font-mono text-sm text-muted-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-base leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <p className="mt-14 text-center font-mono text-sm text-[#9CA3AF]">
              Circom circuits. BLS12-381. Soroban smart contracts. Verified on Stellar.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── Section 6 · Use cases ── */}
      <Section className="bg-white/[0.02]">
        <div className="w-full max-w-4xl">
          <Reveal>
            <h2 className="text-center text-4xl font-bold tracking-tight text-foreground">Private finance for Stellar.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {[
              ["Freelance payments", "Send an invoice link. Get paid without exposing your income on-chain."],
              ["Donations", "Accept contributions privately. Donors stay anonymous. Amounts stay hidden."],
              ["Payroll", "Pay your team without publishing every salary to the world."],
              ["Commerce", "Accept payments at checkout. Customers don't become public records."],
              ["Treasury", "Move organizational funds without broadcasting your strategy."],
              ["Creator payments", "Fans support creators privately. No public ledger of who paid what."],
            ].map(([title, desc], i) => (
              <Reveal key={title} delay={(i % 2) * 90}>
                <div className="u-card h-full p-6">
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <p className="mt-12 text-center text-base text-muted-foreground">
              Any application on Stellar can integrate Umbra.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── Section 7 · Trust ── */}
      <Section className="min-h-[50vh]">
        <Reveal>
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2"><Lock className="h-4 w-4" strokeWidth={2.25} /> Proofs verified on-chain</span>
              <span className="flex items-center gap-2"><Github className="h-4 w-4" strokeWidth={2} /> Open source</span>
              <span className="flex items-center gap-2"><Logo className="h-4 w-4" /> Built on Stellar</span>
            </div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              View the source code <ArrowRight className="inline h-3.5 w-3.5" />
            </a>
          </div>
        </Reveal>
      </Section>

      {/* ── Section 8 · Close ── */}
      <Section className="relative isolate min-h-screen overflow-hidden">
        <Atmosphere src="/art/og.png" align="center" opacity={0.5} scrim="radial" />
        <Reveal>
          <div className="text-center">
            <h2 className="text-5xl font-bold tracking-tight text-foreground md:text-6xl">Get paid privately.</h2>
            <p className="mt-5 text-xl text-muted-foreground">Create your first payment link in 30 seconds.</p>
            <Link href="/links" className="mt-10 inline-block">
              <Button size="lg" variant="secondary" className="px-10 py-5 text-lg">Create a payment link</Button>
            </Link>
          </div>
        </Reveal>
      </Section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center">
        <p className="text-xs text-[#9CA3AF]">Built for Stellar Hacks 2026 · Powered by zero-knowledge proofs</p>
      </footer>
    </div>
  );
}
