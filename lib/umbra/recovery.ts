// On-chain note discovery + recovery. Scans the pool's DepositCreated /
// WithdrawalCompleted events, rebuilds the FULL Merkle tree (so withdrawal paths are
// correct regardless of who else wrote to the pool — this also removes the single-
// writer limitation), and re-identifies the wallet's own notes by re-deriving secrets
// from the wallet seed and matching commitments.
import { commitment as noteCommitment, nullifier } from "@umbra/wallet-core";
import { UMBRA_CONFIG } from "./config";
import { deriveNoteSecret } from "./note-derivation";
import type { WalletNote } from "./wallet";

const MAX_NONCE_SCAN = 64; // how many deterministic notes to look for per wallet
// How far back to scan for events. The RPC walks forward in small pages, so a wide
// window is slow; a fresh pool's activity is recent. ~4500 ledgers ≈ last ~6 hours.
const LEDGER_WINDOW = 4500;

interface Deposit {
  commitment: bigint;
  leafIndex: number;
  amount: bigint;
}

export interface RecoveryResult {
  allLeaves: bigint[]; // full on-chain leaf set, by index
  owned: WalletNote[]; // the wallet's notes (deterministic-matched), with spent status
  scannedDeposits: number;
}

function toBig(v: unknown): bigint {
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

/** Discover the wallet's notes + the full tree from chain, given the wallet seed. */
export async function recoverFromChain(seed: bigint): Promise<RecoveryResult> {
  const sdk = await import("@stellar/stellar-sdk");
  const server = new sdk.rpc.Server(UMBRA_CONFIG.rpcUrl, { allowHttp: true });
  const pool = UMBRA_CONFIG.poolContractId;
  if (!pool) return { allLeaves: [], owned: [], scannedDeposits: 0 };

  const latest = await server.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - LEDGER_WINDOW);

  const deposits: Deposit[] = [];
  const spent = new Set<string>();
  let cursor: string | undefined;

  // The RPC paginates sparsely (a page can be empty while more ledgers remain), so we
  // follow the cursor forward. Stop when it runs out, or a few empty pages after the
  // last activity (we've walked past it), or at the hard page cap.
  let found = false;
  let emptyStreak = 0;
  for (let page = 0; page < 16; page++) {
    const req = cursor
      ? { cursor, filters: [{ type: "contract" as const, contractIds: [pool] }], limit: 200 }
      : { startLedger, filters: [{ type: "contract" as const, contractIds: [pool] }], limit: 200 };
    const resp = await server.getEvents(req as Parameters<typeof server.getEvents>[0]);
    const events = resp.events ?? [];
    const before = deposits.length + spent.size;
    for (const ev of events) {
      const topics = (ev.topic ?? []) as unknown[];
      const t0 = topics[0] ? sdk.scValToNative(topics[0] as never) : null;
      const val = ev.value ? sdk.scValToNative(ev.value as never) : null;
      if (t0 === "DepositCreated" && Array.isArray(val)) {
        deposits.push({ commitment: toBig(val[0]), leafIndex: Number(val[1]), amount: toBig(val[2]) });
      } else if (t0 === "WithdrawalCompleted" && Array.isArray(val)) {
        spent.add(toBig(val[0]).toString());
      }
    }
    if (deposits.length + spent.size > before) {
      found = true;
      emptyStreak = 0;
    } else {
      emptyStreak += 1;
    }
    cursor = resp.cursor;
    if (!cursor) break;
    if (found && emptyStreak >= 3) break;
  }

  // Full tree leaves, ordered by leaf index.
  deposits.sort((a, b) => a.leafIndex - b.leafIndex);
  const allLeaves = deposits.map((d) => d.commitment);

  // Re-derive secrets and match deposits → owned notes.
  const secrets = Array.from({ length: MAX_NONCE_SCAN }, (_, n) => deriveNoteSecret(seed, n));
  const owned: WalletNote[] = [];
  for (const d of deposits) {
    for (const secret of secrets) {
      if (noteCommitment({ secret, value: d.amount }) === d.commitment) {
        const nf = nullifier({ secret, value: d.amount }, d.leafIndex);
        owned.push({ secret, value: d.amount, leafIndex: d.leafIndex, spent: spent.has(nf.toString()) });
        break;
      }
    }
  }

  return { allLeaves, owned, scannedDeposits: deposits.length };
}
