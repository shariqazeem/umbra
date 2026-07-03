/**
 * Local, encrypted audit log. Every meaningful wallet action appends an AES-GCM
 * encrypted record (under the local viewing key). Records live in localStorage as
 * ciphertext; the wallet UI only ever sees `{ hasKey, count }` without decrypting.
 * Export produces an audit packet the user can disclose (with the viewing key) to an
 * accountant/auditor.
 *
 * Honest boundary: the viewing key is ALSO stored locally for the user's own use, so
 * "encrypted at rest" is not protection against someone with full localStorage access.
 * The real security boundary is the EXPORTED packet, which is useless without the
 * separately-exported key.
 */

import { UMBRA_CONFIG } from "./config";
import { NETWORK_LABEL } from "./network";
import {
  AUDIT_PACKET_FORMAT,
  AUDIT_PACKET_VERSION,
  encryptAuditRecord,
  exportViewingKey,
  generateViewingKey,
  importViewingKey,
  type AuditPacket,
  type AuditRecord,
  type EncryptedBlob,
} from "./viewing-key";

const VK_KEY = "umbra.audit.vk.v1";
const REC_KEY = "umbra.audit.records.v1";
const NETWORK = NETWORK_LABEL;

/** Fields a caller supplies; the store fills id/timestamp/network/poolContractId. */
export type AuditDraft = Omit<AuditRecord, "id" | "timestamp" | "network" | "poolContractId"> & {
  poolContractId?: string | null;
};

type StoredRecord = { id: string; blob: EncryptedBlob };
export type AuditSnapshot = { hasKey: boolean; count: number };

const listeners = new Set<() => void>();
let cachedKey: CryptoKey | null = null;
let snapshot: AuditSnapshot = { hasKey: false, count: 0 };

function browser(): boolean {
  return typeof window !== "undefined";
}

function readStored(): StoredRecord[] {
  if (!browser()) return [];
  try {
    const raw = window.localStorage.getItem(REC_KEY);
    return raw ? (JSON.parse(raw) as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function recompute(): void {
  const hasKey = browser() ? !!window.localStorage.getItem(VK_KEY) : false;
  const count = readStored().length;
  if (snapshot.hasKey !== hasKey || snapshot.count !== count) {
    snapshot = { hasKey, count };
  }
}

function notify(): void {
  recompute();
  listeners.forEach((l) => l());
}

async function ensureKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const stored = browser() ? window.localStorage.getItem(VK_KEY) : null;
  if (stored) {
    cachedKey = await importViewingKey(stored);
    return cachedKey;
  }
  const key = await generateViewingKey();
  if (browser()) window.localStorage.setItem(VK_KEY, await exportViewingKey(key));
  cachedKey = key;
  notify();
  return cachedKey;
}

// Recompute once at module load (client only).
if (browser()) recompute();

export const auditStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot(): AuditSnapshot {
    return snapshot;
  },

  hasKey(): boolean {
    return browser() ? !!window.localStorage.getItem(VK_KEY) : false;
  },

  /** Create the viewing key if it doesn't exist yet (idempotent). */
  async generateKey(): Promise<void> {
    await ensureKey();
  },

  /** The exported viewing-key string (or null if none yet). */
  exportKey(): string | null {
    return browser() ? window.localStorage.getItem(VK_KEY) : null;
  },

  /** Encrypt + append a record. Never throws into the caller's success path. */
  async log(draft: AuditDraft): Promise<void> {
    if (!browser()) return;
    try {
      const record: AuditRecord = {
        ...draft,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        network: NETWORK,
        poolContractId: draft.poolContractId ?? (UMBRA_CONFIG.poolContractId || null),
      };
      const key = await ensureKey();
      const blob = await encryptAuditRecord(key, record);
      const recs = readStored();
      recs.push({ id: record.id, blob });
      window.localStorage.setItem(REC_KEY, JSON.stringify(recs));
      notify();
    } catch (e) {
      // Audit logging must never break a real on-chain action.
      console.warn("[umbra] audit log failed:", e);
    }
  },

  /** Bundle the stored ciphertext into a disclosable packet (still encrypted). */
  exportPacket(): AuditPacket {
    const recs = readStored();
    return {
      format: AUDIT_PACKET_FORMAT,
      version: AUDIT_PACKET_VERSION,
      network: NETWORK,
      createdAt: new Date().toISOString(),
      count: recs.length,
      records: recs.map((r) => r.blob),
    };
  },

  /** Clear the local audit records (keeps the viewing key). */
  clearRecords(): void {
    if (!browser()) return;
    window.localStorage.removeItem(REC_KEY);
    notify();
  },
};
