// XLM ⇄ stroops. The pool's asset is the native Stellar Asset Contract, which moves value
// in STROOPS (1 XLM = 10,000,000 stroops). Note values, proofs, and transfers are therefore
// all in stroops on-chain; the UI shows XLM. Convert at every input/display boundary.

export const STROOPS_PER_XLM = 10_000_000n;

/** Parse a user-entered XLM amount (up to 7 decimals) into stroops. Returns 0n on garbage. */
export function xlmToStroops(xlm: string): bigint {
  const s = (xlm ?? "").trim();
  if (!s || !/^\d*\.?\d*$/.test(s)) return 0n;
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOPS_PER_XLM + BigInt(fracPadded || "0");
}

/** Format stroops as an XLM string, trimming trailing-zero decimals (e.g. 12_500_000 → "1.25"). */
export function stroopsToXlm(stroops: bigint): string {
  const neg = stroops < 0n;
  const abs = neg ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const frac = abs % STROOPS_PER_XLM;
  let out = whole.toString();
  if (frac > 0n) out += "." + frac.toString().padStart(7, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + out;
}
