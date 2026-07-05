// Browser wallet for the vertical slice: note storage + commitment tracking +
// witness-input construction, all delegated to @umbra/wallet-core (the same code the
// contract and fixtures use). Persisted to localStorage.
//
// Notes are derived deterministically from a per-wallet seed (see note-derivation.ts)
// so the balance can be recovered on any device by scanning the chain (recovery.ts).
// When a full on-chain leaf set has been synced, the Merkle tree is built from it (so
// withdrawal paths are correct even with other writers); otherwise it falls back to
// the wallet's own observed notes (the original single-writer behavior).
import {
  MerkleTree,
  buildShieldInput,
  buildTransferInput,
  buildWithdrawInput,
  commitment as noteCommitment,
  makeNote,
  recipientField,
  type Note,
  type ShieldInput,
  type TransferInput,
  type WithdrawInput,
} from "@umbra/wallet-core";
import { deriveNoteSecret } from "./note-derivation";

const STORAGE_KEY = "umbra.slice.notes.v1";

export interface WalletNote {
  secret: bigint;
  value: bigint;
  leafIndex: number | null;
  spent: boolean;
  /** Derivation nonce for deterministic notes (absent on legacy random notes). */
  nonce?: number;
}

interface PersistedNote {
  secret: string;
  value: string;
  leafIndex: number | null;
  spent: boolean;
  nonce?: number;
}

function read(): WalletNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as PersistedNote[]).map((n) => ({
      secret: BigInt(n.secret),
      value: BigInt(n.value),
      leafIndex: n.leafIndex,
      spent: n.spent,
      nonce: n.nonce,
    }));
  } catch {
    return [];
  }
}

function write(notes: WalletNote[]): void {
  if (typeof window === "undefined") return;
  const data: PersistedNote[] = notes.map((n) => ({
    secret: n.secret.toString(),
    value: n.value.toString(),
    leafIndex: n.leafIndex,
    spent: n.spent,
    nonce: n.nonce,
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Tiny external store so React components can subscribe via useSyncExternalStore. */
class WalletStore {
  private notes: WalletNote[] = read();
  private listeners = new Set<() => void>();
  private seed: bigint | null = null;
  /** Full on-chain leaf set (by index) once synced; empty = use local fallback. */
  private allLeaves: bigint[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) {
          this.notes = read();
          this.listeners.forEach((l) => l());
        }
      });
    }
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): WalletNote[] => this.notes;

  private commit(): void {
    write(this.notes);
    this.notes = [...this.notes];
    this.listeners.forEach((l) => l());
  }

  /** Install the per-wallet seed so new notes are deterministic (recoverable). */
  setSeed(seed: bigint): void {
    this.seed = seed;
  }

  hasSeed(): boolean {
    return this.seed !== null;
  }

  /** The per-wallet seed (for deriving the note-encryption key). Null until a wallet connects. */
  getSeed(): bigint | null {
    return this.seed;
  }

  /**
   * Pick a derivation nonce whose (secret, value) commitment is not already present — among our
   * own notes OR the full on-chain leaf set. A naive max(nonce)+1 counter breaks after a sync:
   * recovered notes carry no nonce, so it resets to 0 and re-derives secrets that already exist,
   * minting duplicate commitments the wallet can't tell apart. Choosing the first collision-free
   * nonce keeps every commitment unique and still re-derivable by recovery (it scans 0..N).
   */
  private freshNonce(value: bigint): number {
    const taken = new Set(this.notes.map((n) => noteCommitment(toNote(n)).toString()));
    for (const l of this.allLeaves) taken.add(l.toString());
    for (let n = 0; n < 4096; n++) {
      if (!taken.has(noteCommitment({ secret: deriveNoteSecret(this.seed!, n), value }).toString())) return n;
    }
    const used = this.notes.map((n) => n.nonce).filter((x): x is number => typeof x === "number");
    return used.length ? Math.max(...used) + 1 : 0;
  }

  /** Create a note for `value` and return its commitment (the value to shield under). */
  createNote(value: bigint): { note: WalletNote; commitment: bigint } {
    let secret: bigint;
    let nonce: number | undefined;
    if (this.seed !== null) {
      nonce = this.freshNonce(value);
      secret = deriveNoteSecret(this.seed, nonce);
    } else {
      secret = makeNote(value).secret;
    }
    const note: WalletNote = { secret, value, leafIndex: null, spent: false, nonce };
    this.notes.push(note);
    this.commit();
    return { note, commitment: noteCommitment({ secret, value }) };
  }

  /** Record the on-chain leaf index after a successful shield (DepositCreated). */
  observe(commitment: bigint, leafIndex: number): void {
    const note = this.notes.find((n) => noteCommitment(toNote(n)) === commitment && n.leafIndex === null);
    if (note) note.leafIndex = leafIndex;
    // Keep a synced full tree in step with the new on-chain leaf (sole-writer append).
    if (this.allLeaves.length > 0 && leafIndex === this.allLeaves.length) {
      this.allLeaves = [...this.allLeaves, commitment];
    }
    this.commit();
  }

  markSpent(commitment: bigint): void {
    // Mark the first UNSPENT match, so duplicate-commitment notes are retired one spend at a time
    // (and in step with whichever note withdraw/transfer actually spent).
    const note = this.notes.find((n) => noteCommitment(toNote(n)) === commitment && !n.spent);
    if (note) {
      note.spent = true;
      this.commit();
    }
  }

  spendable(): WalletNote[] {
    return this.notes.filter((n) => !n.spent && n.leafIndex !== null);
  }

  /**
   * Replace local state with what was discovered on-chain: the full leaf set (for
   * correct paths) and the wallet's recovered notes. Legacy confirmed notes that still
   * exist on-chain are preserved (e.g. pre-deterministic random-secret notes).
   */
  loadChainState(allLeaves: bigint[], owned: WalletNote[]): void {
    this.allLeaves = allLeaves;
    const leafSet = new Set(allLeaves.map((l) => l.toString()));
    // Key by on-chain LEAF INDEX, never by commitment. Duplicate note secrets (from a reset nonce
    // counter) make several distinct notes — different leaves, each independently spendable via a
    // leaf-bound nullifier — share one commitment. Keying by commitment collapses them and hides
    // real, spendable balance. Leaf index is unique per note, so it never loses one.
    const byLeaf = new Map<number, WalletNote>();
    for (const n of this.notes) {
      if (n.leafIndex === null) continue;
      const cm = noteCommitment(toNote(n)).toString();
      if (leafSet.has(cm)) byLeaf.set(n.leafIndex, n);
    }
    for (const n of owned) {
      if (n.leafIndex === null) continue;
      byLeaf.set(n.leafIndex, n);
    }
    this.notes = [...byLeaf.values()];
    this.commit();
  }

  /** Merkle tree: from the full synced leaf set when available, else observed notes. */
  private tree(): MerkleTree {
    const tree = new MerkleTree();
    if (this.allLeaves.length > 0) {
      for (const leaf of this.allLeaves) tree.insert(leaf);
      return tree;
    }
    const observed = [...this.notes]
      .filter((n) => n.leafIndex !== null)
      .sort((a, b) => a.leafIndex! - b.leafIndex!);
    for (const n of observed) tree.insert(noteCommitment(toNote(n)));
    return tree;
  }

  shieldInput(commitment: bigint): ShieldInput | null {
    const note = this.notes.find((n) => noteCommitment(toNote(n)) === commitment);
    return note ? buildShieldInput(toNote(note)) : null;
  }

  /**
   * Build the witness for a withdrawal with private change: spend the note under `commitment`,
   * pay a PUBLIC `amount` out to `recipientId`, and keep the remainder as `change` (a fresh
   * seed-derived note). 1-in/1-public-out/1-change; conservation (amount + change == value) is
   * enforced. Only `amount` is public on-chain; the change value is hidden.
   */
  withdrawInput(
    commitment: bigint,
    recipientId: bigint,
    amount: bigint,
    change: { secret: bigint; value: bigint },
  ): WithdrawInput | null {
    // Prefer an UNSPENT note: several notes can share a commitment, and spending an already-spent
    // duplicate would revert on-chain (NullifierAlreadySpent).
    const note = this.notes.find((n) => noteCommitment(toNote(n)) === commitment && !n.spent && n.leafIndex !== null);
    if (!note || note.leafIndex === null) return null;
    return buildWithdrawInput(toNote(note), this.tree(), recipientField(recipientId), amount, {
      secret: change.secret,
      value: change.value,
    });
  }

  /**
   * Build the witness for a confidential "private send": spend the note under
   * `inCommitment` and split its (hidden) value across two outputs — `out1` (the recipient's
   * fresh note) and `out2` (the sender's change). 1-in/2-out; conservation is enforced.
   */
  transferInput(
    inCommitment: bigint,
    out1: { secret: bigint; value: bigint },
    out2: { secret: bigint; value: bigint },
  ): TransferInput | null {
    // Prefer an UNSPENT note: duplicate commitments must not spend an already-spent leaf.
    const note = this.notes.find((n) => noteCommitment(toNote(n)) === inCommitment && !n.spent && n.leafIndex !== null);
    if (!note || note.leafIndex === null) return null;
    return buildTransferInput(
      toNote(note),
      this.tree(),
      { secret: out1.secret, value: out1.value },
      { secret: out2.secret, value: out2.value },
    );
  }

  /** A fresh random note secret — used for the recipient's output note in a private send. */
  freshSecret(value: bigint): bigint {
    return makeNote(value).secret;
  }

  /**
   * Import a note received via a private-send claim (secret + value + on-chain leaf
   * index). After a chain sync the note is spendable. Idempotent.
   */
  importNote(secret: bigint, value: bigint, leafIndex: number): boolean {
    if (this.notes.some((n) => n.secret === secret && n.value === value)) return false;
    this.notes.push({ secret, value, leafIndex, spent: false, nonce: undefined });
    this.commit();
    return true;
  }
}

function toNote(n: WalletNote): Note {
  return { secret: n.secret, value: n.value, leafIndex: n.leafIndex ?? undefined, spent: n.spent };
}

export const walletStore = new WalletStore();
export { noteCommitment };
