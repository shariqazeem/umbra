"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

// Signature scroll scene: assets orbit a dark pool, then get absorbed into it one by one as you
// scroll — a tilted stage over /art/pool.png. Each absorption fires an expanding corona ripple
// from the rim and a 1px flash of the ember rim. No WebGL; transform + opacity only.

const RING = 196;

// Each token is pulled into the pool at its own moment, staggered down the scroll.
const TOKENS = [
  { sym: "XLM", angle: -90, at: 0.34 },
  { sym: "USDC", angle: -18, at: 0.47 },
  { sym: "BTC", angle: 48, at: 0.6 },
  { sym: "ETH", angle: 150, at: 0.73 },
  { sym: "SOL", angle: 218, at: 0.85 },
];

function coords(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * RING, y: Math.sin(rad) * RING };
}

const chip =
  "flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#141418] font-mono text-[11px] font-semibold text-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm";

/* ── moving token (scroll-scrubbed) ── */
function Token({ sym, angle, at, progress }: { sym: string; angle: number; at: number; progress: MotionValue<number> }) {
  const { x: sx, y: sy } = coords(angle);
  const x = useTransform(progress, [at - 0.18, at], [sx, 0]);
  const y = useTransform(progress, [at - 0.18, at], [sy, 0]);
  const opacity = useTransform(progress, [0.02, 0.1, at - 0.03, at], [0, 1, 1, 0]);
  const scale = useTransform(progress, [at - 0.18, at], [1, 0.3]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div style={{ x, y, opacity, scale }} className={chip}>
        {sym}
      </motion.div>
    </div>
  );
}

/* ── single corona ripple, expanding from the rim at the moment of absorption ── */
function Ripple({ at, progress }: { at: number; progress: MotionValue<number> }) {
  // ~0.11 of scroll ≈ the 600ms ring at a natural reading pace: scale out, fade to nothing.
  const scale = useTransform(progress, [at - 0.02, at + 0.11], [0.52, 2.0]);
  const opacity = useTransform(progress, [at - 0.02, at + 0.008, at + 0.11], [0, 0.75, 0]);
  return (
    <motion.svg
      aria-hidden
      style={{ scale, opacity }}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      width="320"
      height="320"
      viewBox="0 0 320 320"
    >
      <circle cx="160" cy="160" r="118" fill="none" stroke="#FF3B00" strokeWidth="1.5" />
    </motion.svg>
  );
}

/* ── static composed frame for reduced motion: everything visible, nothing pinned ── */
function StaticPool() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <span className="mb-10 font-mono text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
        01 — Enter the pool
      </span>
      <div className="relative flex h-[300px] w-[300px] max-w-[86vw] items-center justify-center">
        {TOKENS.map((t) => {
          const { x, y } = coords(t.angle);
          return (
            <div key={t.sym} className="absolute" style={{ transform: `translate(${x * 0.7}px, ${y * 0.7}px)` }}>
              <div className={chip}>{t.sym}</div>
            </div>
          );
        })}
        <div className="relative flex h-[280px] w-[280px] items-center justify-center">
          <div aria-hidden className="absolute inset-[-4%] rounded-full bg-[#FF3B00]/25 blur-[60px]" />
          <div className="relative h-[240px] w-[240px] overflow-hidden rounded-full border border-[#FF3B00]/40 shadow-[0_0_50px_-4px_rgba(255,59,0,0.5)]">
            <Image src="/art/pool.png" alt="" fill sizes="260px" className="scale-110 object-cover brightness-[1.35]" />
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-extrabold uppercase tracking-[0.2em] text-white/70">
              Pool
            </span>
          </div>
        </div>
      </div>
      <p className="mt-12 max-w-md text-center text-[15px] leading-relaxed text-muted-foreground">
        Shield any asset into one private pool. Once inside, deposits and withdrawals can&rsquo;t be linked.
      </p>
    </section>
  );
}

export function PoolScene() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const poolScale = useTransform(scrollYProgress, [0, 1], [0.9, 1.16]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [0.16, 0.62]);
  const labelOpacity = useTransform(scrollYProgress, [0, 0.12, 0.85, 1], [0, 1, 1, 0]);
  const captionOpacity = useTransform(scrollYProgress, [0.5, 0.75, 0.95], [0, 1, 0.4]);
  // One multi-spike rim flash — the ember rim ignites for a beat as each token is swallowed.
  const rimFlash = useTransform(
    scrollYProgress,
    TOKENS.flatMap((t) => [t.at - 0.012, t.at, t.at + 0.03]),
    TOKENS.flatMap(() => [0, 1, 0]),
  );

  // Reduced motion → a static frame, only after mount so SSR/first client render match (no
  // hydration desync — the reduced-motion structural branch cannot differ during hydration).
  if (reduce && mounted) return <StaticPool />;

  return (
    <section ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <motion.span
          style={{ opacity: labelOpacity }}
          className="absolute top-[16%] font-mono text-[11px] uppercase tracking-[0.34em] text-muted-foreground"
        >
          01 — Enter the pool
        </motion.span>

        {/* tilted stage — a shallow basin viewed at an angle */}
        <div className="relative flex h-[440px] w-[440px] max-w-[92vw] items-center justify-center [perspective:1200px]">
          <div className="relative flex h-full w-full items-center justify-center [transform:rotateX(14deg)] [transform-style:preserve-3d]">
            {TOKENS.map((t) => (
              <Token key={t.sym} sym={t.sym} angle={t.angle} at={t.at} progress={scrollYProgress} />
            ))}

            {/* absorption ripples — one per token, expanding from the rim */}
            {TOKENS.map((t) => (
              <Ripple key={`r-${t.sym}`} at={t.at} progress={scrollYProgress} />
            ))}

            {/* the pool */}
            <motion.div style={{ scale: poolScale }} className="relative flex h-[300px] w-[300px] items-center justify-center">
              <motion.div aria-hidden style={{ opacity: glowOpacity }} className="absolute inset-[-25%] rounded-full bg-[#FF3B00]/45 blur-[70px]" />
              {/* pool material */}
              <div className="relative h-[280px] w-[280px] overflow-hidden rounded-full border border-[#FF3B00]/35 shadow-[inset_0_2px_50px_rgba(0,0,0,0.7)]">
                <Image src="/art/pool.png" alt="" fill sizes="300px" className="scale-110 object-cover brightness-[1.3]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-sm font-extrabold uppercase tracking-[0.2em] text-white/75">Pool</span>
                </div>
              </div>
              {/* 1px ember rim — flashes as each token is swallowed */}
              <motion.div
                aria-hidden
                style={{ opacity: rimFlash }}
                className="pointer-events-none absolute h-[280px] w-[280px] rounded-full border border-[#FF3B00] shadow-[0_0_18px_0_rgba(255,59,0,0.7)]"
              />
            </motion.div>
          </div>
        </div>

        <motion.p
          style={{ opacity: captionOpacity }}
          className="absolute bottom-[15%] max-w-md text-center text-[15px] leading-relaxed text-muted-foreground"
        >
          Shield any asset into one private pool. Once inside, deposits and withdrawals can&rsquo;t be linked.
        </motion.p>
      </div>
    </section>
  );
}
