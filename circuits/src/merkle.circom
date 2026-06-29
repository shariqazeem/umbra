// Merkle inclusion over Poseidon t=3, shared by withdraw.circom (and reusable).
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";

// One level: hash (cur, sibling) in the order chosen by isRight ∈ {0,1}.
template MerkleLevel() {
    signal input cur;
    signal input sibling;
    signal input isRight;
    signal output out;

    isRight * (isRight - 1) === 0; // boolean

    signal left;
    signal right;
    left <== cur + isRight * (sibling - cur);     // isRight=0 → cur ; =1 → sibling
    right <== sibling + isRight * (cur - sibling);

    component h = PoseidonT3();
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    out <== h.out;
}

// Compute the Merkle root for `leaf` given an authentication path of `depth`.
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
