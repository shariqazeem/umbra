"use client";

// AnimatedNumber — counts a numeric value up/down when it changes (the premium-fintech
// "balance ticks" touch). Takes the already-formatted decimal string (e.g. stroopsToXlm
// output), matches its exact precision so the resting value is byte-identical to the
// source, and only animates on change (not on first mount). Respects reduced motion.
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

export function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  const target = Number.parseFloat(value);
  const safeTarget = Number.isFinite(target) ? target : 0;
  const decimals = value.includes(".") ? value.split(".")[1].length : 0;

  const [display, setDisplay] = useState(safeTarget);
  const prev = useRef(safeTarget);

  useEffect(() => {
    if (reduce || prev.current === safeTarget) {
      setDisplay(safeTarget);
      prev.current = safeTarget;
      return;
    }
    const controls = animate(prev.current, safeTarget, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = safeTarget;
    return () => controls.stop();
  }, [safeTarget, reduce]);

  // If the source wasn't a plain number (shouldn't happen for balances), fall back to it.
  if (!Number.isFinite(target)) return <span className={className}>{value}</span>;
  return <span className={className}>{display.toFixed(decimals)}</span>;
}
