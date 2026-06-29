// Umbra withdraw circuit (mixer-shaped, full-note withdrawal).
//
// Proves, in zero knowledge, all five required properties:
//   1. valid Merkle inclusion   — commitment is a leaf under `root`
//   2. valid note ownership     — prover knows `secret` s.t. commitment=Poseidon(secret,value)
//   3. valid nullifier derivation — nullifier = Poseidon(secret, leafIndex)
//   4. recipient binding        — `recipient` is bound into the proof (no redirection/reuse)
//   5. amount conservation      — withdrawn `amount` == the note's `value`
//
// Public inputs (ORDER IS THE CROSS-LANGUAGE PIN — must match UmbraPool::withdraw):
//   [0] root
//   [1] nullifier
//   [2] recipient
//   [3] amount
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";
include "./merkle.circom";

template Withdraw(depth) {
    signal input root;        // public
    signal input nullifier;   // public
    signal input recipient;   // public
    signal input amount;      // public

    signal input secret;              // private
    signal input value;               // private
    signal input pathElements[depth]; // private
    signal input pathIndices[depth];  // private

    // (2) ownership: re-derive the commitment from the secret note opening.
    component cm = PoseidonT3();
    cm.inputs[0] <== secret;
    cm.inputs[1] <== value;

    // (1) inclusion: the commitment hashes up the path to the public root.
    component incl = MerkleInclusion(depth);
    incl.leaf <== cm.out;
    for (var i = 0; i < depth; i++) {
        incl.pathElements[i] <== pathElements[i];
        incl.pathIndices[i] <== pathIndices[i];
    }
    incl.root === root;

    // leafIndex = Σ pathIndices[i] · 2^i  (binds the nullifier to the position).
    signal lc[depth + 1];
    lc[0] <== 0;
    var pow = 1;
    for (var i = 0; i < depth; i++) {
        lc[i + 1] <== lc[i] + pathIndices[i] * pow;
        pow = pow * 2;
    }
    signal leafIndex;
    leafIndex <== lc[depth];

    // (3) nullifier derivation.
    component nf = PoseidonT3();
    nf.inputs[0] <== secret;
    nf.inputs[1] <== leafIndex;
    nf.out === nullifier;

    // (5) amount conservation: full-note withdrawal.
    amount === value;

    // (4) recipient binding: force `recipient` into the constraint system so the
    // proof is non-malleably bound to it (a proof for one recipient cannot be
    // reused for another — the verifier's public input would differ).
    signal recipientSq;
    recipientSq <== recipient * recipient;
}

component main {public [root, nullifier, recipient, amount]} = Withdraw(8);
