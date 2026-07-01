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
const ROUNDS: usize = POSEIDON_RF + POSEIDON_RP;

/// Poseidon round constants + MDS matrix, deserialized to `Fr` ONCE. Building this per
/// contract call (instead of per hash) collapses ~204 `Fr::from_bytes` host calls per hash
/// — 195 round constants + 9 MDS — to a single setup. That is the dominant on-chain cost
/// when a call performs many hashes (a confidential transfer inserts two commitments =
/// 16 hashes = ~3,264 avoidable deserializations).
pub struct PoseidonParams {
    zero: Fr,
    mds: [[Fr; T]; T],
    rc: [Fr; ROUNDS * T],
}

impl PoseidonParams {
    pub fn new(env: &Env) -> Self {
        let zero = fr_const(env, &[0u8; 32]);
        let mds: [[Fr; T]; T] = [
            [fr_const(env, &POSEIDON_M[0]), fr_const(env, &POSEIDON_M[1]), fr_const(env, &POSEIDON_M[2])],
            [fr_const(env, &POSEIDON_M[3]), fr_const(env, &POSEIDON_M[4]), fr_const(env, &POSEIDON_M[5])],
            [fr_const(env, &POSEIDON_M[6]), fr_const(env, &POSEIDON_M[7]), fr_const(env, &POSEIDON_M[8])],
        ];
        // Fixed-size (no allocator needed on wasm): deserialize each round constant once.
        let rc: [Fr; ROUNDS * T] = core::array::from_fn(|i| fr_const(env, &POSEIDON_C[i]));
        Self { zero, mds, rc }
    }

    /// 2-to-1 Poseidon compression using the precomputed constants (no `from_bytes`).
    pub fn hash2(&self, env: &Env, a: &Fr, b: &Fr) -> Fr {
        let bls = env.crypto().bls12_381();
        let mut state: [Fr; T] = [self.zero.clone(), a.clone(), b.clone()];
        for r in 0..ROUNDS {
            // Add round constants.
            for i in 0..T {
                state[i] = bls.fr_add(&state[i], &self.rc[r * T + i]);
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
            let mut next: [Fr; T] = [self.zero.clone(), self.zero.clone(), self.zero.clone()];
            for i in 0..T {
                let mut acc = self.zero.clone();
                for j in 0..T {
                    acc = bls.fr_add(&acc, &bls.fr_mul(&self.mds[i][j], &state[j]));
                }
                next[i] = acc;
            }
            state = next;
        }
        state[0].clone()
    }
}

/// Convenience one-shot (builds the params each call). Off the hot path — used by the
/// test oracle; hot paths build `PoseidonParams` once and call `hash2` per hash.
pub fn poseidon2(env: &Env, a: &Fr, b: &Fr) -> Fr {
    PoseidonParams::new(env).hash2(env, a, b)
}
