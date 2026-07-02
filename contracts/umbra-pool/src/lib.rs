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
//! nullifiers (persistent set). Events: DepositCreated, WithdrawalCompleted, TransferCompleted.

use groth16_verifier::{verify_groth16, Proof, VerifyingKey};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec, Address, Bytes, BytesN, Env,
    Symbol, Vec,
};

mod poseidon;
mod poseidon_constants;

use poseidon::{fr_from_bytes, fr_to_bytes, PoseidonParams};
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

        depositor.require_auth();

        // CEI ordering: perform the state effect (insert) BEFORE the external interaction
        // (token pull), so even a hostile token contract could not reenter to insert past
        // capacity. The pooled asset is the native XLM SAC (no callbacks) — this is defense in
        // depth. If the pull fails, the whole tx reverts and the insert is rolled back.
        let leaf_index = Self::insert_commitment(&env, &commitment);

        // Keep the contract instance live under active use (tree state, VKs, token).
        s.extend_ttl(100_000, 1_000_000);

        let tk: Address = s.get(&DataKey::Token).unwrap();
        token::Client::new(&env, &tk).transfer(&depositor, &env.current_contract_address(), &amount);

        env.events().publish(
            (Symbol::new(&env, "DepositCreated"),),
            (commitment, leaf_index, amount),
        );
        Ok(leaf_index)
    }

    /// Shielded→public withdrawal with PRIVATE CHANGE (join-split, 1-in / 1-public-out / 1-change).
    ///
    /// Verifies the withdraw proof (inclusion of the spent note, its nullifier, a well-formed
    /// change commitment, value conservation `value == amount + change`, a 64-bit range on every
    /// amount, and the C1 recipient binding), spends the nullifier, and pays the PUBLIC `amount`
    /// out to `to`. When `has_change` is true it inserts the change commitment as a new private
    /// note; when false (a FULL EXIT, where the circuit forces change == 0) it inserts nothing and
    /// needs no free leaf — so a note can always be withdrawn even when the tree is full. Only
    /// `amount` is public; the change value is hidden.
    ///
    /// Public inputs (pinned order): [root, nullifier, recipient, amount, change_commitment, has_change].
    /// Emits WithdrawalCompleted; returns the change note's leaf index (0 on a full exit).
    pub fn withdraw(
        env: Env,
        proof: Proof,
        root: BytesN<32>,
        nullifier: BytesN<32>,
        recipient: BytesN<32>,
        amount: i128,
        change_commitment: BytesN<32>,
        has_change: bool,
        change_ct: Bytes,
        to: Address,
    ) -> Result<u32, Error> {
        let s = env.storage().instance();
        let vk: VerifyingKey = s.get(&DataKey::VkWithdraw).ok_or(Error::NotInitialized)?;

        // M1: reject non-positive public amounts.
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let public_inputs = vec![
            &env,
            root.clone(),
            nullifier.clone(),
            recipient.clone(),
            amount_to_fr_bytes(&env, amount),
            change_commitment.clone(),
            bool_to_fr_bytes(&env, has_change),
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

        // Only a change-keeping withdrawal needs a free leaf. A FULL EXIT (has_change == false,
        // where the circuit forces change == 0) inserts nothing, so it succeeds even when the
        // tree is full — the escape hatch that guarantees funds can never get stuck. Checked
        // before the nullifier spend so a full-tree partial withdrawal fails without burning the note.
        if has_change {
            let next: u32 = s.get(&DataKey::NextIndex).unwrap_or(0);
            if next + 1 > (1u32 << (MERKLE_DEPTH as u32)) {
                return Err(Error::TreeFull);
            }
        }

        // Spend exactly once.
        let nf_key = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nf_key) {
            return Err(Error::NullifierAlreadySpent);
        }
        env.storage().persistent().set(&nf_key, &true);
        env.storage().persistent().extend_ttl(&nf_key, 100_000, 1_000_000);

        // Insert the change note iff we're keeping change. On a full exit, emit a zero-commitment
        // sentinel so off-chain recovery knows no leaf was added (a real Poseidon commitment is
        // never zero).
        let (emitted_cm, change_leaf) = if has_change {
            (change_commitment.clone(), Self::insert_commitment(&env, &change_commitment))
        } else {
            (BytesN::from_array(&env, &[0u8; 32]), 0u32)
        };

        // Keep the contract instance live under active use (tree state, VKs, token).
        s.extend_ttl(100_000, 1_000_000);

        // Pay the public amount out.
        let tk: Address = s.get(&DataKey::Token).unwrap();
        token::Client::new(&env, &tk).transfer(&env.current_contract_address(), &to, &amount);

        // The change note's encrypted opening (empty on a full exit) so the sender can recover
        // this hidden-value note from the chain on any device. The contract never reads it.
        env.events().publish(
            (Symbol::new(&env, "WithdrawalCompleted"),),
            (nullifier, to, amount, emitted_cm, change_leaf, change_ct),
        );
        Ok(change_leaf)
    }

    /// Confidential shielded→shielded transfer (join-split, 1-in / 2-out).
    ///
    /// Verifies the transfer proof (which proves, in zero knowledge, inclusion of the spent
    /// input note, its nullifier, two well-formed output commitments, value conservation,
    /// and a 64-bit range on every amount), spends the input nullifier, and inserts BOTH
    /// output commitments (recipient + change). **No amount is revealed and NO token
    /// moves** — value stays in the pool, re-split. Public inputs (pinned order):
    /// [root, nullifier, out_commitment1, out_commitment2].
    ///
    /// The two Merkle inserts fit Stellar's per-tx compute budget because PoseidonParams
    /// deserializes the round constants + MDS once per call (see poseidon.rs), not per hash.
    pub fn transfer(
        env: Env,
        proof: Proof,
        root: BytesN<32>,
        nullifier: BytesN<32>,
        out_commitment1: BytesN<32>,
        out_commitment2: BytesN<32>,
        change_ct: Bytes,
    ) -> Result<(u32, u32), Error> {
        let s = env.storage().instance();
        let vk: VerifyingKey = s.get(&DataKey::VkTransfer).ok_or(Error::NotInitialized)?;

        let public_inputs = vec![
            &env,
            root.clone(),
            nullifier.clone(),
            out_commitment1.clone(),
            out_commitment2.clone(),
        ];
        if !verify_groth16(&env, &vk, &proof, &public_inputs) {
            return Err(Error::InvalidProof);
        }

        // Inclusion must be against a root the contract actually produced.
        if !Self::is_known_root(&env, &root) {
            return Err(Error::UnknownRoot);
        }

        // The fixed-depth tree must have room for both output commitments.
        let next: u32 = s.get(&DataKey::NextIndex).unwrap_or(0);
        if next + 2 > (1u32 << (MERKLE_DEPTH as u32)) {
            return Err(Error::TreeFull);
        }

        // Spend the input note exactly once. No address auth: the proof IS the
        // authorization (only the note owner knows the secret), and the outputs are fixed
        // commitments in the proof, so a relayer/front-runner cannot redirect value.
        let nf_key = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nf_key) {
            return Err(Error::NullifierAlreadySpent);
        }
        env.storage().persistent().set(&nf_key, &true);
        env.storage().persistent().extend_ttl(&nf_key, 100_000, 1_000_000);

        // Insert both output commitments (value never leaves the pool).
        let leaf1 = Self::insert_commitment(&env, &out_commitment1);
        let leaf2 = Self::insert_commitment(&env, &out_commitment2);

        // Keep the contract instance live under active use.
        s.extend_ttl(100_000, 1_000_000);

        // The change output's (out_commitment2) encrypted opening, so the SENDER can recover
        // their hidden-value change note from the chain on any device. out_commitment1 is the
        // recipient's note — it travels on the bearer claim link, not here. Contract never reads it.
        env.events().publish(
            (Symbol::new(&env, "TransferCompleted"),),
            (nullifier, out_commitment1, out_commitment2, leaf1, leaf2, change_ct),
        );
        Ok((leaf1, leaf2))
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

        // Deserialize the Poseidon constants ONCE for all MERKLE_DEPTH hashes of this insert.
        let params = PoseidonParams::new(env);
        let mut idx = leaf_index;
        let mut cur = fr_from_bytes(commitment);
        for d in 0..MERKLE_DEPTH {
            if idx & 1 == 0 {
                // current node is a left child: record it, hash with the zero sibling.
                frontier.set(d as u32, fr_to_bytes(&cur));
                let z = fr_from_bytes(&BytesN::from_array(env, &ZERO_HASHES[d]));
                cur = params.hash2(env, &cur, &z);
            } else {
                let left = fr_from_bytes(&frontier.get_unchecked(d as u32));
                cur = params.hash2(env, &left, &cur);
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
    // Invariant: callers must guard `amount > 0` (M1) first — a negative i128 would
    // reinterpret as a huge u128. Assert it locally so a future caller can't reintroduce the bug.
    debug_assert!(amount >= 0, "amount_to_fr_bytes requires a non-negative amount");
    let mut buf = [0u8; 32];
    let a = amount as u128; // amounts are non-negative (guarded by M1 at every call site)
    buf[16..32].copy_from_slice(&a.to_be_bytes());
    BytesN::from_array(env, &buf)
}

/// Encode a boolean flag as a 0/1 Fr scalar (a canonical public input for the `has_change` bit).
fn bool_to_fr_bytes(env: &Env, b: bool) -> BytesN<32> {
    let mut buf = [0u8; 32];
    if b {
        buf[31] = 1;
    }
    BytesN::from_array(env, &buf)
}

#[cfg(test)]
mod test;
