/**
 * Convert a snarkjs verification key + proof into the Soroban point-byte layout the
 * groth16-verifier contract consumes, and emit `<circuit>_soroban.json`.
 *
 * snarkjs encodes G1/G2 as decimal-string projective coordinates; we reduce to
 * affine, then to 96-byte (G1) / 192-byte (G2) uncompressed big-endian via
 * @umbra/crypto-bls (the exact encoding validated by B02). The result feeds B04.
 *
 * Usage: tsx export-soroban.ts <circuitName>   (artifacts read from circuits/build)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { g1ToSoroban, g2ToSoroban, G1Point, G2Point, toBytesBE } from "@umbra/crypto-bls";

const name = process.argv[2] ?? "bench_hash";
const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, "..", "build");

const toHex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

/** snarkjs G1 = [x, y, "1"] decimal strings (affine, z=1). Encode to 96 bytes. */
function g1(p: string[]): string {
  if (BigInt(p[2]!) !== 1n) throw new Error("expected affine G1 (z=1) from snarkjs");
  const P = G1Point.fromAffine({ x: BigInt(p[0]!), y: BigInt(p[1]!) });
  return toHex(g1ToSoroban(P));
}

/** snarkjs G2 = [[x_c0,x_c1],[y_c0,y_c1],[z...]] decimal strings. */
function g2(p: string[][]): string {
  const x = { c0: BigInt(p[0]![0]!), c1: BigInt(p[0]![1]!) };
  const y = { c0: BigInt(p[1]![0]!), c1: BigInt(p[1]![1]!) };
  const P = G2Point.fromAffine({ x, y } as unknown as Parameters<typeof G2Point.fromAffine>[0]);
  return toHex(g2ToSoroban(P));
}

const vkey = JSON.parse(readFileSync(join(build, `${name}_vkey.json`), "utf8"));
const proof = JSON.parse(readFileSync(join(build, `${name}_proof.json`), "utf8"));
const pub: string[] = JSON.parse(readFileSync(join(build, `${name}_public.json`), "utf8"));

const out = {
  circuit: name,
  vk: {
    alpha: g1(vkey.vk_alpha_1),
    beta: g2(vkey.vk_beta_2),
    gamma: g2(vkey.vk_gamma_2),
    delta: g2(vkey.vk_delta_2),
    ic: (vkey.IC as string[][]).map((p) => g1(p)),
  },
  proof: {
    a: g1(proof.pi_a),
    b: g2(proof.pi_b),
    c: g1(proof.pi_c),
  },
  publicInputs: pub.map((s) => toHex(toBytesBE(BigInt(s)))),
};

writeFileSync(join(build, `${name}_soroban.json`), JSON.stringify(out, null, 2));
// eslint-disable-next-line no-console
console.log(`wrote ${name}_soroban.json (${out.vk.ic.length} IC points, ${out.publicInputs.length} public inputs)`);
