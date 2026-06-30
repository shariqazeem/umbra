// Network configuration + mainnet safety gates. Umbra runs on Stellar TESTNET today.
// Mainnet is intentionally NOT enabled: it is gated behind security blockers (audit,
// trusted-setup ceremony, relayer, indexer, multisig) and feature flags that default
// to OFF. Nothing here should ever let the UI imply production safety for real assets.

export type StellarNetwork = "testnet" | "mainnet";

export interface NetworkContracts {
  pool: string;
  rpcUrl: string;
  networkPassphrase: string;
  explorer: string;
}

/** The network the app runs against — env-driven, defaults to testnet. */
const ENV_NETWORK: StellarNetwork =
  process.env.NEXT_PUBLIC_UMBRA_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const ACTIVE_NETWORK: StellarNetwork = ENV_NETWORK;

export const NETWORKS: Record<StellarNetwork, NetworkContracts | null> = {
  testnet: {
    pool: process.env.NEXT_PUBLIC_UMBRA_POOL_CONTRACT ?? "",
    rpcUrl: process.env.NEXT_PUBLIC_UMBRA_RPC_URL ?? "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    explorer: "https://stellar.expert/explorer/testnet",
  },
  // Populated only when the app is explicitly pointed at mainnet. Money paths stay gated
  // behind the canary flag + a hard per-deposit cap (below) and the honest, never-"safe"
  // labeling in MainnetGate — pointing at mainnet alone moves nothing.
  mainnet:
    ENV_NETWORK === "mainnet"
      ? {
          pool: process.env.NEXT_PUBLIC_UMBRA_POOL_CONTRACT ?? "",
          rpcUrl: process.env.NEXT_PUBLIC_UMBRA_RPC_URL ?? "",
          networkPassphrase: "Public Global Stellar Network ; September 2015",
          explorer: "https://stellar.expert/explorer/public",
        }
      : null,
};

// Hard per-deposit cap for the canary: XLM (env) → stroops. Default 0 (off). Set
// NEXT_PUBLIC_UMBRA_MAX_DEPOSIT_XLM only when arming the canary, and keep it small.
const CANARY_CAP_XLM = Number(process.env.NEXT_PUBLIC_UMBRA_MAX_DEPOSIT_XLM ?? "0");
const STROOPS_PER_XLM = 10_000_000n;

/** Feature flags — DEFAULT TO SAFE. Mainnet money paths are off unless explicitly armed. */
export const FLAGS = {
  // The experimental, self-reviewed capped canary. Env-armed; never implies "safe".
  ENABLE_MAINNET_CANARY: process.env.NEXT_PUBLIC_UMBRA_ENABLE_CANARY === "true",
  // The full production bar (all SECURITY_BLOCKERS cleared). Still aspirational.
  ENABLE_MAINNET_DEPOSITS: false,
  /** Hard per-deposit cap (stroops). 0 = no deposits. */
  MAX_MAINNET_DEPOSIT:
    Number.isFinite(CANARY_CAP_XLM) && CANARY_CAP_XLM > 0
      ? BigInt(Math.floor(CANARY_CAP_XLM)) * STROOPS_PER_XLM
      : 0n,
  REQUIRE_SECURITY_ACK: true,
} as const;

/**
 * The experimental, self-reviewed capped canary is active. This is deliberately NOT the
 * production safety bar (`isMainnetMoneySafe`) — it does not require the audit/ceremony
 * blockers, because the canary's whole point is small, capped, honest real-money exposure
 * AHEAD of those. The UI must always label it experimental and never "safe"/"audited".
 */
export function isCanaryActive(): boolean {
  return (
    ACTIVE_NETWORK === "mainnet" &&
    FLAGS.ENABLE_MAINNET_CANARY &&
    FLAGS.MAX_MAINNET_DEPOSIT > 0n
  );
}

/** Per-deposit cap in stroops (0 = deposits disabled). Only meaningful on mainnet. */
export function maxDepositStroops(): bigint {
  return ACTIVE_NETWORK === "mainnet" ? FLAGS.MAX_MAINNET_DEPOSIT : 0n;
}

/** Security blockers that MUST all be true before mainnet money paths may open. */
export const SECURITY_BLOCKERS = {
  independentAudit: false,
  trustedSetupCeremony: false,
  feePrivacyRelayer: false,
  productionIndexer: false,
  multisigDeployer: false,
} as const;

/** True only if every blocker is cleared AND mainnet deposits are explicitly enabled. */
export function isMainnetMoneySafe(): boolean {
  return Object.values(SECURITY_BLOCKERS).every(Boolean) && FLAGS.ENABLE_MAINNET_DEPOSITS;
}

export function activeContracts(): NetworkContracts | null {
  return NETWORKS[ACTIVE_NETWORK];
}

/* ── Readiness scorecard (what the /mainnet page renders) ── */

export type ReadinessStatus = "live" | "gated" | "required" | "roadmap";

export interface ReadinessItem {
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export const READINESS: ReadinessItem[] = [
  { label: "On-chain ZK verification", status: "live", detail: "Groth16/BLS12-381 verified inside a Soroban contract via CAP-0059 host functions." },
  { label: "Browser proving", status: "live", detail: "Proofs generated client-side (snarkjs, Web Worker). Secrets never leave the device." },
  { label: "Cross-device recovery", status: "live", detail: "Private balance rebuilt from on-chain events using a deterministic wallet-derived seed." },
  { label: "Selective disclosure", status: "live", detail: "Encrypted audit packets under a user-held viewing key. No backdoor." },
  { label: "Mainnet deployment", status: "gated", detail: "Not deployed. Gated behind the security blockers below; flags default to OFF." },
  { label: "Trusted setup", status: "required", detail: "Groth16 needs an MPC ceremony — or a migration to a transparent proof system (UltraHonk)." },
  { label: "Independent audit", status: "required", detail: "Contract, circuits, and the BLS verifier path must be audited before real assets." },
  { label: "Amount privacy", status: "roadmap", detail: "Today amounts are PUBLIC (link privacy, not confidential amounts). CT-compatible path." },
  { label: "Fee-privacy relayer", status: "roadmap", detail: "The fee payer is visible on-chain; a relayer removes that correlation." },
  { label: "Production indexer", status: "roadmap", detail: "Scalable note discovery from the deploy ledger onward." },
  { label: "Merkle depth 20", status: "required", detail: "Depth 8 (256 notes) today; depth 20 (~1M) needs a recompile + new ceremony." },
];

export const BEFORE_REAL_ASSETS: string[] = [
  "Independent security audit (contract + circuits + verifier path)",
  "MPC trusted-setup ceremony, or migration to a transparent proof system",
  "Deployer multisig + admin controls",
  "Relayer for fee-payer privacy",
  "Indexer for scalable note discovery",
  "Monitoring + incident response",
  "Terms, compliance, and disclosure story",
];
