"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Premium success indicator — a ring that draws on and a check that strokes in,
 * over a soft signal glow. Replaces the flat green disc. On-theme (dark + ember).
 */
export function SuccessMark({ size = 60, className }: { size?: number; className?: string }) {
  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <div aria-hidden className="absolute inset-[-30%] rounded-full bg-[#FF3B00]/18 blur-2xl" />
      <svg viewBox="0 0 52 52" width={size} height={size} className="relative">
        {/* faint base ring */}
        <circle cx="26" cy="26" r="24" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
        {/* drawing ember ring */}
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="#FF3B00"
          strokeWidth="2"
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
          initial={{ pathLength: 0, opacity: 0.6 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease }}
        />
        {/* stroking check */}
        <motion.path
          d="M15.5 26.5 l7 7 l14 -15.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.55, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}
