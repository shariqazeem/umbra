"use client";

// useWallet — the active signer for on-chain actions. Prefers a connected wallet
// (Freighter direct, or a Stellar Wallets Kit wallet — the app never sees the secret);
// falls back to an in-app testnet key. The wallet connection is global (survives
// navigation); the key is ephemeral per page.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { walletSession, type SessionState } from "@/lib/umbra/wallet-session";
import type { Signer } from "@/lib/umbra/signer";

const SERVER_SNAPSHOT: SessionState = { freighterAddress: null, kit: null };

export interface WalletState {
  freighterAddress: string | null;
  /** Source public address of the connected wallet (Freighter or kit); null for the key path. */
  address: string | null;
  /** Display name of the connected wallet ("Freighter", "xBull", …) or null. */
  walletName: string | null;
  key: string;
  setKey: (k: string) => void;
  /** Connect Freighter via the direct path. */
  connect: () => Promise<void>;
  /** Connect a wallet through Stellar Wallets Kit (by wallet id). */
  connectKit: (id: string) => Promise<void>;
  disconnect: () => void;
  connecting: boolean;
  /** Which wallet id is currently connecting ("freighter" | "xbull" | …), or null. */
  connectingId: string | null;
  error: string | null;
  /** The active signer, or null if neither a wallet nor a key is available. */
  signer: Signer | null;
}

export function useWallet(): WalletState {
  const session = useSyncExternalStore(
    walletSession.subscribe,
    walletSession.getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const freighterAddress = session.freighterAddress;
  const kit = session.kit;
  const [key, setKey] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously-connected wallet on load, so a page refresh keeps you connected
  // (the session is otherwise in-memory only). Guarded to run once inside walletSession.
  useEffect(() => {
    void walletSession.restore();
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnectingId("freighter");
    try {
      await walletSession.connect();
    } catch (e) {
      setError((e as Error).message || "Could not connect Freighter");
    } finally {
      setConnectingId(null);
    }
  }, []);

  const connectKit = useCallback(async (id: string) => {
    setError(null);
    setConnectingId(id);
    try {
      await walletSession.connectKit(id);
    } catch (e) {
      setError((e as Error).message || "Could not connect wallet");
    } finally {
      setConnectingId(null);
    }
  }, []);

  const disconnect = useCallback(() => walletSession.disconnect(), []);

  const trimmed = key.trim();
  const signer: Signer | null = kit
    ? { kind: "kit", address: kit.address, walletId: kit.walletId, walletName: kit.walletName }
    : freighterAddress
      ? { kind: "freighter", address: freighterAddress }
      : trimmed
        ? { kind: "key", secret: trimmed }
        : null;

  const address = kit?.address ?? freighterAddress;
  const walletName = kit ? kit.walletName : freighterAddress ? "Freighter" : null;

  return {
    freighterAddress,
    address,
    walletName,
    key,
    setKey,
    connect,
    connectKit,
    disconnect,
    connecting: connectingId !== null,
    connectingId,
    error,
    signer,
  };
}
