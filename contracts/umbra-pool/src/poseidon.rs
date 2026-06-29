//! Poseidon t=3 over BLS12-381 Fr, computed on-chain with the CAP-0059 Fr host
//! functions. Uses the exact constants shared with the circuits and the TS wallet
//! (poseidon_constants.rs), so on-chain roots match off-chain roots and circuit
//! proofs verify. This is the only hashing the contract does (Tornado-style
//! on-chain incremental tree).

use soroban_sdk::crypto::bls12_381::{Bls12_381, Fr};
use soroban_sdk::{BytesN, Env};

use crate::poseidon_constants::{POSEIDON_C, POSEIDON_M, POSEIDON_RF, POSEIDON_RP};

const T: usize = 3;

pub fn fr_from_bytes(b: &BytesN<32>) -> Fr {
    Fr::from_bytes(b.clone())
}

pub fn fr_to_bytes(fr: &Fr) -> BytesN<32> {
    fr.to_bytes()
}

fn fr_const(env: &Env, b: &[u8; 32]) -> Fr {
    Fr::from_bytes(BytesN::from_array(env, b))
}

fn pow5(bls: &Bls12_381, x: &Fr) -> Fr {
    let x2 = bls.fr_mul(x, x);
    let x4 = bls.fr_mul(&x2, &x2);
    bls.fr_mul(&x4, x)
}

/// 2-to-1 Poseidon compression (the Merkle node hash and the commitment/nullifier hash).
pub fn poseidon2(env: &Env, a: &Fr, b: &Fr) -> Fr {
    let bls = env.crypto().bls12_381();
    let zero = fr_const(env, &[0u8; 32]);
    let mut state: [Fr; T] = [zero.clone(), a.clone(), b.clone()];
    let rounds = POSEIDON_RF + POSEIDON_RP;

    for r in 0..rounds {
        // Add round constants.
        for i in 0..T {
            let c = fr_const(env, &POSEIDON_C[r * T + i]);
            state[i] = bls.fr_add(&state[i], &c);
        }
        // S-box: full rounds hit every lane; partial rounds only lane 0.
        let is_full = r < POSEIDON_RF / 2 || r >= POSEIDON_RF / 2 + POSEIDON_RP;
        if is_full {
            for i in 0..T {
                state[i] = pow5(&bls, &state[i]);
            }
        } else {
            state[0] = pow5(&bls, &state[0]);
        }
        // MDS mix.
        let mut next: [Fr; T] = [zero.clone(), zero.clone(), zero.clone()];
        for i in 0..T {
            let mut acc = zero.clone();
            for j in 0..T {
                let m = fr_const(env, &POSEIDON_M[i * T + j]);
                acc = bls.fr_add(&acc, &bls.fr_mul(&m, &state[j]));
            }
            next[i] = acc;
        }
        state = next;
    }

    state[0].clone()
}
