// Umbra confidential transfer circuit — a shielded→shielded join-split (1-in, 2-out) with
// HIDDEN amounts. Spends one input note and splits its value across two output notes
// (recipient + change), all WITHOUT revealing any amount: the chain sees a spent nullifier
// and two new commitments, never a number. This is the "send any private amount, keep the
// change, everything hidden" flow.
//
// It does two on-chain Merkle inserts (one per output). That fits Stellar's per-tx compute
// budget only because the contract's Poseidon deserializes its constants once per call
// (see contracts/umbra-pool/src/poseidon.rs PoseidonParams) rather than per hash.
//
// Proves, in zero knowledge:
//   1. inclusion   — the input note's commitment is a leaf under `root`
//   2. ownership   — prover knows `secret` s.t. inCommitment = Poseidon(secret, value)
//   3. nullifier   — nullifier = Poseidon(secret, leafIndex)  (one-time spend)
//   4. well-formed — outCommitment_i = Poseidon(outSecret_i, outValue_i)
//   5. conservation — value == outValue1 + outValue2   (the ONLY tie between amounts)
//   6. range       — value, outValue1, outValue2 ∈ [0, 2^64)
//
// (6) is SECURITY-CRITICAL: with both outputs bounded to 64 bits their sum cannot wrap the
// field, so (5) holds over the integers — without it a prover could forge value via modular
// overflow (the classic confidential-transaction trap).
//
// Public inputs (CROSS-LANGUAGE PIN — must match UmbraPool::transfer):
//   [0] root
//   [1] nullifier
//   [2] outCommitment1   (recipient note)
//   [3] outCommitment2   (change note)
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
    signal input outCommitment1;
    signal input outCommitment2;

    // ---- private: the input note being spent ----
    signal input secret;
    signal input value;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // ---- private: the two output notes (recipient + change) ----
    signal input outSecret1;
    signal input outValue1;
    signal input outSecret2;
    signal input outValue2;

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

    // (4) output commitments are well-formed Poseidon openings.
    component oc1 = PoseidonT3();
    oc1.inputs[0] <== outSecret1;
    oc1.inputs[1] <== outValue1;
    oc1.out === outCommitment1;

    component oc2 = PoseidonT3();
    oc2.inputs[0] <== outSecret2;
    oc2.inputs[1] <== outValue2;
    oc2.out === outCommitment2;

    // (6) range proofs — SECURITY-CRITICAL. Each amount < 2^64.
    component rIn = RangeN(64);
    rIn.in <== value;
    component rO1 = RangeN(64);
    rO1.in <== outValue1;
    component rO2 = RangeN(64);
    rO2.in <== outValue2;

    // (5) value conservation — no amount is ever a public input.
    value === outValue1 + outValue2;
}

component main {public [root, nullifier, outCommitment1, outCommitment2]} = Transfer(13);
