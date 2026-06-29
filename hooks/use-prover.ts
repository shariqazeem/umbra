"use client";

// useProver — drives off-thread Groth16 proving and surfaces live progress.
//
// Posts the witness input to the proving Web Worker, receives {stage, elapsedMs,
// bytes} progress events (no main-thread blocking), and resolves with the proof.
// Logs real cold-start vs warm latency to console.info for measuring on the demo
// machine. Supports Path A (pre-generated proof for video) without removing the
// live path.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { UMBRA_CONFIG } from "@/lib/umbra/config";
import { loadDemoProof, type Groth16ProofJson, type ProverVariant } from "@/lib/umbra/prover";
import type { ProverRequest, ProverStage, ProverWorkerMessage } from "@/lib/umbra/prover-protocol";

export interface ProverProgressState {
  stage: ProverStage;
  elapsedMs: number;
  loadedBytes: number;
  totalBytes: number;
  error: string | null;
}

const IDLE: ProverProgressState = {
  stage: "idle",
  elapsedMs: 0,
  loadedBytes: 0,
  totalBytes: 0,
  error: null,
};

export interface UseProver extends ProverProgressState {
  /** Run a proof off-thread. Returns the same proof shape as prover.ts. */
  run: (
    variant: ProverVariant,
    input: Record<string, unknown>,
    opts?: { preGenerated?: Groth16ProofJson },
  ) => Promise<Groth16ProofJson>;
  reset: () => void;
}

type Pending = {
  resolve: (p: Groth16ProofJson) => void;
  reject: (e: Error) => void;
  variant: ProverVariant;
};

export function useProver(): UseProver {
  const [state, setState] = useState<ProverProgressState>(IDLE);
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const pendingRef = useRef<Map<number, Pending>>(new Map());

  const ensureWorker = useCallback((): { worker: Worker; firstEver: boolean } => {
    if (workerRef.current) return { worker: workerRef.current, firstEver: false };

    // The literal `new Worker(new URL(...))` is what lets the bundler emit the
    // worker chunk. Module worker so it can use ESM imports.
    const worker = new Worker(new URL("../lib/umbra/prover.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (ev: MessageEvent<ProverWorkerMessage>) => {
      const msg = ev.data;
      const entry = pendingRef.current.get(msg.id);
      if (msg.kind === "progress") {
        setState((s) => ({
          ...s,
          stage: msg.stage,
          elapsedMs: msg.elapsedMs,
          loadedBytes: msg.loadedBytes ?? s.loadedBytes,
          totalBytes: msg.totalBytes ?? s.totalBytes,
          error: null,
        }));
      } else if (msg.kind === "done") {
        const { keyLoadMs, proveMs, totalMs, cached } = msg.timings;
        // eslint-disable-next-line no-console
        console.info(
          `[umbra:prover] ${entry?.variant ?? "?"} ${cached ? "warm" : "cold-start"}: ` +
            `keyLoad=${Math.round(keyLoadMs)}ms prove=${Math.round(proveMs)}ms total=${Math.round(totalMs)}ms`,
        );
        setState((s) => ({ ...s, stage: "done", elapsedMs: totalMs, error: null }));
        entry?.resolve(msg.proof);
        pendingRef.current.delete(msg.id);
      } else if (msg.kind === "error") {
        setState((s) => ({ ...s, stage: "error", error: msg.message }));
        entry?.reject(new Error(msg.message));
        pendingRef.current.delete(msg.id);
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      const err = new Error(e.message || "prover worker crashed");
      pendingRef.current.forEach((p) => p.reject(err));
      pendingRef.current.clear();
      setState((s) => ({ ...s, stage: "error", error: err.message }));
    };

    workerRef.current = worker;
    return { worker, firstEver: true };
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  const run = useCallback<UseProver["run"]>(
    async (variant, input, opts) => {
      setState({ ...IDLE });

      // ── Path A: pre-generated proof for video recording. Live proving stays
      // the default; this only fires with an explicit proof or pregen mode + file.
      const preGen =
        opts?.preGenerated ??
        (UMBRA_CONFIG.proofMode === "pregen" ? await loadDemoProof(variant) : null);
      if (preGen) {
        await replayPreGen(setState);
        // eslint-disable-next-line no-console
        console.info(`[umbra:prover] ${variant} pre-generated (Path A / video) — live proving skipped`);
        return preGen;
      }

      // ── Live path: off-thread proving in the worker.
      const wall0 = performance.now();
      const { worker, firstEver } = ensureWorker();
      const id = ++idRef.current;
      const proof = await new Promise<Groth16ProofJson>((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject, variant });
        const req: ProverRequest = { kind: "prove", id, variant, input };
        worker.postMessage(req);
      });
      if (firstEver) {
        // eslint-disable-next-line no-console
        console.info(
          `[umbra:prover] ${variant} first run wall time incl. worker spin-up: ` +
            `${Math.round(performance.now() - wall0)}ms`,
        );
      }
      return proof;
    },
    [ensureWorker],
  );

  return { ...state, run, reset };
}

/** Timed staged replay so the recorded video shows the identical proving UX. */
async function replayPreGen(setState: Dispatch<SetStateAction<ProverProgressState>>): Promise<void> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const total = 3_985_000; // ~ withdraw zkey size, for a realistic readout
  const t0 = performance.now();
  setState({ stage: "loading-key", elapsedMs: 0, loadedBytes: 0, totalBytes: total, error: null });
  for (let i = 1; i <= 8; i++) {
    await sleep(70);
    setState((s) => ({ ...s, stage: "loading-key", elapsedMs: performance.now() - t0, loadedBytes: Math.round((total * i) / 8) }));
  }
  setState((s) => ({ ...s, stage: "proving", elapsedMs: performance.now() - t0 }));
  for (let i = 0; i < 8; i++) {
    await sleep(180);
    setState((s) => ({ ...s, stage: "proving", elapsedMs: performance.now() - t0 }));
  }
  setState((s) => ({ ...s, stage: "done", elapsedMs: performance.now() - t0 }));
}
