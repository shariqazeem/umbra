"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Shell, Card, Button, Eyebrow } from "@/components/umbra/ui";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { decodeClaim, type PrivateSendClaim } from "@/lib/umbra/private-send";
import { walletStore } from "@/lib/umbra/wallet";
import { stroopsToXlm } from "@/lib/umbra/units";
import { isChainConfigured } from "@/lib/umbra/config";
import { deriveSeed } from "@/lib/umbra/note-derivation";
import { deriveNoteKey, encryptNoteOpening } from "@/lib/umbra/note-crypto";
import { submitRegisterNote } from "@/lib/umbra/soroban";
import { useWallet } from "@/hooks/use-wallet";

export default function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const wallet = useWallet();
  const [added, setAdded] = useState(false);
  const [registered, setRegistered] = useState(false);
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
      walletStore.importNote(claim.secret, claim.value, claim.leafIndex);
      // Register-on-claim: post the note's encrypted opening on-chain, encrypted to the
      // claimer's OWN note key, so this received note recovers on any device — the same
      // cross-device guarantee deposits and change have. Needs a connected wallet (a tiny tx).
      if (isChainConfigured() && wallet.signer) {
        const seed = await deriveSeed(wallet.signer);
        walletStore.setSeed(seed);
        const noteKey = await deriveNoteKey(seed);
        const ct = await encryptNoteOpening(noteKey, claim.secret, claim.value);
        await submitRegisterNote({ leafIndex: claim.leafIndex, noteCt: ct }, wallet.signer);
        setRegistered(true);
      }
      setAdded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
    }
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
                your wallet.{" "}
                {registered
                  ? "It's registered on-chain, so it recovers on any device — not just this browser."
                  : "Held in this browser. Connect a wallet when you claim to make it recoverable anywhere."}
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
                {isChainConfigured() && wallet.signer
                  ? "Registered to your wallet on-chain, so it recovers on any device."
                  : "One-time bearer claim — connect a wallet to make it recoverable anywhere."}
              </p>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
