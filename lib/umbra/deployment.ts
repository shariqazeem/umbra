import mainnet from "@/infra/deploy/deployment.mainnet.json";
import testnet from "@/infra/deploy/deployment.json";
import { ACTIVE_NETWORK } from "./network";

// The "proof" surfaces (proof page, withdraw reveal) display the deployment that matches the
// ACTIVE network, so a mainnet build shows the mainnet pool/tx ids — not testnet ones. Both
// records share the fields these components read (contractIds, deployTx, explorerBase, …).
export const activeDeployment = (ACTIVE_NETWORK === "mainnet"
  ? mainnet
  : testnet) as unknown as typeof testnet;
