import { poseidon2, randomFr, FR_ORDER } from "@umbra/crypto-bls";

/**
 * Minimal note model for the vertical slice. A note is Tornado-style:
 *   commitment = Poseidon(secret, value)
 *   nullifier  = Poseidon(secret, leafIndex)
 * Ownership = knowledge of `secret`. Single asset, full-note withdrawal (no change).
 */
export interface Note {
  secret: bigint;
  value: bigint;
  /** Assigned once the note is observed in the tree (DepositCreated). */
  leafIndex?: number;
  /** Set once the note has been withdrawn. */
  spent?: boolean;
}

/** A wallet is just a spending secret for the slice (deterministic notes derive from it + nonce). */
export interface Wallet {
  secret: bigint;
}

export function createWallet(): Wallet {
  return { secret: randomFr() };
}

/** Build a fresh note for `value`, with an independent per-note secret. */
export function makeNote(value: bigint): Note {
  return { secret: randomFr(), value };
}

export function commitment(note: Note): bigint {
  return poseidon2(note.secret, note.value);
}

export function nullifier(note: Note, leafIndex: number): bigint {
  return poseidon2(note.secret, BigInt(leafIndex));
}

/** A recipient identity bound into the withdraw proof. Must be a field element < r. */
export function recipientField(value: bigint): bigint {
  const v = value % FR_ORDER;
  return v < 0n ? v + FR_ORDER : v;
}

/** In-memory note store (commitment tracking) — the slice's local state. */
export class NoteStore {
  private readonly notes = new Map<string, Note>();

  add(note: Note): void {
    this.notes.set(commitment(note).toString(), note);
  }

  /** Record the on-chain leaf index for a commitment (from DepositCreated). */
  observe(commitmentHex: bigint, leafIndex: number): void {
    const n = this.notes.get(commitmentHex.toString());
    if (n) n.leafIndex = leafIndex;
  }

  markSpent(note: Note): void {
    const n = this.notes.get(commitment(note).toString());
    if (n) n.spent = true;
  }

  spendable(): Note[] {
    return [...this.notes.values()].filter((n) => !n.spent && n.leafIndex !== undefined);
  }

  all(): Note[] {
    return [...this.notes.values()];
  }
}
