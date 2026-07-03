"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { SuccessMark } from "@/components/umbra/success-mark";
import { Button, Card, Eyebrow, Logo } from "@/components/umbra/ui";
import { CryptoTimeline, FUND_STEPS } from "@/components/umbra/crypto-timeline";
import { decodePaymentLink, type PaymentLinkPayload } from "@/lib/umbra/payment-link";
import { stroopsToXlm } from "@/lib/umbra/units";
import { submitShield } from "@/lib/umbra/soroban";
import { walletStore } from "@/lib/umbra/wallet";
import { isChainConfigured } from "@/lib/umbra/config";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { useWallet } from "@/hooks/use-wallet";

type Phase = "review" | "funding" | "paid" | "error";

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("review");
  const [msg, setMsg] = useState<string | null>(null);
  const wallet = useWallet();

  const { payload, error } = useMemo((): { payload: PaymentLinkPayload | null; error: string | null } => {
    try {
      return { payload: decodePaymentLink(params.id), error: null };
    } catch (e) {
      return { payload: null, error: (e as Error).message };
    }
  }, [params.id]);

  async function onPay() {
    if (!payload) return;
    setPhase("funding");
    setMsg(null);
    try {
      if (isChainConfigured()) {
        if (!wallet.signer) throw new Error("Connect your wallet to pay on-chain");
        const { hash, leafIndex } = await submitShield(
          { proof: payload.proof, commitment: BigInt(payload.commitment), amount: BigInt(payload.amount) },
          wallet.signer,
        );
        // Record the on-chain leaf index so the recipient's note becomes spendable.
        walletStore.observe(BigInt(payload.commitment), leafIndex);
        setMsg(`tx ${hash}`);
      } else {
        await new Promise((r) => setTimeout(r, 2800));
      }
      setPhase("paid");
    } catch (e) {
      setMsg((e as Error).message);
      setPhase("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-prose items-center px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold"><Logo /> Umbra</Link>
      </header>

      <main className="animate-fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        {error ? (
          <Card elevated className="p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/[0.08] text-destructive">
              <ShieldAlert className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">This link can&rsquo;t be trusted</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The payment data has been modified and no longer matches its cryptographic proof.
            </p>
            <p className="mt-6 text-sm font-medium text-muted-foreground">This link is invalid</p>
          </Card>
        ) : payload ? (
          <>
            <p className="mb-4 text-center"><Eyebrow>Private payment request</Eyebrow></p>
            <Card elevated className="overflow-hidden">
              <div className="border-b border-border px-8 pb-8 pt-7 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{payload.title}</span> · to {payload.recipientName}
                </p>
                <p className="mt-4 font-mono text-4xl font-semibold tracking-tight text-foreground">
                  {stroopsToXlm(BigInt(payload.amount))} <span className="text-2xl text-muted-foreground">XLM</span>
                </p>
                {payload.description && <p className="mt-3 text-sm text-muted-foreground">{payload.description}</p>}
              </div>

              <div className="px-8 py-6">
                {phase === "paid" ? (
                  <Paid recipient={payload.recipientName} msg={msg} />
                ) : phase === "funding" ? (
                  <CryptoTimeline steps={FUND_STEPS} running done={false} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {isChainConfigured() && <WalletConnect wallet={wallet} />}
                    <Button size="block" onClick={onPay}>Pay {stroopsToXlm(BigInt(payload.amount))} XLM</Button>
                    {phase === "error" && <p className="text-sm text-destructive">{msg}</p>}
                    <p className="text-center text-xs text-[#9CA3AF]">
                      This payment is secured by a zero-knowledge proof verified on Stellar.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-border py-3 text-center">
                <span className="text-xs text-[#9CA3AF]">Powered by Stellar</span>
              </div>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Paid({ recipient, msg }: { recipient: string; msg: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <SuccessMark className="mx-auto" />
      <p className="mt-1 text-lg font-semibold text-foreground">Paid privately</p>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {recipient} can withdraw whenever they like. No one can connect this payment to you.
      </p>
      {msg && <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
