// A "private send" claim — the out-of-band handoff of a confidential-transfer OUTPUT note
// to its recipient. The sender creates the output note, submits the transfer (amount
// hidden on-chain), and hands the recipient this claim (secret + value + the on-chain leaf
// index) so they can import and later spend it. It is delivered via a link/QR, never on
// chain. Treat the link like cash: it is a BEARER token — whoever holds it can claim the
// note, so share it privately. (A recipient-addressed, encrypted variant is future work —
// it needs the recipient's public key.)

export interface PrivateSendClaim {
  secret: bigint;
  value: bigint;
  leafIndex: number;
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
  const json = JSON.stringify({
    s: claim.secret.toString(),
    v: claim.value.toString(),
    l: claim.leafIndex,
  });
  return b64urlEncode(json);
}

export function decodeClaim(code: string): PrivateSendClaim {
  const j = JSON.parse(b64urlDecode(code.trim())) as { s: string; v: string; l: number };
  if (typeof j.s !== "string" || typeof j.v !== "string" || typeof j.l !== "number") {
    throw new Error("malformed private-send claim");
  }
  return { secret: BigInt(j.s), value: BigInt(j.v), leafIndex: Number(j.l) };
}

export function claimUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/claim/${code}`;
}
