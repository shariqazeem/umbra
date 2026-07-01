import { commitment, nullifier, type Note } from "./wallet.js";
import type { MerkleTree } from "./tree.js";

/** Circom inputs are decimal strings. */
export interface ShieldInput {
  commitment: string;
  amount: string;
  secret: string;
}

export function buildShieldInput(note: Note): ShieldInput {
  return {
    commitment: commitment(note).toString(),
    amount: note.value.toString(),
    secret: note.secret.toString(),
  };
}

export interface WithdrawInput {
  root: string;
  nullifier: string;
  recipient: string;
  amount: string;
  secret: string;
  value: string;
  pathElements: string[];
  pathIndices: string[];
}

export function buildWithdrawInput(note: Note, tree: MerkleTree, recipient: bigint): WithdrawInput {
  if (note.leafIndex === undefined) throw new Error("note has no leafIndex (not observed in tree)");
  const p = tree.path(note.leafIndex);
  return {
    root: p.root.toString(),
    nullifier: nullifier(note, note.leafIndex).toString(),
    recipient: recipient.toString(),
    amount: note.value.toString(),
    secret: note.secret.toString(),
    value: note.value.toString(),
    pathElements: p.pathElements.map((x) => x.toString()),
    pathIndices: p.pathIndices.map((x) => x.toString()),
  };
}

/** Confidential transfer ("private send", 1-in / 1-out). The amount is a PRIVATE witness. */
export interface TransferInput {
  root: string;
  nullifier: string;
  outCommitment: string;
  secret: string;
  value: string;
  pathElements: string[];
  pathIndices: string[];
  outSecret: string;
}

/**
 * Build the witness for a shielded→shielded confidential transfer (whole note): spend
 * `inNote` and re-note its full value to `out` (the recipient's note). The value is never
 * revealed. `out` must carry the same value as `inNote` (a 1-in/1-out send preserves it).
 */
export function buildTransferInput(inNote: Note, tree: MerkleTree, out: Note): TransferInput {
  if (inNote.leafIndex === undefined) throw new Error("input note has no leafIndex (not observed in tree)");
  if (out.value !== inNote.value) {
    throw new Error("1-in/1-out transfer must preserve the value (out.value must equal the input note value)");
  }
  const p = tree.path(inNote.leafIndex);
  return {
    root: p.root.toString(),
    nullifier: nullifier(inNote, inNote.leafIndex).toString(),
    outCommitment: commitment(out).toString(),
    secret: inNote.secret.toString(),
    value: inNote.value.toString(),
    pathElements: p.pathElements.map((x) => x.toString()),
    pathIndices: p.pathIndices.map((x) => x.toString()),
    outSecret: out.secret.toString(),
  };
}
