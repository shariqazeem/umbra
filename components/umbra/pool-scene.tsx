"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

// Signature scroll scene: assets orbit a dark pool, then get absorbed into it as you
// scroll — a tilted 3D plane, near-black with a faint ember core. No WebGL.

const TOKENS = [
  { sym: "XLM", angle: -90 },
  { sym: "USDC", angle: -20 },
  { sym: "BTC", angle: 45 },
  { sym: "ETH", angle: 145 },
  { sym: "SOL", angle: 215 },
];
const RING = 190;

function Token({ sym, angle, progress }: { sym: string; angle: number; progress: MotionValue<number> }) {
  const rad = (angle * Math.PI) / 180;
  const sx = Math.cos(rad) * RING;
  const sy = Math.sin(rad) * RING;
  const x = useTransform(progress, [0.05, 0.85], [sx, 0]);
  const y = useTransform(progress, [0.05, 0.85], [sy, 0]);
  const opacity = useTransform(progress, [0, 0.05, 0.75, 0.92], [0, 1, 1, 0]);
  const scale = useTransform(progress, [0.05, 0.85], [1, 0.35]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        style={{ x, y, opacity, scale }}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#141418] font-mono text-[11px] font-semibold text-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm"
      >
        {sym}
      </motion.div>
    </div>
  );
}

export function PoolScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const poolScale = useTransform(scrollYProgress, [0, 1], [0.9, 1.18]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [0.18, 0.6]);
  const labelOpacity = useTransform(scrollYProgress, [0, 0.12, 0.85, 1], [0, 1, 1, 0]);
  const captionOpacity = useTransform(scrollYProgress, [0.5, 0.75, 0.95], [0, 1, 0.4]);

  return (
    <section ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <motion.span
          style={{ opacity: labelOpacity }}
          className="absolute top-[16%] font-mono text-[11px] uppercase tracking-[0.34em] text-muted-foreground"
        >
          01 — Enter the pool
        </motion.span>

        {/* tilted 3D stage */}
        <div className="relative flex h-[440px] w-[440px] max-w-[90vw] items-center justify-center [perspective:1100px]">
          <div className="relative flex h-full w-full items-center justify-center [transform:rotateX(18deg)] [transform-style:preserve-3d]">
            {TOKENS.map((t) => (
              <Token key={t.sym} sym={t.sym} angle={t.angle} progress={scrollYProgress} />
            ))}

            {/* the pool */}
            <motion.div style={{ scale: poolScale }} className="relative flex h-44 w-44 items-center justify-center rounded-full">
              <motion.div aria-hidden style={{ opacity: glowOpacity }} className="absolute inset-[-45%] rounded-full bg-[#FF3B00]/40 blur-[64px]" />
              <div className="u-pool-spin absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,59,0,0.45),transparent_55%)] opacity-60" />
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_32%_26%,#202028,#0a0a0b_72%)] shadow-[inset_0_2px_50px_rgba(0,0,0,0.85)]">
                <span className="font-display text-sm font-extrabold uppercase tracking-[0.2em] text-white/70">Pool</span>
              </div>
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
