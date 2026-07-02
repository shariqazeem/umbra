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
use soroban_sdk::{token, Address, Bytes, BytesN, Env, Vec};

use crate::{UmbraPool, UmbraPoolClient};
use groth16_verifier::{Proof, VerifyingKey};

const AMOUNT: i128 = 1000;
// The withdraw fixture is a join-split: pay WITHDRAW_AMT out publicly, keep the change
// (AMOUNT - WITHDRAW_AMT) as a private note in the pool. Must match circuits/scripts/gen-fixtures.ts.
const WITHDRAW_AMT: i128 = 600;
const CHANGE_AMT: i128 = AMOUNT - WITHDRAW_AMT;

fn build_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../circuits/build")
}

fn fixtures_present() -> bool {
    build_dir().join("shield_soroban.json").exists()
        && build_dir().join("withdraw_soroban.json").exists()
        && build_dir().join("transfer_soroban.json").exists()
        && build_dir().join("claim_soroban.json").exists()
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
    withdraw: Fixture,
    transfer: Fixture,
    claim: Fixture,
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
    let claim = load(&env, "claim");

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
        (
            token_addr.clone(),
            shield.vk.clone(),
            withdraw.vk.clone(),
            transfer.vk.clone(),
            claim.vk.clone(),
        ),
    );
    let client = UmbraPoolClient::new(&env, &id);

    // Shield: publics = [commitment, amount].
    let commitment = shield.publics.get_unchecked(0);
    let leaf = client.shield(&shield.proof, &commitment, &AMOUNT, &depositor);
    assert_eq!(leaf, 0);
    assert_eq!(token.balance(&id), AMOUNT, "pool holds the shielded funds");

    Ctx { env, client, token, withdraw, transfer, claim }
}

// withdraw publics = [root, nullifier, recipient, amount, change_commitment]
fn parts(f: &Fixture) -> (BytesN<32>, BytesN<32>, BytesN<32>, BytesN<32>) {
    (
        f.publics.get_unchecked(0),
        f.publics.get_unchecked(1),
        f.publics.get_unchecked(2),
        f.publics.get_unchecked(4),
    )
}

// The address the regenerated withdraw fixture is bound to (C1: recipient == field(to)).
// A contract address is used so the custom test SAC can credit it without a classic-account
// trustline; the C1 binding logic is identical for the G… payout addresses used in
// production (where the pooled asset is native XLM and no trustline is required).
const PAYEE: &str = "CCG4XWI5PQXJ22L6PCCFJU5YTPFDI7EBJKSVQ4WMI45DIHG4UPHOSIXG";
fn payee(env: &Env) -> Address {
    Address::from_string(&soroban_sdk::String::from_str(env, PAYEE))
}

// MEASUREMENT (not an assertion) — prints the real CPU cost of one Poseidon hash and a full
// transfer, so we can compute how deep the Merkle tree can go within Soroban's per-tx budget.
// Run: cargo test -p umbra-pool measure_depth_budget -- --nocapture
#[test]
fn measure_depth_budget() {
    if !fixtures_present() {
        eprintln!("SKIP measure_depth_budget: fixtures absent");
        return;
    }
    let env = Env::default();
    let a = crate::poseidon::fr_from_bytes(&b::<32>(
        &env,
        "0000000000000000000000000000000000000000000000000000000000000001",
    ));
    let c = crate::poseidon::fr_from_bytes(&b::<32>(
        &env,
        "0000000000000000000000000000000000000000000000000000000000000002",
    ));
    env.cost_estimate().budget().reset_unlimited();
    let _ = crate::poseidon::poseidon2(&env, &a, &c);
    let hash_cpu = env.cost_estimate().budget().cpu_instruction_cost();

    // Split: deserializing the constants (once per insert_commitment) vs one permutation.
    env.cost_estimate().budget().reset_unlimited();
    let params = crate::poseidon::PoseidonParams::new(&env);
    let params_cpu = env.cost_estimate().budget().cpu_instruction_cost();
    env.cost_estimate().budget().reset_unlimited();
    let _ = params.hash2(&env, &a, &c);
    let perm_cpu = env.cost_estimate().budget().cpu_instruction_cost();
    eprintln!("MEASURE params_new_cpu  = {} (deserialize constants)", params_cpu);
    eprintln!("MEASURE permutation_cpu = {} (one hash, params reused)", perm_cpu);

    let ctx = setup();
    let t = &ctx.transfer;
    let root = t.publics.get_unchecked(0);
    let nullifier = t.publics.get_unchecked(1);
    let out1 = t.publics.get_unchecked(2);
    let out2 = t.publics.get_unchecked(3);
    ctx.env.cost_estimate().budget().reset_unlimited();
    ctx.client
        .transfer(&t.proof, &root, &nullifier, &out1, &out2, &Bytes::new(&ctx.env));
    let transfer_cpu = ctx.env.cost_estimate().budget().cpu_instruction_cost();

    let depth = crate::poseidon_constants::MERKLE_DEPTH as u64;
    let inserts_cpu = 2u64 * depth * hash_cpu; // transfer does 2 inserts
    let fixed_cpu = transfer_cpu.saturating_sub(inserts_cpu); // verify + overhead
    eprintln!("MEASURE poseidon2_cpu   = {}", hash_cpu);
    eprintln!("MEASURE transfer_cpu    = {} (depth {})", transfer_cpu, depth);
    eprintln!("MEASURE fixed_cpu       = {} (verify + overhead)", fixed_cpu);
    // Soroban per-tx CPU limit is 100_000_000. With a 10% margin (90M):
    let limit = 90_000_000u64;
    if hash_cpu > 0 {
        let max_d_2insert = (limit.saturating_sub(fixed_cpu)) / (2 * hash_cpu);
        let max_d_1insert = (limit.saturating_sub(fixed_cpu)) / hash_cpu;
        eprintln!("MEASURE max depth @ 2 inserts (today)      = {}", max_d_2insert);
        eprintln!("MEASURE max depth @ 1 batched insert       = {}", max_d_1insert);
    }
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
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
    let to = payee(&ctx.env);

    let before = ctx.client.next_index();
    let change_leaf =
        ctx.client
            .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to);

    assert_eq!(ctx.token.balance(&to), WITHDRAW_AMT, "recipient received the public amount");
    assert_eq!(
        ctx.token.balance(&ctx.client.address),
        CHANGE_AMT,
        "the change value stays in the pool"
    );
    assert_eq!(change_leaf, before, "change note inserted at the next slot");
    assert_eq!(ctx.client.next_index(), before + 1, "one change commitment inserted");
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
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);

    // Attacker observes the proof and tries to redirect the payout to themselves.
    let attacker = Address::generate(&ctx.env);
    let stolen = ctx.client.try_withdraw(
        &ctx.withdraw.proof, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &attacker,
    );
    assert!(stolen.is_err(), "a proof bound to payee P must not pay a different address");
    assert!(!ctx.client.is_spent(&nullifier), "a rejected redirect must not burn the nullifier");

    // The real (bound) payee can still withdraw.
    let to = payee(&ctx.env);
    ctx.client
        .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to);
    assert_eq!(ctx.token.balance(&to), WITHDRAW_AMT, "the bound payee is paid");
}

// Confidential transfer (1-insert): spend the input note; only the change (out2) is inserted,
// the recipient note (out1) is recorded pending. Amounts hidden, no token moves.
#[test]
fn confidential_transfer_works() {
    if !fixtures_present() {
        eprintln!("SKIP confidential_transfer: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let t = &ctx.transfer;
    // transfer publics = [root, nullifier, outCommitment1, outCommitment2]
    let root = t.publics.get_unchecked(0);
    let nullifier = t.publics.get_unchecked(1);
    let out1 = t.publics.get_unchecked(2);
    let out2 = t.publics.get_unchecked(3);

    let before = ctx.client.next_index();
    let leaf2 = ctx.client.transfer(&t.proof, &root, &nullifier, &out1, &out2, &Bytes::new(&ctx.env));
    assert_eq!(leaf2, before, "the change (out2) is inserted at the next slot");
    assert_eq!(ctx.client.next_index(), before + 1, "ONLY the change is inserted (1-insert transfer)");
    assert!(ctx.client.is_spent(&nullifier), "the input note's nullifier is spent");
    // No token moved — the pool still holds exactly the shielded amount.
    assert_eq!(ctx.token.balance(&ctx.client.address), AMOUNT, "value stays in the pool");

    // Double-spend of the same input note is rejected.
    let again = ctx.client.try_transfer(&t.proof, &root, &nullifier, &out1, &out2, &Bytes::new(&ctx.env));
    assert!(again.is_err(), "reusing the spent nullifier must fail");
}

// Register-on-claim: after a transfer pends the recipient note (out1), the recipient proves its
// opening and claim_insert adds it to the tree. Claiming a NON-pending commitment (no backing
// spend) is rejected — this is what prevents minting notes from nothing (inflation).
#[test]
fn claim_insert_works() {
    if !fixtures_present() {
        eprintln!("SKIP claim_insert: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let t = &ctx.transfer;
    let root = t.publics.get_unchecked(0);
    let nullifier = t.publics.get_unchecked(1);
    let out1 = t.publics.get_unchecked(2);
    let out2 = t.publics.get_unchecked(3);
    // claim publics = [commitment]; the fixture's commitment IS the transfer's out1.
    let commitment = ctx.claim.publics.get_unchecked(0);
    assert_eq!(commitment, out1, "claim fixture must open the transfer's recipient note");

    // Before any transfer, out1 is NOT pending → a claim (that would mint value) is rejected.
    let no_backing =
        ctx.client.try_claim_insert(&ctx.claim.proof, &commitment, &Bytes::new(&ctx.env));
    assert!(no_backing.is_err(), "claiming a non-pending commitment must fail (no inflation)");

    // Do the transfer → out1 becomes pending; only out2 (change) is inserted.
    let leaf2 = ctx.client.transfer(&t.proof, &root, &nullifier, &out1, &out2, &Bytes::new(&ctx.env));

    // Now the recipient claims out1 → it is inserted at the next slot.
    let leaf1 = ctx.client.claim_insert(&ctx.claim.proof, &commitment, &Bytes::new(&ctx.env));
    assert_eq!(leaf1, leaf2 + 1, "the claimed note is inserted after the change");
    assert_eq!(ctx.client.next_index(), leaf2 + 2, "both notes now in the tree");

    // Double-claim is rejected (the pending flag was consumed).
    let again = ctx.client.try_claim_insert(&ctx.claim.proof, &commitment, &Bytes::new(&ctx.env));
    assert!(again.is_err(), "a note can be claimed only once");
}

#[test]
fn double_spend_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP double_spend: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
    let to = payee(&ctx.env);

    ctx.client
        .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to);
    // Second spend of the same nullifier must fail.
    let again = ctx.client.try_withdraw(
        &ctx.withdraw.proof, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to,
    );
    assert!(again.is_err(), "double spend must be rejected");
}

// BLS12-381 scalar field modulus r (big-endian) = FR_NEG_ONE + 1.
const FR_MODULUS: [u8; 32] = [
    0x73, 0xed, 0xa7, 0x53, 0x29, 0x9d, 0x7d, 0x48, 0x33, 0x39, 0xd8, 0x08, 0x09, 0xa1, 0xd8, 0x05,
    0x53, 0xbd, 0xa4, 0x02, 0xff, 0xfe, 0x5b, 0xfe, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01,
];

// Big-endian 32-byte addition (wrapping). For our use (n < r, plus r, n + r < 2^256) there is
// no wraparound, so out == n + r exactly.
fn be_add(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut carry = 0u16;
    let mut i = 32;
    while i > 0 {
        i -= 1;
        let s = a[i] as u16 + b[i] as u16 + carry;
        out[i] = (s & 0xff) as u8;
        carry = s >> 8;
    }
    out
}

// Critical #2 — a non-canonical nullifier alias (n + r) must NOT bypass the double-spend
// guard. Soroban's Fr::from_bytes reduces mod r, so n and n+r are the SAME scalar (the proof
// verifies for both) but DIFFERENT raw bytes; the pool keys the nullifier set on raw bytes.
// Without the verifier's canonical-input check, replaying a spent proof with n+r would pay out
// a second time (theft). The verifier must reject n+r as a non-canonical public input.
#[test]
fn noncanonical_nullifier_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP noncanonical_nullifier: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
    let to = payee(&ctx.env);

    // Legit spend with the canonical nullifier n.
    ctx.client
        .withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to);

    // Remove the insufficient-balance excuse (Fable-5 re-audit finding): fund the pool so a
    // wrongly-accepted replay would ACTUALLY have funds to pay a second time. Now the ONLY
    // thing that can stop the double payout is the verifier's canonical-input gate — so this
    // test genuinely PINS the fix (it fails if the gate is removed), rather than passing merely
    // because the pool ran dry on the change-keeping first spend.
    token::StellarAssetClient::new(&ctx.env, &ctx.token.address).mint(&ctx.client.address, &WITHDRAW_AMT);

    // n' = n + r reduces to the same scalar (proof still verifies against it) but is a
    // DIFFERENT 32-byte key. It must be rejected, NOT treated as a fresh unspent nullifier.
    let alias = BytesN::from_array(&ctx.env, &be_add(&nullifier.to_array(), &FR_MODULUS));
    let replay = ctx
        .client
        .try_withdraw(&ctx.withdraw.proof, &root, &alias, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to);
    assert!(replay.is_err(), "non-canonical nullifier alias (n+r) must be rejected, not double-spent");
    assert_eq!(ctx.token.balance(&to), WITHDRAW_AMT, "no second payout — the canonical gate rejected the alias");
}

#[test]
fn invalid_proof_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP invalid_proof: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);

    // Tamper one byte of proof.a → the on-chain pairing check must fail.
    let mut a = ctx.withdraw.proof.a.to_array();
    a[40] ^= 0x01;
    let bad = Proof {
        a: BytesN::from_array(&ctx.env, &a),
        b: ctx.withdraw.proof.b.clone(),
        c: ctx.withdraw.proof.c.clone(),
    };
    let res = ctx.client.try_withdraw(&bad, &root, &nullifier, &recipient, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to);
    assert!(res.is_err(), "tampered proof must be rejected on-chain");
}

#[test]
fn wrong_recipient_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP wrong_recipient: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);

    // Use a DIFFERENT bound recipient than the proof was generated for. The public
    // input no longer matches the proof → verification fails (recipient binding).
    let mut r = recipient.to_array();
    r[31] ^= 0x01;
    let wrong = BytesN::from_array(&ctx.env, &r);

    let res = ctx.client.try_withdraw(
        &ctx.withdraw.proof, &root, &nullifier, &wrong, &WITHDRAW_AMT, &change, &true, &Bytes::new(&ctx.env), &to,
    );
    assert!(res.is_err(), "a proof bound to recipient R must not pay recipient R'");
}

#[test]
fn amount_mismatch_rejected() {
    if !fixtures_present() {
        eprintln!("SKIP amount_mismatch: proof fixtures absent");
        return;
    }
    let ctx = setup();
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
    let to = Address::generate(&ctx.env);

    // The proof binds `amount` as a public input (conservation: amount + change == value).
    // Asking to withdraw a DIFFERENT amount changes the public input → verification fails,
    // so a proof for amount A can never authorize withdrawing A+1.
    let res = ctx.client.try_withdraw(
        &ctx.withdraw.proof, &root, &nullifier, &recipient, &(WITHDRAW_AMT + 1), &change, &true, &Bytes::new(&ctx.env), &to,
    );
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
    let (root, nullifier, recipient, change) = parts(&ctx.withdraw);
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
            ctx.client
                .try_withdraw(&ctx.withdraw.proof, &root, &nullifier, &recipient, &bad, &change, &true, &Bytes::new(&ctx.env), &to)
                .is_err(),
            "withdraw must reject non-positive amount"
        );
    }
}

// M2 — a shield is rejected once the fixed-depth tree is full (depth 6 → 64 leaves).
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

    // Force NextIndex to capacity (2^6 = 64) without needing 64 real proofs.
    let id = ctx.client.address.clone();
    ctx.env.as_contract(&id, || {
        ctx.env.storage().instance().set(&crate::DataKey::NextIndex, &64u32);
    });

    let res = ctx.client.try_shield(&shield.proof, &commitment, &AMOUNT, &depositor);
    assert!(res.is_err(), "shield must be rejected when the tree is full");
}

// Critical #1 — a FULL EXIT (has_change == false, change == 0) inserts NO leaf, so a note can
// be withdrawn even when the Merkle tree is completely full. This is the escape hatch that
// guarantees pooled funds can never get permanently stuck.
#[test]
fn full_exit_works_when_tree_full() {
    if !fixtures_present() || !build_dir().join("withdraw_exit_soroban.json").exists() {
        eprintln!("SKIP full_exit: full-exit fixture absent (run build-slice.sh)");
        return;
    }
    let ctx = setup();
    let exit = load(&ctx.env, "withdraw_exit");
    // exit publics = [root, nullifier, recipient, amount(=AMOUNT), changeCommitment, has_change(=0)]
    let root = exit.publics.get_unchecked(0);
    let nullifier = exit.publics.get_unchecked(1);
    let recipient = exit.publics.get_unchecked(2);
    let change = exit.publics.get_unchecked(4);
    let to = payee(&ctx.env);

    // Force the tree to capacity. A change-keeping withdraw or a transfer would now revert
    // with TreeFull; the full exit must still succeed.
    let id = ctx.client.address.clone();
    ctx.env.as_contract(&id, || {
        ctx.env.storage().instance().set(&crate::DataKey::NextIndex, &64u32);
    });

    let leaf = ctx
        .client
        .withdraw(&exit.proof, &root, &nullifier, &recipient, &AMOUNT, &change, &false, &Bytes::new(&ctx.env), &to);
    assert_eq!(leaf, 0, "a full exit inserts no leaf (returns the 0 sentinel)");
    assert_eq!(ctx.token.balance(&to), AMOUNT, "the whole note is paid out at a full tree");
    assert_eq!(ctx.client.next_index(), 64, "no leaf was inserted");
    assert_eq!(ctx.token.balance(&ctx.client.address), 0, "pool paid out");
    assert!(ctx.client.is_spent(&nullifier), "the note is spent");

    // And a change-keeping withdraw at a full tree is correctly rejected (needs a free leaf).
    let full = load(&ctx.env, "withdraw");
    let (r2, n2, rec2, ch2) = parts(&full);
    let partial = ctx
        .client
        .try_withdraw(&full.proof, &r2, &n2, &rec2, &WITHDRAW_AMT, &ch2, &true, &Bytes::new(&ctx.env), &payee(&ctx.env));
    assert!(partial.is_err(), "a change-keeping withdraw must still fail when the tree is full");
}
