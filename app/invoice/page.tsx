"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FileText, Shield } from "lucide-react";
import { AmountField, Button, Card, Eyebrow, Field, Shell } from "@/components/umbra/ui";
import { CryptoTimeline, SHIELD_STEPS } from "@/components/umbra/crypto-timeline";
import { CopyButton } from "@/components/copy-button";
import { createPaymentLink, linkUrl, type CreatedLink } from "@/lib/umbra/payment-link";
import { xlmToStroops } from "@/lib/umbra/units";

export default function InvoicePage() {
  const [business, setBusiness] = useState("Rivera Design");
  const [client, setClient] = useState("Acme Inc.");
  const [number, setNumber] = useState("1042");
  const [amount, setAmount] = useState("1200");
  const [due, setDue] = useState("Net 14");
  const [item, setItem] = useState("Brand identity — final milestone");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    setProving(true);
    try {
      const link = await createPaymentLink({
        title: `Invoice #${number}`,
        description: `${item} · ${due} · for ${client}`,
        recipientName: business,
        amount: xlmToStroops(amount),
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
            <Eyebrow>Private invoices</Eyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Bill a client privately</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              Send an invoice link. The client pays; your revenue never lands on a public ledger.
            </p>

            <Card className="mt-8 p-6 sm:p-7">
              {proving ? (
                <CryptoTimeline steps={SHIELD_STEPS} running={proving} done={false} />
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Your business" value={business} onChange={(e) => setBusiness(e.target.value)} />
                    <Field label="Bill to" value={client} onChange={(e) => setClient(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Invoice #" value={number} onChange={(e) => setNumber(e.target.value)} />
                    <Field label="Terms" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Net 14" />
                  </div>
                  <AmountField label="Amount due" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Field label="Line item" value={item} onChange={(e) => setItem(e.target.value)} />
                  <Button size="block" onClick={onCreate}>Generate invoice link</Button>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              )}
            </Card>

            {!proving && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-[#9CA3AF]">
                <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
                A zero-knowledge proof is generated in your browser to secure this invoice.
              </p>
            )}
          </>
        ) : (
          <Card elevated className="animate-fade-up mt-2 p-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.04] text-foreground">
              <FileText className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Invoice #{number} is ready</h1>
            <p className="mt-2 text-sm text-muted-foreground">{amount} to {business} · for {client}</p>

            <div className="mx-auto mt-6 w-fit rounded-2xl border border-border bg-white p-4">
              <QRCodeSVG value={url} size={188} marginSize={0} />
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-lg bg-white/[0.04] p-2 pl-4 text-left">
              <span className="flex-1 truncate font-mono text-sm text-muted-foreground">{url}</span>
              <CopyButton value={url} className="size-8 shrink-0 rounded-lg border-border bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground" />
            </div>

            <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Send it to {client}. They pay privately; only you can withdraw.
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
