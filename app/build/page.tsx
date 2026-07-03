"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  FileCode2,
  Github,
  GitBranch,
  KeyRound,
  Link2,
  Lock,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Button, Card, Eyebrow, Pill, Shell } from "@/components/umbra/ui";
import { CopyButton } from "@/components/copy-button";
import { UMBRA_CONFIG } from "@/lib/umbra/config";
import { explorerContractUrl } from "@/lib/umbra/network";

// Follow whatever network the app is armed for (env-driven) rather than hardcoding testnet.
const POOL = UMBRA_CONFIG.poolContractId || "CBA5KVEZQLFGYGGK6Z3HPWBGYVZVDXAL5LNQIS7ISHVGBNB2V43DVXYA";
const NETWORK = UMBRA_CONFIG.networkPassphrase;
const RPC = UMBRA_CONFIG.rpcUrl;
const EXPLORER = explorerContractUrl(POOL);

const CREATE = `import {
  makeNote, commitment, buildShieldInput,
  encodePaymentLink, UMBRA_CONTRACTS,
} from "@umbra/sdk";

// 1 · Mint a note — the secret stays with the recipient, never in the link.
const note = makeNote(50n);

// 2 · Build the Groth16 witness, prove it in the browser (snarkjs · BLS12-381).
const proof = await proveShield(buildShieldInput(note));

// 3 · Package a tamper-evident, backend-free private payment link.
const id = encodePaymentLink({
  v: 1, title: "Design work", recipientName: "Alex",
  amount: "50", commitment: commitment(note).toString(),
  description: "", proof,
});

// 4 · The Soroban contract verifies the proof on-chain. Done.
const { pool } = UMBRA_CONTRACTS.mainnet;`;

const VERIFY = `import { decodePaymentLink } from "@umbra/sdk";

// Throws if the amount/commitment was tampered —
// the proof's public signals won't match.
const req = decodePaymentLink(id);
//   → { amount: "50", recipientName: "Alex", proof, … }`;

const copyCls = "size-6 rounded-md border-border bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground";

function CodeBlock({ filename, code }: { filename: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#0c0c0e]">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{filename}</span>
        </div>
        <CopyButton value={code} className={copyCls} />
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-[1.65] text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Feature({ icon: Icon, title, code, children }: { icon: typeof Boxes; title: string; code: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-foreground">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
      <p className="mt-2.5 font-mono text-[11px] text-[#FF3B00]/90">{code}</p>
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] font-mono text-xs font-semibold text-foreground">
        {n}
      </span>
      <div>
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Shell active="/build">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <Eyebrow>For developers · @umbra/sdk</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-foreground sm:text-5xl">
          Build private payments on Stellar.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Umbra is the privacy layer for Stellar — a pool whose validity is enforced by a
          zero-knowledge proof verified on-chain. The SDK hands you the exact, on-chain-verified
          primitives our own products run on. No new contracts, no new circuits — build on the
          frozen, proven protocol.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Pill tone="ink"><ShieldCheck className="h-3 w-3" /> On-chain verified</Pill>
          <Pill tone="ink"><Lock className="h-3 w-3" /> Secrets never leave the client</Pill>
          <Pill tone="ink"><Boxes className="h-3 w-3" /> One protocol, every app</Pill>
        </div>

        {/* Install */}
        <div className="mt-7 flex items-center justify-between gap-3 rounded-xl border border-border bg-[#0c0c0e] px-4 py-3">
          <code className="truncate font-mono text-sm text-foreground">
            <span className="select-none text-muted-foreground">$ </span>npm i @umbra/sdk
          </code>
          <div className="flex shrink-0 items-center gap-2">
            <Pill tone="muted"><Terminal className="h-3 w-3" /> mainnet</Pill>
            <CopyButton value="npm i @umbra/sdk" className={copyCls} />
          </div>
        </div>

        {/* Quickstart */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          A private payment link, end to end
        </h2>
        <CodeBlock filename="create-link.ts" code={CREATE} />
        <div className="mt-4">
          <CodeBlock filename="verify-link.ts" code={VERIFY} />
        </div>

        {/* What you get */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          What&rsquo;s in the box
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feature icon={Lock} title="Notes & commitments" code="makeNote · commitment · nullifier">
            Private money as a Poseidon commitment, spent exactly once via its nullifier.
          </Feature>
          <Feature icon={GitBranch} title="Contract-mirroring tree" code="MerkleTree · DEPTH">
            Compute roots and Merkle paths the on-chain pool accepts — same Poseidon, same depth.
          </Feature>
          <Feature icon={FileCode2} title="Witness inputs" code="buildShieldInput · buildWithdrawInput">
            Ready-to-prove Groth16 witnesses for shield and withdraw.
          </Feature>
          <Feature icon={ShieldCheck} title="Soroban encoding" code="g1ToSoroban · g2ToSoroban">
            Turn a snarkjs proof / verifying key into the contract&rsquo;s exact byte layout.
          </Feature>
          <Feature icon={Link2} title="Payment-link codec" code="encodePaymentLink · decodePaymentLink">
            Self-contained, integrity-checked links — a pre-authorized shield, no backend.
          </Feature>
          <Feature icon={Boxes} title="Live contracts" code="UMBRA_CONTRACTS.mainnet">
            The deployed pool id + network config, ready to invoke.
          </Feature>
        </div>

        {/* How it works */}
        <h2 className="mb-5 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How a private payment works
        </h2>
        <div className="flex flex-col gap-6">
          <Step n={1} title="Shield">
            A note enters the pool under a Poseidon commitment, with a ZK proof that it really holds the
            deposited amount.
          </Step>
          <Step n={2} title="Prove">
            A withdrawal proves — without revealing which note — Merkle inclusion, ownership, a one-time
            nullifier, recipient binding, and amount conservation.
          </Step>
          <Step n={3} title="Verify on-chain">
            The Soroban contract verifies the Groth16 proof using Stellar&rsquo;s native BLS12-381 host
            functions, then releases funds. No trusted server.
          </Step>
        </div>

        {/* Live contracts */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Live on Stellar mainnet
        </h2>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">UmbraPool contract</p>
              <p className="truncate font-mono text-[13px] text-foreground">{POOL}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CopyButton value={POOL} className={copyCls} />
              <a
                href={EXPLORER}
                target="_blank"
                rel="noreferrer noopener"
                referrerPolicy="no-referrer"
                className="inline-flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Open on stellar.expert"
              >
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Network</p>
              <p className="mt-0.5 font-mono text-[12px] text-foreground">{NETWORK}</p>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Soroban RPC</p>
                <p className="truncate font-mono text-[12px] text-foreground">{RPC}</p>
              </div>
              <CopyButton value={RPC} className={copyCls} />
            </div>
          </div>
        </div>

        {/* Real vs roadmap */}
        <h2 className="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          What is real today vs roadmap
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm font-semibold text-[#FF3B00]">Real, in the SDK today</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Notes, commitments, nullifiers, recipient binding</li>
              <li>Contract-mirroring Poseidon Merkle tree</li>
              <li>Shield / withdraw Groth16 witness inputs</li>
              <li>BLS12-381 → Soroban byte encoding</li>
              <li>Integrity-checked payment-link codec</li>
              <li>Live mainnet pool + network config</li>
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-muted-foreground">Roadmap</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Published to npm (workspace deps unwired)</li>
              <li>Join-split / shielded→shielded transfer inputs</li>
              <li>Multi-asset notes</li>
              <li>Auditor public keys for selective disclosure</li>
            </ul>
          </Card>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          The SDK is workspace-local today; it depends on two workspace packages, so it ships once those
          are published or bundled. Honest by default — we haven&rsquo;t published a half-wired package.
        </p>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-border bg-white/[0.02] px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Build privacy into your Stellar app.</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Payments, donations, payroll, treasury — if it moves value on Stellar, it can be private.
            Start from the wallet, or wire the SDK into your own product.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href="/wallet"><Button>Open the wallet</Button></Link>
            <Link href="/apps"><Button variant="secondary">See live apps</Button></Link>
            <a href="https://github.com/shariqazeem/umbra" target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer">
              <Button variant="ghost"><Github className="h-4 w-4" /> GitHub</Button>
            </a>
          </div>
        </div>
      </div>
    </Shell>
  );
}
