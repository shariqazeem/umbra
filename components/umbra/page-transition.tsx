"use client";

import { useContext, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Freeze the Next App-Router context during the exit animation, so the OUTGOING route keeps
 * rendering its last committed tree while it animates out (without it, Next swaps the subtree
 * to the new route immediately and the exit flashes). This is the standard App-Router +
 * AnimatePresence bridge.
 */
function FrozenRouter({ children }: { children: ReactNode }) {
  const context = useContext(LayoutRouterContext ?? ({} as never));
  const frozen = useRef(context).current;
  if (!frozen) return <>{children}</>;
  return <LayoutRouterContext.Provider value={frozen}>{children}</LayoutRouterContext.Provider>;
}

// Totality's signature spring.
const SPRING = { type: "spring", stiffness: 260, damping: 28, mass: 0.9 } as const;

/**
 * The shared page-transition layer. Content moves; the chrome (Dock) is a sibling above this
 * and never transitions. Incoming rises 12px on a 260/28 spring while the outgoing fades and
 * scales to 0.985 — a ~250ms crossfade. Reduced motion → instant swap.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <div key={pathname}>{children}</div>;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: SPRING }}
        exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
        className="relative min-h-screen"
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
