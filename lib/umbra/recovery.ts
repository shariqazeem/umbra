// On-chain note discovery + recovery. Rebuilds the FULL Merkle tree (so spend inclusion paths are
// correct regardless of who else wrote to the pool) and re-identifies the wallet's own notes two
// ways:
//   1. DEPOSITS — re-derive secrets from the seed and match by their PUBLIC amount.
//   2. CHANGE / RECEIVED notes — hidden value, so they carry an encrypted opening on-chain that we
//      trial-decrypt with the wallet's note key (Zcash-style). This is what recovers a private
//      balance on any device (note-crypto.ts).
//
// Soroban RPC only retains events for ~24h to 7 days (a protocol limit), but a spend must prove
// inclusion against the whole tree. So we seed from a PERMANENT snapshot (the snapshot indexer
// ingests events before they expire; scripts/build-snapshot.mjs + a GitHub Action) and then scan
// the RPC only for events newer than that snapshot. Without a snapshot we fall back to scanning
// from the deploy ledger, which works only inside the retention window.
import { commitment as noteCommitment, nullifier } from "@umbra/wallet-core";
import { UMBRA_CONFIG } from "./config";
import { activeDeployment } from "./deployment";
import { deriveNoteSecret } from "./note-derivation";
import { deriveNoteKey, decryptNoteOpening } from "./note-crypto";
import type { WalletNote } from "./wallet";
import {
  scanPoolEvents,
  deserializeSnapshot,
  emptyScan,
  withRpcRetry,
  type PoolSnapshot,
  type ScannedEvents,
} from "./pool-events";

const MAX_NONCE_SCAN = 64; // how many deterministic notes to look for per wallet
// Fallback scan depth when there is no snapshot (safe value inside any RPC retention window).
const LEDGER_WINDOW = 17280;
const DEPLOY_LEDGER = Number((activeDeployment as { deployLedger?: number }).deployLedger ?? 0);
// The permanent leaf record, refreshed by the snapshot indexer and served statically by Vercel.
const SNAPSHOT_URL = "/pool-snapshot.mainnet.json";

export interface RecoveryResult {
  allLeaves: bigint[]; // full on-chain leaf set, by index
  owned: WalletNote[]; // the wallet's notes (deterministic-matched), with spent status
  scannedDeposits: number;
}

/** Load the permanent pool snapshot (public leaf data) if it exists and matches the active pool. */
async function loadSnapshot(): Promise<ScannedEvents | null> {
  try {
    if (typeof fetch === "undefined") return null;
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const snap = (await res.json()) as PoolSnapshot;
    if (!snap || snap.pool !== UMBRA_CONFIG.poolContractId) return null;
    return deserializeSnapshot(snap);
  } catch {
    return null;
  }
}

/** Discover the wallet's notes + the full tree from chain, given the wallet seed. */
export async function recoverFromChain(seed: bigint): Promise<RecoveryResult> {
  const sdk = await import("@stellar/stellar-sdk");
  const server = new sdk.rpc.Server(UMBRA_CONFIG.rpcUrl, { allowHttp: true });
  const pool = UMBRA_CONFIG.poolContractId;
  if (!pool) return { allLeaves: [], owned: [], scannedDeposits: 0 };

  // Seed from the permanent snapshot, then top up with only the events newer than it.
  const acc: ScannedEvents = (await loadSnapshot()) ?? emptyScan();

  const latest = await withRpcRetry(() => server.getLatestLedger());
  // Probe the RPC's oldest retained ledger so the scan start can never fall before it (getEvents
  // errors otherwise).
  let oldestRetained = 0;
  try {
    const probe = await withRpcRetry(() =>
      server.getEvents({
        startLedger: Math.max(1, latest.sequence - 256),
        filters: [{ type: "contract" as const, contractIds: [pool] }],
        limit: 1,
      } as Parameters<typeof server.getEvents>[0]),
    );
    oldestRetained = Number((probe as { oldestLedger?: number }).oldestLedger ?? 0);
  } catch {
    /* probe failed — use the fallback window below */
  }

  // Continue from just after the snapshot when we have one; else from the deploy ledger; else the
  // rolling window. Clamp to the retention floor so getEvents never errors.
  const preferredStart =
    acc.lastLedger > 0 ? acc.lastLedger + 1 : DEPLOY_LEDGER || Math.max(1, latest.sequence - LEDGER_WINDOW);
  const startLedger = oldestRetained > 0 ? Math.max(oldestRetained, preferredStart) : preferredStart;

  await scanPoolEvents(sdk, server, pool, startLedger, acc);

  // Full tree leaves, DENSE by on-chain leaf index (deposits + transfer/withdraw change outputs).
  // Building from a leaf-indexed map keeps positions correct even when change-note leaves sit
  // between deposits — otherwise the reconstructed root would not match the contract's.
  acc.deposits.sort((a, b) => a.leafIndex - b.leafIndex);
  const maxLeaf = acc.leafAt.size > 0 ? Math.max(...acc.leafAt.keys()) : -1;
  const allLeaves: bigint[] = [];
  for (let i = 0; i <= maxLeaf; i++) allLeaves.push(acc.leafAt.get(i) ?? 0n);

  // Re-derive secrets and match deposits → owned notes (matched by their public amount).
  const secrets = Array.from({ length: MAX_NONCE_SCAN }, (_, n) => deriveNoteSecret(seed, n));
  const owned: WalletNote[] = [];
  for (const d of acc.deposits) {
    for (const secret of secrets) {
      if (noteCommitment({ secret, value: d.amount }) === d.commitment) {
        const nf = nullifier({ secret, value: d.amount }, d.leafIndex);
        owned.push({ secret, value: d.amount, leafIndex: d.leafIndex, spent: acc.spent.has(nf.toString()) });
        break;
      }
    }
  }

  // Recover CHANGE notes from their encrypted openings (hidden value → not matchable by amount).
  // Trial-decrypt each on-chain ciphertext with the wallet's note key; a decrypt that both
  // authenticates AND matches the on-chain commitment is one of ours.
  const noteKey = await deriveNoteKey(seed);
  for (const cc of acc.changeCts) {
    const opening = await decryptNoteOpening(noteKey, cc.ct);
    if (!opening) continue; // not ours, or a full-exit sentinel
    if (noteCommitment({ secret: opening.secret, value: opening.value }) !== cc.commitment) continue;
    const nf = nullifier({ secret: opening.secret, value: opening.value }, cc.leafIndex);
    owned.push({ secret: opening.secret, value: opening.value, leafIndex: cc.leafIndex, spent: acc.spent.has(nf.toString()) });
  }

  // Recover RECEIVED notes registered on-chain at claim time. Same trial-decrypt; dedupe against
  // notes already recovered as a deposit/change at the same leaf.
  const ownedLeaves = new Set(owned.map((n) => n.leafIndex));
  for (const rc of acc.registeredCts) {
    if (ownedLeaves.has(rc.leafIndex)) continue;
    const opening = await decryptNoteOpening(noteKey, rc.ct);
    if (!opening) continue;
    if (noteCommitment({ secret: opening.secret, value: opening.value }) !== rc.commitment) continue;
    const nf = nullifier({ secret: opening.secret, value: opening.value }, rc.leafIndex);
    owned.push({ secret: opening.secret, value: opening.value, leafIndex: rc.leafIndex, spent: acc.spent.has(nf.toString()) });
    ownedLeaves.add(rc.leafIndex);
  }

  return { allLeaves, owned, scannedDeposits: acc.deposits.length };
}
