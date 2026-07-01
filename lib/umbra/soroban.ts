// Minimal Soroban client for the slice: convert a browser-generated snarkjs proof
// into the contract's argument shape and invoke shield()/withdraw() on testnet.
//
// @stellar/stellar-sdk is heavy and only needed when actually submitting to chain, so
// it is LAZY-LOADED (dynamic import) — the demo pages never pull it on load. All byte
// handling uses Uint8Array (never Node's Buffer, which is undefined in the browser).
import type { xdr } from "@stellar/stellar-sdk";
import { G1Point, G2Point, g1ToSoroban, g2ToSoroban } from "@umbra/crypto-bls";
import { UMBRA_CONFIG } from "./config";
import type { Groth16ProofJson } from "./prover";
import { signTransactionXdr, signerAddress, type Signer } from "./signer";

export type { Signer };

type Sdk = typeof import("@stellar/stellar-sdk");

function g1Bytes(p: string[]): Uint8Array {
  if (BigInt(p[2]!) !== 1n) throw new Error("expected affine G1 (z=1) from snarkjs");
  return g1ToSoroban(G1Point.fromAffine({ x: BigInt(p[0]!), y: BigInt(p[1]!) }));
}
function g2Bytes(p: string[][]): Uint8Array {
  const P = G2Point.fromAffine({
    x: { c0: BigInt(p[0]![0]!), c1: BigInt(p[0]![1]!) },
    y: { c0: BigInt(p[1]![0]!), c1: BigInt(p[1]![1]!) },
  } as unknown as Parameters<typeof G2Point.fromAffine>[0]);
  return g2ToSoroban(P);
}
function bytes32(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let n = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}
function proofScVal(sdk: Sdk, pf: Groth16ProofJson["proof"]): xdr.ScVal {
  // The contract's Proof is a Soroban struct → ScMap with SYMBOL keys, sorted by
  // key. `nativeToScVal({a,b,c})` would emit STRING keys (UnexpectedType on-chain),
  // so build the map explicitly. (The CLI gets symbols via the contract spec.)
  const field = (k: string, bytes: Uint8Array) =>
    new sdk.xdr.ScMapEntry({ key: sdk.xdr.ScVal.scvSymbol(k), val: sdk.nativeToScVal(bytes) });
  return sdk.xdr.ScVal.scvMap([
    field("a", g1Bytes(pf.pi_a)),
    field("b", g2Bytes(pf.pi_b)),
    field("c", g1Bytes(pf.pi_c)),
  ]);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Deterministic field encoding of a payout address — IDENTICAL to the contract's
 * `address_to_field` (C1 binding): SHA-256 of the address ScVal XDR with the top byte
 * cleared, so the result is always a valid BLS12-381 Fr element. The withdrawal proof
 * binds its `recipient` public input to this value; on-chain the contract re-derives
 * `field(to)` and rejects any mismatch, so a stolen/observed proof cannot be redirected
 * to a different address.
 */
export async function addressToField(address: string): Promise<bigint> {
  const sdk = await import("@stellar/stellar-sdk");
  const b64 = new sdk.Address(address).toScVal().toXDR("base64");
  const bytes = base64ToBytes(b64);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  digest[0] = 0; // mask the top byte → guaranteed < r
  let acc = 0n;
  for (const b of digest) acc = (acc << 8n) | BigInt(b);
  return acc;
}

interface InvokeResult {
  hash: string;
  returnValue?: xdr.ScVal;
}

/** On-chain submission lifecycle, surfaced to the UI for richer status states. */
export type SubmitPhase = "signing" | "submitting" | "confirming";

async function invoke(
  sdk: Sdk,
  method: string,
  args: xdr.ScVal[],
  signer: Signer,
  onStatus?: (p: SubmitPhase) => void,
): Promise<InvokeResult> {
  const server = new sdk.rpc.Server(UMBRA_CONFIG.rpcUrl);
  const source = await signerAddress(signer);
  const account = await server.getAccount(source);
  const contract = new sdk.Contract(UMBRA_CONFIG.poolContractId);

  const built = new sdk.TransactionBuilder(account, {
    fee: sdk.BASE_FEE,
    networkPassphrase: UMBRA_CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // prepareTransaction simulates (and surfaces a verification/auth failure as a throw).
  const prepared = await server.prepareTransaction(built);

  // Sign with the user's wallet (Freighter direct, or a Stellar Wallets Kit wallet —
  // the app never sees the secret) or, on testnet, the in-app key fallback.
  let signed = prepared;
  onStatus?.("signing");
  if (signer.kind === "key") {
    prepared.sign(sdk.Keypair.fromSecret(signer.secret));
  } else {
    const signedXdr = await signTransactionXdr(signer, prepared.toXDR(), UMBRA_CONFIG.networkPassphrase);
    signed = sdk.TransactionBuilder.fromXDR(signedXdr, UMBRA_CONFIG.networkPassphrase) as typeof prepared;
  }

  onStatus?.("submitting");
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`${method}: submission rejected (status ERROR)`);
  }

  // Poll until the ledger applies the tx — "success" must mean confirmed on-chain,
  // never just submitted.
  onStatus?.("confirming");
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && got.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") {
    throw new Error(`${method}: tx ${sent.hash} did not succeed (status ${got.status})`);
  }
  return { hash: sent.hash, returnValue: got.returnValue };
}

export async function submitShield(
  args: { proof: Groth16ProofJson; commitment: bigint; amount: bigint },
  signer: Signer,
  onStatus?: (p: SubmitPhase) => void,
): Promise<{ hash: string; leafIndex: number }> {
  const sdk = await import("@stellar/stellar-sdk");
  const depositor = await signerAddress(signer);
  const res = await invoke(
    sdk,
    "shield",
    [
      proofScVal(sdk, args.proof.proof),
      sdk.nativeToScVal(bytes32(args.commitment)),
      sdk.nativeToScVal(args.amount, { type: "i128" }),
      new sdk.Address(depositor).toScVal(),
    ],
    signer,
    onStatus,
  );
  // shield() returns the on-chain leaf index — needed so the wallet can later spend
  // this note (Merkle path). Without it the note is unspendable.
  const leafIndex = res.returnValue != null ? Number(sdk.scValToNative(res.returnValue)) : 0;
  return { hash: res.hash, leafIndex };
}

export async function submitWithdraw(
  args: {
    proof: Groth16ProofJson;
    root: bigint;
    nullifier: bigint;
    recipient: bigint;
    amount: bigint;
    to: string;
  },
  signer: Signer,
  onStatus?: (p: SubmitPhase) => void,
): Promise<{ hash: string }> {
  const sdk = await import("@stellar/stellar-sdk");
  const res = await invoke(
    sdk,
    "withdraw",
    [
      proofScVal(sdk, args.proof.proof),
      sdk.nativeToScVal(bytes32(args.root)),
      sdk.nativeToScVal(bytes32(args.nullifier)),
      sdk.nativeToScVal(bytes32(args.recipient)),
      sdk.nativeToScVal(args.amount, { type: "i128" }),
      new sdk.Address(args.to).toScVal(),
    ],
    signer,
    onStatus,
  );
  return { hash: res.hash };
}

/**
 * Confidential shielded→shielded transfer ("private send"). Spends the input note and
 * inserts one output commitment. No amount and no address are on-chain — the public
 * inputs are only [root, nullifier, out_commitment], so the transferred value is hidden.
 */
export async function submitTransfer(
  args: {
    proof: Groth16ProofJson;
    root: bigint;
    nullifier: bigint;
    outCommitment: bigint;
  },
  signer: Signer,
  onStatus?: (p: SubmitPhase) => void,
): Promise<{ hash: string }> {
  const sdk = await import("@stellar/stellar-sdk");
  const res = await invoke(
    sdk,
    "transfer",
    [
      proofScVal(sdk, args.proof.proof),
      sdk.nativeToScVal(bytes32(args.root)),
      sdk.nativeToScVal(bytes32(args.nullifier)),
      sdk.nativeToScVal(bytes32(args.outCommitment)),
    ],
    signer,
    onStatus,
  );
  return { hash: res.hash };
}
