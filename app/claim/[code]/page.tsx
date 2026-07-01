"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Shell, Card, Button, Eyebrow } from "@/components/umbra/ui";
import { decodeClaim, type PrivateSendClaim } from "@/lib/umbra/private-send";
import { walletStore } from "@/lib/umbra/wallet";

export default function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [added, setAdded] = useState(false);

  let claim: PrivateSendClaim | null = null;
  try {
    claim = decodeClaim(code);
  } catch {
    claim = null;
  }

  const value = claim ? claim.value.toString() : "";
  const add = () => {
    if (!claim) return;
    walletStore.importNote(claim.secret, claim.value, claim.leafIndex);
    setAdded(true);
  };

  return (
    <Shell active="/wallet" atmosphere="/art/vault.png">
      <div className="mx-auto max-w-md">
        <Eyebrow>Private payment</Eyebrow>
        <Card className="mt-4 p-7 text-center">
          {!claim ? (
            <p className="py-6 text-sm text-destructive">This claim link is invalid or corrupted.</p>
          ) : added ? (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <h1 className="text-xl font-semibold text-foreground">Added to your wallet</h1>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                <span className="font-mono text-foreground">{value} XLM</span> is now a private note in
                your wallet. Open the wallet and sync to hold or spend it.
              </p>
              <Link href="/wallet" className="mt-2">
                <Button>
                  Open wallet <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF3B00]/10 text-[#FF3B00]">
                <ShieldCheck className="h-6 w-6" strokeWidth={2} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">A private payment is waiting</h1>
              <p className="font-mono text-3xl font-semibold text-foreground">
                {value} <span className="text-lg text-muted-foreground">XLM</span>
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Someone sent you a confidential transfer — the amount was hidden on-chain. Claim it
                into your Umbra wallet to hold or spend it privately.
              </p>
              <Button className="mt-2" onClick={add}>
                Claim into my wallet
              </Button>
              <p className="text-xs text-muted-foreground">
                One-time bearer claim — keep this link private.
              </p>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
