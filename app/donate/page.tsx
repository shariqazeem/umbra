"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, HandCoins, Shield } from "lucide-react";
import { AmountField, Button, Card, Eyebrow, Field, Shell, Textarea } from "@/components/umbra/ui";
import { CryptoTimeline, SHIELD_STEPS } from "@/components/umbra/crypto-timeline";
import { createPaymentLink, linkUrl, type CreatedLink } from "@/lib/umbra/payment-link";

export default function DonatePage() {
  const [recipientName, setRecipientName] = useState("Open Hands NGO");
  const [amount, setAmount] = useState("25");
  const [message, setMessage] = useState("Thank you for supporting our work.");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onCreate() {
    setError(null);
    setProving(true);
    try {
      const link = await createPaymentLink({
        title: `Support ${recipientName}`,
        description: message,
        recipientName,
        amount: BigInt(amount),
      });
      setCreated(link);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProving(false);
    }
  }

  const url = created ? linkUrl(created.id) : "";

  return (
    <Shell active="/apps">
      <div className="mx-auto max-w-prose">
        {!created ? (
          <>
            <Eyebrow>Private donations</Eyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Accept donations privately</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Share a link supporters can give through — without exposing them, or your income, on a public ledger.
            </p>

            <Card className="mt-8 p-6 sm:p-7">
              {proving ? (
                <CryptoTimeline steps={SHIELD_STEPS} running={proving} done={false} />
              ) : (
                <div className="flex flex-col gap-5">
                  <Field label="You / your organization" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Who's receiving?" />
                  <AmountField label="Suggested amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Textarea label="Thank-you message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Shown to supporters" />
                  <Button size="block" onClick={onCreate}>Generate donation link</Button>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              )}
            </Card>

            {!proving && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-[#9CA3AF]">
                <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
                A zero-knowledge proof is generated in your browser to secure this link.
              </p>
            )}
          </>
        ) : (
          <Card elevated className="animate-fade-up mt-2 p-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.04] text-foreground">
              <HandCoins className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Your donation link is ready</h1>

            <div className="mx-auto mt-7 w-fit rounded-2xl border border-border bg-white p-4">
              <QRCodeSVG value={url} size={188} marginSize={0} />
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/[0.04] p-2 pl-4 text-left">
              <span className="flex-1 truncate font-mono text-sm text-muted-foreground">{url}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Share it anywhere. Supporters give privately; only you can withdraw.
            </p>

            <button
              className="mt-6 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              onClick={() => {
                setCreated(null);
                setError(null);
              }}
            >
              Create another
            </button>
          </Card>
        )}
      </div>
    </Shell>
  );
}
