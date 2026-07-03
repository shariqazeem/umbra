"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Copy, KeyRound, Link2, Search, Send, ShieldCheck, Wallet } from "lucide-react";
import { UMBRA_CONFIG } from "@/lib/umbra/config";
import { cn } from "@/lib/utils";

type Router = ReturnType<typeof useRouter>;

type Action = {
  id: string;
  label: string;
  hint: string; // mono hint — the destination path, or "Copy"
  keywords?: string;
  icon: typeof Wallet;
  run: (router: Router) => void | Promise<void>;
};

const ACTIONS: Action[] = [
  { id: "wallet", label: "Open wallet", hint: "/wallet", keywords: "balance private", icon: Wallet, run: (r) => r.push("/wallet") },
  { id: "send", label: "Private send", hint: "/wallet", keywords: "transfer confidential hidden amount", icon: Send, run: (r) => r.push("/wallet") },
  { id: "shield", label: "Shield funds", hint: "/shield", keywords: "deposit add pool", icon: ArrowUpRight, run: (r) => r.push("/shield") },
  { id: "links", label: "Create payment link", hint: "/links", keywords: "invoice donate request pay", icon: Link2, run: (r) => r.push("/links") },
  { id: "proof", label: "Proof Center", hint: "/proof", keywords: "verify zk groth16", icon: ShieldCheck, run: (r) => r.push("/proof") },
  { id: "copy-pool", label: "Copy pool contract ID", hint: "Copy", keywords: "address contract soroban", icon: Copy, run: () => navigator.clipboard?.writeText(UMBRA_CONFIG.poolContractId) },
  { id: "audit", label: "Auditor view", hint: "/audit", keywords: "disclose viewing key packet", icon: KeyRound, run: (r) => r.push("/audit") },
];

/** Subsequence fuzzy match — every query char appears in order. */
function fuzzy(q: string, text: string): boolean {
  const query = q.toLowerCase().trim();
  if (!query) return true;
  const t = text.toLowerCase();
  let i = 0;
  for (const c of query) {
    i = t.indexOf(c, i);
    if (i === -1) return false;
    i += 1;
  }
  return true;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => ACTIONS.filter((a) => fuzzy(query, `${a.label} ${a.keywords ?? ""} ${a.hint}`)),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    setCopied(false);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => setSel(0), [query]);

  async function exec(a: Action) {
    if (a.id === "copy-pool") {
      await a.run(router);
      setCopied(true);
      setTimeout(onClose, 550);
      return;
    }
    await a.run(router);
    onClose();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (results.length ? Math.min(s + 1, results.length - 1) : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = results[sel];
      if (a) void exec(a);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[16vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={
              reduce
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 26 } }
            }
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
            className="u-glass w-full max-w-lg overflow-hidden rounded-2xl"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions…"
                aria-label="Search actions"
                spellCheck={false}
                className="w-full bg-transparent py-3.5 text-[15px] text-foreground caret-[#FF3B00] outline-none placeholder:text-muted-foreground/50"
              />
              <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
                esc
              </kbd>
            </div>
            <div className="max-h-[46vh] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No actions match “{query}”.</p>
              ) : (
                results.map((a, i) => {
                  const active = i === sel;
                  const showCopied = a.id === "copy-pool" && copied;
                  const Icon = showCopied ? Check : a.icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onMouseMove={() => setSel(i)}
                      onClick={() => void exec(a)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                          active ? "bg-[#FF3B00]/12 text-[#FF3B00]" : "bg-white/[0.04] text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-[15px] text-foreground">
                        {showCopied ? "Copied pool contract ID" : a.label}
                      </span>
                      <kbd className="shrink-0 font-mono text-[11px] text-muted-foreground/70">{a.hint}</kbd>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
