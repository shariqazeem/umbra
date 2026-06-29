"use client";

import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  /** The raw value to place on the clipboard (address, hash, proof, balance). */
  value: string;
  /** Accessible label; defaults to a generic copy instruction. */
  label?: string;
  className?: string;
}

/**
 * Inline copy affordance for monospaced crypto data. Embodies the design rule:
 * "monospaced crypto data with copy actions". Pure UI — no crypto here.
 */
export function CopyButton({ value, label = "Copy value", className }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-sm border border-foreground bg-background text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
