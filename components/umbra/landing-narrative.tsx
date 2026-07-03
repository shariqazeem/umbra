"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Github, Lock } from "lucide-react";
import { Button, Eyebrow, Logo } from "@/components/umbra/ui";
import { Atmosphere } from "@/components/umbra/atmosphere";
import { PoolScene } from "@/components/umbra/pool-scene";
import { CopyButton } from "@/components/copy-button";
import { UMBRA_CONFIG } from "@/lib/umbra/config";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/shariqazeem/umbra";

// Tiny blur-up placeholder for the priority hero plate (a 20px JPEG of the eclipse).
const HERO_BLUR =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAFKADAAQAAAABAAAACAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgACAAUAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAExMTExMTIBMTIC0gICAtPS0tLS09TT09PT09TV1NTU1NTU1dXV1dXV1dXXBwcHBwcIODg4ODk5OTk5OTk5OTk//bAEMBFxgYJSMlQCMjQJloVWiZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmf/dAAQAAv/aAAwDAQACEQMRAD8A4unMQelMooAKKKKAP//Z";

const POOL_ID = UMBRA_CONFIG.poolContractId;

/* ───────────────────────  scroll primitives (IO-based, fire once)  ─────────────────────── */

function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.2) {
  const ref = React.useRef<T>(null);
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

/** Generic rise + fade reveal — transform + opacity only; instant under reduced motion. */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Stamp-in — scale 1.04 → 1, opacity 0 → 1. The problem words land like a rubber stamp. */
function Stamp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.35);
  return (
    <span
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "inline-block transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
        inView ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The one section-header pattern: eyebrow → Archivo statement → one lede. */
function SectionHead({
  eyebrow,
  statement,
  lede,
  className,
}: {
  eyebrow: string;
  statement: React.ReactNode;
  lede?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      <Reveal>
        <Eyebrow className="tracking-[0.28em]">{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={90}>
        <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
          {statement}
        </h2>
      </Reveal>
      {lede ? (
        <Reveal delay={170}>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lede}</p>
        </Reveal>
      ) : null}
    </div>
  );
}

/** Interior content section — strict 160px cadence (80px top + 80px bottom between neighbours). */
function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("relative scroll-mt-20 px-6 py-20", className)}>
      {children}
    </section>
  );
}

/* ───────────────────────  the narrative  ─────────────────────── */

export function LandingNarrative() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  // Scroll-linked hero. Under reduced motion we freeze every range to its resting value — and since
  // that resting value is index 0 of each range, SSR and the first client render stay identical
  // (no hydration desync), while a reduced-motion reader simply gets a still eclipse.
  const heroRef = React.useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const R = (a: number, b: number): [number, number] => (reduce ? [a, a] : [a, b]);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const typeY = useTransform(scrollYProgress, [0, 1], R(0, -90));
  const typeScale = useTransform(scrollYProgress, [0, 1], R(1, 0.92));
  const typeOpacity = useTransform(scrollYProgress, [0, 0.85], R(1, 0));
  const artScale = useTransform(scrollYProgress, [0, 1], R(1, 1.08)); // the eclipse disc swells
  const artOpacity = useTransform(scrollYProgress, [0, 1], R(1, 0.7));
  const coronaOpacity = useTransform(scrollYProgress, [0, 1], R(0.14, 0.72)); // …and the corona brightens

  // Type sequence on load — staggered 80ms rise + fade, instant under reduced motion.
  const lineCls = cn(
    "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none",
    mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
  );
  const stagger = (i: number): React.CSSProperties => ({ transitionDelay: `${i * 80}ms` });

  return (
    <div className="relative">
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

      {/* ── 1 · HERO — the eclipse ── */}
      <section
        ref={heroRef}
        className="relative flex min-h-screen flex-col items-center justify-end overflow-hidden px-6 pb-[9vh] pt-24 text-center"
      >
        {/* the scene — /art/hero.png; scroll swells the disc */}
        <motion.div aria-hidden style={{ opacity: artOpacity, scale: artScale }} className="absolute inset-0 -z-10">
          <Atmosphere src="/art/hero.png" align="center" opacity={1} scrim="none" priority blurDataURL={HERO_BLUR} />
        </motion.div>
        {/* corona — brightens as the reader scrolls into the pool (light responds to the reader) */}
        <motion.div
          aria-hidden
          style={{ opacity: coronaOpacity }}
          className="pointer-events-none absolute left-1/2 top-[30%] h-[420px] w-[600px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF3B00]/20 blur-[120px]"
        />
        {/* bottom scrim — keeps the type legible over the ocean without dimming the eclipse */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-background via-background/70 to-transparent" aria-hidden />

        <motion.div style={{ y: typeY, scale: typeScale, opacity: typeOpacity }} className="relative max-w-5xl">
          <span
            style={stagger(0)}
            className={cn(lineCls, "mb-7 inline-block font-mono text-[11px] uppercase tracking-[0.32em] text-[#FF3B00]")}
          >
            The privacy layer for Stellar
          </span>
          {["Private money", "on Stellar."].map((l, i) => (
            <h1
              key={l}
              style={stagger(1 + i)}
              className={cn(
                lineCls,
                "font-display text-6xl font-black uppercase leading-[0.9] tracking-tight text-foreground md:text-8xl",
              )}
            >
              {l}
            </h1>
          ))}
          <p
            style={stagger(3)}
            className={cn(lineCls, "mx-auto mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl")}
          >
            The part of the ledger light can&rsquo;t reach.
          </p>
          <div
            style={stagger(4)}
            className={cn(lineCls, "mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row")}
          >
            <Link href="/wallet">
              <Button size="lg" variant="primary">Open the wallet</Button>
            </Link>
            <Button size="lg" variant="ghost" onClick={scrollTo("how")}>
              See how it works
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── 2 · POOL — the absorption scene ── */}
      <div id="how">
        <PoolScene />
      </div>

      {/* ── 3 · PROBLEM — colorless surveillance (no Ember) ── */}
      <Section id="problem" className="py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Eyebrow className="tracking-[0.28em]">The status quo</Eyebrow>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
              Every payment you receive is public.
            </h2>
          </Reveal>
          <div className="mt-16 space-y-6">
            {[
              ["Your freelance invoice.", "Visible."],
              ["Your donation.", "Traced."],
              ["Your salary.", "Searchable."],
            ].map(([lead, word], i) => (
              <p key={word} className="text-lg text-muted-foreground md:text-xl">
                {lead}{" "}
                <Stamp
                  delay={i * 90}
                  className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
                >
                  {word}
                </Stamp>
              </p>
            ))}
          </div>
          <Reveal delay={150}>
            <p className="mx-auto mt-16 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Blockchains are transparent by design. That transparency comes at a cost: your financial privacy.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ── 4 · SOLUTION — the ember hairline draws as the fix ignites ── */}
      <Section>
        <SectionHead
          eyebrow="The fix"
          statement="Umbra makes payments private on Stellar."
        />
        <div className="mx-auto mt-16 flex max-w-4xl flex-col items-stretch gap-4 md:flex-row">
          {[
            { word: "Shield", desc: "Move funds into the pool — a deposit no one can link to you later." },
            { word: "Send", desc: "Transfer a shielded note privately — the amount hidden on-chain — or cash out, unlinkable from where the money came." },
            { word: "Disclose", desc: "Export an encrypted audit packet. Private by default, accountable by choice." },
          ].map((c, i) => (
            <HairlineCard key={c.word} delay={i * 150} word={c.word} desc={c.desc} />
          ))}
        </div>
        <Reveal delay={200}>
          <p className="mt-12 text-center text-base italic text-muted-foreground">
            Non-custodial. No trusted relayers. Our own zero-knowledge circuits — verified by a Stellar smart contract.
          </p>
        </Reveal>
      </Section>

      {/* ── 5 · REAL MONEY — /art/surface.png full-bleed, darkened ── */}
      <section className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-6 py-28">
        <Atmosphere src="/art/surface.png" align="bottom" opacity={0.3} scrim="vertical" />
        <div className="absolute inset-0 -z-10 bg-background/40" aria-hidden />
        <div className="mx-auto w-full max-w-4xl">
          <SectionHead
            eyebrow="Built for real money"
            statement="Stablecoins. Payroll. Cross-border."
            lede="What people actually use Stellar for — without putting your whole financial life on a public ledger."
          />
          <div className="mt-16 grid gap-4 md:grid-cols-3">
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
      </section>

      {/* ── 6 · REVEAL — what the chain sees; /art/merkle.png at 20% ── */}
      <section className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-6 py-28">
        <Atmosphere src="/art/merkle.png" align="center" opacity={0.2} scrim="radial" />
        <div className="mx-auto w-full max-w-3xl text-center">
          <SectionHead eyebrow="What the chain sees" statement="Verifiable, yet unlinkable." />
          <Reveal delay={150}>
            <div className="u-card-lg mt-16 grid grid-cols-1 gap-y-10 p-8 text-left sm:grid-cols-2 sm:gap-x-10 sm:gap-y-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happened</p>
                <div className="mt-5 space-y-3 text-base leading-loose text-foreground">
                  <p>Alice creates a payment link.</p>
                  <p>Bob pays 100 USDC.</p>
                  <p>Alice withdraws 100 USDC.</p>
                </div>
              </div>
              <div className="border-t border-border pt-8 sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What Stellar sees</p>
                <div className="mt-5">
                  <p className="text-base text-foreground">
                    Deposit: <span className="font-mono">100 USDC</span> → Pool
                  </p>
                  <div className="relative my-12 flex items-center justify-center">
                    <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
                    {/* the seal, with a slow corona pulse behind it */}
                    <span aria-hidden className="u-animate-corona absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF3B00]/25 blur-md" />
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
      </section>

      {/* ── 7 · HOW IT WORKS — 160px cadence, one header pattern ── */}
      <Section>
        <SectionHead eyebrow="Under the hood" statement="Built on real cryptography." />
        <div className="mx-auto mt-16 max-w-3xl space-y-8">
          {[
            ["Zero-knowledge proofs", "Every transaction includes a Groth16 proof: mathematical evidence that the rules were followed, with nothing else revealed."],
            ["On-chain verification", "The Stellar smart contract verifies each proof before releasing funds. No trusted servers. No relayers."],
            ["Confidential transfers", "Send a shielded note with the amount hidden on-chain — our own zero-knowledge circuit, not a third-party token. The chain sees a nullifier and a commitment, never a number."],
            ["Poseidon commitments", "Your funds become sealed commitments — cryptographic locks that only you can open."],
            ["Nullifier protection", "One-time nullifiers prevent double-spending. The math enforces it, not a company."],
          ].map(([title, desc], i) => (
            <Reveal key={title} delay={i * 90}>
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
          <p className="mx-auto mt-16 max-w-3xl text-center font-mono text-sm text-muted-foreground">
            Circom circuits. BLS12-381. Soroban smart contracts. Verified on Stellar.
          </p>
        </Reveal>
      </Section>

      {/* ── 7 · USE CASES ── */}
      <Section>
        <SectionHead eyebrow="Where it fits" statement="Private finance for Stellar." />
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2">
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
          <p className="mt-12 text-center text-base text-muted-foreground">Any application on Stellar can integrate Umbra.</p>
        </Reveal>
      </Section>

      {/* ── 7 · TRUST ── */}
      <Section>
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

      {/* ── 8 · CLOSE — /art/og.png eclipse; end on a verifiable fact ── */}
      <section className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-28 text-center">
        <Atmosphere src="/art/og.png" align="center" opacity={0.55} scrim="radial" />
        <Reveal>
          <h2 className="font-display text-5xl font-black tracking-tight text-foreground md:text-7xl">
            Get paid privately.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-6 text-xl text-muted-foreground">Create your first payment link in 30 seconds.</p>
        </Reveal>
        <Reveal delay={220}>
          <Link href="/links" className="mt-10 inline-block">
            <Button size="lg" variant="secondary" className="px-10 py-5 text-lg">Create a payment link</Button>
          </Link>
        </Reveal>
        {POOL_ID ? (
          <Reveal delay={320}>
            <div className="mt-14 flex flex-col items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground/70">
                Live pool · Stellar mainnet
              </span>
              <div className="flex items-center gap-2">
                <code className="max-w-[80vw] truncate font-mono text-xs text-muted-foreground sm:text-sm">{POOL_ID}</code>
                <CopyButton value={POOL_ID} label="Copy pool contract ID" />
              </div>
            </div>
          </Reveal>
        ) : null}
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center">
        <p className="text-xs text-muted-foreground">Built for Stellar Hacks 2026 · Powered by zero-knowledge proofs</p>
      </footer>
    </div>
  );
}

/* ── solution card with an ember hairline that draws along the top edge on enter ── */
function HairlineCard({ word, desc, delay }: { word: string; desc: string; delay: number }) {
  const { ref, inView } = useInView(0.3);
  return (
    <div ref={ref} className="relative flex-1 overflow-hidden rounded-2xl">
      {/* the ember hairline — scales from the left as the fix ignites */}
      <span
        aria-hidden
        style={{ transitionDelay: `${delay}ms` }}
        className={cn(
          "absolute inset-x-0 top-0 z-10 h-px origin-left bg-[#FF3B00] shadow-[0_0_8px_0_rgba(255,59,0,0.7)] transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
          inView ? "scale-x-100" : "scale-x-0",
        )}
      />
      <div className="u-card h-full p-8 text-left">
        <h3 className="text-2xl font-semibold text-foreground">{word}</h3>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
