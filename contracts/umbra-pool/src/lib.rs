#![cfg_attr(not(test), no_std)]
//! Umbra pool — the vertical-slice privacy pool.
//!
//! Two state-changing entrypoints, both gated by a Groth16/BLS12-381 proof verified
//! on-chain via the CAP-0059 host functions:
//!   * `shield`   — verify a well-formedness proof, pull funds, insert the
//!                  commitment into the on-chain Poseidon Merkle tree.
//!   * `withdraw` — verify an inclusion+nullifier+recipient+amount proof, reject
//!                  spent nullifiers / unknown roots, pay the recipient.
//!
//! Storage: commitments (as a Poseidon incremental tree: frontier + roots),
//! nullifiers (persistent set). Events: DepositCreated, WithdrawalCompleted.

use groth16_verifier::{verify_groth16, Proof, VerifyingKey};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec, Address, BytesN, Env, Symbol,
    Vec,
};

mod poseidon;
mod poseidon_constants;

use poseidon::{fr_from_bytes, fr_to_bytes, poseidon2};
use poseidon_constants::{MERKLE_DEPTH, ZERO_HASHES};

/// Recent roots retained for withdrawal (a withdrawal may prove against any of these).
const ROOT_HISTORY: u32 = 32;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidProof = 3,
    UnknownRoot = 4,
    NullifierAlreadySpent = 5,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    VkShield,
    VkWithdraw,
    Token,
    NextIndex,
    Frontier,
    Roots,
    Nullifier(BytesN<32>),
}

#[contract]
pub struct UmbraPool;

#[contractimpl]
impl UmbraPool {
    /// One-time setup: pin both verifying keys and the pooled asset, and seed the
    /// empty incremental tree (frontier = zero subtrees, root = the empty-tree root).
    pub fn init(
        env: Env,
        token: Address,
        vk_shield: VerifyingKey,
        vk_withdraw: VerifyingKey,
    ) -> Result<(), Error> {
        let s = env.storage().instance();
        if s.has(&DataKey::VkShield) {
            return Err(Error::AlreadyInitialized);
        }
        s.set(&DataKey::VkShield, &vk_shield);
        s.set(&DataKey::VkWithdraw, &vk_withdraw);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::NextIndex, &0u32);

        // Frontier initialized to the zero-subtree hashes.
        let mut frontier: Vec<BytesN<32>> = Vec::new(&env);
        for d in 0..MERKLE_DEPTH {
            frontier.push_back(BytesN::from_array(&env, &ZERO_HASHES[d]));
        }
        s.set(&DataKey::Frontier, &frontier);

        // The empty-tree root is a known root.
        let empty_root = BytesN::from_array(&env, &ZERO_HASHES[MERKLE_DEPTH]);
        s.set(&DataKey::Roots, &vec![&env, empty_root]);
        Ok(())
    }

    /// Shield `amount` of the pooled asset under `commitment`.
    ///
    /// Verifies the shield proof binds `commitment` to the PUBLIC `amount`, pulls the
    /// funds from `depositor`, inserts the commitment into the tree, and emits
    /// DepositCreated. Public inputs (pinned order): [commitment, amount].
    pub fn shield(
        env: Env,
        proof: Proof,
        commitment: BytesN<32>,
        amount: i128,
        depositor: Address,
    ) -> Result<u32, Error> {
        let s = env.storage().instance();
        let vk: VerifyingKey = s.get(&DataKey::VkShield).ok_or(Error::NotInitialized)?;

        let public_inputs = vec![&env, commitment.clone(), amount_to_fr_bytes(&env, amount)];
        if !verify_groth16(&env, &vk, &proof, &public_inputs) {
            return Err(Error::InvalidProof);
        }

        // Pull funds into the pool.
        depositor.require_auth();
        let tk: Address = s.get(&DataKey::Token).unwrap();
        token::Client::new(&env, &tk).transfer(&depositor, &env.current_contract_address(), &amount);

        // Insert the commitment and advance the tree.
        let leaf_index = Self::insert_commitment(&env, &commitment);

        env.events().publish(
            (Symbol::new(&env, "DepositCreated"),),
            (commitment, leaf_index, amount),
        );
        Ok(leaf_index)
    }

    /// Withdraw `amount` to `to`, authorized by a withdraw proof.
    ///
    /// Verifies inclusion under a known `root`, the `nullifier` derivation, recipient
    /// binding, and amount conservation; rejects spent nullifiers; pays `to`; emits
    /// WithdrawalCompleted. Public inputs (pinned order): [root, nullifier, recipient, amount].
    pub fn withdraw(
        env: Env,
        proof: Proof,
        root: BytesN<32>,
        nullifier: BytesN<32>,
        recipient: BytesN<32>,
        amount: i128,
        to: Address,
    ) -> Result<(), Error> {
        let s = env.storage().instance();
        let vk: VerifyingKey = s.get(&DataKey::VkWithdraw).ok_or(Error::NotInitialized)?;

        let public_inputs = vec![
            &env,
            root.clone(),
            nullifier.clone(),
            recipient,
            amount_to_fr_bytes(&env, amount),
        ];
        if !verify_groth16(&env, &vk, &proof, &public_inputs) {
            return Err(Error::InvalidProof);
        }

        // Root must be one the contract actually produced.
        if !Self::is_known_root(&env, &root) {
            return Err(Error::UnknownRoot);
        }

        // Spend exactly once.
        let nf_key = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nf_key) {
            return Err(Error::NullifierAlreadySpent);
        }
        env.storage().persistent().set(&nf_key, &true);
        env.storage().persistent().extend_ttl(&nf_key, 100_000, 1_000_000);

        // Pay out.
        let tk: Address = s.get(&DataKey::Token).unwrap();
        token::Client::new(&env, &tk).transfer(&env.current_contract_address(), &to, &amount);

        env.events()
            .publish((Symbol::new(&env, "WithdrawalCompleted"),), (nullifier, to, amount));
        Ok(())
    }

    // --- read-only views -----------------------------------------------------

    pub fn current_root(env: Env) -> BytesN<32> {
        let roots: Vec<BytesN<32>> = env.storage().instance().get(&DataKey::Roots).unwrap();
        roots.get_unchecked(roots.len() - 1)
    }

    pub fn is_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier))
    }

    pub fn next_index(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::NextIndex).unwrap_or(0)
    }

    // --- internals -----------------------------------------------------------

    fn is_known_root(env: &Env, root: &BytesN<32>) -> bool {
        let roots: Vec<BytesN<32>> = env.storage().instance().get(&DataKey::Roots).unwrap();
        roots.iter().any(|r| &r == root)
    }

    /// Incremental Poseidon insert (Tornado-style). Returns the leaf index used.
    fn insert_commitment(env: &Env, commitment: &BytesN<32>) -> u32 {
        let s = env.storage().instance();
        let leaf_index: u32 = s.get(&DataKey::NextIndex).unwrap();
        let mut frontier: Vec<BytesN<32>> = s.get(&DataKey::Frontier).unwrap();

        let mut idx = leaf_index;
        let mut cur = fr_from_bytes(commitment);
        for d in 0..MERKLE_DEPTH {
            if idx & 1 == 0 {
                // current node is a left child: record it, hash with the zero sibling.
                frontier.set(d as u32, fr_to_bytes(&cur));
                let z = fr_from_bytes(&BytesN::from_array(env, &ZERO_HASHES[d]));
                cur = poseidon2(env, &cur, &z);
            } else {
                let left = fr_from_bytes(&frontier.get_unchecked(d as u32));
                cur = poseidon2(env, &left, &cur);
            }
            idx >>= 1;
        }
        let new_root = fr_to_bytes(&cur);

        // Persist tree state + append the new root (bounded history).
        s.set(&DataKey::Frontier, &frontier);
        s.set(&DataKey::NextIndex, &(leaf_index + 1));
        let mut roots: Vec<BytesN<32>> = s.get(&DataKey::Roots).unwrap();
        roots.push_back(new_root);
        while roots.len() > ROOT_HISTORY {
            roots.remove(0);
        }
        s.set(&DataKey::Roots, &roots);

        leaf_index
    }
}

/// Encode a non-negative i128 amount as a 32-byte big-endian Fr scalar (matches the
/// circuit's `amount` public signal and @umbra/crypto-bls `toBytesBE`).
fn amount_to_fr_bytes(env: &Env, amount: i128) -> BytesN<32> {
    let mut buf = [0u8; 32];
    let a = amount as u128; // amounts are non-negative in the slice
    buf[16..32].copy_from_slice(&a.to_be_bytes());
    BytesN::from_array(env, &buf)
}

#[cfg(test)]
mod test;
