"use client";

import { useCallback, useState } from "react";

/**
 * Copy a string to the clipboard and expose a transient `copied` flag.
 *
 * Supports the design-system rule that monospaced crypto data (addresses,
 * hashes, proofs, balances) must always offer a copy action. Pure UI utility —
 * no crypto, no network.
 */
export function useCopyToClipboard(resetDelayMs = 2000): {
  copied: boolean;
  copy: (value: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (value: string): Promise<boolean> => {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), resetDelayMs);
        return true;
      } catch {
        setCopied(false);
        return false;
      }
    },
    [resetDelayMs],
  );

  return { copied, copy };
}
