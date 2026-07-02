import { poseidon2 } from "@umbra/crypto-bls";

/**
 * Append-only Poseidon Merkle tree (depth 20), mirroring the on-chain incremental
 * tree in `contracts/umbra-pool`. Both hash with the SAME Poseidon constants, so a
 * root computed here equals the root the contract computes on insert, and a path
 * produced here verifies in the withdraw circuit. For the slice this keeps the full
 * leaf list in memory and recomputes — correct and simple for demo volumes.
 */
// Slice depth = 8 (256 leaves), matching the contract + circuit. See the note in
// @umbra/crypto-bls gen-rust-constants.ts on why the slice uses a shallow tree.
export const DEPTH = 13;

/** Zero-subtree hashes: Z[0]=0, Z[i]=Poseidon(Z[i-1], Z[i-1]). */
export function zeroHashes(depth = DEPTH): bigint[] {
  const z: bigint[] = [0n];
  for (let i = 1; i <= depth; i++) z.push(poseidon2(z[i - 1]!, z[i - 1]!));
  return z;
}

export interface MerklePath {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
  leafIndex: number;
}

export class MerkleTree {
  readonly depth: number;
  readonly zeros: bigint[];
  private readonly leaves: bigint[] = [];

  constructor(depth = DEPTH) {
    this.depth = depth;
    this.zeros = zeroHashes(depth);
  }

  /** Insert a leaf; returns its index. */
  insert(leaf: bigint): number {
    this.leaves.push(leaf);
    return this.leaves.length - 1;
  }

  get size(): number {
    return this.leaves.length;
  }

  /** Current root (empty tree → the depth-level zero hash). */
  root(): bigint {
    return this.path(0).root;
  }

  /** Authentication path + root for the leaf at `index`. */
  path(index: number): MerklePath {
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let nodes = this.leaves.slice();
    let idx = index;

    for (let d = 0; d < this.depth; d++) {
      const sibling = idx ^ 1;
      pathElements.push(nodes[sibling] ?? this.zeros[d]!);
      pathIndices.push(idx & 1);

      const next: bigint[] = [];
      const count = Math.max(nodes.length, 2);
      for (let i = 0; i < count; i += 2) {
        const left = nodes[i] ?? this.zeros[d]!;
        const right = nodes[i + 1] ?? this.zeros[d]!;
        next.push(poseidon2(left, right));
      }
      nodes = next;
      idx >>= 1;
    }

    return { pathElements, pathIndices, root: nodes[0] ?? this.zeros[this.depth]!, leafIndex: index };
  }
}
