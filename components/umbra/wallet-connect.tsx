"use client";

import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, Loader2, Wallet, X } from "lucide-react";
import { Button, Pill } from "@/components/umbra/ui";
import { freighterInstalled } from "@/lib/umbra/signer";
import { listKitWallets } from "@/lib/umbra/stellar-wallets-kit";
import type { WalletState } from "@/hooks/use-wallet";

const trunc = (a: string) => (a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-5)}` : a);

type WalletDef = { id: string; name: string; blurb: string; install: string; via: "direct" | "kit" };

// Freighter goes through the proven direct path; the rest through Stellar Wallets Kit.
const WALLETS: WalletDef[] = [
  { id: "freighter", name: "Freighter", blurb: "Browser extension · the standard Stellar wallet", install: "https://www.freighter.app/", via: "direct" },
  { id: "xbull", name: "xBull", blurb: "Browser extension & web wallet", install: "https://xbull.app/", via: "kit" },
  { id: "albedo", name: "Albedo", blurb: "Web wallet — no install needed", install: "https://albedo.link/", via: "kit" },
  { id: "lobstr", name: "LOBSTR", blurb: "Popular Stellar wallet", install: "https://lobstr.co/", via: "kit" },
];

/**
 * Connect-wallet affordance. Opens a premium multi-wallet picker. Real wallets sign in
 * their own UI — Umbra never sees a secret. A clearly-labelled testnet key remains for
 * judges/demos without an extension.
 */
export function WalletConnect({ wallet, className }: { wallet: WalletState; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      {wallet.signer ? (
        <Connected wallet={wallet} />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <Wallet className="h-4 w-4" strokeWidth={2} /> Connect a wallet
        </Button>
      )}
      {open && <WalletModal wallet={wallet} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Connected({ wallet }: { wallet: WalletState }) {
  const isKey = wallet.signer?.kind === "key";
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-white/[0.04] px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="h-2 w-2 rounded-full bg-[#FF3B00] shadow-[0_0_8px_rgba(255,59,0,0.9)]" />
        {isKey ? "Testnet demo key" : (wallet.walletName ?? "Wallet")}
        {isKey ? (
          <Pill tone="muted">testnet only</Pill>
        ) : (
          wallet.address && <span className="font-mono text-xs text-muted-foreground">{trunc(wallet.address)}</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          wallet.disconnect();
          wallet.setKey("");
        }}
        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Disconnect
      </button>
    </div>
  );
}

function WalletModal({ wallet, onClose }: { wallet: WalletState; onClose: () => void }) {
  const [avail, setAvail] = useState<Record<string, boolean | undefined>>({});
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let alive = true;
    freighterInstalled().then((v) => alive && setAvail((a) => ({ ...a, freighter: v })));
    listKitWallets().then((list) => {
      if (!alive) return;
      setAvail((a) => {
        const m = { ...a };
        list.forEach((w) => (m[w.id] = w.available));
        return m;
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  // Close once a wallet connection lands.
  useEffect(() => {
    if (wallet.address) onClose();
  }, [wallet.address, onClose]);

  const onConnect = (w: WalletDef) => (w.via === "direct" ? wallet.connect() : wallet.connectKit(w.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Connect a wallet</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Connect a Stellar wallet to shield, send, and unshield privately.{" "}
          <span className="text-foreground">Umbra never sees your secret key.</span>
        </p>

        <div className="mt-4 rounded-lg border border-[#FF3B00]/30 bg-[#FF3B00]/[0.06] px-3.5 py-2.5">
          <p className="text-xs leading-relaxed text-foreground/90">
            Umbra submits to <span className="font-medium">Stellar testnet</span> — make sure your wallet is set to
            testnet before signing.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {WALLETS.map((w) => {
            const status = avail[w.id]; // undefined = checking
            const connecting = wallet.connectingId === w.id;
            return (
              <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-foreground">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{w.blurb}</p>
                </div>
                <div className="shrink-0">
                  {status === undefined ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : status ? (
                    <Button size="sm" onClick={() => onConnect(w)} loading={connecting}>
                      Connect
                    </Button>
                  ) : (
                    <a
                      href={w.install}
                      target="_blank"
                      rel="noreferrer noopener"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Not installed <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {/* Testnet demo key fallback */}
          <div className="rounded-xl border border-dashed border-border bg-white/[0.02] px-4 py-3">
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-foreground">
                <KeyRound className="h-4 w-4" /> Testnet demo key
              </span>
              <Pill tone="muted">testnet only</Pill>
            </button>
            {showKey && (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  className="w-full rounded-lg border border-border bg-[#0e0e10] px-3.5 py-2.5 font-mono text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus-visible:border-[#FF3B00]/60 focus-visible:ring-4 focus-visible:ring-[#FF3B00]/10"
                  placeholder="S… (testnet only — never paste a mainnet key)"
                  value={wallet.key}
                  onChange={(e) => wallet.setKey(e.target.value)}
                />
                <Button size="sm" disabled={!wallet.key.trim()} onClick={onClose} className="self-end">
                  Use key
                </Button>
              </div>
            )}
          </div>
        </div>

        {wallet.error && <p className="mt-3 text-center text-xs text-destructive">{wallet.error}</p>}
      </div>
    </div>
  );
}
