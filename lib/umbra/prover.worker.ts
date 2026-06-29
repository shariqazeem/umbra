// Web Worker: runs Groth16 proving OFF the main thread so the page never freezes.
//
// It lazy-loads the circuit artifacts here — the 3.9 MB withdraw zkey is fetched
// on the FIRST prove, never at page load — streams real byte/elapsed progress
// back to the useProver hook, then calls the EXISTING proveWithArtifacts (same
// circuit, inputs, witness, output as prover.ts). Artifact bytes are cached per
// variant so the second prove is a true warm run (no re-fetch).
import { PROVER_ARTIFACTS, proveWithArtifacts, type ProverVariant } from "./prover";
import type { ProverRequest, ProverWorkerMessage } from "./prover-protocol";

// `self` in a dedicated worker — typed minimally to avoid pulling the webworker
// lib (which conflicts with the dom lib this project compiles against).
interface WorkerScope {
  postMessage(message: ProverWorkerMessage): void;
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}
const ctx = self as unknown as WorkerScope;
const post = (m: ProverWorkerMessage): void => ctx.postMessage(m);

// First prove of a variant = cold (fetch). Subsequent = warm (served from here).
const artifactCache = new Map<ProverVariant, { wasm: Uint8Array; zkey: Uint8Array }>();

/** Fetch a URL into bytes, reporting streamed progress (used for the big zkey). */
async function fetchBytes(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url} (HTTP ${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress?.(buf.length, buf.length || total);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress?.(loaded, total);
    }
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function handle(req: ProverRequest): Promise<void> {
  const { id, variant, input } = req;
  const t0 = performance.now();
  try {
    const art = PROVER_ARTIFACTS[variant];
    let bytes = artifactCache.get(variant);
    const cached = bytes !== undefined;

    // ── stage: loading proving key ──────────────────────────────────────────
    const keyStart = performance.now();
    post({ kind: "progress", id, stage: "loading-key", elapsedMs: 0, loadedBytes: 0, totalBytes: 0 });
    if (!bytes) {
      const [zkey, wasm] = await Promise.all([
        fetchBytes(art.zkeyUrl, (loaded, total) =>
          post({
            kind: "progress",
            id,
            stage: "loading-key",
            elapsedMs: performance.now() - t0,
            loadedBytes: loaded,
            totalBytes: total,
          }),
        ),
        fetchBytes(art.wasmUrl),
      ]);
      bytes = { wasm, zkey };
      artifactCache.set(variant, bytes);
    }
    const keyLoadMs = performance.now() - keyStart;

    // ── stage: generating the proof ─────────────────────────────────────────
    // Heartbeat so the technical readout ticks with the real elapsed time while
    // the (single, long) proving call runs. snarkjs yields to the loop between
    // async chunks, so these fire and prove the worker stays alive.
    const proveStart = performance.now();
    post({ kind: "progress", id, stage: "proving", elapsedMs: performance.now() - t0 });
    const heartbeat = setInterval(
      () => post({ kind: "progress", id, stage: "proving", elapsedMs: performance.now() - t0 }),
      200,
    );
    const proof = await proveWithArtifacts(input, bytes.wasm, bytes.zkey).finally(() =>
      clearInterval(heartbeat),
    );

    const proveMs = performance.now() - proveStart;
    const totalMs = performance.now() - t0;
    post({ kind: "done", id, proof, timings: { keyLoadMs, proveMs, totalMs, cached } });
  } catch (e) {
    post({ kind: "error", id, message: (e as Error)?.message ?? "proving failed" });
  }
}

ctx.addEventListener("message", (ev: MessageEvent) => {
  const data = ev.data as ProverRequest;
  if (data && data.kind === "prove") void handle(data);
});
