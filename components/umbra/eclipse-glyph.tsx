"use client";

import { cn } from "@/lib/utils";

export type EclipseState = "idle" | "syncing" | "proving" | "success";

/**
 * The product icon, alive — a black disc ringed by a thin ember corona (pure CSS/SVG, no image).
 * The corona mirrors the REAL system state:
 *   idle    → corona at rest (a dim static ring)
 *   syncing → the corona rotates slowly (u-pool-spin)
 *   proving → the corona brightens and accelerates (u-corona-fast)
 *   success → one totality flare (a 400ms ring flash) then rest
 * Reduced motion: no rotation/flare, but the halo + ring brightness still shift per state, so
 * the eclipse reads statically. This is the app's heartbeat; its state tracks the system's.
 */
export function EclipseGlyph({
  state = "idle",
  size = 112,
  className,
}: {
  state?: EclipseState;
  size?: number;
  className?: string;
}) {
  const proving = state === "proving";
  const halo =
    state === "proving" ? "bg-[#FF3B00]/45" : state === "syncing" ? "bg-[#FF3B00]/25" : "bg-[#FF3B00]/15";
  const ring =
    state === "proving" ? "border-[#FF5A24]/90" : state === "syncing" ? "border-[#FF3B00]/70" : "border-[#FF3B00]/45";
  const coronaOpacity = state === "syncing" ? "opacity-70" : state === "proving" ? "opacity-100" : "opacity-0";
  const spin = state === "syncing" ? "u-pool-spin" : state === "proving" ? "u-corona-fast" : "";

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      {/* glow halo */}
      <div className={cn("absolute inset-[-14%] rounded-full blur-2xl transition-colors duration-500", halo)} />
      {/* corona — a bright arc that rotates, clipped into a ring by the black disc on top */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className={cn("absolute inset-0 rounded-full transition-opacity duration-500", coronaOpacity, spin)}
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(255,59,0,0.12) 22deg, #FF3B00 58deg, #FF7A47 84deg, #FF3B00 110deg, transparent 150deg)",
          }}
        />
      </div>
      {/* thin static ring of fire */}
      <div
        className={cn(
          "absolute inset-[6%] rounded-full border-2 transition-colors duration-500",
          ring,
          proving && "shadow-[0_0_18px_-2px_rgba(255,90,36,0.8)]",
        )}
      />
      {/* the black moon */}
      <div className="absolute inset-[9%] rounded-full bg-[#060606] shadow-[inset_0_1px_12px_rgba(0,0,0,0.9)]" />
      {/* totality flare — one bright ring flash on success, then it rests */}
      {state === "success" && (
        <div className="u-animate-flare absolute inset-[3%] rounded-full border-2 border-[#FF7A47] shadow-[0_0_26px_2px_rgba(255,90,36,0.85)]" />
      )}
    </div>
  );
}
