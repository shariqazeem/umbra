"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Lock } from "lucide-react";
import { Button, Eyebrow, Logo } from "@/components/umbra/ui";
import {
  inviteContactEmail,
  isInviteRequired,
  isUnlocked,
  setUnlocked,
  verifyInviteCode,
} from "@/lib/umbra/invite";
import { ACTIVE_NETWORK, FLAGS, isCanaryActive } from "@/lib/umbra/network";
import { cn } from "@/lib/utils";

/**
 * Invite-only access gate for the early-access launch. Wraps a route's children: when the gate
 * is armed (NEXT_PUBLIC_UMBRA_INVITE_REQUIRED=true) and this browser has not unlocked, it shows
 * a request-access screen instead of the app. It is an honest UX funnel — see lib/umbra/invite.ts
 * on why this is NOT an on-chain control — paired with the hard per-deposit cap in network.ts.
 */
export function InviteGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlockedState] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUnlockedState(isUnlocked());
  }, []);

  // Open access (gate disarmed) or already unlocked → pass straight through.
  if (!isInviteRequired() || (mounted && unlocked)) return <>{children}</>;
  // localStorage is client-only; render nothing until mounted to avoid a hydration flash.
  if (!mounted) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(false);
    const ok = await verifyInviteCode(code);
    setChecking(false);
    if (ok) {
      setUnlocked();
      setUnlockedState(true);
    } else {
      setError(true);
    }
  }

  const capXlm = isCanaryActive() ? Number(FLAGS.MAX_MAINNET_DEPOSIT / 10_000_000n) : 0;
  const email = inviteContactEmail();
  const mailto =
    email &&
    `mailto:${email}?subject=${encodeURIComponent("Umbra — early access request")}&body=${encodeURIComponent(
      "Hi — I'd like an invite code for Umbra early access.\n\nMy Stellar address: ",
    )}`;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Umbra</span>
        </div>

        <Eyebrow className="text-[#FF3B00]">Invite-only early access</Eyebrow>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Request access</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {ACTIVE_NETWORK === "mainnet"
            ? isCanaryActive()
              ? `Umbra is live on Stellar mainnet as an experimental, capped canary (max ${capXlm} XLM per deposit). Self-reviewed, not independently audited — enter your invite code to continue.`
              : "Umbra is pointed at mainnet. Enter your invite code to continue."
            : "Umbra is in private early access on Stellar testnet. Enter your invite code to continue."}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(false);
              }}
              autoFocus
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="UMBRA-XXXX-XXXX"
              aria-label="Invite code"
              className={cn(
                "w-full rounded-xl border bg-[#0e0e10] py-3 pl-11 pr-4 font-mono text-sm tracking-wide outline-none transition-all duration-200 placeholder:text-muted-foreground/40 focus-visible:bg-[#121214] focus-visible:ring-4 focus-visible:ring-[#FF3B00]/10",
                error ? "border-destructive/60" : "border-border focus-visible:border-[#FF3B00]/60",
              )}
            />
          </div>
          {error && <p className="text-xs text-destructive">That code isn’t valid. Check it and try again.</p>}
          <Button type="submit" variant="secondary" size="block" loading={checking} disabled={!code.trim()}>
            <Lock className="h-4 w-4" />
            Unlock access
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-5 text-sm">
          {mailto ? (
            <p className="text-muted-foreground">
              No code?{" "}
              <a href={mailto} className="text-foreground underline underline-offset-4 hover:opacity-70">
                Request an invite
              </a>
            </p>
          ) : (
            <p className="text-muted-foreground">No code? Contact the team for an invite.</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground/70">
            Experimental early access. Not independently audited; single-contributor trusted setup. Deposits are
            hard-capped — only use funds you can afford to lose.{" "}
            <a href="/mainnet" className="underline underline-offset-4 hover:opacity-70">
              Details
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
