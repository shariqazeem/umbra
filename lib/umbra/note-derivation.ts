// Deterministic note derivation — so a private balance can follow the wallet across
// devices. Note secrets are derived from a per-wallet seed instead of being random:
//   - key signer: seed = H(raw ed25519 secret)        (no prompt, fully deterministic)
//   - Freighter / kit: seed = H(signMessage(domain))  (Ed25519 sig is deterministic)
// Same wallet → same seed → same note secrets, so on any device we can re-derive the
// secrets and rediscover the notes by scanning the chain (see recovery.ts).
import { fr, poseidon2 } from "@umbra/crypto-bls";
import type { Signer } from "./signer";

const DERIVATION_MESSAGE = "Umbra · deterministic note seed · v1";

let cache: { id: string; seed: bigint } | null = null;

function signerId(s: Signer): string {
  return s.kind === "key" ? `key:${s.secret.slice(0, 10)}` : `${s.kind}:${s.address}`;
}

function toUint8(x: unknown): Uint8Array {
  if (x instanceof Uint8Array) return x;
  if (x && typeof x === "object" && "data" in (x as Record<string, unknown>)) {
    const d = (x as { data: unknown }).data;
    if (Array.isArray(d)) return Uint8Array.from(d as number[]);
  }
  if (typeof x === "string") return new TextEncoder().encode(x);
  return new TextEncoder().encode(JSON.stringify(x));
}

async function sha256Big(bytes: Uint8Array): Promise<bigint> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  let hex = "";
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
  return BigInt("0x" + hex);
}

async function keyMaterial(signer: Signer): Promise<Uint8Array> {
  if (signer.kind === "key") {
    const sdk = await import("@stellar/stellar-sdk");
    return Uint8Array.from(sdk.Keypair.fromSecret(signer.secret).rawSecretKey());
  }
  if (signer.kind === "freighter") {
    const { signMessage } = await import("@stellar/freighter-api");
    const r = (await signMessage(DERIVATION_MESSAGE, { address: signer.address })) as unknown as {
      signedMessage?: unknown;
      error?: unknown;
    };
    if (r?.error) throw new Error(String(r.error));
    return toUint8(r?.signedMessage ?? r);
  }
  // kit (xBull / Albedo / LOBSTR)
  const { kitSignMessage } = await import("./stellar-wallets-kit");
  return toUint8(await kitSignMessage(signer.walletId));
}

/** Derive (and cache) the per-wallet seed. May prompt the wallet once (signMessage). */
export async function deriveSeed(signer: Signer): Promise<bigint> {
  const id = signerId(signer);
  if (cache?.id === id) return cache.seed;
  const seed = fr(await sha256Big(await keyMaterial(signer)));
  cache = { id, seed };
  return seed;
}

export function clearSeedCache(): void {
  cache = null;
}

/** Deterministic note secret for a seed + nonce (a valid BLS12-381 Fr element). */
export function deriveNoteSecret(seed: bigint, nonce: number): bigint {
  return poseidon2(seed, BigInt(nonce));
}

export { DERIVATION_MESSAGE };
