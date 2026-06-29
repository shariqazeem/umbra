// Poseidon over BLS12-381 Fr — canonical (unoptimized) formulation, t=3 (2 inputs).
//
// This template consumes the SAME constants emitted by @umbra/crypto-bls
// (scripts/gen-constants.ts → poseidon_constants_t3.circom), so the Circom hash and
// the TypeScript hash agree by construction. Compile with `--prime bls12381`.
pragma circom 2.1.6;

include "./poseidon_constants_t3.circom";

// S-box x^5.
template Pow5() {
    signal input in;
    signal output out;
    signal in2;
    signal in4;
    in2 <== in * in;
    in4 <== in2 * in2;
    out <== in4 * in;
}

// 2-to-1 Poseidon compression (state width t=3, R_F=8, R_P=57).
template PoseidonT3() {
    signal input inputs[2];
    signal output out;

    var t = 3;
    var RF = 8;
    var RP = 57;
    var N = RF + RP; // 65 rounds
    var C[195] = POSEIDON_T3_C();
    var M[3][3] = POSEIDON_T3_M();

    signal state[N + 1][t];
    state[0][0] <== 0;       // capacity element
    state[0][1] <== inputs[0];
    state[0][2] <== inputs[1];

    signal arked[N][t];
    signal sboxed[N][t];
    component pw[N][t];

    for (var r = 0; r < N; r++) {
        var isFull = (r < RF \ 2) || (r >= (RF \ 2) + RP);

        // Add round constants.
        for (var i = 0; i < t; i++) {
            arked[r][i] <== state[r][i] + C[r * t + i];
        }

        // S-box: full rounds hit every lane; partial rounds hit only lane 0.
        for (var i = 0; i < t; i++) {
            if (isFull || i == 0) {
                pw[r][i] = Pow5();
                pw[r][i].in <== arked[r][i];
                sboxed[r][i] <== pw[r][i].out;
            } else {
                sboxed[r][i] <== arked[r][i];
            }
        }

        // MDS mix (constant matrix × state vector).
        for (var i = 0; i < t; i++) {
            state[r + 1][i] <== M[i][0] * sboxed[r][0] + M[i][1] * sboxed[r][1] + M[i][2] * sboxed[r][2];
        }
    }

    out <== state[N][0];
}
