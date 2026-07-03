"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Shield } from "lucide-react";
import { Card, Eyebrow, Shell } from "@/components/umbra/ui";
import { CryptoTimeline, SHIELD_STEPS } from "@/components/umbra/crypto-timeline";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

/** The app's art as a small header emblem — the one "accent" that distinguishes the trio. */
function Emblem({ art, className }: { art: string; className?: string }) {
  return (
    <span className={cn("relative flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10", className)}>
      <Image src={art} alt="" fill sizes="48px" className="object-cover" />
    </span>
  );
}

/**
 * The shared skeleton for the three link creators (/links, /donate, /invoice). Identical form
 * anatomy and proving/success treatment — only the art emblem and copy change. Behavior stays
 * with each page (state + createPaymentLink); this owns only the presentation.
 */
export function CreatorScaffold({
  active,
  art,
  eyebrow,
  title,
  blurb,
  secureLine,
  proving,
  created,
  url,
  successTitle,
  successSub,
  successNote,
  onReset,
  resetLabel = "Create another",
  children,
}: {
  active: string;
  art: string;
  eyebrow: string;
  title: string;
  blurb: string;
  secureLine: string;
  proving: boolean;
  created: boolean;
  url: string;
  successTitle: string;
  successSub?: ReactNode;
  successNote: string;
  onReset: () => void;
  resetLabel?: string;
  children: ReactNode;
}) {
  return (
    <Shell active={active}>
      <div className="mx-auto max-w-prose">
        {!created ? (
          <>
            <div className="flex items-center gap-4">
              <Emblem art={art} />
              <div>
                <Eyebrow>{eyebrow}</Eyebrow>
                <h1 className="mt-1.5 font-display text-3xl font-extrabold uppercase tracking-tight text-foreground">
                  {title}
                </h1>
              </div>
            </div>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{blurb}</p>

            <Card className="mt-8 p-6 sm:p-7">
              {proving ? <CryptoTimeline steps={SHIELD_STEPS} running={proving} done={false} /> : children}
            </Card>

            {!proving && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
                {secureLine}
              </p>
            )}
          </>
        ) : (
          <Card glass className="animate-fade-up mt-2 p-8 text-center">
            <Emblem art={art} className="mx-auto" />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{successTitle}</h1>
            {successSub ? <p className="mt-2 text-sm text-muted-foreground">{successSub}</p> : null}

            <div className="mx-auto mt-7 w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG value={url} size={188} marginSize={0} />
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/[0.04] p-2 pl-4 text-left">
              <span className="flex-1 truncate font-mono text-sm text-muted-foreground">{url}</span>
              <CopyButton
                value={url}
                className="size-8 shrink-0 rounded-lg border-border bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground"
              />
            </div>

            <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">{successNote}</p>

            <button
              className="mt-6 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              onClick={onReset}
            >
              {resetLabel}
            </button>
          </Card>
        )}
      </div>
    </Shell>
  );
}
