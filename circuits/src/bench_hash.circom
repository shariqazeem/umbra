// bench_hash — minimal circuit to exercise the full BLS12-381 Groth16 pipeline
// (compile → ceremony → prove → verify → export vk → on-chain verify) with a tiny,
// fast witness. Statement: "I know (a, b) such that Poseidon(a, b) = hash", with
// `hash` the only public signal. Used by B03 (proving latency floor) and to produce
// the proof/vk consumed by B04 (on-chain verification).
pragma circom 2.1.6;

include "./poseidon/poseidon.circom";

template BenchHash() {
    signal input a;       // private
    signal input b;       // private
    signal output hash;   // public

    component h = PoseidonT3();
    h.inputs[0] <== a;
    h.inputs[1] <== b;
    hash <== h.out;
}

component main = BenchHash();
