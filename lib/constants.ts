/**
 * Static product metadata. No runtime/crypto/network logic lives here — this is
 * Phase 0.1 scaffolding only.
 */

export const PRODUCT = {
  name: "Umbra",
  wordmark: "UMBRA",
  tagline: "Private Finance for Stellar",
  thesis: "Consumer privacy layer for Stellar commerce",
} as const;

export interface ProductSection {
  /** Two-digit ordinal shown in the monospaced index. */
  index: string;
  /** Section identifier (also used as the anchor id). */
  id: "shield" | "transfer" | "invoice" | "donation";
  title: string;
  description: string;
  /**
   * Whether this surface performs a cryptographic action. Drives the reserved
   * use of the #FF3B00 signal color, per the design system.
   */
  cryptographic: boolean;
}

export const SECTIONS: readonly ProductSection[] = [
  {
    index: "01",
    id: "shield",
    title: "Shield",
    description:
      "One-click shielding. Move public balances into a private position with a single confirmation.",
    cryptographic: true,
  },
  {
    index: "02",
    id: "transfer",
    title: "Transfer",
    description:
      "Private transfers between accounts. Amounts and counterparties stay off the public ledger.",
    cryptographic: true,
  },
  {
    index: "03",
    id: "invoice",
    title: "Invoice",
    description:
      "Private invoices. Request payment without exposing your balances or transaction history.",
    cryptographic: false,
  },
  {
    index: "04",
    id: "donation",
    title: "Donation",
    description:
      "Private donation links. Accept contributions through a shareable link with sender privacy.",
    cryptographic: false,
  },
] as const;
