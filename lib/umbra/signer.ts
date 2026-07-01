// Wallet / signer abstraction. Umbra signs real Soroban transactions either with
// Freighter (the user's wallet — the app NEVER sees the secret; this is the only
// safe model for mainnet) or, as a testnet-only fallback, an in-app secret key.
//
// freighter-api talks to a browser extension, so every call is lazy-imported to
// keep it strictly client-side (no SSR / build evaluation).

export type Signer =
  | { kind: "key"; secret: string } // testnet fallback only — app sees the secret
  | { kind: "freighter"; address: string } // real wallet (direct path) — app never sees the secret
  | { kind: "kit"; address: string; walletId: string; walletName: string }; // via Stellar Wallets Kit

async function freighter() {
  return import("@stellar/freighter-api");
}

/** Is the Freighter extension installed in this browser? */
export async function freighterInstalled(): Promise<boolean> {
  try {
    const { isConnected } = await freighter();
    const r = await isConnected();
    return Boolean(r?.isConnected);
  } catch {
    return false;
  }
}

/** Prompt the user to connect Freighter; returns their public address. */
export async function connectFreighter(): Promise<string> {
  const { requestAccess } = await freighter();
  const r = await requestAccess();
  if ("error" in r && r.error) throw new Error(String(r.error));
  if (!r.address) throw new Error("Freighter returned no address");
  return r.address;
}

/**
 * The Freighter address if the site is already authorized — WITHOUT prompting. Used to
 * silently restore a connection on page load. Returns null if Freighter is absent, locked,
 * or hasn't granted this site access.
 */
export async function freighterAddressIfAllowed(): Promise<string | null> {
  try {
    const { isConnected, isAllowed, getAddress } = await freighter();
    const conn = await isConnected();
    if (!conn?.isConnected) return null;
    const allowed = await isAllowed();
    if (!allowed?.isAllowed) return null;
    const r = await getAddress();
    if ("error" in r && r.error) return null;
    return r.address || null;
  } catch {
    return null;
  }
}

/** Ask Freighter to sign a transaction XDR; returns the signed XDR. */
export async function freighterSign(
  xdr: string,
  networkPassphrase: string,
  address: string,
): Promise<string> {
  const { signTransaction } = await freighter();
  const r = await signTransaction(xdr, { networkPassphrase, address });
  if ("error" in r && r.error) throw new Error(String(r.error));
  return r.signedTxXdr;
}

/** The public (source) account for a signer. */
export async function signerAddress(signer: Signer): Promise<string> {
  if (signer.kind === "freighter" || signer.kind === "kit") return signer.address;
  const sdk = await import("@stellar/stellar-sdk");
  return sdk.Keypair.fromSecret(signer.secret).publicKey();
}

/**
 * Sign a prepared transaction XDR with a wallet signer (Freighter direct, or a kit
 * wallet). The "key" signer does NOT go through here — it signs via Keypair in the
 * submission pipeline. Returns the signed XDR.
 */
export async function signTransactionXdr(
  signer: Signer,
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  if (signer.kind === "freighter") {
    return freighterSign(xdr, networkPassphrase, signer.address);
  }
  if (signer.kind === "kit") {
    const { kitSign } = await import("./stellar-wallets-kit");
    return kitSign(signer.walletId, xdr, networkPassphrase);
  }
  throw new Error("key signer is signed with a Keypair, not via XDR");
}
