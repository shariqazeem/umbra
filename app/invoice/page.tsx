"use client";

import { useState } from "react";
import { AmountField, Button, Field } from "@/components/umbra/ui";
import { CreatorScaffold } from "@/components/umbra/creator-scaffold";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { createPaymentLink, linkUrl, type CreatedLink } from "@/lib/umbra/payment-link";
import { xlmToStroops } from "@/lib/umbra/units";
import { isChainConfigured } from "@/lib/umbra/config";
import { useWallet } from "@/hooks/use-wallet";

export default function InvoicePage() {
  const wallet = useWallet();
  const [business, setBusiness] = useState("Rivera Design");
  const [client, setClient] = useState("Acme Inc.");
  const [number, setNumber] = useState("1042");
  const [amount, setAmount] = useState("1200");
  const [due, setDue] = useState("Net 14");
  const [item, setItem] = useState("Brand identity — final milestone");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsWallet = isChainConfigured() && !wallet.signer;

  async function onCreate() {
    setError(null);
    if (needsWallet) {
      setError("Connect your wallet first so you can withdraw what your client pays.");
      return;
    }
    setProving(true);
    try {
      const link = await createPaymentLink({
        title: `Invoice #${number}`,
        description: `${item} · ${due} · for ${client}`,
        recipientName: business,
        amount: xlmToStroops(amount),
        signer: wallet.signer,
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
    <CreatorScaffold
      active="/apps"
      art="/art/apps/invoice.png"
      eyebrow="Private invoices"
      title="Bill a client privately"
      blurb="Send an invoice link. The client pays; your revenue never lands on a public ledger."
      secureLine="A zero-knowledge proof is generated in your browser to secure this invoice."
      proving={proving}
      created={!!created}
      url={url}
      successTitle={`Invoice #${number} is ready`}
      successSub={`${amount} to ${business} · for ${client}`}
      successNote={`Send it to ${client}. They pay privately; only you can withdraw.`}
      onReset={() => {
        setCreated(null);
        setError(null);
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Your business" value={business} onChange={(e) => setBusiness(e.target.value)} />
          <Field label="Bill to" value={client} onChange={(e) => setClient(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Invoice #" value={number} onChange={(e) => setNumber(e.target.value)} />
          <Field label="Terms" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Net 14" />
        </div>
        <AmountField hero label="Amount due" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="Line item" value={item} onChange={(e) => setItem(e.target.value)} />
        {isChainConfigured() && <WalletConnect wallet={wallet} />}
        <Button size="block" onClick={onCreate} disabled={needsWallet}>Generate invoice link</Button>
        {needsWallet && (
          <p className="text-center text-xs text-muted-foreground">The invoice is tied to your wallet, so only you can withdraw what your client pays.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </CreatorScaffold>
  );
}
