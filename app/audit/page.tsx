"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Eye, FileJson, KeyRound, Lock, Upload } from "lucide-react";
import { Button, Card, Eyebrow, Field, Pill, Shell } from "@/components/umbra/ui";
import { decryptAuditPacket, importViewingKey, type AuditRecord } from "@/lib/umbra/viewing-key";

const KIND_LABEL: Record<AuditRecord["kind"], string> = {
  shield: "Shield · deposit",
  withdraw: "Unshield · withdraw",
  send: "Private send",
  pay_link_created: "Payment link created",
  pay_link_paid: "Payment link paid",
};

const SAMPLE: AuditRecord[] = [
  {
    id: "sample-1",
    kind: "shield",
    timestamp: "2026-06-25T10:00:00.000Z",
    network: "testnet",
    poolContractId: "CCWIFQID…GZHU",
    txHash: "daf74520…2ca0238d",
    amount: "100",
    asset: "XLM",
    direction: "in",
    commitment: "12876…0091",
    leafIndex: 0,
    disclosureNote: "Shielded 100 XLM into the Umbra pool (private deposit).",
  },
  {
    id: "sample-2",
    kind: "send",
    timestamp: "2026-06-25T10:06:00.000Z",
    network: "testnet",
    poolContractId: "CCWIFQID…GZHU",
    txHash: "80e0b0d6…65be3482",
    amount: "100",
    asset: "XLM",
    direction: "out",
    nullifier: "47193…5521",
    counterparty: "GAHR34WC…HYXQ",
    disclosureNote:
      "Sent 100 XLM privately to GAHR34WC…HYXQ. (v1: an unlinkable withdraw-to-recipient — not yet a shielded→shielded transfer.)",
  },
];

function dirSign(d: AuditRecord["direction"]) {
  return d === "in" ? "+" : d === "out" ? "−" : "";
}

function publicView(r: AuditRecord): string {
  switch (r.kind) {
    case "shield":
      return "A deposit transaction — the amount and depositor are public, but it cannot be linked to any later withdrawal.";
    case "withdraw":
    case "send":
      return "A withdrawal transaction — the recipient and amount are public, but it cannot be linked to any deposit.";
    default:
      return "Nothing on-chain — a payment request created off-chain.";
  }
}

function explorer(r: AuditRecord): string | null {
  if (r.explorerUrl) return r.explorerUrl;
  if (r.txHash && !r.txHash.includes("…")) return `https://stellar.expert/explorer/testnet/tx/${r.txHash}`;
  return null;
}

function Disclosed({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs text-foreground">{String(value)}</span>
    </div>
  );
}

function RecordRow({ r }: { r: AuditRecord }) {
  const href = explorer(r);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold text-foreground">{KIND_LABEL[r.kind]}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {new Date(r.timestamp).toLocaleString()}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <span className="font-mono text-xl font-semibold text-foreground">
          {dirSign(r.direction)}
          {r.amount} <span className="text-sm text-muted-foreground">{r.asset ?? ""}</span>
        </span>
        <Pill tone="ink">{r.direction}</Pill>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.disclosureNote}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white/[0.02] p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">What public Stellar saw</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{publicView(r)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white/[0.02] p-3.5">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">What you disclosed</p>
          <div className="space-y-1.5">
            <Disclosed label="amount" value={`${r.amount} ${r.asset ?? ""}`} />
            <Disclosed label="commitment" value={r.commitment} />
            <Disclosed label="nullifier" value={r.nullifier} />
            <Disclosed label="leaf" value={r.leafIndex} />
            <Disclosed label="to" value={r.counterparty} />
            <Disclosed label="pool" value={r.poolContractId} />
          </div>
        </div>
      </div>

      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          referrerPolicy="no-referrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#FF3B00] underline-offset-4 hover:underline"
        >
          View transaction on stellar.expert <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </Card>
  );
}

export default function AuditPage() {
  const [packetText, setPacketText] = useState("");
  const [keyText, setKeyText] = useState("");
  const [records, setRecords] = useState<AuditRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onDecrypt() {
    setError(null);
    setBusy(true);
    try {
      let packet: unknown;
      try {
        packet = JSON.parse(packetText);
      } catch {
        throw new Error("The audit packet is not valid JSON.");
      }
      const key = await importViewingKey(keyText);
      const recs = await decryptAuditPacket(key, packet);
      recs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setRecords(recs);
    } catch (e) {
      setError((e as Error).message);
      setRecords(null);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPacketText(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  const showing = records ?? SAMPLE;
  const isSample = records === null;

  return (
    <Shell active="/audit">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Auditor view</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground">
          Disclose by choice.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Paste an Umbra audit packet and the viewing key it was disclosed with. Everything is decrypted{" "}
          <span className="text-foreground">in your browser</span> — this page cannot see any private activity
          without the key. Disclosure is user-consented.
        </p>

        {/* Inputs */}
        <Card className="mt-7 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileJson className="h-4 w-4" /> Audit packet
                </span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Upload className="h-3 w-3" /> Upload .json
                </button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
              </div>
              <textarea
                rows={5}
                placeholder='{ "format": "umbra-audit-packet", "version": 1, ... }'
                value={packetText}
                onChange={(e) => setPacketText(e.target.value)}
                className="w-full resize-none rounded-xl border border-border bg-[#0e0e10] px-4 py-3 font-mono text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus-visible:border-[#FF3B00]/60 focus-visible:ring-4 focus-visible:ring-[#FF3B00]/10"
              />
            </div>
            <Field
              label="Viewing key"
              mono
              placeholder="umbra-vk-v1:…"
              value={keyText}
              onChange={(e) => setKeyText(e.target.value)}
            />
            <Button onClick={onDecrypt} loading={busy} disabled={!packetText.trim() || !keyText.trim()}>
              <KeyRound className="h-4 w-4" /> Decrypt audit packet
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </Card>

        {/* Results */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" /> {isSample ? "Decrypted timeline" : `${showing.length} records`}
          </h2>
          {isSample ? (
            <Pill tone="muted">Sample format — not live data</Pill>
          ) : (
            <Pill tone="signal">
              <Lock className="h-3 w-3" /> Decrypted locally
            </Pill>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {showing.map((r) => (
            <RecordRow key={r.id} r={r} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          Selective disclosure is <span className="text-foreground">encryption-based</span> in v1: the user exports
          the packet and the viewing key, then shares both with whoever they consent to. Umbra and third parties get
          no access. Roadmap: auditor public keys, scoped viewing keys, encrypted note discovery.
        </p>
      </div>
    </Shell>
  );
}
