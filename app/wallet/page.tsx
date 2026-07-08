"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Link2,
  Lock,
  RefreshCw,
  Repeat,
  Send,
  Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AmountField, Button, Card, Eyebrow, Field, Pill, Shell } from "@/components/umbra/ui";
import { EclipseGlyph, type EclipseState } from "@/components/umbra/eclipse-glyph";
import { cn } from "@/lib/utils";
import { CryptoTimeline, SHIELD_STEPS } from "@/components/umbra/crypto-timeline";
import { WalletConnect } from "@/components/umbra/wallet-connect";
import { SuccessMark } from "@/components/umbra/success-mark";
import { useProver } from "@/hooks/use-prover";
import { useWallet } from "@/hooks/use-wallet";
import { noteCommitment, walletStore, type WalletNote } from "@/lib/umbra/wallet";
import { addressToField, submitShield, submitTransfer, submitWithdraw } from "@/lib/umbra/soroban";
import { createPaymentLink, linkUrl, type CreatedLink } from "@/lib/umbra/payment-link";
import { encodeClaim, claimUrl } from "@/lib/umbra/private-send";
import { isChainConfigured } from "@/lib/umbra/config";
import { explorerTxUrl } from "@/lib/umbra/network";
import { xlmToStroops, stroopsToXlm } from "@/lib/umbra/units";
import { auditStore } from "@/lib/umbra/audit-store";
import { DisclosureKit } from "@/components/umbra/disclosure-kit";
import { TxProgress, type TxStep } from "@/components/umbra/tx-progress";
import { ProofViz } from "@/components/umbra/proof-viz";
import { AnimatedNumber } from "@/components/umbra/animated-number";
import { deriveSeed } from "@/lib/umbra/note-derivation";
import { deriveNoteKey, encryptNoteOpening } from "@/lib/umbra/note-crypto";
import { recoverFromChain } from "@/lib/umbra/recovery";
import type { Signer } from "@/lib/umbra/signer";

const signerKey = (s: Signer) => (s.kind === "key" ? `key:${s.secret.slice(0, 10)}` : `${s.kind}:${s.address}`);

const NO_NOTES: WalletNote[] = [];
const ASSET = "XLM";
const EXPLORER_TX = (h: string) => explorerTxUrl(h);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Surface a readable error string from anything thrown — never "[object Object]" or blank. */
function errMsg(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
    try {
      const s = JSON.stringify(e);
      if (s && s !== "{}") return s;
    } catch {
      /* fall through to fallback */
    }
  }
  return fallback;
}

type View = "home" | "shield" | "send" | "transfer" | "unshield" | "paylink";
type Phase = "form" | "working" | "done" | "error";

export default function WalletPage() {
  const notes = useSyncExternalStore(walletStore.subscribe, walletStore.getSnapshot, () => NO_NOTES);
  const spendable = useMemo(() => notes.filter((n) => !n.spent && n.leafIndex !== null), [notes]);
  const balance = spendable.reduce((s, n) => s + n.value, 0n);

  const prover = useProver();
  const wallet = useWallet();

  const [view, setView] = useState<View>("home");
  const [phase, setPhase] = useState<Phase>("form");
  const [amount, setAmount] = useState("100");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [txStep, setTxStep] = useState<TxStep>("proving");
  const [lastAmount, setLastAmount] = useState("0");
  const [lastTo, setLastTo] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [claim, setClaim] = useState<string | null>(null);
  // When a cash-out spans multiple notes, which one we're on (1-indexed) of how many.
  const [spendNote, setSpendNote] = useState<{ i: number; n: number } | null>(null);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (wallet.address && !to) setTo(wallet.address);
  }, [wallet.address, to]);

  const ensureSeed = useCallback(async () => {
    if (wallet.signer && !walletStore.hasSeed()) walletStore.setSeed(await deriveSeed(wallet.signer));
  }, [wallet.signer]);

  // The wallet's note-encryption key (deterministic from the seed) — encrypts change-note
  // openings that get posted on-chain, so hidden-value change recovers on any device.
  const noteKey = useCallback(async () => {
    const seed = walletStore.getSeed();
    if (seed === null) throw new Error("Wallet seed unavailable — connect your wallet.");
    return deriveNoteKey(seed);
  }, []);

  const syncFromChain = useCallback(async () => {
    if (!wallet.signer || !isChainConfigured()) return;
    setSyncing(true);
    try {
      const seed = await deriveSeed(wallet.signer);
      walletStore.setSeed(seed);
      const { allLeaves, owned } = await recoverFromChain(seed);
      walletStore.loadChainState(allLeaves, owned);
    } catch (e) {
      console.warn("[umbra] balance sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }, [wallet.signer]);

  // Recover the private balance from chain when a wallet connects (once per signer).
  useEffect(() => {
    const id = wallet.signer ? signerKey(wallet.signer) : null;
    if (!id) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current !== id) {
      syncedFor.current = id;
      void syncFromChain();
    }
  }, [wallet.signer, syncFromChain]);

  function go(v: View) {
    setView(v);
    setPhase("form");
    setMsg(null);
    setLink(null);
    setTxStep("proving");
    setSpendNote(null);
    prover.reset();
  }

  async function onShield() {
    setPhase("working");
    setMsg(null);
    setTxStep("proving");
    try {
      await ensureSeed();
      const value = xlmToStroops(amount);
      if (value <= 0n) throw new Error("Enter an amount to shield.");
      setLastAmount(stroopsToXlm(value));
      const { commitment } = walletStore.createNote(value);
      const input = walletStore.shieldInput(commitment);
      if (!input) throw new Error("couldn't prepare the note");
      const proof = await prover.run("shield", input as unknown as Record<string, unknown>);
      let txHash: string | null = null;
      let leafIndex: number | null = null;
      if (isChainConfigured()) {
        if (!wallet.signer) throw new Error("Connect your wallet to shield on-chain");
        setTxStep("signing");
        const res = await submitShield({ proof, commitment, amount: value }, wallet.signer, (p) => setTxStep(p));
        txHash = res.hash;
        leafIndex = res.leafIndex;
        walletStore.observe(commitment, leafIndex);
        setMsg(res.hash);
      } else {
        await sleep(800);
      }
      void auditStore.log({
        kind: "shield",
        amount: stroopsToXlm(value),
        asset: ASSET,
        direction: "in",
        commitment: String(commitment),
        leafIndex,
        txHash,
        explorerUrl: txHash ? EXPLORER_TX(txHash) : null,
        disclosureNote: `Shielded ${stroopsToXlm(value)} ${ASSET} into the Umbra pool (private deposit).`,
      });
      setPhase("done");
    } catch (e) {
      setMsg(errMsg(e));
      setPhase("error");
    }
  }

  async function doWithdraw(resolvePayout: () => string | null, kind: "send" | "withdraw") {
    const want = xlmToStroops(amount);
    if (want <= 0n) {
      setMsg("Enter an amount.");
      setPhase("error");
      return;
    }
    if (balance < want) {
      setMsg(`Not enough private balance — you have ${stroopsToXlm(balance)} ${ASSET}.`);
      setPhase("error");
      return;
    }
    setPhase("working");
    setMsg(null);
    setTxStep("proving");
    setSpendNote(null);
    try {
      await ensureSeed();
      const payout = resolvePayout();
      if (isChainConfigured() && !payout) throw new Error("Enter a destination Stellar address");
      // Refresh the full on-chain tree before proving so inclusion paths stay valid even if
      // others wrote to the pool since our last sync (a stale tree → an unknown root).
      if (isChainConfigured() && wallet.signer) await syncFromChain();

      // A shielded pool is note-based: each spend consumes ONE note. To cash out an amount
      // larger than any single note, spend SEVERAL — greedily take notes (largest first) until
      // `want` is covered. Every note but the last is a FULL exit (whole note, no change, no
      // insert); the last takes the remainder (with private change if it exceeds it). Because a
      // full exit never changes the on-chain root, every proof stays valid against the ONE
      // synced root, so no re-sync is needed between spends.
      const poolNotes = [...walletStore.spendable()].sort((a, b) =>
        b.value > a.value ? 1 : b.value < a.value ? -1 : 0,
      );
      const plan: { note: WalletNote; take: bigint }[] = [];
      let remaining = want;
      for (const n of poolNotes) {
        if (remaining <= 0n) break;
        const take = n.value < remaining ? n.value : remaining;
        plan.push({ note: n, take });
        remaining -= take;
      }
      if (remaining > 0n) throw new Error(`Not enough private balance — you have ${stroopsToXlm(balance)} ${ASSET}.`);

      // C1 — bind each proof to its payee. field(payout) is the proof's `recipient` public
      // input; on-chain the contract re-derives field(to) and rejects any mismatch.
      const recipient = payout ? await addressToField(payout) : BigInt("12345");
      const payoutAddr: string | null = payout;
      setLastAmount(stroopsToXlm(want));
      if (payout) setLastTo(payout);

      let lastHash: string | null = null;
      for (let i = 0; i < plan.length; i++) {
        const { note, take } = plan[i];
        setSpendNote(plan.length > 1 ? { i: i + 1, n: plan.length } : null);
        setTxStep("proving");
        const cm = noteCommitment({ secret: note.secret, value: note.value });
        const changeValue = note.value - take; // > 0 only on the last (partial) note

        // Change note: seed-derived + its opening encrypted on-chain, so it recovers x-device.
        const change = walletStore.createNote(changeValue);
        const input = walletStore.withdrawInput(cm, recipient, take, {
          secret: change.note.secret,
          value: changeValue,
        });
        if (!input) throw new Error("couldn't build the proof for this note");
        const proof = await prover.run("withdraw", input as unknown as Record<string, unknown>);
        let txHash: string | null = null;
        if (isChainConfigured()) {
          if (!wallet.signer) throw new Error("Connect your wallet to move funds on-chain");
          if (!payout) throw new Error("Enter a destination Stellar address");
          setTxStep("signing");
          const changeCt =
            changeValue > 0n
              ? await encryptNoteOpening(await noteKey(), change.note.secret, changeValue)
              : new Uint8Array(0);
          const { hash, changeLeaf } = await submitWithdraw(
            {
              proof,
              root: BigInt(input.root),
              nullifier: BigInt(input.nullifier),
              recipient: BigInt(input.recipient),
              amount: BigInt(input.amount),
              changeCommitment: BigInt(input.changeCommitment),
              hasChange: input.has_change === "1",
              changeCt,
              to: payout,
            },
            wallet.signer,
            (p) => setTxStep(p),
          );
          txHash = hash;
          lastHash = hash;
          walletStore.markSpent(cm);
          if (changeValue > 0n) walletStore.observe(change.commitment, changeLeaf);
        } else {
          await sleep(900);
        }
        void auditStore.log({
          kind,
          amount: stroopsToXlm(take),
          asset: ASSET,
          direction: "out",
          commitment: String(cm),
          nullifier: String(input.nullifier),
          root: String(input.root),
          txHash,
          explorerUrl: txHash ? EXPLORER_TX(txHash) : null,
          counterparty: payoutAddr,
          disclosureNote:
            kind === "send"
              ? `Sent ${stroopsToXlm(take)} ${ASSET} to ${payoutAddr ?? "a recipient"}. The amount is public; the link to your deposit is not. Any change stays private in the pool.`
              : `Unshielded ${stroopsToXlm(take)} ${ASSET} to your own address${payoutAddr ? ` ${payoutAddr}` : ""}. Any change stays private in the pool.`,
        });
      }
      setSpendNote(null);
      setMsg(lastHash);
      setPhase("done");
    } catch (e) {
      setSpendNote(null);
      setMsg(errMsg(e));
      setPhase("error");
    }
  }
  const onSend = () => doWithdraw(() => to.trim() || null, "send");
  const onUnshield = () => doWithdraw(() => to.trim() || wallet.address, "withdraw");

  // Confidential transfer ("private send"): spend a shielded note and split its HIDDEN
  // value into a recipient note + a change note (1-in/2-out join-split). Produces a bearer
  // claim the recipient imports. No amount appears on-chain (public inputs are only root,
  // nullifier, and the two output commitments).
  async function doTransfer() {
    const sendAmt = xlmToStroops(amount);
    if (sendAmt <= 0n) {
      setMsg("Enter an amount to send.");
      setPhase("error");
      return;
    }
    if (!walletStore.spendable()[0]) {
      setMsg("No private balance yet — shield some funds first.");
      setPhase("error");
      return;
    }
    setPhase("working");
    setMsg(null);
    setClaim(null);
    setTxStep("proving");
    try {
      await ensureSeed();
      if (isChainConfigured() && wallet.signer) await syncFromChain();
      // 1-in/2-out spends ONE note, so it must cover the send + change.
      const note = walletStore.spendable().find((n) => n.value >= sendAmt);
      if (!note) {
        const max = walletStore.spendable().reduce((m, n) => (n.value > m ? n.value : m), 0n);
        throw new Error(
          `No single note covers ${stroopsToXlm(sendAmt)} ${ASSET} — your largest is ${stroopsToXlm(max)}. Shield more, or send up to ${stroopsToXlm(max)}.`,
        );
      }
      setLastAmount(stroopsToXlm(sendAmt));
      const cm = noteCommitment({ secret: note.secret, value: note.value });
      const changeAmt = note.value - sendAmt;
      // out1 = recipient (fresh random secret, delivered via claim). out2 = change
      // (seed-derived so it stays recoverable in the sender's own wallet).
      const recipientSecret = walletStore.freshSecret(sendAmt);
      const change = walletStore.createNote(changeAmt);
      const input = walletStore.transferInput(
        cm,
        { secret: recipientSecret, value: sendAmt },
        { secret: change.note.secret, value: changeAmt },
      );
      if (!input) throw new Error("couldn't build the transfer for this note");
      const proof = await prover.run("transfer", input as unknown as Record<string, unknown>);
      let txHash: string | null = null;
      if (isChainConfigured()) {
        if (!wallet.signer) throw new Error("Connect your wallet to move funds on-chain");
        setTxStep("signing");
        // Encrypt the change (out2) opening under the wallet's note key → posted on-chain so the
        // sender's hidden-value change recovers cross-device. The recipient note (out1) is
        // pending until the recipient claims it — its opening travels on the bearer claim link.
        const changeCt =
          changeAmt > 0n
            ? await encryptNoteOpening(await noteKey(), change.note.secret, changeAmt)
            : new Uint8Array(0);
        const res = await submitTransfer(
          {
            proof,
            root: BigInt(input.root),
            nullifier: BigInt(input.nullifier),
            outCommitment1: BigInt(input.outCommitment1),
            outCommitment2: BigInt(input.outCommitment2),
            changeCt,
          },
          wallet.signer,
          (p) => setTxStep(p),
        );
        txHash = res.hash;
        walletStore.markSpent(cm); // input note spent
        walletStore.observe(change.commitment, res.changeLeaf); // change note now spendable
        setMsg(txHash);
      } else {
        await sleep(1200);
      }
      // The recipient's note (out1) has no leaf yet — the link carries only its opening; the
      // recipient inserts it at claim time.
      setClaim(encodeClaim({ secret: recipientSecret, value: sendAmt }));
      void auditStore.log({
        kind: "send",
        amount: stroopsToXlm(sendAmt),
        asset: ASSET,
        direction: "out",
        commitment: String(cm),
        nullifier: String(input.nullifier),
        root: String(input.root),
        txHash,
        explorerUrl: txHash ? EXPLORER_TX(txHash) : null,
        counterparty: null,
        disclosureNote: `Confidential transfer of ${stroopsToXlm(sendAmt)} ${ASSET} (${stroopsToXlm(changeAmt)} change kept) — both amounts hidden on-chain. Delivered to the recipient as a private claim.`,
      });
      setPhase("done");
    } catch (e) {
      setMsg(errMsg(e));
      setPhase("error");
    }
  }

  async function onPayLink() {
    setPhase("working");
    setMsg(null);
    try {
      const l = await createPaymentLink({
        title: "Private payment request",
        description: "",
        recipientName: "You",
        amount: xlmToStroops(amount),
        signer: wallet.signer,
      });
      setLink(l);
      void auditStore.log({
        kind: "pay_link_created",
        amount: amount,
        asset: ASSET,
        direction: "request",
        label: "Private payment request",
        disclosureNote: `Created a private payment request for ${amount} ${ASSET}.`,
      });
      setPhase("done");
    } catch (e) {
      setMsg(errMsg(e));
      setPhase("error");
    }
  }

  // The eclipse card is the app's heartbeat — its state mirrors the real system state.
  const sheetOpen = view !== "home";
  const eclipseState: EclipseState =
    sheetOpen && phase === "done"
      ? "success"
      : sheetOpen && phase === "working"
        ? "proving"
        : syncing
          ? "syncing"
          : "idle";

  return (
    <Shell active="/wallet" atmosphere="/art/vault.png">
      <div className="mx-auto max-w-xl">
        <WalletHeader balance={stroopsToXlm(balance)} eclipseState={eclipseState} />

        <div className="relative mt-6">
          <HomeBody notes={notes} wallet={wallet} onAction={go} syncing={syncing} onSync={syncFromChain} dim={sheetOpen} />

          <AnimatePresence>
            {sheetOpen && (
              <Sheet key="sheet" onBack={() => go("home")} locked={phase === "working"}>
                <ActionPanel
                  view={view}
                  phase={phase}
                  txStep={txStep}
                  spendNote={spendNote}
                  prover={prover}
                  wallet={wallet}
                  amount={amount}
                  setAmount={setAmount}
                  to={to}
                  setTo={setTo}
                  msg={msg}
                  link={link}
                  copied={copied}
                  setCopied={setCopied}
                  balance={stroopsToXlm(balance)}
                  lastAmount={lastAmount}
                  lastTo={lastTo}
                  onBack={() => go("home")}
                  onShield={onShield}
                  onSend={onSend}
                  onTransfer={doTransfer}
                  onUnshield={onUnshield}
                  onPayLink={onPayLink}
                  claim={claim}
                />
              </Sheet>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Shell>
  );
}

/* ── The iOS sheet: slides up over a dimmed Home, spring-clean. Reduced motion → a plain swap. ── */

function Sheet({ children, onBack, locked }: { children: React.ReactNode; onBack: () => void; locked: boolean }) {
  const reduce = useReducedMotion();
  const spring = { type: "spring", stiffness: 320, damping: 34 } as const;
  return (
    <>
      <motion.div
        aria-hidden
        onClick={locked ? undefined : onBack}
        className="absolute inset-0 -m-2 rounded-[28px] bg-background/55 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="absolute inset-x-0 top-0"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, transition: spring }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 22, transition: { duration: 0.18 } }}
      >
        {children}
      </motion.div>
    </>
  );
}

/* ── The eclipse card: the product icon made monumental. Persistent — its corona is the
   app's heartbeat, tracking idle → syncing → proving → totality. ── */

function WalletHeader({ balance, eclipseState }: { balance: string; eclipseState: EclipseState }) {
  const status =
    eclipseState === "proving"
      ? "Proving"
      : eclipseState === "syncing"
        ? "Syncing"
        : eclipseState === "success"
          ? "Confirmed"
          : "Private";
  return (
    <>
      <Eyebrow>Privacy wallet</Eyebrow>
      <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground">Your private balance</h1>

      <Card
        className={cn(
          "u-signal-glow mt-6 overflow-hidden p-6 transition-shadow duration-500 sm:p-7",
          eclipseState === "proving" && "shadow-signal",
        )}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-sm text-muted-foreground">Shielded balance</span>
            <p className="mt-1.5 font-mono text-display-sm font-semibold leading-none tracking-tight text-foreground">
              <AnimatedNumber value={balance} /> <span className="text-2xl text-muted-foreground">{ASSET}</span>
            </p>
            <div className="mt-3.5">
              <Pill tone="signal"><Lock className="h-3 w-3" /> {status}</Pill>
            </div>
          </div>
          <EclipseGlyph state={eclipseState} size={116} />
        </div>
      </Card>
    </>
  );
}

/* ── Home body: wallet connect, actions, roadmap, activity, recovery, disclosure. Dims and
   scales back behind the sheet — an iOS presenting screen. ── */

function HomeBody({
  notes,
  wallet,
  onAction,
  syncing,
  onSync,
  dim,
}: {
  notes: WalletNote[];
  wallet: ReturnType<typeof useWallet>;
  onAction: (v: View) => void;
  syncing: boolean;
  onSync: () => void;
  dim: boolean;
}) {
  const reduce = useReducedMotion();
  const actions: { v: View; label: string; sub: string; Icon: typeof Send }[] = [
    { v: "transfer", label: "Private send", sub: "Hidden amount → a private claim link", Icon: Sparkles },
    { v: "shield", label: "Shield", sub: "Deposit privately", Icon: ArrowDownToLine },
    { v: "send", label: "Send", sub: "Public amount → any Stellar wallet", Icon: Send },
    { v: "unshield", label: "Unshield", sub: "Cash out to your own wallet", Icon: ArrowUpRight },
    { v: "paylink", label: "Pay link", sub: "Request a payment", Icon: Link2 },
  ];
  return (
    <motion.div
      aria-hidden={dim}
      animate={{ scale: dim && !reduce ? 0.985 : 1, opacity: dim ? 0.5 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      style={{ transformOrigin: "top center" }}
      className={cn(dim && "pointer-events-none select-none")}
    >
      {isChainConfigured() && <WalletConnect wallet={wallet} />}

      {/* Recover-from-chain status */}
      {isChainConfigured() && wallet.signer && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-white/[0.02] px-4 py-2.5">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-[#FF3B00]" : ""}`} />
            {syncing ? "Recovering your private balance from chain…" : "Balance synced from chain — follows your wallet"}
          </span>
          <button
            onClick={onSync}
            disabled={syncing}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Sync
          </button>
        </div>
      )}

      {/* Actions — app tiles. Ember only on Private send (the hero action). */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const hero = a.v === "transfer";
          return (
            <motion.button
              key={a.v}
              onClick={() => onAction(a.v)}
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl border p-5 text-left",
                hero ? "col-span-2 border-[#FF3B00]/40 bg-[#FF3B00]/[0.06]" : "border-border bg-card hover:border-white/15",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  hero ? "bg-[#FF3B00]/15 text-[#FF3B00]" : "bg-white/[0.05] text-foreground",
                )}
              >
                <a.Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-foreground">{a.label}</span>
                <span className="block text-xs text-muted-foreground">{a.sub}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Roadmap */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[{ label: "Private Swap", Icon: Repeat }].map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-4 opacity-60">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-muted-foreground">
              <r.Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">{r.label}</span>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Coming soon</span>
            </span>
          </div>
        ))}
      </div>

      {/* Activity — a native list: mono amounts right-aligned, hairline rows, no cards-in-cards. */}
      <h2 className="mb-3 mt-10 text-sm font-semibold text-muted-foreground">Activity</h2>
      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <EclipseGlyph state="idle" size={64} />
          <p className="font-medium text-foreground">No activity yet</p>
          <button
            onClick={() => onAction("shield")}
            className="text-sm font-medium text-[#FF3B00] underline-offset-4 hover:underline"
          >
            Shield funds
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {notes.map((n, i) => {
            const d = describe(n);
            return (
              <div
                key={i}
                className={cn("flex items-center justify-between gap-3 px-5 py-3.5", i > 0 && "border-t border-border/60")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-muted-foreground">
                    <d.Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">{d.verb}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {n.leafIndex !== null ? `note #${n.leafIndex}` : "pending"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("font-mono text-[15px] font-medium", d.sign === "+" ? "text-verify" : "text-foreground")}>
                    {d.sign}
                    {stroopsToXlm(n.value)} {ASSET}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">{d.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cross-device recovery — the "your balance follows your wallet" moment */}
      {isChainConfigured() && (
        <div className="mt-10">
          <RecoveryCard hasWallet={!!wallet.signer} syncing={syncing} onSync={onSync} />
        </div>
      )}

      {/* Selective disclosure */}
      <div className="mt-10">
        <DisclosureKit />
      </div>
    </motion.div>
  );
}

const RECOVERY_STEPS = [
  { t: "Connect your wallet", s: "No account, no server, no custodian." },
  { t: "Sync from chain", s: "Scan the pool's events — deposits, plus your change's encrypted openings." },
  { t: "Private balance rebuilt", s: "Your Merkle tree and notes, reconstructed from chain." },
  { t: "Withdrawable note found", s: "Re-derived / decrypted with your wallet — ready to spend, anywhere." },
];

function RecoveryCard({ hasWallet, syncing, onSync }: { hasWallet: boolean; syncing: boolean; onSync: () => void }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-foreground">
            <RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </span>
          <h2 className="text-[15px] font-semibold text-foreground">Your balance follows your wallet</h2>
        </div>
        <Pill tone="signal">Cross-device</Pill>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Not an account. Not a server balance.{" "}
        <span className="text-foreground">Deposits and change rebuild from the chain on any device</span> — each
        note&rsquo;s opening is encrypted to your wallet&rsquo;s key. A payment someone sent you is claimed from its
        one-time link.
      </p>
      <div className="mt-5">
        {RECOVERY_STEPS.map((s, i) => {
          const last = i === RECOVERY_STEPS.length - 1;
          return (
            <div key={s.t} className="flex gap-3.5">
              <div className="flex flex-col items-center self-stretch">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF3B00]/10 font-mono text-[11px] font-semibold text-[#FF3B00]">
                  {i + 1}
                </span>
                {!last && <span className="w-px grow bg-gradient-to-b from-[#FF3B00]/30 to-border" />}
              </div>
              <div className={last ? "pb-0.5" : "pb-5"}>
                <p className="text-[14px] font-medium text-foreground">{s.t}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{s.s}</p>
              </div>
            </div>
          );
        })}
      </div>
      {hasWallet && (
        <div className="mt-5 border-t border-border pt-4">
          <Button size="sm" variant="secondary" onClick={onSync} loading={syncing}>
            <RefreshCw className="h-4 w-4" /> {syncing ? "Recovering from chain…" : "Sync from chain"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function describe(n: WalletNote) {
  if (n.spent) return { verb: "Sent privately", label: "Spent", tone: "muted" as const, accent: "border-l-muted-foreground/30", Icon: ArrowUpRight, sign: "−" };
  if (n.leafIndex !== null) return { verb: "Shielded", label: "Available", tone: "ink" as const, accent: "border-l-verify/50", Icon: ArrowDownToLine, sign: "+" };
  return { verb: "Awaiting funding", label: "Pending", tone: "muted" as const, accent: "border-l-border", Icon: ArrowDownToLine, sign: "" };
}

/* ── Action panel: one flow at a time ── */

function ActionPanel(props: {
  view: Exclude<View, "home">;
  phase: Phase;
  txStep: TxStep;
  spendNote: { i: number; n: number } | null;
  prover: ReturnType<typeof useProver>;
  wallet: ReturnType<typeof useWallet>;
  amount: string;
  setAmount: (s: string) => void;
  to: string;
  setTo: (s: string) => void;
  msg: string | null;
  link: CreatedLink | null;
  copied: boolean;
  setCopied: (b: boolean) => void;
  balance: string;
  lastAmount: string;
  lastTo: string | null;
  onBack: () => void;
  onShield: () => void;
  onSend: () => void;
  onTransfer: () => void;
  onUnshield: () => void;
  onPayLink: () => void;
  claim: string | null;
}) {
  const { view, phase, txStep, prover, wallet, amount, setAmount, to, setTo, msg, link, balance, onBack } = props;
  const meta = {
    shield: { title: "Shield funds", sub: "Move public funds into the privacy pool.", cta: "Shield privately", run: props.onShield },
    transfer: { title: "Private send", sub: "Send to anyone via a private claim link — the amount is hidden on-chain and the funds stay shielded until they claim.", cta: "Send privately", run: props.onTransfer },
    send: { title: "Send to address", sub: "Pay any Stellar wallet real XLM. The amount is public, but it can't be linked to you — and your change stays private.", cta: "Send", run: props.onSend },
    unshield: { title: "Unshield", sub: "Cash out to your own wallet. The amount is public but unlinkable to you; your change stays private.", cta: "Unshield", run: props.onUnshield },
    paylink: { title: "Request a payment", sub: "Generate a private link anyone can pay.", cta: "Generate link", run: props.onPayLink },
  }[view];

  return (
    <div className="u-card-lg overflow-hidden rounded-[28px] p-6 sm:p-7">
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Wallet
      </button>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-foreground">{meta.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{meta.sub}</p>

      <div className="mt-7">
        {phase === "done" ? (
          <Success
            view={view}
            msg={msg}
            link={link}
            claim={props.claim}
            copied={props.copied}
            setCopied={props.setCopied}
            amount={props.lastAmount}
            to={props.lastTo}
          />
        ) : phase === "working" ? (
          view === "paylink" ? (
            <CryptoTimeline steps={SHIELD_STEPS} running done={false} />
          ) : (
            /* THE PROVING MOMENT — full-bleed proof art + the live prover terminal. */
            <div className="flex flex-col gap-6 py-2">
              {props.spendNote && (
                <p className="text-center font-mono text-xs text-[#FF3B00]">
                  Cashing out across notes — {props.spendNote.i} of {props.spendNote.n}
                </p>
              )}
              <ProofViz stage={prover.stage} large />
              <TxProgress step={txStep} prover={prover} chain={isChainConfigured()} />
            </div>
          )
        ) : (
          <div className="flex flex-col gap-5">
            {/* Hero amount input */}
            <div>
              <AmountField
                hero
                label={
                  view === "transfer" || view === "send"
                    ? "Amount to send"
                    : view === "unshield"
                      ? "Amount to cash out"
                      : "Amount"
                }
                suffix={ASSET}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {(view === "send" || view === "unshield" || view === "transfer") && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Available · <AnimatedNumber value={balance} /> {ASSET}
                </p>
              )}
            </div>
            {view === "transfer" && (
              <p className="rounded-xl border border-[#FF3B00]/20 bg-[#FF3B00]/[0.04] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Send any amount — your <span className="text-foreground">change comes back to you</span>,
                and both amounts are <span className="text-foreground">hidden on-chain</span>. Your
                recipient gets a one-time claim link to receive it.
              </p>
            )}
            {(view === "send" || view === "unshield") && (
              <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Cash out any amount — the <span className="text-foreground">amount is public</span>, but
                it&rsquo;s unlinkable from your deposit, and any{" "}
                <span className="text-foreground">change stays private</span> in the pool.
              </p>
            )}
            {view === "send" && (
              <Field label="Recipient address" hint="Any Stellar address. Unlinkable from your deposit." mono placeholder="G…" value={to} onChange={(e) => setTo(e.target.value)} />
            )}
            {view === "unshield" && (
              <Field label="Cash out to" hint="Defaults to your connected wallet." mono placeholder="G…" value={to} onChange={(e) => setTo(e.target.value)} />
            )}
            {isChainConfigured() && view !== "paylink" && <WalletConnect wallet={wallet} />}
            <Button size="block" onClick={meta.run}>{meta.cta}</Button>
            {phase === "error" && <p className="text-sm text-destructive">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Evidence cells rise in with a small stagger; reduced motion → a plain fade (readable as text). */
function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Success({
  view,
  msg,
  link,
  claim,
  copied,
  setCopied,
  amount,
  to,
}: {
  view: View;
  msg: string | null;
  link: CreatedLink | null;
  claim: string | null;
  copied: boolean;
  setCopied: (b: boolean) => void;
  amount: string;
  to: string | null;
}) {
  if (view === "transfer" && claim) {
    const url = claimUrl(claim);
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <SuccessMark className="mx-auto" />
        <p className="text-lg font-semibold text-foreground">Sent privately · amount hidden</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          A confidential transfer landed on-chain — the ledger sees a nullifier and a new
          commitment, never the amount. Hand this claim to your recipient to receive it:
        </p>
        {/* QR + claim link on the glass material */}
        <div className="u-glass w-full rounded-2xl p-5">
          <div className="mx-auto w-fit rounded-2xl bg-white p-4">
            <QRCodeSVG value={url} size={160} marginSize={0} />
          </div>
          <div className="mt-4 flex w-full items-center gap-2 rounded-lg bg-white/[0.04] p-2 pl-4 text-left">
            <span className="flex-1 truncate font-mono text-sm text-muted-foreground">{url}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Bearer claim — whoever opens it receives the funds. Share it privately.
          </p>
        </div>
        {msg ? (
          <a
            href={EXPLORER_TX(msg)}
            target="_blank"
            rel="noreferrer noopener"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-[#FF3B00] transition-colors hover:bg-white/[0.04]"
          >
            View the transfer on-chain →
          </a>
        ) : null}
      </div>
    );
  }
  if (view === "paylink" && link) {
    const url = linkUrl(link.id);
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="u-glass w-full rounded-2xl p-5">
          <div className="mx-auto w-fit rounded-2xl bg-white p-4">
            <QRCodeSVG value={url} size={172} marginSize={0} />
          </div>
          <div className="mt-4 flex w-full items-center gap-2 rounded-lg bg-white/[0.04] p-2 pl-4 text-left">
            <span className="flex-1 truncate font-mono text-sm text-muted-foreground">{url}</span>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Share it. Anyone can pay privately; only you can withdraw.</p>
      </div>
    );
  }
  const short = (a: string | null) => (a && a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-5)}` : (a ?? ""));
  const titles: Record<string, string> = { shield: "Funds shielded", send: "Sent privately", unshield: "Unshielded" };
  const youDid: Record<string, string> = {
    shield: `You moved ${amount} ${ASSET} into the private pool.`,
    send: `You sent ${amount} ${ASSET} privately${to ? ` to ${short(to)}` : ""}.`,
    unshield: `You cashed out ${amount} ${ASSET} to your own wallet.`,
  };
  const chainSees: Record<string, string> = {
    shield: `A deposit of ${amount} ${ASSET}. The amount is public — but it can't be linked to any future withdrawal.`,
    send: `A withdrawal${to ? ` to ${short(to)}` : ""} of ${amount} ${ASSET}. The amount is public; the link to your deposit is not.`,
    unshield: `A withdrawal of ${amount} ${ASSET}. The amount is public; the link to your deposit is not.`,
  };
  const provedPrivately: Record<string, string> = {
    shield: "A zero-knowledge proof that your note is well-formed for the public amount — verified on-chain. Your secret never left the browser.",
    send: "A zero-knowledge proof, verified on-chain, that you own a note in the pool — without revealing which one. A one-time nullifier prevents double-spend, and the recipient received the funds.",
    unshield: "A zero-knowledge proof, verified on-chain, that you own a note in the pool — without revealing which one. A one-time nullifier prevents double-spend.",
  };
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <SuccessMark className="mx-auto" />
      <p className="text-lg font-semibold text-foreground">{titles[view] ?? "Done"}</p>
      <div className="mt-1 grid w-full gap-3 text-left sm:grid-cols-2">
        <Rise delay={0.06} className="rounded-xl border border-border bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">What you did</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{youDid[view]}</p>
        </Rise>
        <Rise delay={0.12} className="rounded-xl border border-border bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">What the Stellar ledger sees</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{chainSees[view]}</p>
        </Rise>
      </div>
      <Rise delay={0.18} className="w-full rounded-xl border border-[#FF3B00]/25 bg-[#FF3B00]/[0.04] p-4 text-left">
        <p className="text-[11px] uppercase tracking-wider text-[#FF3B00]">What Umbra proved privately</p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{provedPrivately[view]}</p>
      </Rise>
      {msg ? (
        <a
          href={EXPLORER_TX(msg)}
          target="_blank"
          rel="noreferrer noopener"
          referrerPolicy="no-referrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-[#FF3B00] transition-colors hover:bg-white/[0.04]"
        >
          View on stellar.expert · {msg.slice(0, 8)}…{msg.slice(-6)} <ArrowUpRight className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Demo mode — no on-chain transaction was submitted.</p>
      )}
    </div>
  );
}
