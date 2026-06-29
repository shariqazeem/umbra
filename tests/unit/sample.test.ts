import { describe, expect, it } from "vitest";

import { PRODUCT } from "@/lib/constants";
import { cn } from "@/lib/utils";

describe("umbra/foundation", () => {
  it("merges and de-duplicates conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-foreground", false, undefined, "uppercase")).toBe("text-foreground uppercase");
  });

  it("exposes the product thesis verbatim", () => {
    expect(PRODUCT.thesis).toBe("Consumer privacy layer for Stellar commerce");
    expect(PRODUCT.wordmark).toBe("UMBRA");
    expect(PRODUCT.tagline).toBe("Private Finance for Stellar");
  });
});
