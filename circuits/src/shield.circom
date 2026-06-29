// Umbra shield circuit.
//
// Proves a deposit commitment is well-formed for the PUBLIC amount, so the pool
// cannot be seeded with a note whose hidden value exceeds the funds actually
// deposited. The note is Tornado-style: commitment = Poseidon(secret, amount).
//
// Public inputs (ORDER IS THE CROSS-LANGUAGE PIN — must match UmbraPool::shield):
//   [0] commitment
//   [1] amount
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";

template Shield() {
    signal input commitment;   // public
    signal input amount;       // public
    signal input secret;       // private

    component cm = PoseidonT3();
    cm.inputs[0] <== secret;
    cm.inputs[1] <== amount;
    cm.out === commitment;
}

component main {public [commitment, amount]} = Shield();
