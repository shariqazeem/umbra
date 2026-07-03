"use client";

import { useState } from "react";
import { AmountField, Button, Field, Textarea } from "@/components/umbra/ui";
import { CreatorScaffold } from "@/components/umbra/creator-scaffold";
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
    <CreatorScaffold
      active="/links"
      art="/art/apps/links.png"
      eyebrow="Get paid"
      title="Create a payment link"
      blurb="Your recipient will be able to pay you privately on Stellar."
      secureLine="A zero-knowledge proof is generated in your browser to secure this link."
      proving={proving}
      created={!!created}
      url={url}
      successTitle="Your payment link is ready"
      successNote="Share this link with your payer. When they pay, funds enter the privacy pool. Only you can withdraw them."
      onReset={() => {
        setCreated(null);
        setError(null);
      }}
      resetLabel="Create another link"
    >
      <div className="flex flex-col gap-5">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's it for?" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        <AmountField hero label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="Recipient name" hint="Shown to whoever pays." value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        <Button size="block" onClick={onCreate}>Generate payment link</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </CreatorScaffold>
  );
}
