// Global wallet-connection session, shared across pages via useSyncExternalStore.
//   - freighterAddress: the direct Freighter path (proven).
//   - kit: a wallet connected through Stellar Wallets Kit (xBull / Albedo / LOBSTR).
// The in-app key fallback is intentionally NOT stored here — it stays ephemeral in the
// form so a secret never lives in a singleton.
import { connectFreighter, freighterAddressIfAllowed } from "./signer";
import { connectKitWallet, disconnectKit } from "./stellar-wallets-kit";

// Which wallet was last connected — persisted so the session survives a page reload.
const STORAGE_KEY = "umbra.wallet.v1";
type Persisted = { type: "freighter" } | { type: "kit"; id: string };

function persist(p: Persisted | null): void {
  if (typeof window === "undefined") return;
  try {
    if (p) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
function readPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

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
    persist({ type: "freighter" });
    return address;
  }

  /** Connect a wallet through Stellar Wallets Kit (clears any Freighter connection). */
  async connectKit(id: string): Promise<KitConnection> {
    const conn = await connectKitWallet(id);
    this.set({ freighterAddress: null, kit: conn });
    persist({ type: "kit", id });
    return conn;
  }

  disconnect(): void {
    if (this.state.kit) void disconnectKit();
    this.set({ freighterAddress: null, kit: null });
    persist(null);
  }

  /**
   * Restore a previously-connected wallet on page load. Freighter restores SILENTLY (no
   * prompt) if the site is still authorized; kit wallets reconnect by id. Called once from
   * useWallet on mount, so a refresh keeps you connected.
   */
  private restored = false;
  async restore(): Promise<void> {
    if (this.restored || typeof window === "undefined") return;
    this.restored = true;
    const p = readPersisted();
    if (!p) return;
    try {
      if (p.type === "freighter") {
        const address = await freighterAddressIfAllowed();
        if (address) this.set({ freighterAddress: address, kit: null });
        else persist(null); // access was revoked — forget it
      } else {
        const conn = await connectKitWallet(p.id);
        this.set({ freighterAddress: null, kit: conn });
      }
    } catch {
      persist(null);
    }
  }
}

export const walletSession = new WalletSession();
