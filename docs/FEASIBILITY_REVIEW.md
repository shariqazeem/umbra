# Umbra — Technical Feasibility Review

> Pre-implementation cryptographic and protocol review. The question is not "is
> this a good idea" — it is "will every cryptographic and Stellar assumption hold
> when we build it." Treated as a design review before a $10M investment:
> assumptions are challenged, numbers are sourced, and where a number cannot be
> sourced it is labelled as an unvalidated estimate that **must** be benchmarked
> before code is written.

**Evidence convention used throughout:**

- `[MEASURED]` — a concrete number from a primary source (cited in §Evidence).
- `[ESTIMATE]` — engineering judgement, not yet measured. Treat as a hypothesis.
- `[BENCHMARK]` — unknown; gates the build. Must be measured in the Day-0 spike.

---

## Executive verdict (read this first)

**The architecture is feasible, and — critically — it is no longer speculative.**
Stellar's own ecosystem team has already shipped a *Prototyping Privacy Pools on
Stellar* implementation using the identical primitive stack: Poseidon over
BLS12-381, Groth16, Circom + snarkjs, a `circom2soroban` converter, and on-chain
verification via the Protocol 22 BLS12-381 host functions. The two hardest
"will-it-even-work" questions are therefore answered by prior art, not by us.

What that prototype **left unsolved is precisely what Umbra's architecture already
specifies** — recipient binding in the proof (their `main.circom` explicitly does
not implement it) and a ring of historical roots for concurrent operations. We are
not ahead of the curve on the easy parts and behind on the hard parts; it is the
reverse.

| Area | Verdict | The one thing that can kill it |
|------|---------|--------------------------------|
| 1. On-chain Groth16 verification | 🟢 **Proven** | Verify is ~40M/100M instr. The *full spend tx* (verify + MSM + 2 SAC + storage) margin is the real risk. |
| 2. Circom/snarkjs compatibility | 🟢 **Proven** | Poseidon constants must be regenerated for BLS12-381 `Fr`. Non-negotiable correctness item. |
| 3. Trusted setup | 🟡 **Solvable** | No convenient BLS12-381 Powers-of-Tau exists; we must run our own Phase 1. |
| 4. Merkle / circuit size | 🟡 **Solvable** | In-circuit insertion roughly doubles hashing → proving time. |
| 5. Browser proving | 🟡 **Desktop yes, mobile no** | Spend witness contains secrets → **cannot** be offloaded. Mobile OOM is unsolved. |
| 6. Soroban state model | 🟡 **Solvable, with two traps** | Nullifier **archival-replay** semantics + event **retention window** for recovery. |
| 7. Security | 🟢 **No fund-theft vector found** | Soundness rests entirely on the trusted setup; one Soroban-specific replay subtlety. |
| 8. Scale to 100k | 🔴 **Needs redesign** | Serialized insertion + full-stream note scanning are hard walls. |

**Bottom line up front:** build the hackathon MVP; the on-chain ZK thesis is
sound and de-risked by prior art. But the most ambitious feature — *in-pool
private peer-to-peer transfer* — is also the one feature that forces the
verify-and-insert budget collision and the heavy circuit. The mixer core
(shield → private withdraw) is proven and cheap; the join-split transfer is the
part to treat as the ambitious, separately-de-risked target. See §9.

---

## 1. Stellar verification feasibility

**Verdict: 🟢 Valid and proven in production-grade prototypes. The proposed
verifier architecture is correct as specified.**

### Available host functions `[MEASURED]`

Protocol 22 (mainnet 2024-12-05, CAP-0059) added the BLS12-381 host functions.
Confirmed signatures:

```
G1:   bls12_381_g1_add, _g1_mul, _g1_msm, _map_fp_to_g1, _hash_to_g1
G2:   bls12_381_g2_add, _g2_mul, _g2_msm, _map_fp2_to_g2, _hash_to_g2
Pair: bls12_381_multi_pairing_check(vp1: Vec<G1>, vp2: Vec<G2>) -> bool
Fr:   bls12_381_fr_add, _fr_sub, _fr_mul, _fr_pow, _fr_inv
```

This is exactly the instruction set the verifier in our architecture assumed.
`multi_pairing_check` returns `true` iff `∏ e(vp1[i], vp2[i]) == 1_fp12` — which is
the Groth16 verification equation in product form, in one host call. **The verifier
architecture is valid as written.**

Three facts materially de-risk the verifier and were *not* assumptions we could
rely on before this review:

- **Subgroup checks are automatic.** `[MEASURED]` Every host function errors if an
  input point is not in the correct subgroup. The classic SNARK-verifier footgun —
  an attacker submitting an off-subgroup `A`/`B`/`C` to break soundness — is closed
  *by the host*, not by our contract. We still document it, but we do not have to
  implement it.
- **Serialization is fixed and known.** `[MEASURED]` G1 = 96 bytes, G2 = 192 bytes,
  **uncompressed, big-endian**; a compression flag is an error. Our `vk`/proof
  encoder must target this exactly.
- **An official reference verifier exists.** `stellar/soroban-examples/groth16_verifier`
  is a BLS12-381 Groth16 verifier consuming Circom/snarkjs `proof.json`,
  `verification_key.json`, `public.json` (circom 2.2.1). It is explicitly
  demo-only / unaudited, but it proves the path end to end.

### Expected instruction cost — the actual risk `[MEASURED] + [BENCHMARK]`

This is the number that matters and it is now sourced. Stellar's privacy-pools
prototype: **Groth16 verification ≈ 40,000,000 instructions ≈ 40% of the 100M
per-transaction budget** (testnet).

Two things follow, and the second is the real finding:

1. **A single verification fits comfortably.** Groth16 verification cost is
   *constant in circuit size* — it depends only on the pairing (fixed) and the
   public-input MSM (linear in #public-inputs), **not** on the number of
   constraints. So Umbra's far larger join-split circuit verifies at essentially
   the same ~40M as the prototype's simple mixer. Circuit complexity is paid by the
   *prover*, not the chain. This is a crucial and favourable asymmetry.

2. **The risk is not the verify — it is the rest of the `spend` transaction.**
   Umbra's `spend` does, in one atomic transaction: verify (~40M) + a G1 MSM over
   ~15 public inputs + point decodes + 2 nullifier writes + root-ring/frontier
   writes + **up to two SAC transfers** (unshield payout + relayer fee). Estimated
   budget:

   | Component | Cost | Basis |
   |-----------|------|-------|
   | `multi_pairing_check` (4-term) | ~40M | `[MEASURED]` (prototype) |
   | `g1_msm` over ~15 IC points | ~5–15M | `[ESTIMATE]`, MSM is linear in length |
   | Point decodes (A,B,C + vk) | ~few M | `[ESTIMATE]` |
   | 2× SAC `transfer` (unshield + fee) | ~10–20M | `[ESTIMATE]`, each SAC call is millions |
   | Storage (2 nullifiers, root, frontier) | ~few M | `[ESTIMATE]` |
   | **Total `spend`** | **~60–80M** | `[BENCHMARK]` |

   ~60–80M is **under** 100M but inside the caution band — and developer reports
   describe transactions hanging around 80–96M instructions, so the *practical*
   ceiling is below the nominal one. **The single most important Day-0 benchmark is
   a full `spend` transaction — verify + MSM + two SAC transfers + storage — end to
   end, measured.** If it lands at 60M we have margin; if it lands at 85M we must
   shed work (drop the in-tx fee transfer, reduce public inputs, or decouple
   insertion).

### Storage costs, protocol dependencies, known limitations

- **Protocol dependency:** requires Protocol ≥ 22. Satisfied on mainnet since
  2024-12. Confirm the *mainnet* instruction budget matches the testnet 100M used
  in the prototype's "40%" figure `[BENCHMARK]`.
- **Resource-entry limits:** `[MEASURED]` SLP-0001 (2025-01-22) raised limits to
  100 ledger-entry reads / 50 writes per transaction. Umbra `spend` writes ~4
  entries — no pressure there.
- **Known limitation:** `Fr` arithmetic is available as host functions but each is
  an individual metered call. Computing Poseidon on-chain (hundreds of `fr_mul`s
  per hash, ×20 per Merkle insert) would compete directly with the 40M verify for
  the same 100M budget. This is the empirical justification for the architecture's
  "contract computes zero hashes" rule (K3) — see §4.

**Conclusion:** the verifier architecture is valid and proven. The open question is
margin on the composite `spend` transaction, which is measurable on Day 0.

---

## 2. Circom compatibility review

**Verdict: 🟢 Compatible. snarkjs/Circom → Soroban is a solved pipeline, with one
mandatory correctness task and two encoding tasks.**

### Curve & proving-system assumptions `[MEASURED]`

- Circom compiles to BLS12-381 via `--prime bls12381`.
- snarkjs supports BLS12-381 end to end: `powersoftau new bls12381 …`, `groth16
  setup/prove/verify`. The proof/vk shapes (π = G1,G2,G1; vk = α∈G1, β,γ,δ∈G2,
  IC∈G1[]) are exactly what the Soroban verifier consumes.
- A `circom2soroban` converter already exists (built for the privacy-pools
  prototype) to serialize snarkjs JSON into the Soroban byte layout. We either
  reuse it or reimplement its logic — but the problem is solved, not open.

### Incompatibilities and required work — be precise

1. **Poseidon constants MUST be regenerated for BLS12-381 `Fr`. `[MEASURED-risk]`**
   circomlib's Poseidon (and EdDSA, comparators) ship constants computed for
   **BN254**'s scalar field. Reusing them under BLS12-381 is not "slightly wrong" —
   it is cryptographically invalid (round constants / MDS matrix are
   field-specific). This is the single highest-probability *silent* failure in the
   whole project: it will still compile, still prove, still verify against its own
   wrong `vk`, and be insecure. **Action:** generate Poseidon parameters for
   BLS12-381 `Fr` and pin them with cross-implementation test vectors
   (circom witness ↔ Rust ↔ TS) before any circuit is trusted.

2. **Field width differs: ~255-bit (BLS12-381) vs ~254-bit (BN254). `[MEASURED]`**
   Any circomlib gadget that hardcodes 254-bit decomposition (`Num2Bits`, range
   checks, `LessThan`) must use the correct bit length, or range proofs are subtly
   unsound. Audit every bit-width constant.

3. **No Soroban verifier exporter. `[MEASURED]`** snarkjs's `export
   solidityverifier` is BN254/EVM only. There is no `export sorobanverifier`. We
   write the encoder: snarkjs vk JSON (decimal affine, non-Montgomery) → 96/192-byte
   uncompressed big-endian → embedded in the contract at init. Coordinate ordering,
   infinity flags, and `Fp2` component order are the failure points; cover with
   round-trip tests.

### Verifier-key requirements

- `vk` is set once at contract init and is the root of trust for soundness.
- CI **must** assert the deployed on-chain `vk` byte-matches the `vk` exported from
  the exact circuit commit. A mismatched-but-valid `vk` is a silent
  accept-everything door.

**Conclusion:** no blocking incompatibility. The Poseidon-constant regeneration is
the one item that is both mandatory and easy to get silently wrong.

---

## 3. Trusted setup analysis

**Verdict: 🟡 Solvable, but the convenient path is closed and most teams won't
notice until it bites.**

### Groth16 ceremony requirements

Groth16 needs a two-phase setup: Phase 1 (Powers of Tau, circuit-independent) and
Phase 2 (per-circuit). Toxic waste = the secret randomness (τ, α, β in Phase 1; δ
in Phase 2). **If a single party knows all of it, they can forge proofs** →
mint notes / drain the pool.

**Critical scoping of the risk:** trusted-setup compromise breaks **soundness, not
privacy**. A leaked setup lets an attacker counterfeit value; it does **not**
deanonymize honest users or decrypt their notes. This bounds the blast radius and
shapes the mitigation priority.

### The non-obvious problem `[MEASURED-risk]`

Every hackathon team's muscle memory is "download `powersOfTau28_hez_final.ptau`
and go." **Those files are BN254.** There is no widely-trusted, snarkjs-ready
BLS12-381 Powers of Tau of comparable provenance. Large BLS12-381 ceremonies exist
(Zcash Sapling, Filecoin) but not in a drop-in `.ptau` for our toolchain.
Consequence: **we must run our own Phase 1 for BLS12-381**, or convert an existing
ceremony's output. This is real, often-missed work and it changes the security
story for production.

### Recommended approach

- **Hackathon (demo-only, stated openly):** generate our own BLS12-381 Phase 1 at
  the smallest sufficient power (≈ 2^16–2^17 for a ~50k-constraint circuit), run
  Phase 2 with **2–3 independent contributors plus a public verifiable beacon**
  (e.g., a future Stellar ledger hash or a drand round) as the final
  contribution. Publish the transcript. This yields a "1-of-N honest" assurance —
  acceptable for a demo with test funds, and we say so plainly.
- **Production (real money):** a large, public, well-publicized **Phase 2 ceremony**
  (dozens–hundreds of contributors), reproducible circuit build so anyone can
  verify the `vk` matches the source, and either a credibly-sourced BLS12-381
  Phase 1 or a dedicated Phase 1 ceremony. This is a multi-week coordination
  effort and a launch-blocking dependency — schedule it as such, not as an
  afterthought.

**Recommendation:** treat the ceremony as a first-class production workstream with
its own timeline. For the hackathon, the self-run beacon ceremony is fine *because
the stakes are test funds* — never ship those keys to mainnet.

---

## 4. Merkle tree feasibility

**Verdict: 🟡 Feasible. Depth and proof size are non-issues; the real cost is that
in-circuit insertion roughly doubles the hashing the prover must do.**

| Parameter | Value | Assessment |
|-----------|-------|------------|
| Tree depth | 20 (1,048,576 notes) | `[ESTIMATE]` ample; trivial on-chain (frontier = 20 hashes) |
| Membership path / spend | 2 × 20 Poseidon | standard |
| In-circuit insertion / spend | ~2 × 20 Poseidon (frontier→old_root + recompute) | **the cost of K3** |
| Proof size | ~192 B (compressed) / ~288 B (uncompressed) | `[MEASURED]` curve sizes; constant |
| Witness size | ~#signals × 32 B ≈ low single-digit MB | `[ESTIMATE]` non-issue |

### Witness / constraint estimate `[ESTIMATE]`

Spend circuit Poseidon budget: 2 inclusion paths (~40) + 2-leaf in-circuit
insertion (~40) + 4 commitments + 2 key-derivations + 2 nullifiers ≈ **~90 Poseidon
permutations**. At ~250–300 R1CS constraints each that is ~25–30k constraints from
hashing, plus 4×64-bit range checks (~1k) and conservation logic. **Total ≈
30–50k constraints `[BENCHMARK]`.**

### The honest tradeoff this review must surface

The architecture's K3 ("contract never hashes") is **correct for staying under the
100M budget** — because, uniquely, Umbra's `spend` would otherwise pay for the
~40M verify *and* an on-chain depth-20 insertion *in the same transaction*. That
collision is what justifies moving insertion into the circuit.

**But K3 is not free — it is paid on the prover side.** In-circuit insertion roughly
**doubles** the Poseidon count of `spend` (membership *and* insertion), which
directly increases proving time (§5). The privacy-pools prototype avoided this by
being a mixer: deposit (insert, no verify) and withdraw (verify, no insert) are
*separate transactions that never collide*. Umbra's in-pool transfer is what forces
verify+insert together.

**This is a genuine fork in the road, and it is the most important architectural
challenge in this review:**

- **Option X (current K3):** insertion in-circuit, one transaction. Contract cheap;
  prover pays ~2× hashing; serialized inserts.
- **Option Y (decouple):** `spend` verifies + nullifies + *emits* output
  commitments; a separate, cheap, batchable transaction performs on-chain
  insertion in its own 100M budget. Smaller spend circuit (~25–30k → faster
  proving, friendlier to weaker devices), at the cost of two-phase latency and a
  sequencer role.

Option Y is also the production scaling answer (§8). **Recommendation:** build
Option X for the MVP (operationally simplest, one tx), but design the note format
and events so Option Y is a later swap, not a rewrite. Revisit immediately if §5
proving times come in painful.

---

## 5. Browser proof generation feasibility

**Verdict: 🟡 Desktop is fine. Mobile is not — and the usual escape hatch is
closed by the privacy model.**

### The closed escape hatch (most important finding in this section)

The instinct when browser proving is too heavy is "prove it on the server." **For
Umbra's `spend` this is forbidden.** The spend witness contains the spending key
(`ask`/`nk`), the input note values, and the blinding factors. Handing the witness
to a relayer to prove would hand it the user's secrets and **destroy the entire
privacy guarantee**. Therefore:

> Spend proving is *necessarily* client-side. Mobile memory limits cannot be
> waved away with server-side proving. This is a hard constraint, not a tuning
> knob.

(The architecture doc's aside that the relayer "optionally offers a native prover…
on witnesses that carry no secret" is **wrong for the core flows** and is corrected
here: no core Umbra operation has a secret-free witness. Relayer proving is off the
table for shield/spend.)

### WASM proving, memory, latency `[ESTIMATE]/[BENCHMARK]`

- **Tooling:** Circom WASM witness generator + snarkjs Groth16, with rapidsnark-wasm
  as the fast path. snarkjs pure-JS is the slow, memory-hungry baseline.
- **Memory:** zkey for a ~40k-constraint circuit ≈ tens of MB on disk; snarkjs
  proving peak RAM can reach ~1–2 GB; rapidsnark is leaner. `[BENCHMARK]`
- **BLS12-381 penalty:** `[MEASURED]` ~50% larger prime than BN254 → meaningfully
  slower proving and bigger keys than any BN254 benchmark you find. Scale all
  BN254 numbers up; do not quote BN254 timings as if they apply.
- **Latency estimate `[ESTIMATE]`:** ~30–50k-constraint BLS12-381 spend:
  - Desktop, rapidsnark-wasm: **~3–10 s** (+ witness gen).
  - Desktop, snarkjs pure-JS: **~10–30 s**.
  - Mobile: **OOM / unviable risk.** Mobile Safari kills tabs in the few-hundred-MB
    range; large zkey + proving can exceed it. Treat mobile as unsupported for MVP.

### Compatibility conclusion

- **Desktop:** viable. The signal-coloured "PROVING…" moment is a few seconds — on
  brand, acceptable UX.
- **Mobile:** **not** viable for MVP without smaller circuits (Option Y),
  WebGPU-accelerated proving, or a native app. Post-hackathon.
- **Direct consequence:** Umbra MVP is a **desktop-first** product. Say so in the
  pitch; do not demo on a phone.

---

## 6. Soroban state model review

**Verdict: 🟡 Workable, but with two model-specific traps that a naive design walks
straight into — one is a correctness/security trap, one is a recovery trap.**

### Commitment storage `[MEASURED-model]`

Commitments live in **contract events** (transaction meta), not in contract
storage. This is correct — it keeps contract state flat and growth off the
critical-path ledger state. The frontier (20 hashes) + a 64-root ring live in
instance storage (~2–3 KB, bumped each op). **Trap (recovery):** Soroban RPC
`getEvents` serves only a **limited rolling retention window** (provider-dependent,
on the order of days). The architecture's "a client can always rebuild from chain"
fallback is therefore only *trustless within the retention window*; a full
historical rebuild requires a **history-archive / full-meta source**, not vanilla
RPC. `[BENCHMARK the exact window]` **Consequence:** the indexer (or an archive
node) is load-bearing for long-term note recovery. This weakens the "indexer is
pure convenience" claim and must be stated honestly: funds are always safe, but
*discovering your notes* after long offline periods depends on data availability.

### Nullifier storage `[MEASURED-model]` — the security trap

Each nullifier is a **persistent** storage entry (set membership = spent). Two
problems:

1. **Perpetual rent / unbounded growth.** Nullifiers must live **forever** (else
   replay). Persistent entries accrue rent and must be kept alive via TTL bumps.
   This is a monotonically growing, perpetually-funded liability. Fine at MVP
   scale; a real cost model question at 100k users (§8).
2. **Archival-replay — a double-spend vector unique to Soroban. `[BENCHMARK —
   security-critical]`** Soroban persistent entries can be *archived* when their
   TTL lapses, and restored later. The contract's `is_spent` check **must not** be
   satisfiable-around by letting a spent nullifier archive and then permitting a
   re-spend, nor by mis-handling a read of an archived entry. The protocol's
   intended semantics (an archived entry cannot be silently re-created; it must be
   restored) likely prevent this — **but "likely" is not acceptable for a
   double-spend vector.** This must be explicitly tested: spend → let nullifier
   archive → attempt replay → assert rejection. Until that test is green, the
   nullifier scheme is not validated.

   *Production direction:* replace the flat nullifier set with an on-chain nullifier
   **accumulator** (root only), proving non-membership in-circuit — removes both the
   rent liability and the archival surface, at the cost of circuit complexity and
   its own contention. Not MVP.

### Root & event storage

- **Roots:** 64 × 32 B ring in instance storage — bounded, trivial, bumped per op.
  Validated.
- **Events:** linear in transactions, but off-chain (indexer DB) for the heavy data.
  Manageable; the constraint is the RPC retention window above, not contract state.

### Growth over time `[ESTIMATE]`

| State | Per op | At 1M spends | Concern |
|-------|--------|--------------|---------|
| Nullifiers (persistent) | +2 entries | ~2M entries, perpetual rent | rent funding model |
| Frontier + root ring | O(1) | constant | none |
| Commitments (events) | +1–2 | off-chain / archive | retention window |

---

## 7. Security audit simulation

**Verdict: 🟢 No value-theft vector found that does not require breaking the
trusted setup or a SNARK assumption. The residual risks are one Soroban replay
subtlety (§6), griefing/liveness, and metadata privacy.** Attempting to break it:

| Attack | Result | Why |
|--------|--------|-----|
| **Double spend** | ✅ blocked | Same note → same `nf = Poseidon(nk,pos)`; spent-set rejects the second. Soroban applies txs sequentially → no intra-ledger race. **Caveat:** depends on the §6 archival-replay test passing. |
| **Replay (cross-deployment)** | ✅ blocked | `domain = H(chain‖contract)` bound as a public input. |
| **Replay (same proof, same chain)** | ✅ blocked | Inputs are nullified on first use; resubmission fails. |
| **Forged commitment / mint-from-nothing** | ⚠️ rests on setup | Prevented by Groth16 soundness + value-conservation + range checks. **Sole dependency: honest trusted setup.** A leaked setup = counterfeiting. This is *the* soundness anchor. |
| **Field-overflow conservation forgery** | ✅ blocked | `value < 2^64` range checks on every input/output (with the §2 BLS12-381 bit-width fix). |
| **Forged / griefing nullifier** | ✅ blocked | `nf` needs the victim's secret `nk`; uncomputable from public `owner_pk`. Cannot nullify someone else's note. |
| **Root substitution (prove against a fake tree)** | ✅ blocked | `membership_root` must be in the on-chain ring; roots only advance via valid inserts from the current root. The insertion witness (frontier) is constrained to hash to the pinned on-chain `old_root`, so a forged frontier fails. This is the core soundness argument for K3 — and it holds. |
| **Relayer redirects payout** | ✅ blocked | `recipient`/`relayer` bound as public inputs (2×128-bit limbs). **Note:** the Stellar privacy-pools prototype explicitly *had not* implemented recipient binding — Umbra closing this is a concrete improvement over the reference. |
| **Front-running a spend** | ✅ harmless | A copied `(proof, inputs)` executes the *identical* bound state transition (same recipient, same fee-recipient). Front-runner only pays the network fee to do what the user wanted. No theft. |
| **Relayer manipulation / extraction** | ⚠️ liveness only | Relayer cannot alter bound values or read the witness; it can only censor. Mitigation: switch relayer / re-prove (inputs not yet nullified). |
| **Off-subgroup point attack on the verifier** | ✅ blocked | `[MEASURED]` Host functions auto-check subgroup membership and error. |
| **Root-churn griefing / DoS** | ⚠️ real (design cost) | Because every op pins `old_root == current`, an attacker spamming cheap inserts forces honest users to re-prove (seconds of work) against the moving head. The 64-root ring protects *membership* but **not** insertion. This is the dark side of serialized insertion — a genuine griefing/throughput vector, addressed only by Option Y / batching (§4, §8). |
| **CPU-budget DoS / reliability** | ⚠️ real | If `spend` runs near the practical ceiling (§1, ~80M), worst-case spends (max SAC ops) may intermittently exceed and fail. Reliability, not theft. Forces the Day-0 budget benchmark. |
| **Garbage output ciphertext** | ⚠️ griefing | A malicious sender can post undecryptable note ciphertext; recipient simply can't detect the note. Sender-side only; production binds a ciphertext commitment in-proof. |
| **Metadata deanonymization** | ⚠️ accepted | Amount correlation, timing, IP, small anonymity set. Mitigated by relayer + denomination/delay nudges; never fully solved at MVP. State honestly. |

**Summary:** the contract is hard to steal from. Soundness reduces to (a) the
trusted setup and (b) the regenerated Poseidon constants and (c) the
archival-replay test. Privacy reduces to client integrity + metadata discipline.
The remaining items are liveness/griefing/reliability — all traceable to the
serialized-insertion design choice.

---

## 8. Production readiness gaps

What blocks each tier of scale. Anchored to the measured constraints: 100M instr/tx,
serialized insertion, full-stream note scanning, perpetual nullifier rent.

### To support 1,000 users — 🟢 mostly there

- A real (not self-run) trusted setup, or at least a credible multi-contributor
  Phase 2 with published transcript.
- Indexer durability + a history-archive source for note recovery beyond the RPC
  retention window (§6).
- ≥2 relayers for censorship/liveness resilience.
- The Day-0 `spend`-budget benchmark passing with margin.
- *Insertion serialization is not yet a bottleneck at this volume.*

### To support 10,000 users — 🟡 needs the known upgrades

- **Insertion throughput.** Serialized `old_root == current` inserts become a
  contention and griefing pressure point. Move to **Option Y / batched insertion**.
- **Note discovery.** "Download the entire ciphertext stream and trial-decrypt"
  scales linearly and gets slow. Introduce **view tags** (a 1-byte hint per note to
  skip ~99% of trial-decryptions) and incremental sync.
- **Nullifier rent** becomes a visible cost; needs a funding model (fee-funded
  endowment).
- Mobile still unsolved (§5) — a growing share of users locked out.

### To support 100,000 users — 🔴 requires redesign, not tuning

- **Insertion is a hard wall.** Single-writer serialized tree updates cannot absorb
  this load. Requires a **rollup-style batched-insertion sequencer**: users submit
  membership-only proofs; a sequencer proves a batch root update; the contract
  verifies one SNARK per batch. This is the architecture's stated production path —
  it must actually be built.
- **Note discovery needs sublinear scanning** — view tags at minimum, likely
  **PIR or oblivious sync**, or the whole-stream model collapses.
- **Nullifier set** must become an **accumulator** (on-chain root + in-circuit
  non-membership) or the perpetual-rent liability and state size become untenable.
- **Network-level limits.** Beyond the per-tx 100M budget, Stellar/Soroban
  per-ledger resource and TPS ceilings bound aggregate private throughput.
  100k active users of a compute-heavy contract is a network-capacity question, not
  just a contract-design one. `[BENCHMARK against current ledger limits]`
- **Trusted setup** must be a large, public, audited ceremony.
- *Silver lining:* at this scale the anonymity set is large — privacy quality
  improves precisely as the engineering gets harder.

**Honest framing for investors:** the MVP architecture is a correct **v1 that does
not linearly scale to 100k.** The v2 that does (batched insertion + sublinear
scanning + nullifier accumulator) is well-understood (it is how zk-rollups and
mature shielded pools work) but is substantial, multi-quarter engineering. Fund it
as such.

---

## 9. Hackathon scope reduction

The thesis to protect: **"a real-feeling private payment whose validity is enforced
by a zero-knowledge proof verified inside a Stellar smart contract."** Anything that
doesn't serve that on the demo stage is cuttable.

### A — Absolutely required (no thesis without these)

- On-chain Groth16 verification on Soroban (BLS12-381 host fns). **The thesis is
  literally this.**
- `shield`: public deposit → commitment in the tree, with a verified proof.
- **One** privacy-preserving spend whose proof is verified on-chain and that
  nullifies an input (no double-spend) — demonstrating ZK is load-bearing.
- Local note management sufficient to show balance + detect a received/withdrawn
  note.
- Regenerated BLS12-381 Poseidon constants with test vectors (§2) — a correctness
  prerequisite, not a feature.

### B — Valuable but optional (demo is stronger with them; thesis survives without)

- **In-pool private P2P transfer (join-split with change).** This is the most
  product-like feature *and* the source of the verify+insert collision and the
  heavy circuit (§4). **Strong recommendation:** if the Day-0 spend benchmark or
  proving time is tight, fall back to the **proven mixer** shape — `shield` →
  private **withdraw to a fresh address** (the Stellar prototype's design) — which
  removes in-circuit insertion entirely and still fully demonstrates the thesis.
  Treat the join-split as the ambitious target, not the load-bearing one.
- Unshield as a distinct UX (it's a spend with a public output — cheap to add once
  spend works).
- Relayer. For the demo you *can* self-submit and verbally note the fee-payer
  privacy caveat; a relayer is more honest but not thesis-critical.
- wa-sqlite + OPFS encrypted storage. A simpler local store suffices to demo; the
  encrypted-at-rest story can be described.
- Invoices / donation links (a UX layer over a transfer; show as a stretch).

### C — Post-hackathon (do not attempt under time pressure)

- Multi-asset pools, batched/rollup insertion, viewing keys / compliance, PIR /
  view-tag scanning, mobile proving, nullifier accumulator, a real public ceremony.

**The sharp recommendation:** ship **A + mixer-shaped spend** as the guaranteed
demo, and pursue **B.join-split** in parallel as the upside. That sequencing makes
the thesis un-missable regardless of how the heavier circuit lands.

---

## 10. Final verdict

A brutally honest assessment, as requested.

### Strongest architectural decisions

1. **BLS12-381.** Vindicated hard. It is the *only* curve with native Soroban
   support, snarkjs/Circom both target it, and Stellar's own prototype proves the
   full pipeline. Choosing BN254 (the default muscle-memory choice) would have been
   fatal — no host support. This decision alone separates a feasible project from a
   dead one.
2. **Contract computes zero hashes (K3).** The 40M-verify-vs-100M-budget reality
   makes this not a stylistic choice but a survival one for the `spend` transaction.
   Correct for the right, now-quantified, reason.
3. **Binding recipient/relayer in the proof.** It closes the *exact* gap Stellar's
   reference prototype left open. We are ahead of the reference on the hard part.
4. **Building on proven prior art.** The riskiest assumptions (on-chain pairing
   verification, Circom→Soroban) are de-risked by an existing Stellar
   implementation. This is a low-novelty-risk core with high-value product framing —
   the ideal hackathon posture.

### Weakest architectural decisions

1. **In-pool join-split transfer as a core MVP feature.** It is simultaneously the
   most compelling feature and the source of every hard problem in this review:
   verify+insert budget collision, ~2× circuit hashing, slowest proving, and the
   serialized-insertion griefing/throughput ceiling. It should be framed as the
   ambitious target with the mixer as the proven floor (§9).
2. **Assuming browser proving generalizes.** It does on desktop and **fails on
   mobile**, and — because the witness is secret — the server-proving escape hatch
   is *closed*. This quietly makes the MVP desktop-only. Acceptable, but it must be
   acknowledged, not discovered on stage.
3. **Flat nullifier set on Soroban.** Carries a perpetual-rent liability and an
   archival-replay subtlety that is a *double-spend-class* risk until explicitly
   tested.
4. **Trusting "rebuild from chain" as a clean trustless fallback.** RPC retention
   makes it conditional on an archive/indexer for long-offline recovery.

### Biggest risk

- **For the hackathon:** the composite `spend` transaction fitting under the
  practical instruction ceiling (verify ~40M + MSM + 2 SAC + storage, est. 60–80M
  against a ~80M practical wall) **and** join-split proving time on BLS12-381 being
  bearable. **Both are measurable on Day 0** — which is why the Day-0 spend
  benchmark is non-negotiable and gates everything.
- **For the $10M investment:** scaling. The v1 is a correct design that does **not**
  reach 100k users without a real v2 (batched insertion + sublinear note scanning +
  nullifier accumulator). That work is well-understood but multi-quarter. The bet is
  not "does the crypto work" (it does) — it is "can the team execute the rollup-grade
  v2 before growth outruns the v1."

### Probability of successful implementation `[ESTIMATE]`

- **Thesis-proving MVP (A + mixer spend, on-chain verify):** **~85%.** The pipeline
  is proven; the main residual is integration friction (Poseidon constants, vk
  encoding, the budget benchmark). High confidence *conditional on the Day-0 spike
  passing* — and if the spike fails, we learn it in 48 hours, not at the deadline.
- **Full polished join-split transfer + invoices in hackathon timeframe:**
  **~55–65%.** Gated by proving time, in-circuit insertion correctness, and circuit
  debugging cycle time — the classic ZK time-sink. This is why §9 hedges it as
  upside.
- **Production system at 1k users:** **high**, given a real ceremony and indexer
  durability. **At 100k:** **conditional on building the documented v2** — do not
  represent the v1 as 100k-ready.

### The one-paragraph version for the investment committee

The cryptography works and is no longer speculative — Stellar themselves have
prototyped the core, and Umbra's design specifically improves on where that
prototype stopped. The on-chain verifier is proven; the curve choice is the only
viable one and we made it. The genuine risks are not "will ZK verify on Stellar"
(it does, at ~40% of the tx budget) but three execution risks: (1) the *composite*
spend transaction's instruction margin, measurable Day 0; (2) client-side proving
that is desktop-only until a real v2; and (3) a v1 whose insertion and note-scanning
models must be redesigned — along known rollup lines — before they reach six-figure
user counts. Fund the MVP with confidence; fund the production system with eyes open
to a multi-quarter v2.

---

## Day-0 benchmark gate (do this before writing application code)

Non-negotiable measurements that convert every `[BENCHMARK]` above into a fact:

1. **Composite `spend` instruction cost** on testnet: a real Groth16 verify (~15
   public inputs) + G1 MSM + 2 SAC transfers + 4 storage writes, end to end.
   *Pass = comfortably below the practical ceiling (~70M with headroom).*
2. **BLS12-381 join-split proving time** for a ~40k-constraint circuit with
   rapidsnark-wasm on a mid-range laptop. *Pass = single-digit-to-low-tens of
   seconds.* If it fails, switch to Option Y / mixer (§4, §9).
3. **Poseidon-BLS12-381 cross-impl vectors** (circom ↔ Rust ↔ TS) agree.
4. **Nullifier archival-replay test:** spend → force TTL lapse/archival → attempt
   replay → assert rejection. *Pass = replay impossible.*
5. **RPC event-retention window** measured for the target provider → decide the
   archive/indexer recovery requirement.

If 1, 2, and 4 pass, the project is green-lit to build. If 1 or 4 fail, the
architecture changes (decouple insertion / harden nullifiers) *before* any app code.

---

## Evidence & sources

Primary sources consulted for the `[MEASURED]` claims above:

- Stellar, *Announcing Protocol 22* — BLS12-381 / CAP-0059, mainnet 2024-12-05:
  https://stellar.org/blog/developers/announcing-protocol-22
- CAP-0059, *BLS12-381 host functions* (signatures, subgroup checks, serialization):
  https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md
- Stellar, *Prototyping Privacy Pools on Stellar* — the direct prior art; Poseidon/
  BLS12-381/Groth16, `circom2soroban`, **~40M-instruction verification = 40% of
  budget**, and the explicitly-unimplemented recipient binding + historical roots:
  https://stellar.org/blog/ecosystem/prototyping-privacy-pools-on-stellar
- `stellar/soroban-examples` — `groth16_verifier` (BLS12-381, Circom 2.2.1):
  https://github.com/stellar/soroban-examples/tree/main/groth16_verifier
- snarkjs — BLS12-381 support, `powersoftau new bls12381`, Groth16 workflow:
  https://github.com/iden3/snarkjs
- Soroban resource limits — 100M CPU instr/tx; SLP-0001 (2025-01-22) 100 read / 50
  write entries: https://github.com/stellar/stellar-protocol/blob/master/limits/slp-0004.md
- *Interstellar: Full ZK Pipeline for Noir + Soroban Using BLS12-381* (BLS12-381
  ~255-bit `Fr`, ~50% larger than BN254; verification benchmarking deferred to
  build): https://github.com/orgs/noir-lang/discussions/8654
- *Stellar Hacks: Real-World ZK* (target hackathon):
  https://dorahacks.io/hackathon/stellar-hacks-zk/detail

*Numbers labelled `[ESTIMATE]` are engineering judgement pending the Day-0 gate.
Numbers labelled `[BENCHMARK]` are unmeasured and gate the build. Do not treat
either as fact until the gate is run.*
