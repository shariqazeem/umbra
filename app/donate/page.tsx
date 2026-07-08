"use client";

import { useState } from "react";
import { AmountField, Button, Field, Textarea } from "@/components/umbra/ui";
import { CreatorScaffold } from "@/components/umbra/creator-scaffold";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { createPaymentLink, linkUrl, type CreatedLink } from "@/lib/umbra/payment-link";
import { xlmToStroops } from "@/lib/umbra/units";
import { isChainConfigured } from "@/lib/umbra/config";
import { useWallet } from "@/hooks/use-wallet";

export default function DonatePage() {
  const wallet = useWallet();
  const [recipientName, setRecipientName] = useState("Open Hands NGO");
  const [amount, setAmount] = useState("25");
  const [message, setMessage] = useState("Thank you for supporting our work.");
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsWallet = isChainConfigured() && !wallet.signer;

  async function onCreate() {
    setError(null);
    if (needsWallet) {
      setError("Connect your wallet first so you can withdraw the donations you receive.");
      return;
    }
    setProving(true);
    try {
      const link = await createPaymentLink({
        title: `Support ${recipientName}`,
        description: message,
        recipientName,
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
      art="/art/apps/donate.png"
      eyebrow="Private donations"
      title="Accept donations privately"
      blurb="Share a link supporters can give through — without exposing them, or your income, on a public ledger."
      secureLine="A zero-knowledge proof is generated in your browser to secure this link."
      proving={proving}
      created={!!created}
      url={url}
      successTitle="Your donation link is ready"
      successNote="Share it anywhere. Supporters give privately; only you can withdraw."
      onReset={() => {
        setCreated(null);
        setError(null);
      }}
    >
      <div className="flex flex-col gap-5">
        <Field label="You / your organization" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Who's receiving?" />
        <AmountField hero label="Suggested amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Textarea label="Thank-you message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Shown to supporters" />
        {isChainConfigured() && <WalletConnect wallet={wallet} />}
        <Button size="block" onClick={onCreate} disabled={needsWallet}>Generate donation link</Button>
        {needsWallet && (
          <p className="text-center text-xs text-muted-foreground">The link is tied to your wallet, so only you can withdraw what supporters give.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </CreatorScaffold>
  );
}
