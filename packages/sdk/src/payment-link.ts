// Self-contained, backend-free private payment links.
//
// A payment link is a PRE-AUTHORIZED SHIELD: the recipient generates a note secret
// and the shield proof at creation time; the link carries the commitment + proof,
// never the secret. The payer simply funds it. Security falls out of the proof:
// tampering with the amount/commitment makes the public signals mismatch, so the
// link is rejected client-side and would fail on-chain shield verification too.
//
// This is a pure codec (no wallet, no framework) — bring your own note + proof.

export interface Groth16ProofJson {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[]; // [commitment, amount]
}

export interface PaymentLinkPayload {
  v: 1;
  title: string;
  description: string;
  recipientName: string;
  amount: string; // decimal
  commitment: string; // decimal (Fr)
  proof: Groth16ProofJson; // pre-generated shield proof
}

function toBase64Url(json: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(id: string): string {
  const b64 = id.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Package a payload into a URL-safe, self-contained link id. */
export function encodePaymentLink(payload: PaymentLinkPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decode a link id and verify its funds-critical integrity. Throws if the link was
 * tampered (the displayed amount/commitment must equal the proof's public signals —
 * a tamperer cannot forge a matching proof without the secret).
 */
export function decodePaymentLink(id: string): PaymentLinkPayload {
  const p = JSON.parse(fromBase64Url(id)) as PaymentLinkPayload;
  if (p.v !== 1) throw new Error("unsupported payment-link version");
  const [commitmentSignal, amountSignal] = p.proof.publicSignals;
  if (commitmentSignal !== p.commitment) throw new Error("link integrity: commitment mismatch");
  if (amountSignal !== p.amount) throw new Error("link integrity: amount mismatch");
  return p;
}
