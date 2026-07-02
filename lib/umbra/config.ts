// Slice configuration. Set these (NEXT_PUBLIC_*) to point the UI at a deployed
// UmbraPool on testnet. Without them, the UI still does all local crypto (wallet,
// commitment, witness, proof) — only on-chain submission needs them.
export const UMBRA_CONFIG = {
  rpcUrl: process.env.NEXT_PUBLIC_UMBRA_RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    process.env.NEXT_PUBLIC_UMBRA_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  poolContractId: process.env.NEXT_PUBLIC_UMBRA_POOL_CONTRACT ?? "",
  // Circuit artifacts served statically (copy from circuits/build to public/circuits).
  withdrawWasmUrl: "/circuits/withdraw_js/withdraw.wasm",
  withdrawZkeyUrl: "/circuits/withdraw_final.zkey",
  shieldWasmUrl: "/circuits/shield_js/shield.wasm",
  shieldZkeyUrl: "/circuits/shield_final.zkey",
  transferWasmUrl: "/circuits/transfer_js/transfer.wasm",
  transferZkeyUrl: "/circuits/transfer_final.zkey",
  claimWasmUrl: "/circuits/claim_js/claim.wasm",
  claimZkeyUrl: "/circuits/claim_final.zkey",
  // Proving mode. "live" (default): real in-browser Groth16 proving in a Worker.
  // "pregen" (Path A): replay a pre-generated proof for video recording. Live
  // proving is never removed — pregen only activates when set AND a demo proof
  // (/circuits/<variant>_demo_proof.json) is present.
  proofMode: (process.env.NEXT_PUBLIC_UMBRA_PROOF_MODE === "pregen" ? "pregen" : "live") as
    | "live"
    | "pregen",
} as const;

export function isChainConfigured(): boolean {
  return UMBRA_CONFIG.poolContractId.length > 0;
}
