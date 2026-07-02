#![no_std]
//! groth16-verifier — Groth16 verification over BLS12-381 using the Soroban
//! CAP-0059 host functions. This is the load-bearing contract for the Umbra
//! thesis (proofs verified ON-CHAIN) and is validated end-to-end on testnet by
//! benchmark B04. Verification cost is constant in circuit size (~40M instr per
//! FEASIBILITY_REVIEW.md §1); only the public-input count affects the MSM term.
//!
//! Verification equation, in product-of-pairings form so it lands on a single
//! `pairing_check` host call:
//!
//!     e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
//!     where vk_x = IC[0] + Σ pub_i · IC[i]
//!
//! Points are uncompressed, big-endian (G1=96B, G2=192B); the host validates
//! subgroup membership automatically, so off-curve / wrong-subgroup proof points
//! are rejected without explicit checks here.

use soroban_sdk::{
    contract, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    BytesN, Env, Vec,
};

/// r − 1 in Fr (big-endian) = the scalar −1, used to negate A on-chain.
const FR_NEG_ONE: [u8; 32] = [
    0x73, 0xed, 0xa7, 0x53, 0x29, 0x9d, 0x7d, 0x48, 0x33, 0x39, 0xd8, 0x08, 0x09, 0xa1, 0xd8, 0x05,
    0x53, 0xbd, 0xa4, 0x02, 0xff, 0xfe, 0x5b, 0xfe, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
];

/// Groth16 verifying key (snarkjs layout, serialized to Soroban point bytes).
#[contracttype]
#[derive(Clone)]
pub struct VerifyingKey {
    pub alpha: BytesN<96>,    // G1
    pub beta: BytesN<192>,    // G2
    pub gamma: BytesN<192>,   // G2
    pub delta: BytesN<192>,   // G2
    pub ic: Vec<BytesN<96>>,  // G1[], length = (#public inputs) + 1
}

/// A Groth16 proof (π_A ∈ G1, π_B ∈ G2, π_C ∈ G1).
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: BytesN<96>,
    pub b: BytesN<192>,
    pub c: BytesN<96>,
}

/// Verify `proof` against `vk` for `public_inputs` (each a 32-byte Fr, big-endian).
/// Returns true iff the proof is valid. Reusable by any contract (the Umbra pool
/// calls this directly). Panics (host error) only on malformed / off-subgroup bytes.
pub fn verify_groth16(
    env: &Env,
    vk: &VerifyingKey,
    proof: &Proof,
    public_inputs: &Vec<BytesN<32>>,
) -> bool {
    // ic must have exactly one more element than the public inputs.
    if vk.ic.len() != public_inputs.len() + 1 {
        return false;
    }

    // SECURITY (canonical public inputs) — reject any public input >= r. Soroban's
    // `Fr::from_bytes` silently reduces mod r, so `x` and `x + r` map to the SAME scalar:
    // a proof valid for one verifies for the other, yet they are DIFFERENT 32-byte values.
    // A caller that compares a public input by raw bytes (e.g. the pool's nullifier
    // double-spend key `DataKey::Nullifier(bytes)`) would treat `n` and `n + r` as distinct,
    // enabling a replay/double-spend. Enforcing canonical form makes the verifier's field
    // view agree with the caller's byte view for EVERY field-typed public input. Honest
    // provers always emit x < r, so this never rejects a valid proof.
    for i in 0..public_inputs.len() {
        if !fr_is_canonical(&public_inputs.get_unchecked(i)) {
            return false;
        }
    }

    let bls = env.crypto().bls12_381();

    // vk_x = IC[0] + Σ public_i · IC[i+1]   (single G1 MSM + one add)
    let mut points: Vec<G1Affine> = Vec::new(env);
    let mut scalars: Vec<Fr> = Vec::new(env);
    for i in 0..public_inputs.len() {
        points.push_back(G1Affine::from_bytes(vk.ic.get_unchecked(i + 1)));
        scalars.push_back(Fr::from_bytes(public_inputs.get_unchecked(i)));
    }
    let acc = bls.g1_msm(points, scalars);
    let ic0 = G1Affine::from_bytes(vk.ic.get_unchecked(0));
    let vk_x = bls.g1_add(&ic0, &acc);

    // -A = A · (r-1)
    let a = G1Affine::from_bytes(proof.a.clone());
    let neg_one = Fr::from_bytes(BytesN::from_array(env, &FR_NEG_ONE));
    let neg_a = bls.g1_mul(&a, &neg_one);

    // Assemble the 4-term multi-pairing and check the product equals 1_GT.
    let mut vp1: Vec<G1Affine> = Vec::new(env);
    vp1.push_back(neg_a);
    vp1.push_back(G1Affine::from_bytes(vk.alpha.clone()));
    vp1.push_back(vk_x);
    vp1.push_back(G1Affine::from_bytes(proof.c.clone()));

    let mut vp2: Vec<G2Affine> = Vec::new(env);
    vp2.push_back(G2Affine::from_bytes(proof.b.clone()));
    vp2.push_back(G2Affine::from_bytes(vk.beta.clone()));
    vp2.push_back(G2Affine::from_bytes(vk.gamma.clone()));
    vp2.push_back(G2Affine::from_bytes(vk.delta.clone()));

    bls.pairing_check(vp1, vp2)
}

/// True iff `x` (big-endian, 32 bytes) is a canonical Fr element, i.e. `x < r`. Because
/// `FR_NEG_ONE == r - 1`, canonical ⟺ `x <= r - 1` ⟺ the big-endian bytes are `<= FR_NEG_ONE`
/// (lexicographic compare of equal-length big-endian arrays equals integer compare).
fn fr_is_canonical(x: &BytesN<32>) -> bool {
    let x = x.to_array();
    let mut i = 0;
    while i < 32 {
        if x[i] < FR_NEG_ONE[i] {
            return true; // strictly below r-1 ⇒ < r
        }
        if x[i] > FR_NEG_ONE[i] {
            return false; // above r-1 ⇒ >= r (non-canonical)
        }
        i += 1;
    }
    true // exactly r-1 ⇒ still < r, canonical
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    /// Thin contract wrapper around [`verify_groth16`].
    pub fn verify(env: Env, vk: VerifyingKey, proof: Proof, public_inputs: Vec<BytesN<32>>) -> bool {
        verify_groth16(&env, &vk, &proof, &public_inputs)
    }
}
