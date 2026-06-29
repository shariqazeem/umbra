import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import type { Capability, CapabilityStatus, EnvReport } from "./types.js";

const requireFrom = createRequire(import.meta.url);

/** Try to run a command and capture its (trimmed) stdout; null if it fails. */
function probe(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 15_000 }).trim();
  } catch {
    return null;
  }
}

/** Can a Node module be resolved from the harness's perspective? */
function canResolve(mod: string): boolean {
  try {
    requireFrom.resolve(mod);
    return true;
  } catch {
    return false;
  }
}

function status(
  capability: Capability,
  available: boolean,
  detail: string,
  enableHint: string,
): CapabilityStatus {
  return { capability, available, detail, enableHint };
}

/**
 * Detect every capability the harness can opportunistically use. Detection is
 * non-fatal: a missing toolchain produces a SKIP with an actionable hint, never
 * a crash. This is what makes the harness honest about what it actually measured.
 */
export function detectEnv(rootDir: string): EnvReport {
  const circomV = probe("circom", ["--version"]);
  const cargoV = probe("cargo", ["--version"]);
  const stellarV = probe("stellar", ["version"]) ?? probe("soroban", ["version"]);

  const artifactsDir = join(rootDir, "circuits", "build");
  const haveArtifacts =
    existsSync(join(artifactsDir, "bench_membership_js", "bench_membership.wasm")) &&
    existsSync(join(artifactsDir, "bench_membership_final.zkey")) &&
    existsSync(join(artifactsDir, "bench_membership_vkey.json"));

  const haveSnarkjs = canResolve("snarkjs");

  const testnetReady =
    !!process.env.UMBRA_RPC_URL &&
    !!process.env.UMBRA_NETWORK_PASSPHRASE &&
    !!process.env.UMBRA_SOURCE_SECRET;

  const capabilities: Record<Capability, CapabilityStatus> = {
    node: status("node", true, `node ${process.version}`, "always available"),
    circom: status(
      "circom",
      circomV !== null,
      circomV ?? "not found on PATH",
      "install Circom 2.2.x — see circuits/README.md (cargo install circom or prebuilt binary)",
    ),
    snarkjs: status(
      "snarkjs",
      haveSnarkjs,
      haveSnarkjs ? "resolvable" : "module not installed",
      "pnpm add -w -D snarkjs  (already declared as an optional dep of @umbra/benchmarks)",
    ),
    "circuit-artifacts": status(
      "circuit-artifacts",
      haveArtifacts,
      haveArtifacts ? `present under ${artifactsDir}` : "wasm/zkey/vkey not built",
      "bash circuits/scripts/run-all.sh   (compiles + runs the ceremony + exports artifacts)",
    ),
    cargo: status(
      "cargo",
      cargoV !== null,
      cargoV ?? "not found on PATH",
      "install Rust via rustup: https://rustup.rs",
    ),
    "stellar-cli": status(
      "stellar-cli",
      stellarV !== null,
      stellarV ?? "not found on PATH",
      "install: cargo install --locked stellar-cli  (or brew install stellar-cli)",
    ),
    testnet: status(
      "testnet",
      testnetReady,
      testnetReady ? "UMBRA_RPC_URL + passphrase + source secret set" : "testnet env vars unset",
      "cp infra/deploy/.env.example .env and fill UMBRA_RPC_URL / UMBRA_NETWORK_PASSPHRASE / UMBRA_SOURCE_SECRET",
    ),
  };

  return {
    capabilities,
    platform: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    detectedAt: new Date().toISOString(),
  };
}

/** Which of the required capabilities are missing, with their enable hints. */
export function missingCapabilities(
  env: EnvReport,
  required: Capability[],
): { missing: Capability[]; hints: string[] } {
  const missing = required.filter((c) => !env.capabilities[c].available);
  const hints = missing.map((c) => `${c}: ${env.capabilities[c].enableHint}`);
  return { missing, hints };
}
