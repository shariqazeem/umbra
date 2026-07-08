// Private Payment Links — an application-layer feature on top of the frozen
// protocol. The insight: a payment link is a PRE-AUTHORIZED SHIELD.
//
//   • The recipient (e.g. a freelancer) generates a fresh note secret and the
//     shield proof for it at link-creation time. The link carries the commitment
//     and the (zero-knowledge) shield proof — never the secret.
//   • The payer opens the link and simply FUNDS the shield (pays the tokens). They
//     learn nothing that lets them withdraw.
//   • Only the recipient — the sole holder of the note secret — can later withdraw,
//     privately, through the existing pool.
//
// Security falls out of the existing protocol, no new circuits/contracts:
//   - amount/commitment tampering → the shield proof's public signals no longer
//     match → on-chain shield verification fails (and we reject the link client-side).
//   - recipient substitution → impossible: withdrawal needs the secret, which is
//     only ever in the recipient's wallet, never in the link.
import { walletStore } from "./wallet";
import { proveShield, type Groth16ProofJson } from "./prover";
import { deriveSeed } from "./note-derivation";
import { isChainConfigured } from "./config";
import type { Signer } from "./signer";

export interface PaymentLinkPayload {
  v: 1;
  title: string;
  description: string;
  recipientName: string;
  amount: string; // decimal
  commitment: string; // decimal (Fr)
  proof: Groth16ProofJson; // pre-generated shield proof; publicSignals = [commitment, amount]
}

// --- URL-safe base64 of the payload (self-contained link, no backend) ---------

function encodePayload(p: PaymentLinkPayload): string {
  const json = JSON.stringify(p);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(id: string): PaymentLinkPayload {
  const b64 = id.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as PaymentLinkPayload;
}

// --- create / decode ----------------------------------------------------------

export interface CreatedLink {
  id: string;
  path: string; // /pay/<id>
  payload: PaymentLinkPayload;
}

/** Recipient action: mint a note, prove its shield, and package a shareable link. */
export async function createPaymentLink(args: {
  title: string;
  description: string;
  recipientName: string;
  amount: bigint;
  signer: Signer | null;
}): Promise<CreatedLink> {
  // A link is only "real" when the note it mints is RECOVERABLE — derived from your wallet seed,
  // not a throwaway random secret stuck in one browser. On a live chain we require a connected
  // wallet and install its seed, so whoever pays funds a note your wallet can rediscover (recovery
  // matches deposits by amount) and withdraw on ANY device. Without this, money paid to the link
  // would be unspendable off the exact browser that created it.
  if (isChainConfigured() && !args.signer) {
    throw new Error(
      "Connect your wallet first — a payment link must be tied to your wallet so you can withdraw what people pay you.",
    );
  }
  if (args.signer && !walletStore.hasSeed()) {
    walletStore.setSeed(await deriveSeed(args.signer));
  }
  const { commitment } = walletStore.createNote(args.amount);
  const input = walletStore.shieldInput(commitment);
  if (!input) throw new Error("failed to build shield input");

  // Pre-generate the shield proof (binds commitment ↔ amount). The recipient's
  // note (with its secret) stays in their local wallet for later withdrawal.
  const proof = await proveShield(input);

  const payload: PaymentLinkPayload = {
    v: 1,
    title: args.title,
    description: args.description,
    recipientName: args.recipientName,
    amount: args.amount.toString(),
    commitment: commitment.toString(),
    proof,
  };
  const id = encodePayload(payload);
  rememberLink({ id, title: args.title, amount: args.amount.toString() });
  return { id, path: `/pay/${id}`, payload };
}

/** Payer action: decode a link and verify its funds-critical integrity. */
export function decodePaymentLink(id: string): PaymentLinkPayload {
  const p = decodePayload(id);
  if (p.v !== 1) throw new Error("unsupported link version");
  const [cmSignal, amtSignal] = p.proof.publicSignals;
  // The displayed amount/commitment MUST equal the proof's public inputs, or the
  // link was tampered. (A tamperer cannot forge a matching proof without the secret.)
  if (cmSignal !== p.commitment) throw new Error("link integrity: commitment mismatch");
  if (amtSignal !== p.amount) throw new Error("link integrity: amount mismatch");
  return p;
}

// --- local index of links this browser created (for the /links list) ----------

export interface LinkMeta {
  id: string;
  title: string;
  amount: string;
}

const INDEX_KEY = "umbra.slice.links.v1";

function rememberLink(meta: LinkMeta): void {
  if (typeof window === "undefined") return;
  const list = listLinks();
  list.unshift(meta);
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(0, 50)));
}

export function listLinks(): LinkMeta[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? "[]") as LinkMeta[];
  } catch {
    return [];
  }
}

export function linkUrl(id: string): string {
  if (typeof window === "undefined") return `/pay/${id}`;
  return `${window.location.origin}/pay/${id}`;
}
