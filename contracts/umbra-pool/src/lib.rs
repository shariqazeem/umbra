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
    InvalidAmount = 6,
    TreeFull = 7,
    RecipientMismatch = 8,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    VkShield,
    VkWithdraw,
    VkTransfer,
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
    /// Atomic constructor — runs exactly once, at deploy: pin both verifying keys and
    /// the pooled asset, and seed the empty incremental tree (frontier = zero subtrees,
    /// root = the empty-tree root).
    ///
    /// H1: this is a `__constructor` rather than a separate `init` call, so there is no
    /// post-deploy window in which an attacker could front-run initialization and bind a
    /// malicious verifying key (which would accept forged proofs and drain the pool).
    /// Verifying keys and the asset are fixed in the same transaction that creates the
    /// contract, and cannot be changed afterward.
    pub fn __constructor(
        env: Env,
        token: Address,
        vk_shield: VerifyingKey,
        vk_withdraw: VerifyingKey,
        vk_transfer: VerifyingKey,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::VkShield, &vk_shield);
        s.set(&DataKey::VkWithdraw, &vk_withdraw);
        s.set(&DataKey::VkTransfer, &vk_transfer);
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

        // M1: reject non-positive amounts (a negative i128 would misbehave in transfer).
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        // M2: reject once the fixed-depth tree is full (the frontier math is only valid
        // for leaf indices in [0, 2^depth)).
        let next: u32 = s.get(&DataKey::NextIndex).unwrap_or(0);
        if next >= (1u32 << (MERKLE_DEPTH as u32)) {
            return Err(Error::TreeFull);
        }

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

        // M1: reject non-positive amounts.
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let public_inputs = vec![
            &env,
            root.clone(),
            nullifier.clone(),
            recipient.clone(),
            amount_to_fr_bytes(&env, amount),
        ];
        if !verify_groth16(&env, &vk, &proof, &public_inputs) {
            return Err(Error::InvalidProof);
        }

        // C1: bind the proof to the payee. The proof's `recipient` public input must
        // equal field(to), so a stolen/observed proof cannot be redirected to another
        // address (front-running theft).
        if recipient != Self::address_to_field(&env, &to) {
            return Err(Error::RecipientMismatch);
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

    /// Confidential shielded→shielded transfer ("private send", 1-in / 1-out).
    ///
    /// Verifies the transfer proof (which proves, in zero knowledge, inclusion of the
    /// spent input note, its nullifier, a well-formed output commitment carrying the same
    /// HIDDEN value, and a 64-bit range on that value), spends the input nullifier, and
    /// inserts the output commitment. **No amount is revealed and NO token moves** — value
    /// stays in the pool, re-noted to the recipient. Public inputs (pinned order):
    /// [root, nullifier, out_commitment].
    ///
    /// 1-out (rather than a 2-out join-split with change) is a deliberate fit to Stellar's
    /// per-transaction compute budget, which allows the Groth16/BLS verify plus a single
    /// Poseidon Merkle insert; two inserts exceed it at this depth. See the circuit header.
    pub fn transfer(
        env: Env,
        proof: Proof,
        root: BytesN<32>,
        nullifier: BytesN<32>,
        out_commitment: BytesN<32>,
    ) -> Result<u32, Error> {
        let s = env.storage().instance();
        let vk: VerifyingKey = s.get(&DataKey::VkTransfer).ok_or(Error::NotInitialized)?;

        let public_inputs = vec![&env, root.clone(), nullifier.clone(), out_commitment.clone()];
        if !verify_groth16(&env, &vk, &proof, &public_inputs) {
            return Err(Error::InvalidProof);
        }

        // Inclusion must be against a root the contract actually produced.
        if !Self::is_known_root(&env, &root) {
            return Err(Error::UnknownRoot);
        }

        // The fixed-depth tree must have room for the output commitment.
        let next: u32 = s.get(&DataKey::NextIndex).unwrap_or(0);
        if next >= (1u32 << (MERKLE_DEPTH as u32)) {
            return Err(Error::TreeFull);
        }

        // Spend the input note exactly once. No address auth: the proof IS the
        // authorization (only the note owner knows the secret), and the output is a fixed
        // commitment in the proof, so a relayer/front-runner cannot redirect value.
        let nf_key = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nf_key) {
            return Err(Error::NullifierAlreadySpent);
        }
        env.storage().persistent().set(&nf_key, &true);
        env.storage().persistent().extend_ttl(&nf_key, 100_000, 1_000_000);

        // Insert the output commitment (value never leaves the pool).
        let leaf = Self::insert_commitment(&env, &out_commitment);

        env.events()
            .publish((Symbol::new(&env, "TransferCompleted"),), (nullifier, out_commitment, leaf));
        Ok(leaf)
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

    /// Deterministic field encoding of a payout address: SHA-256 of its ScVal XDR with
    /// the top byte cleared (so it is always a valid BLS12-381 Fr element). Computed
    /// identically in the wallet (TS), so a withdrawal proof can bind to its payee.
    fn address_to_field(env: &Env, addr: &Address) -> BytesN<32> {
        use soroban_sdk::xdr::ToXdr;
        let h = env.crypto().sha256(&addr.clone().to_xdr(env)).to_bytes();
        let mut a = h.to_array();
        a[0] = 0;
        BytesN::from_array(env, &a)
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
