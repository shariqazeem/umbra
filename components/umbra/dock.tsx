"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { Logo } from "@/components/umbra/ui";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/wallet", label: "Wallet" },
  { href: "/proof", label: "Proof" },
  { href: "/mainnet", label: "Mainnet" },
  { href: "/apps", label: "Apps" },
  { href: "/build", label: "Build" },
];

const SPRING = { type: "spring", stiffness: 260, damping: 28 } as const;

/**
 * The Dock — persistent chrome. A floating glass pill, centered, detached from the top edge.
 * The active item is a soft pill that SLIDES between items via a shared `layoutId` spring
 * (macOS segmented-control). Condenses on scroll-down, expands on scroll-up. Reduced motion:
 * no slide, no condense.
 */
export function Dock({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > last && y > 48) setCondensed(true);
        else if (y < last - 4) setCondensed(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4">
      <motion.nav
        aria-label="Primary"
        animate={{ scale: condensed && !reduce ? 0.96 : 1 }}
        transition={reduce ? { duration: 0 } : SPRING}
        style={{ transformOrigin: "top center" }}
        className={cn(
          "u-glass pointer-events-auto mt-4 flex items-center gap-0.5 rounded-full shadow-lg transition-[padding] duration-200",
          condensed ? "px-1.5 py-1" : "px-2 py-1.5",
        )}
      >
        <Link href="/" aria-label="Umbra home" className="flex items-center rounded-full p-1.5 transition-colors hover:bg-white/[0.06]">
          <Logo />
        </Link>
        {ITEMS.map((i) => {
          const active = isActive(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors active:scale-[0.96]",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="dock-active"
                  transition={reduce ? { duration: 0 } : SPRING}
                  className="absolute inset-0 rounded-full bg-white/[0.06]"
                />
              )}
              <span className="relative z-10">{i.label}</span>
            </Link>
          );
        })}
        <span className="mx-0.5 h-4 w-px bg-white/10" aria-hidden />
        <button
          type="button"
          onClick={onSearch}
          aria-label="Open command palette (Command K)"
          className="group flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground active:scale-[0.96]"
        >
          <Search className="h-3.5 w-3.5" />
          <kbd className="font-mono text-[10px] tracking-tight text-muted-foreground/80 group-hover:text-foreground/80">⌘K</kbd>
        </button>
      </motion.nav>
    </div>
  );
}
