// bench_membership — a depth-20 Poseidon Merkle inclusion proof. This is the
// realistic shape of the Umbra `withdraw` membership check (FEASIBILITY_REVIEW.md §4)
// and gives B03 a representative proving-latency number (≈20 Poseidon hashes) rather
// than the trivial floor that bench_hash measures.
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";

// One Merkle level: hash (cur, sibling) in the order selected by isRight ∈ {0,1}.
template MerkleLevel() {
    signal input cur;
    signal input sibling;
    signal input isRight;
    signal output out;

    isRight * (isRight - 1) === 0; // boolean constraint

    signal left;
    signal right;
    left <== cur + isRight * (sibling - cur);   // isRight=0 → cur ; isRight=1 → sibling
    right <== sibling + isRight * (cur - sibling);

    component h = PoseidonT3();
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    out <== h.out;
}

template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component levels[depth];
    signal cur[depth + 1];
    cur[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        levels[i] = MerkleLevel();
        levels[i].cur <== cur[i];
        levels[i].sibling <== pathElements[i];
        levels[i].isRight <== pathIndices[i];
        cur[i + 1] <== levels[i].out;
    }

    root <== cur[depth];
}

component main = MerkleInclusion(20);
