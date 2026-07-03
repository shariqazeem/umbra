"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Shell, Button, Eyebrow } from "@/components/umbra/ui";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { CryptoTimeline, type TimelineStep } from "@/components/umbra/crypto-timeline";
import { commitment as noteCommitment, buildClaimInput } from "@umbra/wallet-core";
import { decodeClaim, type PrivateSendClaim } from "@/lib/umbra/private-send";
import { walletStore } from "@/lib/umbra/wallet";
import { stroopsToXlm } from "@/lib/umbra/units";
import { isChainConfigured } from "@/lib/umbra/config";
import { deriveSeed } from "@/lib/umbra/note-derivation";
import { deriveNoteKey, encryptNoteOpening } from "@/lib/umbra/note-crypto";
import { submitClaimInsert } from "@/lib/umbra/soroban";
import { useWallet } from "@/hooks/use-wallet";
import { useProver } from "@/hooks/use-prover";
import { cn } from "@/lib/utils";

const CLAIM_STEPS: TimelineStep[] = [
  { label: "Opening your note" },
  { label: "Proving it's yours", mono: true },
  { label: "Inserting it privately on-chain", mono: true },
  { label: "Added to your wallet" },
];

export default function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const wallet = useWallet();
  const prover = useProver();
  const [added, setAdded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let claim: PrivateSendClaim | null = null;
  try {
    claim = decodeClaim(code);
  } catch {
    claim = null;
  }

  const value = claim ? stroopsToXlm(claim.value) : "";

  const add = async () => {
    if (!claim) return;
    setClaiming(true);
    setError(null);
    try {
      const note = { secret: claim.secret, value: claim.value };
      if (isChainConfigured()) {
        if (!wallet.signer) throw new Error("Connect your wallet to claim this note into it.");
        // Prove we hold a valid opening of the pending recipient note (value stays private),
        // then the contract inserts it into the tree + records its encrypted opening so it
        // recovers cross-device. This deferred insert is what makes the send a 1-insert tx.
        const cm = noteCommitment(note);
        const proof = await prover.run("claim", buildClaimInput(note) as unknown as Record<string, unknown>);
        const seed = await deriveSeed(wallet.signer);
        walletStore.setSeed(seed);
        const ct = await encryptNoteOpening(await deriveNoteKey(seed), claim.secret, claim.value);
        const { leaf } = await submitClaimInsert({ proof, commitment: cm, noteCt: ct }, wallet.signer);
        walletStore.importNote(claim.secret, claim.value, leaf);
      } else {
        // Demo mode (no chain): just hold it locally.
        walletStore.importNote(claim.secret, claim.value, 0);
      }
      setAdded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Shell active="/wallet">
      <div className="mx-auto max-w-sm">
        {/* The gift — claim.png. It rests dim while waiting, then warms as the light is released. */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-3xl border border-white/10">
          <Image
            src="/art/claim.png"
            alt=""
            fill
            priority
            sizes="300px"
            className={cn(
              "object-cover transition-all duration-1000 ease-out",
              added
                ? "scale-[1.03] brightness-110 saturate-[1.15]"
                : claiming
                  ? "brightness-90"
                  : "brightness-[0.55] saturate-[0.8]",
            )}
          />
          {/* corona rising from the box — brightens through claiming → released */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-1000",
              added ? "opacity-100" : claiming ? "opacity-70" : "opacity-0",
            )}
            style={{ background: "radial-gradient(58% 44% at 50% 56%, rgba(255,90,36,0.4), transparent 72%)" }}
          />
          {/* totality flare on release */}
          {added && (
            <div className="u-animate-flare pointer-events-none absolute left-1/2 top-[54%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#FF7A47]/60" />
          )}
        </div>

        {/* Content */}
        <div className="mt-7 text-center">
          {!claim ? (
            <p className="py-6 text-sm text-destructive">This claim link is invalid or corrupted.</p>
          ) : added ? (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-verify/15 text-verify">
                <Check className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <h1 className="text-xl font-semibold text-foreground">Added to your wallet</h1>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                <span className="font-mono text-foreground">{value} XLM</span> is now a private note in
                your wallet — inserted on-chain and registered to your key, so it recovers on any device.
              </p>
              <Link href="/wallet" className="mt-2">
                <Button variant="secondary">
                  Open wallet <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : claiming ? (
            <div className="flex flex-col items-center gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#FF3B00]">Releasing the light…</p>
              <div className="w-full text-left">
                <CryptoTimeline steps={CLAIM_STEPS} running done={false} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Eyebrow>Private payment</Eyebrow>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">A private payment is waiting</h1>
              <p className="font-mono text-4xl font-semibold tracking-tight text-foreground">
                {value} <span className="text-xl text-muted-foreground">XLM</span>
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Someone sent you a confidential transfer — the amount was hidden on-chain. Claim it
                into your Umbra wallet: you prove you hold it and it&rsquo;s inserted privately.
              </p>
              {isChainConfigured() && (
                <div className="w-full">
                  <WalletConnect wallet={wallet} />
                </div>
              )}
              <Button className="mt-2" onClick={add} loading={claiming} disabled={claiming}>
                {claiming ? "Claiming…" : "Claim into my wallet"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                One-time bearer claim — whoever opens it can claim the funds. Share it privately.
              </p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
