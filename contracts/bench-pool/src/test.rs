//! Native tests against the soroban-sdk test host. Run by:
//!   B07 → `cargo test -p bench-pool nullifier`
//!   B08 → `cargo test -p bench-pool replay`

use soroban_sdk::{BytesN, Env};

use crate::{BenchPool, BenchPoolClient};

fn nf(env: &Env, seed: u8) -> BytesN<32> {
    let mut a = [0u8; 32];
    a[31] = seed;
    BytesN::from_array(env, &a)
}

fn domain(env: &Env, seed: u8) -> BytesN<32> {
    let mut a = [0xa5u8; 32];
    a[0] = seed;
    BytesN::from_array(env, &a)
}

fn setup(env: &Env) -> BenchPoolClient<'_> {
    let id = env.register(BenchPool, ());
    BenchPoolClient::new(env, &id)
}

// ---- B07: nullifier storage --------------------------------------------------

#[test]
fn nullifier_insert_and_check() {
    let env = Env::default();
    let client = setup(&env);
    let d = domain(&env, 1);
    client.init(&d);

    let n = nf(&env, 7);
    assert!(!client.is_spent(&n), "fresh nullifier must read as unspent");
    client.spend(&n, &d);
    assert!(client.is_spent(&n), "spent nullifier must read as spent");

    // An unrelated nullifier is unaffected.
    assert!(!client.is_spent(&nf(&env, 8)));
}

#[test]
fn nullifier_double_spend_rejected() {
    let env = Env::default();
    let client = setup(&env);
    let d = domain(&env, 1);
    client.init(&d);

    let n = nf(&env, 9);
    client.spend(&n, &d);
    // Second spend of the same nullifier must be rejected (no double-spend).
    let again = client.try_spend(&n, &d);
    assert!(again.is_err(), "re-spending a nullifier must fail");
}

#[test]
fn nullifier_requires_init() {
    let env = Env::default();
    let client = setup(&env);
    // Spending before init must fail (no domain pinned).
    let res = client.try_spend(&nf(&env, 1), &domain(&env, 1));
    assert!(res.is_err(), "spend before init must fail");
}

// ---- B08: replay / domain separation ----------------------------------------

#[test]
fn replay_same_nullifier_rejected() {
    let env = Env::default();
    let client = setup(&env);
    let d = domain(&env, 1);
    client.init(&d);

    let n = nf(&env, 42);
    client.spend(&n, &d);
    // Replaying the exact same (nullifier, domain) is a double-spend → rejected.
    let replay = client.try_spend(&n, &d);
    assert!(replay.is_err(), "replaying a spend must fail");
}

#[test]
fn replay_cross_domain_rejected() {
    let env = Env::default();
    let client = setup(&env);
    let d = domain(&env, 1);
    client.init(&d);

    // A proof bound to a different deployment/domain must be rejected even though
    // the nullifier is fresh — this is the cross-deployment replay guard.
    let other = domain(&env, 2);
    let res = client.try_spend(&nf(&env, 99), &other);
    assert!(res.is_err(), "spend with a foreign domain must fail");
}

#[test]
fn replay_distinct_nullifiers_independent() {
    let env = Env::default();
    let client = setup(&env);
    let d = domain(&env, 1);
    client.init(&d);

    // Two different nullifiers under the right domain both succeed independently.
    client.spend(&nf(&env, 100), &d);
    client.spend(&nf(&env, 101), &d);
    assert!(client.is_spent(&nf(&env, 100)));
    assert!(client.is_spent(&nf(&env, 101)));
}
