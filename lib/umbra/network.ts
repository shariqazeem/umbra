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

/** The network the app is currently running against. */
export const ACTIVE_NETWORK: StellarNetwork = "testnet";

export const NETWORKS: Record<StellarNetwork, NetworkContracts | null> = {
  testnet: {
    pool: process.env.NEXT_PUBLIC_UMBRA_POOL_CONTRACT ?? "",
    rpcUrl: process.env.NEXT_PUBLIC_UMBRA_RPC_URL ?? "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    explorer: "https://stellar.expert/explorer/testnet",
  },
  // Not deployed. Mainnet stays null until the readiness checklist is complete.
  mainnet: null,
};

/** Feature flags — DEFAULT TO SAFE. Mainnet money paths are off. */
export const FLAGS = {
  ENABLE_MAINNET_CANARY: false,
  ENABLE_MAINNET_DEPOSITS: false,
  /** Hard cap (stroops) if a capped canary is ever enabled. 0 = no deposits. */
  MAX_MAINNET_DEPOSIT: 0n,
  REQUIRE_SECURITY_ACK: true,
} as const;

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
