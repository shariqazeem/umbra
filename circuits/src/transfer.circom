// Umbra confidential transfer circuit — a shielded→shielded "private send" (1-in, 1-out)
// with a HIDDEN amount. Spends one input note and re-notes its full value to a fresh
// output note (for the recipient) WITHOUT revealing the amount: the chain sees only a
// spent nullifier and one new commitment, never a number.
//
// Why 1-out: Stellar's per-transaction compute budget allows a Groth16/BLS verify plus a
// single Poseidon Merkle insert. A 2-output join-split (arbitrary amount + change) needs
// two inserts and exceeds that budget at this tree depth — a documented limitation, not a
// soundness gap. Whole-note sends (this circuit) fit comfortably and are a real
// confidential transfer; arbitrary-amount-with-change is future work (2-tx flow, shallower
// tree, or a host-side Poseidon).
//
// Proves, in zero knowledge:
//   1. inclusion   — the input note's commitment is a leaf under `root`
//   2. ownership   — prover knows `secret` s.t. inCommitment = Poseidon(secret, value)
//   3. nullifier   — nullifier = Poseidon(secret, leafIndex)  (one-time spend)
//   4. well-formed out — outCommitment = Poseidon(outSecret, value)  (same hidden value)
//   5. range       — value ∈ [0, 2^64)  (defensive; the value is also a real note opening)
//
// Public inputs (CROSS-LANGUAGE PIN — must match UmbraPool::transfer):
//   [0] root
//   [1] nullifier
//   [2] outCommitment   (recipient note — value hidden)
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";
include "./merkle.circom";

// Range check: in ∈ [0, 2^n). Decomposes into n boolean bits and recomposes (the
// canonical Num2Bits pattern — no circomlib dependency).
template RangeN(n) {
    signal input in;
    signal bits[n];
    var lc = 0;
    var pow = 1;
    for (var i = 0; i < n; i++) {
        bits[i] <-- (in >> i) & 1;
        bits[i] * (bits[i] - 1) === 0; // each bit boolean
        lc += bits[i] * pow;
        pow = pow * 2;
    }
    lc === in; // recomposition pins `in` to exactly these n bits
}

template Transfer(depth) {
    // ---- public ----
    signal input root;
    signal input nullifier;
    signal input outCommitment;

    // ---- private: the input note being spent ----
    signal input secret;
    signal input value;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // ---- private: the output note (recipient), same hidden value ----
    signal input outSecret;

    // (2) ownership: re-derive the input commitment.
    component inCm = PoseidonT3();
    inCm.inputs[0] <== secret;
    inCm.inputs[1] <== value;

    // (1) inclusion: the commitment hashes up to the public root.
    component incl = MerkleInclusion(depth);
    incl.leaf <== inCm.out;
    for (var i = 0; i < depth; i++) {
        incl.pathElements[i] <== pathElements[i];
        incl.pathIndices[i] <== pathIndices[i];
    }
    incl.root === root;

    // leafIndex = Σ pathIndices[i]·2^i  (binds the nullifier to the position).
    signal lc[depth + 1];
    lc[0] <== 0;
    var pw = 1;
    for (var i = 0; i < depth; i++) {
        lc[i + 1] <== lc[i] + pathIndices[i] * pw;
        pw = pw * 2;
    }
    signal leafIndex;
    leafIndex <== lc[depth];

    // (3) nullifier derivation (one-time spend of the input note).
    component nf = PoseidonT3();
    nf.inputs[0] <== secret;
    nf.inputs[1] <== leafIndex;
    nf.out === nullifier;

    // (4) output commitment: the recipient note carries the SAME value, kept private.
    component oc = PoseidonT3();
    oc.inputs[0] <== outSecret;
    oc.inputs[1] <== value;
    oc.out === outCommitment;

    // (5) range proof — value is a valid 64-bit amount (no amount is ever public).
    component rng = RangeN(64);
    rng.in <== value;
}

component main {public [root, nullifier, outCommitment]} = Transfer(8);
