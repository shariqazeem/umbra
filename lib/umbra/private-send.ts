// A "private send" claim — the out-of-band handoff of a confidential-transfer OUTPUT note to
// its recipient. The sender creates the output note and submits the transfer (amount hidden
// on-chain); the recipient's note is NOT inserted on-chain by the transfer — it is recorded
// "pending". This claim carries just the opening (secret + value); the recipient inserts the
// note themselves at claim time (proving the opening → claim_insert), which is what makes the
// transfer a single on-chain insert. Delivered via a link/QR, never on chain. Treat it like
// cash: a BEARER token — whoever holds it can claim the note, so share it privately.

export interface PrivateSendClaim {
  secret: bigint;
  value: bigint;
}

function b64urlEncode(s: string): string {
  const b64 =
    typeof window === "undefined" ? Buffer.from(s, "utf8").toString("base64") : window.btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof window === "undefined"
    ? Buffer.from(b64, "base64").toString("utf8")
    : window.atob(b64);
}

export function encodeClaim(claim: PrivateSendClaim): string {
  const json = JSON.stringify({ s: claim.secret.toString(), v: claim.value.toString() });
  return b64urlEncode(json);
}

export function decodeClaim(code: string): PrivateSendClaim {
  const j = JSON.parse(b64urlDecode(code.trim())) as { s: string; v: string };
  if (typeof j.s !== "string" || typeof j.v !== "string") {
    throw new Error("malformed private-send claim");
  }
  return { secret: BigInt(j.s), value: BigInt(j.v) };
}

export function claimUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/claim/${code}`;
}
