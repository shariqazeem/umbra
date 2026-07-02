// App-level invite gate for the early-access / capped-canary launch.
//
// HONEST SCOPE: this is a UX funnel, NOT an on-chain access control. The pool contract is
// public and does not check invites — anyone who can craft a transaction can still call it
// directly. What this does is gate who reaches the *wallet UI*, keeping the canary small and
// intentional (the Solana-perps invite-code / DEFA request-access pattern). Combined with the
// hard per-deposit cap in `network.ts`, that bounds real-world exposure during early access.
//
// Codes are matched by SHA-256 so the plaintext codes are never shipped in the bundle — only
// their digests live in NEXT_PUBLIC_UMBRA_INVITE_HASHES. (A determined user can still read the
// hashes and brute-force a weak code, so issued codes must be long + random.)

const UNLOCK_KEY = "umbra:invite:unlocked:v1";

/** Invite gate is armed only when explicitly enabled (default off → open, for testnet/dev). */
export function isInviteRequired(): boolean {
  return process.env.NEXT_PUBLIC_UMBRA_INVITE_REQUIRED === "true";
}

/** Optional contact for the "request access" action (mailto). Empty → generic copy. */
export function inviteContactEmail(): string {
  return (process.env.NEXT_PUBLIC_UMBRA_CONTACT_EMAIL ?? "").trim();
}

function validHashes(): string[] {
  return (process.env.NEXT_PUBLIC_UMBRA_INVITE_HASHES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length === 64);
}

async function sha256Hex(input: string): Promise<string> {
  // Normalize to upper-case so codes are case-insensitive (they're issued as UMBRA-XXXX-XXXX).
  const bytes = new TextEncoder().encode(input.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True iff `code` (after trim) SHA-256s to one of the configured invite hashes. */
export async function verifyInviteCode(code: string): Promise<boolean> {
  if (!code.trim() || validHashes().length === 0) return false;
  return validHashes().includes(await sha256Hex(code));
}

/** Client-only: has this browser already been unlocked? (Not required → always true.) */
export function isUnlocked(): boolean {
  if (!isInviteRequired()) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* storage disabled — the gate simply re-prompts next load */
  }
}

export function lockAccess(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* no-op */
  }
}
