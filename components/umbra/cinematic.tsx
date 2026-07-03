"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/** Buttery, ultra-modern smooth scrolling for the landing. Renders nothing. */
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const GRID: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "64px 64px",
  WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 22%, #000 30%, transparent 75%)",
  maskImage: "radial-gradient(ellipse 75% 60% at 50% 22%, #000 30%, transparent 75%)",
};

/**
 * Living, cinematic backdrop — stays near-black, with deep, desaturated color washes
 * drifting slowly through it (not loud glows). A faint grid, film grain, and a heavy
 * vignette keep it moody. GPU-only transforms; respects reduced motion.
 */
export function CinematicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#080809]">
      {/* deep cool + plum washes — barely-there color movement in the dark */}
      <div className="u-aurora-2 absolute -left-[14%] top-[2%] h-[70vh] w-[70vh] rounded-full bg-[#0e1530] opacity-70 blur-[150px]" />
      <div className="u-aurora-3 absolute -right-[12%] top-[48%] h-[64vh] w-[64vh] rounded-full bg-[#170d22] opacity-70 blur-[160px]" />
      {/* one faint ember, kept dim and concentrated */}
      <div className="u-aurora-1 absolute left-[30%] top-[18%] h-[48vh] w-[48vh] rounded-full bg-[#FF3B00] opacity-[0.06] blur-[150px]" />
      <div className="absolute inset-0" style={GRID} />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-soft-light" style={{ backgroundImage: GRAIN }} />
      {/* Film grain plate — above the washes, below content. */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: "url(/art/grain.png)", backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.78))]" />
    </div>
  );
}
