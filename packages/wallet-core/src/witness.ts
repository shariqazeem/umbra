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

/** Withdraw (join-split, 1-in / 1-public-out / 1-change). `amount` is public; change is hidden. */
export interface WithdrawInput {
  root: string;
  nullifier: string;
  recipient: string;
  amount: string;
  changeCommitment: string;
  /** 1 = keep change (insert a change note); 0 = full exit (no insert — works at a full tree). */
  has_change: string;
  secret: string;
  value: string;
  pathElements: string[];
  pathIndices: string[];
  changeSecret: string;
  changeValue: string;
}

/**
 * Build the witness for a shielded→public withdrawal with private change: spend `note`, pay a
 * PUBLIC `amount` out to a bound `recipient`, and keep the remainder as `changeNote`. Enforces
 * value conservation off-chain too (amount + change == value) so a non-conserving call fails
 * fast rather than producing an unsatisfiable witness.
 */
export function buildWithdrawInput(
  note: Note,
  tree: MerkleTree,
  recipient: bigint,
  amount: bigint,
  changeNote: Note,
): WithdrawInput {
  if (note.leafIndex === undefined) throw new Error("note has no leafIndex (not observed in tree)");
  if (amount + changeNote.value !== note.value) {
    throw new Error("withdraw is not value-conserving (amount + change must equal the input note value)");
  }
  const p = tree.path(note.leafIndex);
  return {
    root: p.root.toString(),
    nullifier: nullifier(note, note.leafIndex).toString(),
    recipient: recipient.toString(),
    amount: amount.toString(),
    changeCommitment: commitment(changeNote).toString(),
    // A full exit (no change) needs no on-chain insert, so it works even when the tree is full.
    has_change: changeNote.value > 0n ? "1" : "0",
    secret: note.secret.toString(),
    value: note.value.toString(),
    pathElements: p.pathElements.map((x) => x.toString()),
    pathIndices: p.pathIndices.map((x) => x.toString()),
    changeSecret: changeNote.secret.toString(),
    changeValue: changeNote.value.toString(),
  };
}

/** Confidential transfer (join-split, 1-in / 2-out). Amounts are PRIVATE witnesses. */
export interface TransferInput {
  root: string;
  nullifier: string;
  outCommitment1: string;
  outCommitment2: string;
  secret: string;
  value: string;
  pathElements: string[];
  pathIndices: string[];
  outSecret1: string;
  outValue1: string;
  outSecret2: string;
  outValue2: string;
}

/**
 * Build the witness for a shielded→shielded confidential transfer: spend `inNote` and split
 * its value across two output notes (`out1` = recipient, `out2` = change), amounts hidden.
 * Enforces value conservation off-chain too, so a non-conserving call fails fast rather than
 * producing an unsatisfiable witness.
 */
export function buildTransferInput(
  inNote: Note,
  tree: MerkleTree,
  out1: Note,
  out2: Note,
): TransferInput {
  if (inNote.leafIndex === undefined) throw new Error("input note has no leafIndex (not observed in tree)");
  if (out1.value + out2.value !== inNote.value) {
    throw new Error("transfer is not value-conserving (out1 + out2 must equal the input note value)");
  }
  const p = tree.path(inNote.leafIndex);
  return {
    root: p.root.toString(),
    nullifier: nullifier(inNote, inNote.leafIndex).toString(),
    outCommitment1: commitment(out1).toString(),
    outCommitment2: commitment(out2).toString(),
    secret: inNote.secret.toString(),
    value: inNote.value.toString(),
    pathElements: p.pathElements.map((x) => x.toString()),
    pathIndices: p.pathIndices.map((x) => x.toString()),
    outSecret1: out1.secret.toString(),
    outValue1: out1.value.toString(),
    outSecret2: out2.secret.toString(),
    outValue2: out2.value.toString(),
  };
}

/** Claim (opening proof, value private). Proves you hold a valid opening of `commitment`. */
export interface ClaimInput {
  commitment: string;
  secret: string;
  value: string;
}

/**
 * Build the witness for a register-on-claim: prove knowledge of a note's opening (secret,
 * value) for its `commitment`, WITHOUT revealing the value. The contract inserts the commitment
 * once it verifies this + that the commitment is a pending transfer output.
 */
export function buildClaimInput(note: Note): ClaimInput {
  return {
    commitment: commitment(note).toString(),
    secret: note.secret.toString(),
    value: note.value.toString(),
  };
}
