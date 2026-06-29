// Stellar Wallets Kit adapter — a thin signer layer over @creit.tech/stellar-wallets-kit.
//
// Scope: routes xBull / Albedo / LOBSTR through the kit. Freighter intentionally stays
// on the proven direct path (lib/umbra/signer.ts) and the testnet key is its own
// fallback — this file only adds the kit wallets. Everything is lazy-imported so the
// kit (preact + web components) never evaluates during SSR / build.
//
// The kit v2 API is a STATIC singleton: init({modules, network}) → setWallet(id) →
// fetchAddress() / signTransaction(xdr, {networkPassphrase, address}).

import { UMBRA_CONFIG } from "./config";

/** Wallets we expose through the kit, in priority order. */
export const KIT_WALLETS = [
  { id: "xbull", name: "xBull" },
  { id: "albedo", name: "Albedo" },
  { id: "lobstr", name: "LOBSTR" },
] as const;

export interface KitWalletStatus {
  id: string;
  name: string;
  available: boolean;
}

type KitModule = import("@creit.tech/stellar-wallets-kit").KitModule;
type KitClass = typeof import("@creit.tech/stellar-wallets-kit").StellarWalletsKit;

let modules: KitModule[] | null = null;
let initPromise: Promise<{ Kit: KitClass; modules: KitModule[] }> | null = null;

async function ensureKit(): Promise<{ Kit: KitClass; modules: KitModule[] }> {
  if (!initPromise) {
    initPromise = (async () => {
      const kitMod = await import("@creit.tech/stellar-wallets-kit");
      if (!modules) {
        const [xb, al, lo] = await Promise.all([
          import("@creit.tech/stellar-wallets-kit/modules/xbull"),
          import("@creit.tech/stellar-wallets-kit/modules/albedo"),
          import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        ]);
        modules = [new xb.xBullModule(), new al.AlbedoModule(), new lo.LobstrModule()];
        kitMod.StellarWalletsKit.init({
          modules,
          network: kitMod.Networks.TESTNET, // Umbra is testnet-only for now
        });
      }
      return { Kit: kitMod.StellarWalletsKit, modules };
    })();
  }
  return initPromise;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]).catch(() => fallback);
}

/** Detected/installed state for each kit wallet (best-effort; never throws). */
export async function listKitWallets(): Promise<KitWalletStatus[]> {
  try {
    const { modules: mods } = await ensureKit();
    return await Promise.all(
      mods.map(async (m) => ({
        id: m.productId,
        name: m.productName,
        available: await withTimeout(m.isAvailable(), 1500, false),
      })),
    );
  } catch {
    return KIT_WALLETS.map((w) => ({ ...w, available: false }));
  }
}

/** Connect a kit wallet; returns the normalized connection. */
export async function connectKitWallet(
  id: string,
): Promise<{ address: string; walletId: string; walletName: string }> {
  const { Kit } = await ensureKit();
  Kit.setWallet(id);
  const { address } = await Kit.fetchAddress();
  if (!address) throw new Error("Wallet returned no address");
  const name = KIT_WALLETS.find((w) => w.id === id)?.name ?? id;
  return { address, walletId: id, walletName: name };
}

/** Sign a prepared transaction XDR with a connected kit wallet; returns signed XDR. */
export async function kitSign(walletId: string, xdr: string, networkPassphrase: string): Promise<string> {
  const { Kit } = await ensureKit();
  Kit.setWallet(walletId);
  const { signedTxXdr } = await Kit.signTransaction(xdr, {
    networkPassphrase: networkPassphrase || UMBRA_CONFIG.networkPassphrase,
  });
  if (!signedTxXdr) throw new Error("Wallet returned no signed transaction");
  return signedTxXdr;
}

const DERIVATION_MESSAGE = "Umbra · deterministic note seed · v1";

/** Sign the derivation message with a kit wallet; returns the signature material. */
export async function kitSignMessage(walletId: string): Promise<string | Uint8Array> {
  const { Kit } = await ensureKit();
  Kit.setWallet(walletId);
  const { signedMessage } = await Kit.signMessage(DERIVATION_MESSAGE, {
    networkPassphrase: UMBRA_CONFIG.networkPassphrase,
  });
  return signedMessage;
}

export async function disconnectKit(): Promise<void> {
  try {
    const { Kit } = await ensureKit();
    await Kit.disconnect();
  } catch {
    /* best-effort */
  }
}
