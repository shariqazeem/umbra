// Umbra withdraw circuit — a shielded→public withdrawal with PRIVATE CHANGE
// (join-split, 1-in / 1-public-out / 1-change-note). Spends one input note, pays a PUBLIC
// `amount` out to a bound `recipient` (value LEAVES the pool), and keeps the remainder as a
// new private change note. Only `amount` is public; the change value is hidden.
//
// This is the arbitrary-amount cash-out: "unshield 200 of your 491, keep 291 private."
// It mirrors the confidential transfer (transfer.circom) but one output is a public
// withdrawal instead of a second commitment.
//
// Proves, in zero knowledge:
//   1. inclusion   — the input note's commitment is a leaf under `root`
//   2. ownership   — prover knows `secret` s.t. inCommitment = Poseidon(secret, value)
//   3. nullifier   — nullifier = Poseidon(secret, leafIndex)  (one-time spend)
//   4. well-formed — changeCommitment = Poseidon(changeSecret, changeValue)
//   5. conservation — value == amount + changeValue   (the ONLY tie between amounts)
//   6. range       — value, amount, changeValue ∈ [0, 2^64)
//   7. recipient binding — `recipient` bound into the proof (no redirection/reuse)
//
// (6) is SECURITY-CRITICAL: with amount and changeValue each bounded to 64 bits their sum
// cannot wrap the field, so (5) holds over the integers — without it a prover could forge
// `value` via modular overflow (the classic confidential-transaction trap).
//
// Public inputs (ORDER IS THE CROSS-LANGUAGE PIN — must match UmbraPool::withdraw):
//   [0] root
//   [1] nullifier
//   [2] recipient
//   [3] amount            (public withdrawal, leaves the pool)
//   [4] changeCommitment  (new private change note)
//   [5] has_change        (1 = insert change note; 0 = full exit, no insert — works at a full tree)
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

template Withdraw(depth) {
    // ---- public ----
    signal input root;
    signal input nullifier;
    signal input recipient;
    signal input amount;            // public withdrawal (leaves the pool)
    signal input changeCommitment;  // new private change note
    signal input has_change;        // 1 = insert change note; 0 = full exit (no insert)

    // ---- private: the input note being spent ----
    signal input secret;
    signal input value;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // ---- private: the change note ----
    signal input changeSecret;
    signal input changeValue;

    // (2) ownership: re-derive the input commitment from the secret note opening.
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

    // (4) the change note is a well-formed Poseidon opening.
    component ch = PoseidonT3();
    ch.inputs[0] <== changeSecret;
    ch.inputs[1] <== changeValue;
    ch.out === changeCommitment;

    // (6) range proofs — SECURITY-CRITICAL. Each amount < 2^64.
    component rIn = RangeN(64);
    rIn.in <== value;
    component rAmt = RangeN(64);
    rAmt.in <== amount;
    component rCh = RangeN(64);
    rCh.in <== changeValue;

    // (5) conservation: withdrawn amount + private change == the input note's value.
    value === amount + changeValue;

    // (8) full-exit flag. has_change is boolean, and a full exit (has_change == 0) FORCES
    // changeValue == 0. So when the caller declares "no change", the contract may safely skip
    // inserting the change note — meaning a note can always be fully withdrawn even when the
    // Merkle tree is full (no free leaf required), and no value is left unaccounted for.
    has_change * (has_change - 1) === 0;
    (1 - has_change) * changeValue === 0;

    // (7) recipient binding: force `recipient` into the constraint system so the proof is
    // non-malleably bound to it (a proof for one payee cannot be reused for another — the
    // verifier's public input would differ).
    signal recipientSq;
    recipientSq <== recipient * recipient;
}

component main {public [root, nullifier, recipient, amount, changeCommitment, has_change]} = Withdraw(6);
