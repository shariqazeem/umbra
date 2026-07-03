// Shared Soroban event scanning for the Umbra pool. Used by BOTH the wallet's live recovery
// (recovery.ts) and the snapshot indexer (scripts/build-snapshot.mjs), so the two never drift.
//
// It extracts the seed-INDEPENDENT data recovery needs from the pool's events: every inserted
// leaf (by index), deposits (for amount-matching), spent nullifiers, and the encrypted change /
// received-note openings (for cross-device recovery). All of this is public on-chain data; no
// secrets. The wallet does the seed-specific matching/decryption on top of this in recovery.ts.
//
// Why this exists: Soroban RPC only retains events for ~24h to 7 days (a protocol limit). A spend
// proves Merkle inclusion against a root the contract still holds, so the wallet must rebuild the
// FULL leaf set. Past retention the events are gone, so the snapshot indexer ingests them into a
// permanent record (per Stellar's own guidance) and the wallet seeds its tree from that snapshot
// plus recent live events.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ScannedEvents {
  deposits: { commitment: bigint; leafIndex: number; amount: bigint }[];
  spent: Set<string>; // nullifier decimal strings
  leafAt: Map<number, bigint>; // leafIndex -> commitment (every inserted leaf)
  changeCts: { ct: Uint8Array; commitment: bigint; leafIndex: number }[];
  registeredCts: { ct: Uint8Array; commitment: bigint; leafIndex: number }[];
  lastLedger: number; // highest ledger observed in this scan (for incremental continuation)
}

export function emptyScan(): ScannedEvents {
  return { deposits: [], spent: new Set(), leafAt: new Map(), changeCts: [], registeredCts: [], lastLedger: 0 };
}

export function toBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (v instanceof Uint8Array) {
    let hex = "";
    for (const b of v) hex += b.toString(16).padStart(2, "0");
    return hex ? BigInt("0x" + hex) : 0n;
  }
  if (v && typeof v === "object" && "data" in (v as Record<string, unknown>)) {
    return toBig(Uint8Array.from((v as { data: number[] }).data));
  }
  return BigInt(String(v));
}

export function toBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v && typeof v === "object" && "data" in (v as Record<string, unknown>)) {
    return Uint8Array.from((v as { data: number[] }).data);
  }
  return new Uint8Array(0);
}

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string): Uint8Array =>
  s ? Uint8Array.from(s.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))) : new Uint8Array(0);

/* ── Transient-failure retry for RPC calls ──────────────────────────────────────────────────────
 * Public Soroban RPCs rate-limit shared IPs (CI runners, busy Wi-Fi) with HTTP 429, and can return
 * 5xx / network blips. A single un-retried failure aborts the scan mid-way, so the caller rebuilds
 * an INCOMPLETE Merkle tree → a root the contract never held → the spend reverts with Error(#4).
 * Exponential backoff makes a transient throttle recoverable instead of corrupting recovery. */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function httpStatus(e: unknown): number | undefined {
  const anyE = e as { response?: { status?: number }; status?: number; message?: unknown };
  const s = anyE?.response?.status ?? anyE?.status;
  if (typeof s === "number") return s;
  const m = /status code (\d{3})/i.exec(String(anyE?.message ?? ""));
  return m ? Number(m[1]) : undefined;
}

export async function withRpcRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const s = httpStatus(e);
      const msg = String((e as { message?: unknown })?.message ?? "");
      const retryable =
        s === 429 ||
        (s !== undefined && s >= 500 && s <= 599) ||
        (s === undefined && /timeout|network|fetch failed|econnreset|etimedout|eai_again|socket hang up/i.test(msg));
      if (!retryable || i === attempts - 1) throw e;
      await sleep(Math.min(1000 * 2 ** i, 16000) + Math.floor(Math.random() * 250));
    }
  }
  throw lastErr;
}

/**
 * Scan the pool's events from `startLedger` forward, merging into `acc` (so callers can continue
 * an existing snapshot incrementally). `sdk` is the @stellar/stellar-sdk module and `server` its
 * rpc.Server — passed in so this works in both the browser (dynamic import) and Node (the script).
 */
export async function scanPoolEvents(
  sdk: any,
  server: any,
  pool: string,
  startLedger: number,
  acc: ScannedEvents = emptyScan(),
  maxPages = 60,
): Promise<ScannedEvents> {
  let cursor: string | undefined;
  let found = false;
  let emptyStreak = 0;
  const seenLeaf = new Set(acc.leafAt.keys());
  for (let page = 0; page < maxPages; page++) {
    const req = cursor
      ? { cursor, filters: [{ type: "contract" as const, contractIds: [pool] }], limit: 200 }
      : { startLedger, filters: [{ type: "contract" as const, contractIds: [pool] }], limit: 200 };
    // `server` is untyped (any) here, so pin resp explicitly — withRpcRetry would otherwise widen it.
    const resp: any = await withRpcRetry(() => server.getEvents(req));
    const events = resp.events ?? [];
    const before = acc.leafAt.size + acc.spent.size + acc.registeredCts.length;
    for (const ev of events) {
      if (ev.ledger) acc.lastLedger = Math.max(acc.lastLedger, Number(ev.ledger));
      const topics = (ev.topic ?? []) as unknown[];
      const t0 = topics[0] ? sdk.scValToNative(topics[0]) : null;
      const val = ev.value ? sdk.scValToNative(ev.value) : null;
      if (t0 === "DepositCreated" && Array.isArray(val)) {
        const commitment = toBig(val[0]);
        const leafIndex = Number(val[1]);
        if (!seenLeaf.has(leafIndex)) {
          acc.deposits.push({ commitment, leafIndex, amount: toBig(val[2]) });
          acc.leafAt.set(leafIndex, commitment);
          seenLeaf.add(leafIndex);
        }
      } else if (t0 === "WithdrawalCompleted" && Array.isArray(val)) {
        acc.spent.add(toBig(val[0]).toString());
        if (val.length >= 5 && toBig(val[3]) !== 0n) {
          const cm = toBig(val[3]);
          const li = Number(val[4]);
          if (!seenLeaf.has(li)) {
            acc.leafAt.set(li, cm);
            seenLeaf.add(li);
            if (val.length >= 6) acc.changeCts.push({ ct: toBytes(val[5]), commitment: cm, leafIndex: li });
          }
        }
      } else if (t0 === "TransferCompleted" && Array.isArray(val)) {
        acc.spent.add(toBig(val[0]).toString());
        const out2 = toBig(val[2]);
        const li = Number(val[3]);
        if (!seenLeaf.has(li)) {
          acc.leafAt.set(li, out2);
          seenLeaf.add(li);
          if (val.length >= 5) acc.changeCts.push({ ct: toBytes(val[4]), commitment: out2, leafIndex: li });
        }
      } else if (t0 === "NoteRegistered" && Array.isArray(val)) {
        const cm = toBig(val[1]);
        const li = Number(val[0]);
        if (!seenLeaf.has(li)) {
          acc.leafAt.set(li, cm);
          seenLeaf.add(li);
          acc.registeredCts.push({ ct: toBytes(val[2]), commitment: cm, leafIndex: li });
        }
      }
    }
    if (acc.leafAt.size + acc.spent.size + acc.registeredCts.length > before) {
      found = true;
      emptyStreak = 0;
    } else {
      emptyStreak += 1;
    }
    cursor = resp.cursor;
    if (!cursor) break;
    if (found && emptyStreak >= 3) break;
  }
  return acc;
}

/* ── Serializable snapshot (all public data; hex/decimal strings, no bigints/bytes) ── */

export interface PoolSnapshot {
  pool: string;
  deployLedger: number;
  lastLedger: number;
  leaves: [number, string][]; // [leafIndex, commitment decimal]
  deposits: [string, number, string][]; // [commitment, leafIndex, amount]
  spent: string[]; // nullifier decimals
  changeCts: [string, string, number][]; // [ctHex, commitment, leafIndex]
  registeredCts: [string, string, number][];
}

export function serializeSnapshot(pool: string, deployLedger: number, s: ScannedEvents): PoolSnapshot {
  return {
    pool,
    deployLedger,
    lastLedger: s.lastLedger,
    leaves: [...s.leafAt.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => [i, c.toString()]),
    deposits: s.deposits.map((d) => [d.commitment.toString(), d.leafIndex, d.amount.toString()]),
    spent: [...s.spent],
    changeCts: s.changeCts.map((c) => [hex(c.ct), c.commitment.toString(), c.leafIndex]),
    registeredCts: s.registeredCts.map((c) => [hex(c.ct), c.commitment.toString(), c.leafIndex]),
  };
}

/** Rehydrate a snapshot into an in-memory ScannedEvents the wallet can continue scanning from. */
export function deserializeSnapshot(snap: PoolSnapshot): ScannedEvents {
  const acc = emptyScan();
  acc.lastLedger = snap.lastLedger;
  for (const [i, c] of snap.leaves) acc.leafAt.set(i, BigInt(c));
  for (const [c, i, a] of snap.deposits) acc.deposits.push({ commitment: BigInt(c), leafIndex: i, amount: BigInt(a) });
  for (const n of snap.spent) acc.spent.add(n);
  for (const [ct, c, i] of snap.changeCts) acc.changeCts.push({ ct: unhex(ct), commitment: BigInt(c), leafIndex: i });
  for (const [ct, c, i] of snap.registeredCts) acc.registeredCts.push({ ct: unhex(ct), commitment: BigInt(c), leafIndex: i });
  return acc;
}
