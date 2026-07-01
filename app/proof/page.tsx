"use client";

import {
  ArrowUpRight,
  Boxes,
  Cpu,
  Database,
  Eye,
  FileCode2,
  Fingerprint,
  GitBranch,
  KeyRound,
  Lock,
  ScanLine,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button, Card, Eyebrow, Pill, Shell } from "@/components/umbra/ui";
import { CopyButton } from "@/components/copy-button";
import deployment from "@/infra/deploy/deployment.json";

const D = deployment as {
  network: string;
  networkPassphrase: string;
  contractIds: { pool: string; token: string };
  wasmHash: string;
  deployTx: string;
  deployer: string;
  explorerBase: string;
  shieldTx?: string;
  transferTx?: string;
};

const EXPLORER = D.explorerBase || "https://stellar.expert/explorer/testnet";
const tx = (h: string) => `${EXPLORER}/tx/${h}`;
const contract = (c: string) => `${EXPLORER}/contract/${c}`;
const account = (a: string) => `${EXPLORER}/account/${a}`;

const copyCls =
  "size-7 rounded-md border-border bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground";

function ExtLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      referrerPolicy="no-referrer"
      className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
      aria-label="Open on stellar.expert"
    >
      <ArrowUpRight className="size-3.5" />
    </a>
  );
}

function IdRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-[13px] text-foreground">{value}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CopyButton value={value} className={copyCls} />
        {href && <ExtLink href={href} />}
      </div>
    </div>
  );
}

function TxEvidence({ kind, hash }: { kind: string; hash: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-medium text-foreground">{kind}</span>
        <Pill tone="ink">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B00]" /> Confirmed on Horizon
        </Pill>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{hash}</span>
        <CopyButton value={hash} className={copyCls} />
      </div>
      <a
        href={tx(hash)}
        target="_blank"
        rel="noreferrer noopener"
        referrerPolicy="no-referrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#FF3B00] underline-offset-4 hover:underline"
      >
        View on stellar.expert <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function PipelineStep({
  icon: Icon,
  title,
  sentence,
  last,
}: {
  icon: typeof Cpu;
  title: string;
  sentence: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-[#FF3B00]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        {!last && <span className="my-1 w-px grow bg-border" />}
      </div>
      <div className={last ? "pb-1" : "pb-6"}>
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{sentence}</p>
      </div>
    </div>
  );
}

function PipelineCard({ icon: Icon, title, children }: { icon: typeof Cpu; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-foreground">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] text-foreground">{value}</p>
    </div>
  );
}

const PIPELINE: { icon: typeof Cpu; title: string; sentence: string }[] = [
  { icon: Wallet, title: "Wallet", sentence: "You connect a Stellar wallet. Your keys and note secrets never leave the browser." },
  { icon: KeyRound, title: "Note", sentence: "A private note is minted locally — a secret plus an amount. Nobody else can see it." },
  { icon: Fingerprint, title: "Commitment", sentence: "The note is hashed to a Poseidon commitment — the only part that ever touches the chain." },
  { icon: Cpu, title: "Browser proof", sentence: "snarkjs generates a Groth16 proof in a Web Worker. It proves membership without revealing which note — the secret is never sent anywhere." },
  { icon: ShieldCheck, title: "Soroban verifier", sentence: "The contract checks the proof on-chain (BLS12-381 host functions) before any funds move. No valid proof, no payout." },
  { icon: Database, title: "Pool transfer", sentence: "Funds move; the commitment is inserted into the on-chain Merkle tree; a one-time nullifier prevents double-spend." },
  { icon: ScanLine, title: "Explorer confirmation", sentence: "The transaction is confirmed on Horizon — publicly checkable, yet unlinkable to your other notes." },
];

const STELLAR_SEES = [
  "A shield (deposit) amount",
  "A withdrawal's public amount — but not its change",
  "The pool contract address",
  "A withdrawal's recipient address",
  "The nullifier (an opaque one-time tag)",
  "Transaction timing",
];

const UMBRA_HIDES = [
  "Which deposit funded which withdrawal",
  "A confidential transfer's amount — fully hidden (only a nullifier + two commitments touch the chain)",
  "The change on every withdrawal — it stays a private note in the pool",
  "Your note secret (never leaves the browser)",
  "Your private balance — only your wallet can reconstruct it",
  "Your local audit metadata, unless you choose to disclose it",
];

const RECOVERY = [
  { title: "Connect your wallet", sentence: "No account, no server, no custodian." },
  { title: "Derive a deterministic seed", sentence: "From a signature your wallet produces — same wallet, same seed." },
  { title: "Scan the pool's events", sentence: "DepositCreated / WithdrawalCompleted, straight from the chain." },
  { title: "Rebuild the Merkle tree", sentence: "Reconstructed from on-chain commitments — correct withdrawal paths." },
  { title: "Recover your spendable notes", sentence: "Re-derive your secrets and match them; your balance reappears, withdrawable." },
];

const TESTS: [string, string][] = [
  ["cargo test -p umbra-pool", "10 / 10 — real Groth16 proofs vs the real BLS12-381 host"],
  ["@umbra/crypto-bls", "13 / 13 — Poseidon: Rust ≡ circuit ≡ TS"],
  ["vitest (unit/component)", "25 / 25"],
  ["tsc --noEmit", "clean"],
  ["next build", "15 / 15 routes"],
  ["browser → testnet shield · transfer · unshield", "confirmed on Horizon"],
];

export default function ProofPage() {
  return (
    <Shell active="/proof">
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <Eyebrow>Proof Center</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-5xl">
          Don&rsquo;t trust us. Verify the proof.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Umbra generates a zero-knowledge proof <span className="text-foreground">in your browser</span> and verifies
          it <span className="text-foreground">inside a Stellar smart contract</span>. Every claim below is backed by
          code, copyable contract ids, live explorer links, and the exact transactions.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill tone="signal">Live on testnet</Pill>
          <Pill tone="ink">BLS12-381 · Groth16</Pill>
          <Pill tone="ink">10/10 contract tests</Pill>
          <Pill tone="ink">Proven from the browser</Pill>
        </div>

        {/* Pipeline with sentences */}
        <h2 className="mb-5 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How a private payment is verified
        </h2>
        <div className="rounded-2xl border border-border bg-white/[0.01] p-6">
          {PIPELINE.map((s, i) => (
            <PipelineStep key={s.title} icon={s.icon} title={s.title} sentence={s.sentence} last={i === PIPELINE.length - 1} />
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          The proof is generated client-side; money only moves if the contract verifies it on-chain.
        </p>

        {/* Live on testnet */}
        <h2 className="mb-4 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Live on Stellar testnet
        </h2>
        <div className="space-y-2.5">
          <IdRow label="UmbraPool contract (verifier + tree)" value={D.contractIds.pool} href={contract(D.contractIds.pool)} />
          <IdRow label="Asset (native SAC)" value={D.contractIds.token} href={contract(D.contractIds.token)} />
          <IdRow label="Deployer" value={D.deployer} href={account(D.deployer)} />
          <IdRow label="Deploy transaction" value={D.deployTx} href={tx(D.deployTx)} />
          <IdRow label="WASM hash" value={D.wasmHash} />
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          network: {D.network} · {D.networkPassphrase} · Protocol 27. The Groth16 verifier is a Rust library compiled
          into the pool contract, so verification happens inside the same on-chain call.
        </p>

        {/* Protocol facts */}
        <h2 className="mb-4 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          The protocol, in facts
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Fact label="Network" value="Stellar testnet · P27" />
          <Fact label="Proof system" value="Groth16" />
          <Fact label="Curve" value="BLS12-381" />
          <Fact label="On-chain verify" value="CAP-0059 host fns" />
          <Fact label="Hash" value="Poseidon" />
          <Fact label="Circuits" value="Circom (shield · withdraw · transfer)" />
          <Fact label="Merkle depth" value="6 (64 notes)" />
          <Fact label="Shield public inputs" value="[commitment, amount]" />
          <Fact label="Withdraw public inputs" value="[root, nullifier, recipient, amount, change]" />
          <Fact label="Transfer public inputs" value="[root, nullifier, out₁, out₂]" />
        </div>

        {/* Real transactions */}
        <h2 className="mb-2 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Two real, unlinkable transactions
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          A shield (deposit) and a confidential transfer — on-chain they share no linking data, and the transfer
          reveals no amount at all. Both confirmed on Horizon.
        </p>
        {D.shieldTx && D.transferTx ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TxEvidence kind="Shield · deposit" hash={D.shieldTx} />
            <TxEvidence kind="Confidential transfer · amount hidden" hash={D.transferTx} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white/[0.02] p-5">
            <p className="text-sm font-medium text-foreground">Freshly redeployed — generate your own evidence.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              This deployment&rsquo;s live proof is its{" "}
              <a href={tx(D.deployTx)} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" className="text-[#FF3B00] underline-offset-4 hover:underline">
                constructor transaction
              </a>{" "}
              (above). Shield, send, and unshield transactions appear on the explorer the moment you run the
              wallet against this pool — nothing is pre-baked, so every hash you see is one you produced.
            </p>
            <Link href="/wallet" className="mt-3 inline-block">
              <Button size="sm" variant="secondary">Open the wallet and produce one</Button>
            </Link>
          </div>
        )}

        {/* What Stellar sees vs what Umbra hides */}
        <h2 className="mb-2 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          What Stellar sees vs what Umbra hides
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Be precise about what&rsquo;s hidden. Shielding and cashing out reveal their amounts — that&rsquo;s{" "}
          <span className="text-foreground">link privacy</span>: the deposit↔withdrawal connection is broken. A{" "}
          <span className="text-foreground">confidential transfer reveals no amount at all</span>, and every
          withdrawal keeps its <span className="text-foreground">change private</span> in the pool.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-muted-foreground">
                <Eye className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">Stellar sees (public)</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {STELLAR_SEES.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" /> {x}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF3B00]/10 text-[#FF3B00]">
                <Lock className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">Umbra hides (private)</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
              {UMBRA_HIDES.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#FF3B00]" /> {x}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Cross-device recovery */}
        <h2 className="mb-2 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your private balance follows your wallet
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Not an account. Not a server balance. A private note your wallet can rebuild from the chain on any device.
        </p>
        <Card className="p-6">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {RECOVERY.map((s, i) => (
              <div key={s.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF3B00]/10 font-mono text-[11px] font-semibold text-[#FF3B00]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[14px] font-medium text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{s.sentence}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            Verified end-to-end: wipe local storage, reconnect the same wallet, and the shielded balance is rebuilt from
            chain — withdrawable from there. <span className="text-foreground">No centralized account required.</span>
          </p>
        </Card>

        {/* ZK pipeline detail */}
        <h2 className="mb-4 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Under the hood
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <PipelineCard icon={FileCode2} title="Circuits (Circom)">
            <span className="font-mono text-[0.9em]">shield</span> proves{" "}
            <span className="font-mono text-[0.9em]">commitment = Poseidon(secret, amount)</span>.{" "}
            <span className="font-mono text-[0.9em]">withdraw</span> and{" "}
            <span className="font-mono text-[0.9em]">transfer</span> are join-splits: each proves Merkle inclusion,
            ownership, a one-time nullifier, value conservation, and a 64-bit range on every amount — so a
            withdrawal keeps private change and a transfer hides amounts entirely.
          </PipelineCard>
          <PipelineCard icon={ShieldCheck} title="On-chain verifier">
            A BLS12-381 Groth16 verifier using Stellar&rsquo;s native host functions (CAP-0059) — a G1 MSM + a 4-term
            pairing check in one host call (~40M of the 100M tx budget).
          </PipelineCard>
          <PipelineCard icon={GitBranch} title="Poseidon Merkle tree">
            Commitments are inserted into an <span className="font-mono text-[0.9em]">on-chain</span> Poseidon tree; a
            recent-roots ring lets withdrawals prove inclusion against a known root. Poseidon is byte-identical across
            contract, circuit, and wallet.
          </PipelineCard>
          <PipelineCard icon={Fingerprint} title="Nullifiers">
            Each spend reveals a one-time{" "}
            <span className="font-mono text-[0.9em]">nullifier = Poseidon(secret, leafIndex)</span>; the contract
            rejects any nullifier it has seen — no double-spend, no link to the deposit.
          </PipelineCard>
          <PipelineCard icon={Cpu} title="Browser proving">
            Groth16 proofs are generated <span className="font-mono text-[0.9em]">in the browser</span> via snarkjs in a
            Web Worker — off the main thread, ~2.5s for the 3.9 MB withdraw key. No server ever sees your secret.
          </PipelineCard>
          <PipelineCard icon={Boxes} title="The pool contract">
            <span className="font-mono text-[0.9em]">shield()</span> verifies + inserts + returns the leaf;{" "}
            <span className="font-mono text-[0.9em]">withdraw()</span> verifies + spends the nullifier + inserts the
            change note + pays the public amount out;{" "}
            <span className="font-mono text-[0.9em]">transfer()</span> spends one note into two new commitments with
            no token moving. Money cannot move without an on-chain-verified proof.
          </PipelineCard>
        </div>

        {/* Verified */}
        <h2 className="mb-4 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Verified</h2>
        <Card className="divide-y divide-border overflow-hidden">
          {TESTS.map(([cmd, result]) => (
            <div key={cmd} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-[13px] text-foreground">{cmd}</span>
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B00]" /> {result}
              </span>
            </div>
          ))}
        </Card>

        {/* Selective disclosure */}
        <h2 className="mb-4 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Private by default, accountable by choice
        </h2>
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-foreground">
                <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">Selective disclosure (v1)</h3>
            </div>
            <Pill tone="signal">
              <Lock className="h-3 w-3" /> Encryption-based
            </Pill>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every action is recorded and <span className="text-foreground">encrypted locally</span> under a viewing key
            only the user holds. They can export an <span className="text-foreground">audit packet</span> and disclose
            it — to an accountant or auditor — by choice. No backdoor, no automatic access, and no ZK disclosure proof:
            v1 is honest, symmetric, user-consented encryption. Roadmap: auditor public keys, scoped viewing keys.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/wallet"><Button size="sm" variant="secondary">Disclosure Kit</Button></Link>
            <Link href="/audit"><Button size="sm" variant="secondary">Auditor view</Button></Link>
          </div>
        </Card>

        {/* Real vs roadmap */}
        <h2 className="mb-4 mt-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          What is real today vs roadmap
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm font-semibold text-[#FF3B00]">Real, on-chain, today</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Shield (deposit) — proof verified on-chain</li>
              <li>Confidential transfer (private send) — shielded→shielded, amount hidden</li>
              <li>Unshield / withdraw — any amount, private change, C1-bound</li>
              <li>Private payment / donation / invoice links</li>
              <li>In-browser proving + Freighter signing</li>
              <li>Selective disclosure (encrypted audit packets)</li>
              <li>Cross-device wallet-linked recovery</li>
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-muted-foreground">Roadmap (not faked)</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>Confidential amounts on shield + withdraw (public today; transfers already hide them)</li>
              <li>Fee-privacy relayer · production indexer</li>
              <li>MPC trusted-setup ceremony · independent audit</li>
              <li>Mainnet release (security-gated)</li>
            </ul>
          </Card>
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-border bg-white/[0.02] px-6 py-10 text-center">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
            See it move, privately.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Open the wallet, shield testnet funds, and watch the proof verify on-chain — then check the hash here.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="/wallet"><Button>Open the wallet</Button></a>
            <a href="/mainnet"><Button variant="secondary">Mainnet readiness</Button></a>
          </div>
        </div>
      </div>
    </Shell>
  );
}
