/**
 * Umbra selective disclosure — viewing keys + encrypted audit packets (v1).
 *
 * Design (honest):
 *   - "Private by default. Disclose only when you choose."
 *   - A locally generated AES-GCM-256 viewing key encrypts each audit record.
 *   - An audit packet bundles the encrypted records with an unencrypted metadata
 *     header (format/version/network) so a viewer can identify it without the key.
 *   - v1 is SYMMETRIC: the user exports the packet AND the viewing key (separately)
 *     and shares both with whoever they consent to disclose to. There is NO auditor
 *     public key, NO backdoor, and NO ZK disclosure proof — those are roadmap.
 *
 * Browser-safe: uses Web Crypto (`crypto.subtle`), available in the browser and in
 * Node 20+. No Node-only APIs, so it bundles cleanly for Next.
 */

export const AUDIT_PACKET_FORMAT = "umbra-audit-packet" as const;
export const AUDIT_PACKET_VERSION = 1 as const;
export const VIEWING_KEY_PREFIX = "umbra-vk-v1:" as const;

export type AuditRecordKind = "shield" | "withdraw" | "send" | "pay_link_created" | "pay_link_paid";

/** One disclosed event, holding only what the app can honestly know. */
export interface AuditRecord {
  id: string;
  kind: AuditRecordKind;
  timestamp: string; // ISO 8601
  network: string; // e.g. "testnet"
  poolContractId: string | null;
  txHash?: string | null;
  explorerUrl?: string | null;
  commitment?: string | null;
  nullifier?: string | null;
  root?: string | null;
  leafIndex?: number | null;
  amount: string; // decimal string
  asset?: string | null; // e.g. "XLM"
  direction: "in" | "out" | "request";
  counterparty?: string | null; // address/recipient the user entered, if any
  label?: string | null; // note title/label, if any
  /** Human-readable sentence: what this record proves. */
  disclosureNote: string;
}

/** AES-GCM ciphertext, base64-encoded. */
export interface EncryptedBlob {
  iv: string;
  data: string;
}

export interface AuditPacket {
  format: typeof AUDIT_PACKET_FORMAT;
  version: number;
  network: string;
  createdAt: string;
  count: number;
  records: EncryptedBlob[];
}

/* ── low-level helpers ── */

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

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/** Copy into a standalone ArrayBuffer — a clean BufferSource for Web Crypto. */
function ab(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

/* ── viewing key ── */

export async function generateViewingKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

/** Export to a shareable string: `umbra-vk-v1:<base64url(raw 32 bytes)>`. */
export async function exportViewingKey(key: CryptoKey): Promise<string> {
  const raw = await subtle().exportKey("raw", key);
  const b64url = toB64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return VIEWING_KEY_PREFIX + b64url;
}

/** Parse a viewing key string (with or without the prefix). */
export async function importViewingKey(text: string): Promise<CryptoKey> {
  const trimmed = text.trim();
  const body = trimmed.startsWith(VIEWING_KEY_PREFIX) ? trimmed.slice(VIEWING_KEY_PREFIX.length) : trimmed;
  const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
  let bytes: Uint8Array;
  try {
    bytes = fromB64(b64);
  } catch {
    throw new Error("Invalid viewing key (not valid base64)");
  }
  if (bytes.length !== 32) throw new Error("Invalid viewing key (expected 32 bytes)");
  return subtle().importKey("raw", ab(bytes), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

/* ── record encryption ── */

export async function encryptAuditRecord(key: CryptoKey, record: AuditRecord): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(utf8.encode(JSON.stringify(record))));
  return { iv: toB64(iv), data: toB64(ct) };
}

export async function decryptAuditRecord(key: CryptoKey, blob: EncryptedBlob): Promise<AuditRecord> {
  let pt: ArrayBuffer;
  try {
    pt = await subtle().decrypt({ name: "AES-GCM", iv: ab(fromB64(blob.iv)) }, key, ab(fromB64(blob.data)));
  } catch {
    throw new Error("Decryption failed — wrong viewing key or corrupted record");
  }
  try {
    return JSON.parse(fromUtf8.decode(pt)) as AuditRecord;
  } catch {
    throw new Error("Decryption succeeded but the record was not valid JSON");
  }
}

/* ── packets ── */

export async function createAuditPacket(
  key: CryptoKey,
  records: AuditRecord[],
  opts?: { network?: string; createdAt?: string },
): Promise<AuditPacket> {
  const encrypted = await Promise.all(records.map((r) => encryptAuditRecord(key, r)));
  return {
    format: AUDIT_PACKET_FORMAT,
    version: AUDIT_PACKET_VERSION,
    network: opts?.network ?? "testnet",
    createdAt: opts?.createdAt ?? new Date().toISOString(),
    count: encrypted.length,
    records: encrypted,
  };
}

export async function decryptAuditPacket(key: CryptoKey, packet: unknown): Promise<AuditRecord[]> {
  const p = packet as Partial<AuditPacket> | null;
  if (!p || typeof p !== "object") throw new Error("Not an audit packet");
  if (p.format !== AUDIT_PACKET_FORMAT) throw new Error("Not an Umbra audit packet");
  if (typeof p.version !== "number" || p.version > AUDIT_PACKET_VERSION) {
    throw new Error("Unsupported audit packet version");
  }
  if (!Array.isArray(p.records)) throw new Error("Malformed audit packet (records missing)");
  const out: AuditRecord[] = [];
  for (const blob of p.records) {
    const b = blob as EncryptedBlob;
    if (!b || typeof b.iv !== "string" || typeof b.data !== "string") {
      throw new Error("Malformed audit packet (bad record entry)");
    }
    out.push(await decryptAuditRecord(key, b));
  }
  return out;
}
