"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SuccessMark } from "@/components/umbra/success-mark";
import { Button, Card, Eyebrow, Field, Shell } from "@/components/umbra/ui";
import { ProverProgress } from "@/components/umbra/prover-progress";
import { WithdrawReveal } from "@/components/umbra/withdraw-reveal";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { useProver } from "@/hooks/use-prover";
import { useWallet } from "@/hooks/use-wallet";
import { noteCommitment, walletStore, type WalletNote } from "@/lib/umbra/wallet";
import { submitWithdraw } from "@/lib/umbra/soroban";
import { isChainConfigured } from "@/lib/umbra/config";

type Phase = "form" | "working" | "done" | "error";

// Stable server-snapshot reference — a fresh [] each call makes React's
// useSyncExternalStore warn about an infinite loop.
const NO_NOTES: WalletNote[] = [];

export default function WithdrawPage() {
  const notes = useSyncExternalStore(walletStore.subscribe, walletStore.getSnapshot, () => NO_NOTES);
  const spendable = notes.filter((n) => !n.spent && n.leafIndex !== null);
  const balance = spendable.reduce((s, n) => s + n.value, 0n);

  const [selected, setSelected] = useState(0);
  const [recipientId] = useState("12345");
  const [to, setTo] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [msg, setMsg] = useState<string | null>(null);
  const prover = useProver();
  const wallet = useWallet();

  // Unshielding cashes out to yourself by default — prefill with the connected wallet.
  useEffect(() => {
    if (wallet.address && !to) setTo(wallet.address);
  }, [wallet.address, to]);

  const note = spendable[selected];

  async function onWithdraw() {
    if (!note) return;
    setPhase("working");
    setMsg(null);
    try {
      const cm = noteCommitment({ secret: note.secret, value: note.value });
      const input = walletStore.withdrawInput(cm, BigInt(recipientId));
      if (!input) throw new Error("couldn't build the proof for this note");
      const proof = await prover.run("withdraw", input as unknown as Record<string, unknown>);
      if (isChainConfigured()) {
        if (!wallet.signer) throw new Error("Connect your wallet (or enter a testnet key) to unshield on-chain");
        const payout = to.trim() || wallet.address;
        if (!payout) throw new Error("Enter a payout Stellar address");
        const { hash } = await submitWithdraw(
          {
            proof,
            root: BigInt(input.root),
            nullifier: BigInt(input.nullifier),
            recipient: BigInt(input.recipient),
            amount: BigInt(input.amount),
            to: payout,
          },
          wallet.signer,
        );
        walletStore.markSpent(cm);
        setMsg(`tx ${hash}`);
      } else {
        await new Promise((r) => setTimeout(r, 1200));
      }
      setPhase("done");
    } catch (e) {
      setMsg((e as Error).message);
      setPhase("error");
    }
  }

  return (
    <Shell active="/withdraw">
      <div className="mx-auto max-w-prose">
        {phase === "done" ? (
          <div className="text-center">
            <SuccessMark className="mx-auto" />
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">Funds released</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Withdrawn privately. Here&rsquo;s why no one can trace it.
            </p>
            <WithdrawReveal className="mt-8" amount={note ? note.value.toString() : "50"} asset="XLM" />
            {msg && <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{msg}</p>}
          </div>
        ) : spendable.length === 0 ? (
          <Card className="p-10 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Nothing to withdraw yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">Get paid first — create a link and share it.</p>
            <Link href="/links" className="mt-6 inline-block"><Button>Create a payment link</Button></Link>
          </Card>
        ) : (
          <>
            <Eyebrow>Withdraw</Eyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Cash out privately</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Prove you own funds in the pool without revealing which deposit was yours.
            </p>

            <Card className="mt-8 p-6 sm:p-7">
              {phase === "working" ? (
                <ProverProgress
                  stage={prover.stage}
                  elapsedMs={prover.elapsedMs}
                  loadedBytes={prover.loadedBytes}
                  totalBytes={prover.totalBytes}
                  error={prover.error}
                />
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="rounded-xl bg-white/[0.04] px-5 py-4">
                    <p className="text-sm text-muted-foreground">Available to withdraw</p>
                    <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-foreground">
                      {balance.toString()} <span className="text-xl text-muted-foreground">USDC</span>
                    </p>
                  </div>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">Amount to withdraw</span>
                    <select
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[15px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      value={selected}
                      onChange={(e) => setSelected(Number(e.target.value))}
                    >
                      {spendable.map((n, i) => (
                        <option key={i} value={i}>{n.value.toString()} USDC</option>
                      ))}
                    </select>
                  </label>
                  {isChainConfigured() && (
                    <>
                      <Field label="Cash out to" hint="Defaults to your connected wallet — any Stellar address works." mono placeholder="G…" value={to} onChange={(e) => setTo(e.target.value)} />
                      <WalletConnect wallet={wallet} />
                    </>
                  )}
                  <Button size="block" onClick={onWithdraw}>Withdraw privately</Button>
                  {phase === "error" && <p className="text-sm text-destructive">{msg}</p>}
                </div>
              )}
            </Card>

            {phase !== "working" && (
              <p className="mt-4 text-center text-sm leading-relaxed text-[#9CA3AF]">
                A zero-knowledge proof proves you own these funds. The Stellar contract verifies it on-chain
                before releasing them.
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
