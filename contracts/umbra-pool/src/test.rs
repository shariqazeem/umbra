//! End-to-end tests for the Umbra pool, run natively against the soroban-sdk test
//! host — which executes the REAL BLS12-381 host functions, so the Groth16 proofs
//! are genuinely verified (not stubbed). Proof fixtures are produced by
//! `circuits/scripts/build-slice.sh`. If they are absent the tests skip (so the
//! crate still builds without the circom toolchain).
//!
//!   1. happy path           — shield then withdraw; recipient is paid, nullifier spent
//!   2. double-spend attempt  — second withdraw of the same nullifier is rejected
//!   3. invalid-proof attempt — a tampered proof is rejected on-chain
//!   4. wrong-recipient attempt — a proof bound to recipient R can't pay recipient R'

use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, BytesN, Env, Vec};

use crate::{UmbraPool, UmbraPoolClient};
use groth16_verifier::{Proof, VerifyingKey};

const AMOUNT: i128 = 1000;

fn build_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../circuits/build")
}

fn fixtures_present() -> bool {
    build_dir().join("shield_soroban.json").exists()
        && build_dir().join("withdraw_soroban.json").exists()
        && build_dir().join("transfer_soroban.json").exists()
}

fn b<const N: usize>(env: &Env, h: &str) -> BytesN<N> {
    let v = hex::decode(h).expect("hex");
    let a: [u8; N] = v.try_into().expect("length");
    BytesN::from_array(env, &a)
}

struct Fixture {
    vk: VerifyingKey,
    proof: Proof,
    publics: Vec<BytesN<32>>,
}

fn load(env: &Env, name: &str) -> Fixture {
    let path = build_dir().join(format!("{name}_soroban.json"));
    let s = std::fs::read_to_string(&path).expect("fixture missing — run circuits/scripts/build-slice.sh");
    let j: serde_json::Value = serde_json::from_str(&s).unwrap();

    let vkj = &j["vk"];
    let mut ic: Vec<BytesN<96>> = Vec::new(env);
    for e in vkj["ic"].as_array().unwrap() {
        ic.push_back(b::<96>(env, e.as_str().unwrap()));
    }
    let vk = VerifyingKey {
        alpha: b::<96>(env, vkj["alpha"].as_str().unwrap()),
        beta: b::<192>(env, vkj["beta"].as_str().unwrap()),
        gamma: b::<192>(env, vkj["gamma"].as_str().unwrap()),
        delta: b::<192>(env, vkj["delta"].as_str().unwrap()),
        ic,
    };
    let pj = &j["proof"];
    let proof = Proof {
        a: b::<96>(env, pj["a"].as_str().unwrap()),
        b: b::<192>(env, pj["b"].as_str().unwrap()),
        c: b::<96>(env, pj["c"].as_str().unwrap()),
    };
    let mut publics: Vec<BytesN<32>> = Vec::new(env);
    for e in j["publicInputs"].as_array().unwrap() {
        publics.push_back(b::<32>(env, e.as_str().unwrap()));
    }
    Fixture { vk, proof, publics }
}

struct Ctx<'a> {
    env: Env,
    client: UmbraPoolClient<'a>,
    token: token::TokenClient<'a>,
    depositor: Address,
    withdraw: Fixture,
    transfer: Fixture,
}

/// Register the pool + a test asset, init with both VKs, mint to a depositor, and
/// shield the slice note so the on-chain tree holds it at index 0.
fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();

    let shield = load(&env, "shield");
    let withdraw = load(&env, "withdraw");
    let transfer = load(&env, "transfer");

    // Test asset.
    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);
    let token = token::TokenClient::new(&env, &token_addr);

    let depositor = Address::generate(&env);
    token_admin.mint(&depositor, &AMOUNT);

    // Pool — initialized atomically via the constructor (H1: no separate init call).
    let id = env.register(
        UmbraPool,
        (token_addr.clone(), shield.vk.clone(), withdraw.vk.clone(), transfer.vk.clone()),
    );
    let client = UmbraPoolClient::new(&env, &id);

    // Shield: publics = [commitment, amount].
    let commitment = shield.publics.get_unchecked(0);
    let leaf = client.shield(&shield.proof, &commitment, &AMOUNT, &depositor);
    assert_eq!(leaf, 0);
    assert_eq!(token.balance(&id), AMOUNT, "pool holds the shielded funds");

    Ctx { env, client, token, depositor, withdraw, transfer }
}

// withdraw publics = [root, nullifier, recipient, amount]
fn parts(f: &Fixture) -> (BytesN<32>, BytesN<32>, BytesN<32>) {
    (f.publics.get_unchecked(0), f.publics.get_unchecked(1), f.publics.get_unchecked(2))
}

// The address the regenerated withdraw fixture is bound to (C1: recipient == field(to)).
// A contract address is used so the custom test SAC can credit it without a classic-account
// trustline; the C1 binding logic is identical for the G… payout addresses used in
// production (where the pooled asset is native XLM and no trustline is required).
const PAYEE: &str = "CCG4XWI5PQXJ22L6PCCFJU5YTPFDI7EBJKSVQ4WMI45DIHG4UPHOSIXG";
fn payee(env: &Env) -> Address {
    Address::from_string(&soroban_sdk::String::from_str(env, PAYEE))
}

/// The on-chain Poseidon MUST match the TS/circuit Poseidon, or contract roots will
/// never equal wallet/circuit roots. Oracle from @umbra/crypto-bls gen-rust-constants.
#[test]
fn poseidon_matches_ts_oracle() {
    let env = Env::default();
    let one = crate::poseidon::fr_from_bytes(&b::<32>(
        &env,
        "0000000000000000000000000000000000000000000000000000000000000001",
    ));
    let two = crate::poseidon::fr_from_bytes(&b::<32>(
        &env,
        "0000000000000000000000000000000000000000000000000000000000000002",
    ));
    let got = crate::poseidon::fr_to_bytes(&crate::poseidon::poseidon2(&env, &one, &two));
    let expected = b::<32>(&env, "58868e1855a423fefce9235dfb1a35c7c26b82805c218dc0de7ca4a9a4d4cce7");
    assert_eq!(got, expected, "Rust Poseidon must equal the TS/circuit Poseidon");
}

#[test]
fn happy_path_shield_then_withdraw() {
    if !fixtures_present() {
        eprintln!("SKIP happy_path: proof fixtures absent (run build-slice.sh)");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);
    let to = payee(&ctx.env);

    ctx.client
        .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &AMOUNT, &to);

    assert_eq!(ctx.token.balance(&to), AMOUNT, "recipient received the funds");
    assert_eq!(ctx.token.balance(&ctx.client.address), 0, "pool drained");
    assert!(ctx.client.is_spent(&nullifier), "nullifier marked spent");
}

// C1 — a withdrawal proof bound to payee P cannot be redirected to another address
// (front-running theft), and a failed redirect does not burn the nullifier.
#[test]
fn wrong_payee_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP wrong_payee: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);

    // Attacker observes the proof and tries to redirect the payout to themselves.
    let attacker = Address::generate(&ctx.env);
    let stolen = ctx
        .client
        .try_withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &AMOUNT, &attacker);
    assert!(stolen.is_err(), "a proof bound to payee P must not pay a different address");
    assert!(!ctx.client.is_spent(&nullifier), "a rejected redirect must not burn the nullifier");

    // The real (bound) payee can still withdraw.
    let to = payee(&ctx.env);
    ctx.client
        .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &AMOUNT, &to);
    assert_eq!(ctx.token.balance(&to), AMOUNT, "the bound payee is paid");
}

// Confidential transfer: spend the input note into two output commitments. Amounts are
// hidden (no amount is a public input), value never leaves the pool, and the chain sees
// only a spent nullifier + two new commitments.
#[test]
fn confidential_transfer_works() {
    if !fixtures_present() {
        eprintln!("SKIP confidential_transfer: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let t = &ctx.transfer;
    // transfer publics = [root, nullifier, outCommitment]
    let root = t.publics.get_unchecked(0);
    let nullifier = t.publics.get_unchecked(1);
    let out = t.publics.get_unchecked(2);

    let before = ctx.client.next_index();
    let leaf = ctx.client.transfer(&t.proof, &root, &nullifier, &out);
    assert_eq!(leaf, before, "output inserted at the next slot");
    assert_eq!(ctx.client.next_index(), before + 1, "one output commitment inserted");
    assert!(ctx.client.is_spent(&nullifier), "the input note's nullifier is spent");
    // No token moved — the pool still holds exactly the shielded amount.
    assert_eq!(ctx.token.balance(&ctx.client.address), AMOUNT, "value stays in the pool");

    // Double-spend of the same input note is rejected.
    let again = ctx.client.try_transfer(&t.proof, &root, &nullifier, &out);
    assert!(again.is_err(), "reusing the spent nullifier must fail");
}

#[test]
fn double_spend_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP double_spend: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);
    let to = payee(&ctx.env);

    ctx.client
        .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &AMOUNT, &to);
    // Second spend of the same nullifier must fail.
    let again = ctx
        .client
        .try_withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &AMOUNT, &to);
    assert!(again.is_err(), "double spend must be rejected");
}

#[test]
fn invalid_proof_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP invalid_proof: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);

    // Tamper one byte of proof.a → the on-chain pairing check must fail.
    let mut a = ctx.withdraw.proof.a.to_array();
    a[40] ^= 0x01;
    let bad = Proof {
        a: BytesN::from_array(&ctx.env, &a),
        b: ctx.withdraw.proof.b.clone(),
        c: ctx.withdraw.proof.c.clone(),
    };
    let res = ctx.client.try_withdraw(&bad, &root, &nullifier, &recipient, &AMOUNT, &to);
    assert!(res.is_err(), "tampered proof must be rejected on-chain");
}

#[test]
fn wrong_recipient_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP wrong_recipient: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);

    // Use a DIFFERENT bound recipient than the proof was generated for. The public
    // input no longer matches the proof → verification fails (recipient binding).
    let mut r = recipient.to_array();
    r[31] ^= 0x01;
    let wrong = BytesN::from_array(&ctx.env, &r);

    let res = ctx.client.try_withdraw(&ctx.withdraw.proof, &root, &nullifier, &wrong, &AMOUNT, &to);
    assert!(res.is_err(), "a proof bound to recipient R must not pay recipient R'");
}

#[test]
fn amount_mismatch_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP amount_mismatch: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);

    // The proof binds `amount` as a public input (amount conservation: amount == value).
    // Asking to withdraw a DIFFERENT amount changes the public input → verification fails,
    // so a proof for amount A can never authorize withdrawing A+1.
    let res = ctx
        .client
        .try_withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &(AMOUNT + 1), &to);
    assert!(res.is_err(), "a proof for amount A must not authorize withdrawing A+1");
}

// M1 — non-positive amounts are rejected before any token movement.
#[test]
fn nonpositive_amount_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP nonpositive_amount: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);
    let shield = load(&ctx.env, "shield");
    let commitment = shield.publics.get_unchecked(0);
    let depositor = Address::generate(&ctx.env);

    for bad in [0i128, -1i128, -1000i128] {
        assert!(
            ctx.client.try_shield(&shield.proof, &commitment, &bad, &depositor).is_err(),
            "shield must reject non-positive amount"
        );
        assert!(
            ctx.client.try_withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &bad, &to).is_err(),
            "withdraw must reject non-positive amount"
        );
    }
}

// M2 — a shield is rejected once the fixed-depth tree is full (depth 8 → 256 leaves).
#[test]
fn tree_full_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP tree_full: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let shield = load(&ctx.env, "shield");
    let commitment = shield.publics.get_unchecked(0);
    let depositor = Address::generate(&ctx.env);

    // Force NextIndex to capacity (2^8 = 256) without needing 256 real proofs.
    let id = ctx.client.address.clone();
    ctx.env.as_contract(&id, || {
        ctx.env.storage().instance().set(&crate::DataKey::NextIndex, &256u32);
    });

    let res = ctx.client.try_shield(&shield.proof, &commitment, &AMOUNT, &depositor);
    assert!(res.is_err(), "shield must be rejected when the tree is full");
}
