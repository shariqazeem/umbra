// Minimal ambient types for @creit.tech/stellar-wallets-kit v2.x — the package ships
// no .d.ts. We declare only the static API + module classes Umbra actually uses.

declare module "@creit.tech/stellar-wallets-kit" {
  export const Networks: {
    PUBLIC: string;
    TESTNET: string;
    FUTURENET: string;
    SANDBOX: string;
    STANDALONE: string;
  };

  export interface KitSignedTx {
    signedTxXdr: string;
    signerAddress?: string;
  }

  export interface KitModule {
    productId: string;
    productName: string;
    isAvailable(): Promise<boolean>;
  }

  export class StellarWalletsKit {
    static init(params: { modules: KitModule[]; selectedWalletId?: string; network?: string }): void;
    static setWallet(id: string): void;
    static setNetwork(network: string): void;
    static fetchAddress(): Promise<{ address: string }>;
    static getAddress(): Promise<{ address: string }>;
    static signTransaction(
      xdr: string,
      opts: { networkPassphrase?: string; address?: string },
    ): Promise<KitSignedTx>;
    static signMessage(
      message: string,
      opts?: { networkPassphrase?: string; address?: string },
    ): Promise<{ signedMessage: string | Uint8Array }>;
    static disconnect(): Promise<void>;
  }
}

declare module "@creit.tech/stellar-wallets-kit/modules/xbull" {
  import type { KitModule } from "@creit.tech/stellar-wallets-kit";
  export class xBullModule implements KitModule {
    constructor();
    productId: string;
    productName: string;
    isAvailable(): Promise<boolean>;
  }
}

declare module "@creit.tech/stellar-wallets-kit/modules/albedo" {
  import type { KitModule } from "@creit.tech/stellar-wallets-kit";
  export class AlbedoModule implements KitModule {
    constructor();
    productId: string;
    productName: string;
    isAvailable(): Promise<boolean>;
  }
}

declare module "@creit.tech/stellar-wallets-kit/modules/lobstr" {
  import type { KitModule } from "@creit.tech/stellar-wallets-kit";
  export class LobstrModule implements KitModule {
    constructor();
    productId: string;
    productName: string;
    isAvailable(): Promise<boolean>;
  }
}
