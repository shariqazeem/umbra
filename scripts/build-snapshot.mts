// Snapshot indexer. Run on a schedule by .github/workflows/pool-snapshot.yml (via `npx tsx`).
//
// Soroban RPC only retains events for ~24h to 7 days, but wallet recovery must rebuild the full
// Merkle tree to prove a spend. This script ingests the pool's events into a PERMANENT record
// (public/pool-snapshot.mainnet.json, served statically by Vercel) BEFORE they expire, continuing
// the previous snapshot incrementally so no leaf is ever lost. The wallet seeds its tree from this
// snapshot plus recent live events (lib/umbra/recovery.ts). This is Stellar's recommended pattern
// for long-lived event history.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as sdk from "@stellar/stellar-sdk";
import {
  scanPoolEvents,
  serializeSnapshot,
  deserializeSnapshot,
  emptyScan,
  type PoolSnapshot,
} from "../lib/umbra/pool-events";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const deployment = JSON.parse(readFileSync(join(root, "infra/deploy/deployment.mainnet.json"), "utf8"));
const POOL: string = deployment.contractIds.pool;
const DEPLOY_LEDGER = Number(deployment.deployLedger ?? 0);
const RPC =
  process.env.SNAPSHOT_RPC_URL || process.env.NEXT_PUBLIC_UMBRA_RPC_URL || "https://mainnet.sorobanrpc.com";
const OUT = join(root, "public", "pool-snapshot.mainnet.json");

const server = new sdk.rpc.Server(RPC, { allowHttp: true });

// Continue an existing snapshot incrementally so already-captured leaves survive even after they
// expire from the RPC.
let acc = emptyScan();
if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, "utf8")) as PoolSnapshot;
  if (prev.pool === POOL) acc = deserializeSnapshot(prev);
}

const latest = await server.getLatestLedger();
// Clamp the scan start to the RPC's oldest retained ledger (getEvents errors before it).
let oldest = 0;
try {
  const probe = await server.getEvents({
    startLedger: Math.max(1, latest.sequence - 256),
    filters: [{ type: "contract", contractIds: [POOL] }],
    limit: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldest = Number((probe as any).oldestLedger ?? 0);
} catch {
  /* keep default */
}

const preferred =
  acc.lastLedger > 0 ? acc.lastLedger + 1 : DEPLOY_LEDGER || Math.max(1, latest.sequence - 100000);
const start = oldest > 0 ? Math.max(oldest, preferred) : preferred;

if (oldest > 0 && DEPLOY_LEDGER > 0 && acc.lastLedger === 0 && start > DEPLOY_LEDGER) {
  console.warn(
    `[snapshot] WARNING: no prior snapshot and the deploy ledger (${DEPLOY_LEDGER}) has expired from RPC ` +
      `retention (oldest=${oldest}). The first ${start - DEPLOY_LEDGER} ledgers of leaves are unrecoverable. ` +
      `Run this on a schedule from now on so future leaves are captured.`,
  );
}

console.log(
  `[snapshot] pool=${POOL.slice(0, 8)}… rpc=${RPC} start=${start} (deploy=${DEPLOY_LEDGER}, prev.lastLedger=${acc.lastLedger}, oldestRetained=${oldest}, latest=${latest.sequence})`,
);

await scanPoolEvents(sdk, server, POOL, start, acc, 200);

const snap = serializeSnapshot(POOL, DEPLOY_LEDGER, acc);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snap) + "\n");
console.log(
  `[snapshot] wrote ${OUT}: ${snap.leaves.length} leaves, ${snap.deposits.length} deposits, ` +
    `${snap.spent.length} nullifiers, lastLedger=${snap.lastLedger}`,
);
