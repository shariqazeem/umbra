#![no_std]
//! bench-pool — the storage-and-replay core of the Umbra pool, isolated for
//! benchmarking. It contains the parts whose CORRECTNESS is independent of the
//! BLS verifier: the spent-nullifier set, domain separation, and double-spend
//! rejection. These are validated natively against the soroban-sdk test host by
//! benchmarks B07 (nullifier storage) and B08 (replay protection) — no testnet
//! required — so the security-critical assumptions are checked before any UI exists.
//!
//! NOTE: a production pool also verifies a Groth16 proof (see ../groth16-verifier)
//! before reaching this logic; that path is validated on testnet by B04. Here we
//! exercise the state machine in isolation.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, BytesN, Env};

/// Persistent nullifiers must outlive any practical spend horizon. We bump TTL on
/// every write; the absolute values here are conservative benchmark defaults.
const NULLIFIER_TTL_THRESHOLD: u32 = 100_000;
const NULLIFIER_TTL_EXTEND: u32 = 1_000_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    DomainMismatch = 3,
    NullifierAlreadySpent = 4,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Domain separator H(chain_id ‖ contract_id) — replay/cross-deployment guard.
    Domain,
    /// Membership marker for a spent nullifier.
    Nullifier(BytesN<32>),
}

#[contract]
pub struct BenchPool;

#[contractimpl]
impl BenchPool {
    /// One-time setup: pin the domain separator this pool accepts proofs for.
    pub fn init(env: Env, domain: BytesN<32>) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Domain) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Domain, &domain);
        Ok(())
    }

    /// Attempt to spend a note by its nullifier.
    ///
    /// Enforces, in order: pool is initialized; the proof's domain matches this
    /// deployment (cross-deployment replay guard); the nullifier has not already
    /// been spent (double-spend guard). On success the nullifier is recorded
    /// permanently and its TTL extended.
    pub fn spend(env: Env, nullifier: BytesN<32>, domain: BytesN<32>) -> Result<(), Error> {
        let expected: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::Domain)
            .ok_or(Error::NotInitialized)?;

        if expected != domain {
            return Err(Error::DomainMismatch);
        }

        let key = DataKey::Nullifier(nullifier);
        if env.storage().persistent().has(&key) {
            return Err(Error::NullifierAlreadySpent);
        }

        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, NULLIFIER_TTL_THRESHOLD, NULLIFIER_TTL_EXTEND);
        Ok(())
    }

    /// Whether a nullifier is recorded as spent.
    pub fn is_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier))
    }
}

#[cfg(test)]
mod test;
