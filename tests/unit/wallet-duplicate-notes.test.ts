// @vitest-environment jsdom
// Regression for the "vanishing balance" bug: after a chain-sync the nonce counter reset to 0, so
// repeated shields of the same amount re-derived the SAME secret. commitment = Poseidon(secret,
// value) has no leaf index, so those notes share one commitment — but nullifier = Poseidon(secret,
// leafIndex) binds the leaf, so on-chain each is a distinct, independently spendable note. The
// wallet must (1) keep every such note (not collapse them by commitment) and (2) stop minting new
// duplicates.
import { beforeEach, describe, expect, it } from "vitest";
import { walletStore, noteCommitment } from "@/lib/umbra/wallet";
import { deriveNoteSecret } from "@/lib/umbra/note-derivation";

const seed = 987654321987654321n;

function ownedNote(value: bigint, leafIndex: number, spent = false) {
  // Same secret (nonce 0) on purpose — this is exactly the duplicate the bug produced.
  return { secret: deriveNoteSecret(seed, 0), value, leafIndex, spent, nonce: undefined };
}

beforeEach(() => {
  window.localStorage.clear();
  walletStore.loadChainState([], []); // reset in-memory notes
  walletStore.setSeed(seed);
});

describe("duplicate-commitment notes", () => {
  it("keeps every note sharing a commitment, so balance is the full sum", () => {
    const value = 5n;
    const cm = noteCommitment({ secret: deriveNoteSecret(seed, 0), value });
    const leaves = [0n, 0n, 0n, cm, 0n, 0n, 0n, 0n, 0n, cm]; // indices 3 and 9 both = cm
    walletStore.loadChainState(leaves, [ownedNote(value, 3), ownedNote(value, 9)]);

    const spendable = walletStore.getSnapshot().filter((n) => !n.spent && n.leafIndex !== null);
    expect(spendable.length).toBe(2); // before the fix: 1 (collapsed by commitment)
    expect(spendable.reduce((s, n) => s + n.value, 0n)).toBe(10n);
  });

  it("spent status is tracked per leaf, not shared across the duplicates", () => {
    const value = 5n;
    const cm = noteCommitment({ secret: deriveNoteSecret(seed, 0), value });
    walletStore.loadChainState([0n, 0n, 0n, cm, 0n, 0n, 0n, 0n, 0n, cm], [
      ownedNote(value, 3, true), // leaf 3 spent
      ownedNote(value, 9, false), // leaf 9 still live
    ]);
    const live = walletStore.getSnapshot().filter((n) => !n.spent && n.leafIndex !== null);
    expect(live.length).toBe(1);
    expect(live[0].leafIndex).toBe(9);
  });

  it("does not re-mint an existing commitment when shielding the same amount again", () => {
    const value = 5n;
    const cm0 = noteCommitment({ secret: deriveNoteSecret(seed, 0), value });
    walletStore.loadChainState([cm0], []); // a nonce-0 note already lives on-chain; no local nonce
    const { commitment, note } = walletStore.createNote(value);
    expect(commitment).not.toBe(cm0); // fresh, collision-free
    expect(note.nonce).toBe(1);
  });
});
