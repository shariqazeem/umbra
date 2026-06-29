// Global wallet-connection session, shared across pages via useSyncExternalStore.
//   - freighterAddress: the direct Freighter path (proven).
//   - kit: a wallet connected through Stellar Wallets Kit (xBull / Albedo / LOBSTR).
// The in-app key fallback is intentionally NOT stored here — it stays ephemeral in the
// form so a secret never lives in a singleton.
import { connectFreighter } from "./signer";
import { connectKitWallet, disconnectKit } from "./stellar-wallets-kit";

export interface KitConnection {
  address: string;
  walletId: string;
  walletName: string;
}

export interface SessionState {
  freighterAddress: string | null;
  kit: KitConnection | null;
}

class WalletSession {
  private state: SessionState = { freighterAddress: null, kit: null };
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): SessionState => this.state;

  private set(next: Partial<SessionState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  }

  /** Connect Freighter via the direct path (clears any kit connection). */
  async connect(): Promise<string> {
    const address = await connectFreighter();
    this.set({ freighterAddress: address, kit: null });
    return address;
  }

  /** Connect a wallet through Stellar Wallets Kit (clears any Freighter connection). */
  async connectKit(id: string): Promise<KitConnection> {
    const conn = await connectKitWallet(id);
    this.set({ freighterAddress: null, kit: conn });
    return conn;
  }

  disconnect(): void {
    if (this.state.kit) void disconnectKit();
    this.set({ freighterAddress: null, kit: null });
  }
}

export const walletSession = new WalletSession();
