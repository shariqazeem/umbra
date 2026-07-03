"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Shield } from "lucide-react";
import { AmountField, Button, Card, Eyebrow, Field, Shell, Textarea } from "@/components/umbra/ui";
import { CryptoTimeline, SHIELD_STEPS } from "@/components/umbra/crypto-timeline";
import { SuccessMark } from "@/components/umbra/success-mark";
import { CopyButton } from "@/components/copy-button";
import { createPaymentLink, linkUrl, type CreatedLink } from "@/lib/umbra/payment-link";
import { xlmToStroops } from "@/lib/umbra/units";

export default function LinksPage() {
  const [title, setTitle] = useState("Design work");
  const [description, setDescription] = useState("Logo + brand kit");
  const [recipientName, setRecipientName] = useState("Alex Rivera");
  const [amount, setAmount] = useState("50");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    setProving(true);
    try {
      const link = await createPaymentLink({ title, description, recipientName, amount: xlmToStroops(amount) });
      setCreated(link);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProving(false);
    }
  }

  const url = created ? linkUrl(created.id) : "";

  return (
    <Shell active="/links">
      <div className="mx-auto max-w-prose">
        {!created ? (
          <>
            <Eyebrow>Get paid</Eyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Create a payment link</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Your recipient will be able to pay you privately on Stellar.
            </p>

            <Card className="mt-8 p-6 sm:p-7">
              {proving ? (
                <CryptoTimeline steps={SHIELD_STEPS} running={proving} done={false} />
              ) : (
                <div className="flex flex-col gap-5">
                  <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's it for?" />
                  <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                  <AmountField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Field label="Recipient name" hint="Shown to whoever pays." value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                  <Button size="block" onClick={onCreate}>Generate payment link</Button>
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
          <Card glass className="animate-fade-up mt-2 p-8 text-center">
            <SuccessMark className="mx-auto" size={48} />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Your payment link is ready</h1>

            <div className="mx-auto mt-7 w-fit rounded-2xl border border-border bg-white p-4">
              <QRCodeSVG value={url} size={188} marginSize={0} />
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/[0.04] p-2 pl-4 text-left">
              <span className="flex-1 truncate font-mono text-sm text-muted-foreground">{url}</span>
              <CopyButton value={url} className="size-8 shrink-0 rounded-lg border-border bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground" />
            </div>

            <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Share this link with your payer. When they pay, funds enter the privacy pool. Only you can
              withdraw them.
            </p>

            <button
              className="mt-6 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              onClick={() => {
                setCreated(null);
                setError(null);
              }}
            >
              Create another link
            </button>
          </Card>
        )}
      </div>
    </Shell>
  );
}
