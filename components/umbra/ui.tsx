"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Atmosphere } from "@/components/umbra/atmosphere";

/* ─────────────────────────────  Button (ink, never signal)  ───────────────────────────── */

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] select-none whitespace-nowrap active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B00]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-[#FF5A24] to-[#FF3B00] text-white shadow-[0_6px_26px_-8px_rgba(255,59,0,0.6),inset_0_1px_0_rgba(255,255,255,0.22)] hover:from-[#FF6A38] hover:to-[#FF4810] hover:shadow-[0_8px_32px_-6px_rgba(255,59,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]",
        secondary: "border border-white/10 bg-white/[0.04] text-foreground hover:border-white/20 hover:bg-white/[0.08]",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-foreground underline underline-offset-4 hover:opacity-70",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "px-8 py-4 text-base",
        block: "w-full py-4 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(button({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ─────────────────────────────  Card  ───────────────────────────── */

export function Card({
  className,
  elevated,
  glass,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean; glass?: boolean }) {
  return <div className={cn(glass ? "u-glass rounded-2xl" : elevated ? "u-card-lg" : "u-card", className)} {...props} />;
}

/* ─────────────────────────────  Fields  ───────────────────────────── */

const inputBase =
  "w-full rounded-xl border border-border bg-[#0e0e10] px-4 py-3 text-[15px] transition-all duration-200 placeholder:text-muted-foreground/50 outline-none focus-visible:border-[#FF3B00]/60 focus-visible:bg-[#121214] focus-visible:ring-4 focus-visible:ring-[#FF3B00]/10";

export function Field({
  label,
  hint,
  mono,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input className={cn(inputBase, mono && "font-mono text-sm", className)} {...props} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea rows={3} className={cn(inputBase, "resize-none", className)} {...props} />
    </label>
  );
}

export function AmountField({
  label,
  suffix = "XLM",
  hero = false,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; suffix?: string; hero?: boolean }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="relative">
        <input
          className={cn(inputBase, "font-mono", hero ? "py-4 pr-24 text-4xl tracking-tight" : "pr-16", className)}
          inputMode="decimal"
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 font-mono text-muted-foreground",
            hero ? "right-5 text-xl" : "right-4 text-sm",
          )}
        >
          {suffix}
        </span>
      </div>
    </label>
  );
}

/* ─────────────────────────────  Labels & status  ───────────────────────────── */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "signal" | "ink" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    ink: "bg-foreground/[0.04] text-foreground",
    signal: "bg-[#FF3B00]/10 text-[#FF3B00]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

/* ─────────────────────────────  App shell  ───────────────────────────── */

/**
 * Per-route content frame. The persistent chrome — Dock, cinematic background, page transitions —
 * is provided once by `AppChrome` in the root layout, so Shell only centers the page content and
 * layers optional per-route atmosphere art. Top padding clears the floating Dock. `active` is
 * accepted for backwards-compat and ignored (the Dock derives the active route from the path).
 */
export function Shell({
  children,
  atmosphere,
}: {
  children: React.ReactNode;
  active?: string;
  atmosphere?: string;
}) {
  return (
    <div className="relative min-h-screen">
      {atmosphere ? <Atmosphere src={atmosphere} fixed opacity={0.26} scrim="top" /> : null}
      <main className="relative z-10 mx-auto max-w-shell px-6 pb-20 pt-24 sm:pt-28">{children}</main>
    </div>
  );
}

/* ─────────────────────────────  Logo (pure ink, no signal)  ───────────────────────────── */

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-foreground", className)} aria-hidden>
      <span className="h-2.5 w-2.5 rounded-[3px] bg-background" />
    </span>
  );
}
