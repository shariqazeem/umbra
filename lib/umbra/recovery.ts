// On-chain note discovery + recovery. Scans the pool's DepositCreated / WithdrawalCompleted /
// TransferCompleted events, rebuilds the FULL Merkle tree (so withdrawal paths are correct
// regardless of who else wrote to the pool), and re-identifies the wallet's own notes two ways:
//   1. DEPOSITS — re-derive secrets from the seed and match by their PUBLIC amount.
//   2. CHANGE notes — hidden-value, so they can't be matched by amount; instead they carry an
//      encrypted opening on-chain (Zcash-style note ciphertext), which we trial-decrypt with the
//      wallet's note key. This is what lets change notes recover on any device (note-crypto.ts).
import { commitment as noteCommitment, nullifier } from "@umbra/wallet-core";
import { UMBRA_CONFIG } from "./config";
import { deriveNoteSecret } from "./note-derivation";
import { deriveNoteKey, decryptNoteOpening } from "./note-crypto";
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

/** A scValToNative'd Bytes value (Buffer/Uint8Array/{data}) → Uint8Array. */
function toBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v && typeof v === "object" && "data" in (v as Record<string, unknown>)) {
    return Uint8Array.from((v as { data: number[] }).data);
  }
  return new Uint8Array(0);
}

/** An on-chain encrypted change-note opening, to be trial-decrypted with the wallet's note key. */
interface ChangeCipher {
  ct: Uint8Array;
  commitment: bigint;
  leafIndex: number;
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
  const leafAt = new Map<number, bigint>(); // every inserted commitment, by on-chain leaf index
  const changeCts: ChangeCipher[] = []; // encrypted change-note openings, to trial-decrypt
  const registeredCts: { ct: Uint8Array; leafIndex: number }[] = []; // received notes (register-on-claim)
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
    const before = leafAt.size + spent.size + registeredCts.length;
    for (const ev of events) {
      const topics = (ev.topic ?? []) as unknown[];
      const t0 = topics[0] ? sdk.scValToNative(topics[0] as never) : null;
      const val = ev.value ? sdk.scValToNative(ev.value as never) : null;
      if (t0 === "DepositCreated" && Array.isArray(val)) {
        const commitment = toBig(val[0]);
        const leafIndex = Number(val[1]);
        deposits.push({ commitment, leafIndex, amount: toBig(val[2]) });
        leafAt.set(leafIndex, commitment);
      } else if (t0 === "WithdrawalCompleted" && Array.isArray(val)) {
        // (nullifier, to, amount, change_commitment, change_leaf, change_ct): a spent input note
        // plus a new change commitment that MUST be in the tree, and its encrypted opening. A
        // full exit emits change_commitment == 0 (no leaf inserted) — skip that sentinel.
        spent.add(toBig(val[0]).toString());
        if (val.length >= 5 && toBig(val[3]) !== 0n) {
          const cm = toBig(val[3]);
          leafAt.set(Number(val[4]), cm);
          if (val.length >= 6) changeCts.push({ ct: toBytes(val[5]), commitment: cm, leafIndex: Number(val[4]) });
        }
      } else if (t0 === "TransferCompleted" && Array.isArray(val)) {
        // (nullifier, outCommitment1, outCommitment2, leaf1, leaf2, change_ct): a spent input
        // plus two new commitments (both in the tree), and the SENDER's change (out2) opening.
        spent.add(toBig(val[0]).toString());
        leafAt.set(Number(val[3]), toBig(val[1]));
        const out2 = toBig(val[2]);
        leafAt.set(Number(val[4]), out2);
        if (val.length >= 6) changeCts.push({ ct: toBytes(val[5]), commitment: out2, leafIndex: Number(val[4]) });
      } else if (t0 === "NoteRegistered" && Array.isArray(val)) {
        // (leaf_index, note_ct): a RECEIVED note the owner claimed + registered on-chain, so it
        // recovers cross-device. Matched below by decrypting the ct + checking the commitment.
        registeredCts.push({ ct: toBytes(val[1]), leafIndex: Number(val[0]) });
      }
    }
    if (leafAt.size + spent.size + registeredCts.length > before) {
      found = true;
      emptyStreak = 0;
    } else {
      emptyStreak += 1;
    }
    cursor = resp.cursor;
    if (!cursor) break;
    if (found && emptyStreak >= 3) break;
  }

  // Full tree leaves, DENSE by on-chain leaf index (deposits + transfer outputs). Building
  // from a leaf-indexed map keeps positions correct even when transfer-output leaves sit
  // between deposits — otherwise the reconstructed root would not match the contract's.
  deposits.sort((a, b) => a.leafIndex - b.leafIndex);
  const maxLeaf = leafAt.size > 0 ? Math.max(...leafAt.keys()) : -1;
  const allLeaves: bigint[] = [];
  for (let i = 0; i <= maxLeaf; i++) allLeaves.push(leafAt.get(i) ?? 0n);

  // Re-derive secrets and match deposits → owned notes (matched by their public amount).
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

  // Recover CHANGE notes from their encrypted openings (hidden value → not matchable by amount).
  // Trial-decrypt each on-chain ciphertext with the wallet's note key; a decrypt that both
  // authenticates AND matches the on-chain commitment is one of ours. This is what makes a
  // private balance rebuild on any device, not just the browser that created it.
  const noteKey = await deriveNoteKey(seed);
  for (const cc of changeCts) {
    const opening = await decryptNoteOpening(noteKey, cc.ct);
    if (!opening) continue; // not ours, or a full-exit sentinel
    if (noteCommitment({ secret: opening.secret, value: opening.value }) !== cc.commitment) continue;
    const nf = nullifier({ secret: opening.secret, value: opening.value }, cc.leafIndex);
    owned.push({ secret: opening.secret, value: opening.value, leafIndex: cc.leafIndex, spent: spent.has(nf.toString()) });
  }

  // Recover RECEIVED notes registered on-chain at claim time (register-on-claim). Same trial-
  // decrypt: a ciphertext that decrypts under our key AND matches the on-chain commitment at its
  // leaf is ours. Dedupe against notes already recovered as a deposit/change at the same leaf.
  const ownedLeaves = new Set(owned.map((n) => n.leafIndex));
  for (const rc of registeredCts) {
    if (ownedLeaves.has(rc.leafIndex)) continue;
    const commitment = leafAt.get(rc.leafIndex);
    if (commitment === undefined) continue;
    const opening = await decryptNoteOpening(noteKey, rc.ct);
    if (!opening) continue;
    if (noteCommitment({ secret: opening.secret, value: opening.value }) !== commitment) continue;
    const nf = nullifier({ secret: opening.secret, value: opening.value }, rc.leafIndex);
    owned.push({ secret: opening.secret, value: opening.value, leafIndex: rc.leafIndex, spent: spent.has(nf.toString()) });
    ownedLeaves.add(rc.leafIndex);
  }

  return { allLeaves, owned, scannedDeposits: deposits.length };
}
