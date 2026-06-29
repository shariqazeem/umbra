"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, KeyRound, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Card, Pill } from "@/components/umbra/ui";
import { auditStore, type AuditSnapshot } from "@/lib/umbra/audit-store";

const EMPTY: AuditSnapshot = { hasKey: false, count: 0 };

function download(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Selective-disclosure control panel. Private by default; the user exports an
 * encrypted audit packet (and the viewing key, separately) only when they choose to
 * disclose. No backdoor, no automatic access.
 */
export function DisclosureKit() {
  const snap = useSyncExternalStore(auditStore.subscribe, auditStore.getSnapshot, () => EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function genKey() {
    setBusy(true);
    await auditStore.generateKey();
    setBusy(false);
  }
  function exportKey() {
    const k = auditStore.exportKey();
    if (k) download("umbra-viewing-key.txt", k, "text/plain");
  }
  function exportPacket() {
    const p = auditStore.exportPacket();
    const day = new Date().toISOString().slice(0, 10);
    download(`umbra-audit-packet-${day}.json`, JSON.stringify(p, null, 2));
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-foreground">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </span>
          <h2 className="text-[15px] font-semibold text-foreground">Disclosure Kit</h2>
        </div>
        <Pill tone="signal">
          <Lock className="h-3 w-3" /> Private by default
        </Pill>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Umbra keeps your payment history private. Each action is recorded and{" "}
        <span className="text-foreground">encrypted locally</span> under a viewing key only you hold.
        Export an audit packet only when you choose to disclose — to an accountant or auditor.
      </p>

      {/* status */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Viewing key</p>
          <p className="mt-0.5 font-mono text-sm text-foreground">{snap.hasKey ? "Created" : "Not created"}</p>
        </div>
        <div className="rounded-xl border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Encrypted records</p>
          <p className="mt-0.5 font-mono text-sm text-foreground">{snap.count}</p>
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {!snap.hasKey ? (
          <Button size="sm" onClick={genKey} loading={busy}>
            <KeyRound className="h-4 w-4" /> Generate viewing key
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={exportKey}>
              <KeyRound className="h-4 w-4" /> Export viewing key
            </Button>
            <Button size="sm" variant="secondary" onClick={exportPacket} disabled={snap.count === 0}>
              <Download className="h-4 w-4" /> Export audit packet
            </Button>
            {confirmClear ? (
              <span className="inline-flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => { auditStore.clearRecords(); setConfirmClear(false); }}>
                  Confirm clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={snap.count === 0}>
                <Trash2 className="h-4 w-4" /> Clear records
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Encryption-based selective disclosure (v1). No backdoor; no automatic access.
        </p>
        <Link
          href="/audit"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#FF3B00] underline-offset-4 hover:underline"
        >
          Auditor view <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
