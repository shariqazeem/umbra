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
