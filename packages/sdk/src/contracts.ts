// Deployed Umbra pool contracts. The on-chain Groth16 verifier + Poseidon Merkle
// pool your app shields into and withdraws from.

export type UmbraNetwork = "testnet";

export interface UmbraDeployment {
  /** UmbraPool contract id (C…). */
  pool: string;
  networkPassphrase: string;
  rpcUrl: string;
  explorer: string;
}

export const UMBRA_CONTRACTS: Record<UmbraNetwork, UmbraDeployment> = {
  testnet: {
    pool: "CBGB5DAYD7RYIHDK2T6DE364VD3RJZGG5AUEQETW6LO3ZI4A5L3LSDV7",
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    explorer: "https://stellar.expert/explorer/testnet",
  },
};
