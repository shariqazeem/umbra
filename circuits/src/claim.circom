// Umbra claim circuit — proves knowledge of a note opening WITHOUT revealing its value.
//
// Used by register-on-claim: when you receive a private-send note (via a bearer link), you
// prove to the contract that you hold a valid opening (secret, value) of the commitment, and the
// contract inserts that commitment into the Merkle tree. This is what lets the transfer insert
// only ONE leaf on-chain (the sender's change) and defer the recipient's leaf to claim time —
// halving the transfer's Merkle work so the tree can be far deeper.
//
// Security role:
//   - value is PRIVATE, so the received amount stays hidden (only `commitment` is public).
//   - the opening proof stops a griefer from spamming the tree with commitments they can't spend.
//   - the contract additionally checks the commitment is a PENDING transfer output (backed by a
//     real spent input), which is what prevents inflation — this circuit does not need to.
//   - the 64-bit range keeps a malformed/oversized value from ever entering the tree.
//
// Public inputs (CROSS-LANGUAGE PIN — must match UmbraPool::claim_insert):
//   [0] commitment
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";

// Range check: in ∈ [0, 2^n). Canonical Num2Bits (bits pinned boolean + recomposed).
template RangeN(n) {
    signal input in;
    signal bits[n];
    var lc = 0;
    var pow = 1;
    for (var i = 0; i < n; i++) {
        bits[i] <-- (in >> i) & 1;
        bits[i] * (bits[i] - 1) === 0;
        lc += bits[i] * pow;
        pow = pow * 2;
    }
    lc === in;
}

template Claim() {
    signal input commitment; // public
    signal input secret;     // private
    signal input value;      // private

    // The commitment is a well-formed Poseidon opening the prover knows.
    component cm = PoseidonT3();
    cm.inputs[0] <== secret;
    cm.inputs[1] <== value;
    cm.out === commitment;

    // Value is a canonical 64-bit amount (no field-overflowing junk enters the tree).
    component r = RangeN(64);
    r.in <== value;
}

component main {public [commitment]} = Claim();
