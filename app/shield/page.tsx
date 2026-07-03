"use client";

import { useState } from "react";
import { SuccessMark } from "@/components/umbra/success-mark";
import { AmountField, Button, Card, Eyebrow, Shell } from "@/components/umbra/ui";
import { ProofViz } from "@/components/umbra/proof-viz";
import { TxProgress, type TxStep } from "@/components/umbra/tx-progress";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { useProver } from "@/hooks/use-prover";
import { useWallet } from "@/hooks/use-wallet";
import { walletStore } from "@/lib/umbra/wallet";
import { submitShield } from "@/lib/umbra/soroban";
import { isChainConfigured } from "@/lib/umbra/config";

type Phase = "form" | "working" | "done" | "error";

export default function ShieldPage() {
  const [amount, setAmount] = useState("100");
  const [phase, setPhase] = useState<Phase>("form");
  const [txStep, setTxStep] = useState<TxStep>("proving");
  const [msg, setMsg] = useState<string | null>(null);
  const prover = useProver();
  const wallet = useWallet();

  async function onShield() {
    setPhase("working");
    setTxStep("proving");
    setMsg(null);
    try {
      const value = BigInt(amount);
      const { commitment } = walletStore.createNote(value);
      const input = walletStore.shieldInput(commitment);
      if (!input) throw new Error("couldn't prepare the note");
      const proof = await prover.run("shield", input as unknown as Record<string, unknown>);
      if (isChainConfigured()) {
        if (!wallet.signer) throw new Error("Connect your wallet to shield on-chain");
        const { hash, leafIndex } = await submitShield({ proof, commitment, amount: value }, wallet.signer, (p) => setTxStep(p));
        walletStore.observe(commitment, leafIndex);
        setMsg(`tx ${hash}`);
      } else {
        await new Promise((r) => setTimeout(r, 800));
      }
      setPhase("done");
    } catch (e) {
      setMsg((e as Error).message);
      setPhase("error");
    }
  }

  return (
    <Shell active="/wallet">
      <div className="mx-auto max-w-prose">
        <Eyebrow>Advanced</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-extrabold uppercase tracking-tight text-foreground">Add funds privately</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Move funds into the privacy pool directly. Most people just share a payment link instead.
        </p>

        <Card className="mt-8 p-6 sm:p-7">
          {phase === "done" ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <SuccessMark />
              <p className="mt-1 text-lg font-semibold text-foreground">Funds shielded</p>
              <p className="text-sm text-muted-foreground">They&rsquo;re now private in your wallet.</p>
              {msg && <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{msg}</p>}
            </div>
          ) : phase === "working" ? (
            <div className="flex flex-col gap-6 py-2">
              <ProofViz stage={prover.stage} large />
              <TxProgress step={txStep} prover={prover} chain={isChainConfigured()} />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <AmountField hero label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {isChainConfigured() && <WalletConnect wallet={wallet} />}
              <Button size="block" onClick={onShield}>Shield funds</Button>
              {phase === "error" && <p className="text-sm text-destructive">{msg}</p>}
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-sm leading-relaxed text-muted-foreground">
          Shielding seals your funds under a commitment only you can open. A zero-knowledge proof secures it.
        </p>
      </div>
    </Shell>
  );
}
