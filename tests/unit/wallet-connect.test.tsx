import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the browser-only detection so the modal renders deterministically.
vi.mock("@/lib/umbra/signer", () => ({ freighterInstalled: async () => true }));
vi.mock("@/lib/umbra/stellar-wallets-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/umbra/stellar-wallets-kit")>()),
  // stub only the browser detection; keep the real KIT_WALLETS constant
  listKitWallets: async () => [
    { id: "xbull", name: "xBull", available: false },
    { id: "albedo", name: "Albedo", available: true },
    { id: "lobstr", name: "LOBSTR", available: true },
  ],
}));

import { WalletConnect } from "@/components/umbra/wallet-connect";
import { KIT_WALLETS } from "@/lib/umbra/stellar-wallets-kit";
import type { WalletState } from "@/hooks/use-wallet";

function fakeWallet(over: Partial<WalletState> = {}): WalletState {
  return {
    freighterAddress: null,
    address: null,
    walletName: null,
    key: "",
    setKey: () => {},
    connect: async () => {},
    connectKit: async () => {},
    disconnect: () => {},
    connecting: false,
    connectingId: null,
    error: null,
    signer: null,
    ...over,
  };
}

describe("WalletConnect", () => {
  it("opens a multi-wallet picker with the supported wallets + testnet fallback", () => {
    render(<WalletConnect wallet={fakeWallet()} />);
    fireEvent.click(screen.getByRole("button", { name: /Connect a wallet/i }));
    for (const name of ["Freighter", "xBull", "Albedo", "LOBSTR"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("Testnet demo key")).toBeInTheDocument();
    expect(screen.getByText(/Stellar testnet/i)).toBeInTheDocument();
  });

  it("renders the connected state for a wallet signer", () => {
    const addr = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    render(
      <WalletConnect
        wallet={fakeWallet({ signer: { kind: "freighter", address: addr }, address: addr, walletName: "Freighter" })}
      />,
    );
    expect(screen.getByText("Freighter")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("labels the testnet key signer clearly", () => {
    render(<WalletConnect wallet={fakeWallet({ signer: { kind: "key", secret: "SABC" }, key: "SABC" })} />);
    expect(screen.getByText("Testnet demo key")).toBeInTheDocument();
    expect(screen.getByText("testnet only")).toBeInTheDocument();
  });

  it("normalizes the kit wallet list", () => {
    expect(KIT_WALLETS.map((w) => w.id)).toEqual(["xbull", "albedo", "lobstr"]);
  });
});
