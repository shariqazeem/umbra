/**
 * Encrypted note backup — Zcash-style note ciphertexts so a private balance recovers on any
 * device, not just this browser.
 *
 * The problem it solves: a shielded DEPOSIT has a public amount, so recovery can re-derive and
 * match it from the chain. But a CHANGE note (from a private send or an unshield) has a HIDDEN
 * value — nothing on-chain reveals it — so recovery cannot reconstruct it, and it is lost if
 * localStorage is cleared. The fix (how Zcash/Orchard does it): attach an encrypted copy of the
 * note opening `{secret, value}` to the on-chain transaction, encrypted under a key only the
 * owner's wallet can derive. Recovery trial-decrypts every ciphertext; the ones that
 * authenticate are the owner's notes. Amounts stay hidden from everyone else — only the AES-GCM
 * auth tag under the owner's key ever opens them.
 *
 * Scope: covers the sender's OWN change notes (the primary "balance follows your wallet" case).
 * Notes SENT to someone else still travel on the bearer claim link — in that model the sender
 * does not hold the recipient's key, so it cannot encrypt to them.
 *
 * Browser + Node 20+ via Web Crypto (`crypto.subtle`); no Node-only APIs, bundles cleanly.
 */

const utf8 = new TextEncoder();
const NOTE_ENC_DOMAIN = "umbra-note-enc-v1";

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) throw new Error("Web Crypto (crypto.subtle) is unavailable in this environment");
  return c.subtle;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  (globalThis as { crypto: Crypto }).crypto.getRandomValues(b);
  return b;
}

/** Copy into a standalone ArrayBuffer — a clean BufferSource for Web Crypto. */
function ab(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

function toBytesBE(x: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let v = x;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function fromBytesBE(b: Uint8Array): bigint {
  let v = 0n;
  for (const byte of b) v = (v << 8n) | BigInt(byte);
  return v;
}

const SECRET_BYTES = 32; // a BLS12-381 Fr element
const VALUE_BYTES = 16; // stroops (u128-safe)
const IV_BYTES = 12; // AES-GCM nonce
const PLAINTEXT_BYTES = SECRET_BYTES + VALUE_BYTES; // 48

/**
 * Deterministic AES-GCM-256 note-encryption key from the wallet seed — the SAME wallet derives
 * the SAME key on any device, so ciphertexts written on one device decrypt on another. The key
 * is non-extractable; it never leaves Web Crypto.
 */
export async function deriveNoteKey(seed: bigint): Promise<CryptoKey> {
  const material = new Uint8Array([...toBytesBE(seed, 32), ...utf8.encode(NOTE_ENC_DOMAIN)]);
  const digest = await subtle().digest("SHA-256", ab(material));
  return subtle().importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypt a note opening → `iv(12) || ciphertext+tag(48+16)` = 76 bytes. Posted on-chain in the
 * transfer/withdrawal event so the owner can recover the note from the chain alone.
 */
export async function encryptNoteOpening(
  key: CryptoKey,
  secret: bigint,
  value: bigint,
): Promise<Uint8Array> {
  const iv = randomBytes(IV_BYTES);
  const plaintext = new Uint8Array([...toBytesBE(secret, SECRET_BYTES), ...toBytesBE(value, VALUE_BYTES)]);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(plaintext)));
  return new Uint8Array([...iv, ...ct]);
}

/**
 * Trial-decrypt a note ciphertext. Returns the opening if it authenticates under `key` (i.e. it
 * is the owner's note), else `null` (someone else's ciphertext, corrupt, or an empty/no-change
 * sentinel). Never throws on a foreign ciphertext — that is the normal scan case.
 */
export async function decryptNoteOpening(
  key: CryptoKey,
  blob: Uint8Array,
): Promise<{ secret: bigint; value: bigint } | null> {
  if (blob.length < IV_BYTES + 16) return null; // too short to hold iv + a GCM tag
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  let pt: ArrayBuffer;
  try {
    pt = await subtle().decrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(ct));
  } catch {
    return null; // not ours / corrupt — expected while scanning the whole pool
  }
  const u = new Uint8Array(pt);
  if (u.length !== PLAINTEXT_BYTES) return null;
  return { secret: fromBytesBE(u.slice(0, SECRET_BYTES)), value: fromBytesBE(u.slice(SECRET_BYTES)) };
}
