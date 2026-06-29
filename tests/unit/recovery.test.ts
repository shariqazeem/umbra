// @vitest-environment node
// Recovery safety: deterministic note derivation must be stable for one wallet and
// must NEVER reproduce another wallet's note (so a scan can't claim others' notes).
import { describe, expect, it } from "vitest";
import { commitment as noteCommitment } from "@umbra/wallet-core";
import { deriveNoteSecret } from "@/lib/umbra/note-derivation";

const seedA = 111111111111111111n;
const seedB = 222222222222222222n;

describe("deterministic recovery", () => {
  it("derives the same secret for the same seed + nonce", () => {
    expect(deriveNoteSecret(seedA, 0)).toBe(deriveNoteSecret(seedA, 0));
    expect(deriveNoteSecret(seedA, 7)).toBe(deriveNoteSecret(seedA, 7));
  });

  it("derives distinct secrets across nonces and across seeds", () => {
    expect(deriveNoteSecret(seedA, 0)).not.toBe(deriveNoteSecret(seedA, 1));
    expect(deriveNoteSecret(seedA, 0)).not.toBe(deriveNoteSecret(seedB, 0));
  });

  it("does NOT mark another wallet's note as owned", () => {
    const amount = 100n;
    // Wallet B's note commitment (their seed, their secret).
    const theirCommitment = noteCommitment({ secret: deriveNoteSecret(seedB, 0), value: amount });
    // Wallet A scans 64 of ITS OWN nonces — it must never reproduce B's commitment.
    for (let n = 0; n < 64; n++) {
      const mine = noteCommitment({ secret: deriveNoteSecret(seedA, n), value: amount });
      expect(mine).not.toBe(theirCommitment);
    }
  });
});
