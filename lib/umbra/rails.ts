// PrivacyRail — the architecture seam that lets Umbra's product (wallet UX, payment
// links, selective disclosure, cross-device recovery) sit on top of different privacy
// PRIMITIVES. Today: our Groth16 pool (link privacy). Future: Stellar Confidential
// Tokens (confidential amounts). See docs/CONFIDENTIAL_TOKENS_STRATEGY.md.
//
// This is a real, typed interface. Groth16PoolRail's metadata + recovery + disclosure
// are wired to the live code; its shield/send are UI-driven today (browser proving runs
// in a Web Worker via useProver), so they point back to the wallet flow rather than
// faking a headless path. ConfidentialTokenRail is an explicit PREVIEW stub.

import type { Signer } from "./signer";
import { deriveSeed } from "./note-derivation";
import { recoverFromChain } from "./recovery";
import { auditStore } from "./audit-store";
import type { AuditPacket } from "./viewing-key";

export type RailId = "groth16-pool" | "confidential-token";

export interface ProofStatus {
  system: string;
  trustedSetup: boolean;
  verifiedOnChain: boolean;
}

export interface PublicVisibility {
  /** Are transfer/deposit amounts visible on-chain? */
  amountsVisible: boolean;
  /** Is the deposit↔withdrawal link hidden? */
  linkageHidden: boolean;
  recipientVisible: boolean;
  summary: string;
}

export interface ShieldArgs {
  amount: bigint;
  signer: Signer;
}
export interface SendArgs {
  amount: bigint;
  to: string;
  signer: Signer;
}

export interface PrivacyRail {
  readonly id: RailId;
  readonly name: string;
  readonly status: "live" | "preview";
  getProofStatus(): ProofStatus;
  getPublicVisibility(): PublicVisibility;
  shield(args: ShieldArgs): Promise<{ txHash: string | null }>;
  privateSend(args: SendArgs): Promise<{ txHash: string | null }>;
  recover(signer: Signer): Promise<{ balance: bigint }>;
  disclose(): Promise<AuditPacket>;
}

const UI_DRIVEN =
  "Driven by the Umbra wallet today: the proof is generated in a Web Worker via useProver. The rail interface formalizes the seam — see docs/CONFIDENTIAL_TOKENS_STRATEGY.md.";

/** The live rail: Umbra's Groth16/BLS12-381 pool. Link privacy, public amounts. */
export class Groth16PoolRail implements PrivacyRail {
  readonly id = "groth16-pool" as const;
  readonly name = "Umbra pool · Groth16 / BLS12-381";
  readonly status = "live" as const;

  getProofStatus(): ProofStatus {
    return { system: "Groth16 / BLS12-381", trustedSetup: true, verifiedOnChain: true };
  }

  getPublicVisibility(): PublicVisibility {
    return {
      amountsVisible: true,
      linkageHidden: true,
      recipientVisible: true,
      summary: "Link privacy: amounts and recipient are public; the deposit↔withdrawal link is hidden.",
    };
  }

  async shield(_args: ShieldArgs): Promise<{ txHash: string | null }> {
    throw new Error(UI_DRIVEN);
  }

  async privateSend(_args: SendArgs): Promise<{ txHash: string | null }> {
    throw new Error(UI_DRIVEN);
  }

  /** Real: re-derive the wallet seed and rebuild the spendable balance from chain. */
  async recover(signer: Signer): Promise<{ balance: bigint }> {
    const seed = await deriveSeed(signer);
    const { owned } = await recoverFromChain(seed);
    const balance = owned.filter((n) => !n.spent).reduce((sum, n) => sum + n.value, 0n);
    return { balance };
  }

  /** Real: export the encrypted audit packet (selective disclosure). */
  async disclose(): Promise<AuditPacket> {
    return auditStore.exportPacket();
  }
}

/** PREVIEW stub: Stellar Confidential Tokens (UltraHonk / SEP-41). Not implemented. */
export class ConfidentialTokenRail implements PrivacyRail {
  readonly id = "confidential-token" as const;
  readonly name = "Stellar Confidential Tokens · UltraHonk / SEP-41";
  readonly status = "preview" as const;

  private static readonly PREVIEW =
    "Confidential Tokens rail is roadmap/preview — not implemented in Umbra. See docs/CONFIDENTIAL_TOKENS_STRATEGY.md.";

  getProofStatus(): ProofStatus {
    // UltraHonk is a transparent proof system — no per-circuit trusted setup.
    return { system: "UltraHonk (Noir)", trustedSetup: false, verifiedOnChain: true };
  }

  getPublicVisibility(): PublicVisibility {
    return {
      amountsVisible: false,
      linkageHidden: false,
      recipientVisible: true,
      summary: "Confidential amounts: balances and transfer amounts are hidden; addresses remain visible.",
    };
  }

  async shield(): Promise<{ txHash: string | null }> {
    throw new Error(ConfidentialTokenRail.PREVIEW);
  }
  async privateSend(): Promise<{ txHash: string | null }> {
    throw new Error(ConfidentialTokenRail.PREVIEW);
  }
  async recover(): Promise<{ balance: bigint }> {
    throw new Error(ConfidentialTokenRail.PREVIEW);
  }
  async disclose(): Promise<AuditPacket> {
    throw new Error(ConfidentialTokenRail.PREVIEW);
  }
}

export const RAILS: Record<RailId, PrivacyRail> = {
  "groth16-pool": new Groth16PoolRail(),
  "confidential-token": new ConfidentialTokenRail(),
};
