"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CinematicBackground, SmoothScroll } from "@/components/umbra/cinematic";
import { Dock } from "@/components/umbra/dock";
import { CommandPalette } from "@/components/umbra/command-palette";
import { PageTransition } from "@/components/umbra/page-transition";

/**
 * The persistent app chrome, mounted once in the root layout so it NEVER remounts on navigation
 * — which is what lets the Dock's active pill slide (shared layoutId) and the content transition
 * beneath fixed chrome. The Dock is hidden on the marketing landing (its own header) and on the
 * standalone /pay receipt. Lenis smooth-scroll runs on the landing only; app routes get native
 * scroll with hidden scrollbars (the `u-app-scroll` class on <html>).
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isPay = pathname.startsWith("/pay");
  const showDock = !isLanding && !isPay;
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K toggles the command palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // App routes: native scroll, hidden scrollbars, app cursor. Landing: Lenis + normal scrollbar.
  useEffect(() => {
    document.documentElement.classList.toggle("u-app-scroll", !isLanding);
    return () => document.documentElement.classList.remove("u-app-scroll");
  }, [isLanding]);

  return (
    <>
      <CinematicBackground />
      {isLanding && <SmoothScroll />}
      {showDock && <Dock onSearch={() => setPaletteOpen(true)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* The landing runs its own scroll-pinned scenes (PoolScene) — never inside a transform
          boundary, which would break its sticky/fixed positioning. Everything else transitions. */}
      {isLanding ? children : <PageTransition>{children}</PageTransition>}
    </>
  );
}
