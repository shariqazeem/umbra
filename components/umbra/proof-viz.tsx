"use client";

// ProofViz — the "crypto as art" moment. While a real Groth16 proof is generated
// off-thread, this renders a live Merkle-inclusion visualization: the inclusion path
// climbs from a leaf (your note) to the root in signal orange, the co-path siblings
// pulse as they hash in, and the root crowns when the proof lands. Driven entirely by
// the REAL prover stage — it is not decorative filler, it tracks actual work:
//   loading-key → a scan shimmer over a dim tree
//   proving     → the inclusion path climbs, looping, Poseidon "hashing" at each node
//   done        → the whole path settles lit, the root flashes
//
// Design-system honest: black surface, #FF3B00 reserved for the cryptographic action,
// glow (not shadow) for depth, JetBrains Mono for the readout. Respects reduced motion.
import { motion, useReducedMotion } from "framer-motion";
import type { ProverStage } from "@/lib/umbra/prover-protocol";

const SIGNAL = "#FF3B00";
const DEPTH = 3; // 8 leaves — a legible tree (the real tree is depth 6); art favors clarity
const TARGET_LEAF = 5; // the leaf whose inclusion we prove ("your note")

const W = 320;
const H = 168;
const PAD_Y = 16;

type Node = {
  level: number; // 0 = root … DEPTH = leaves
  index: number; // 0-based within the level
  x: number;
  y: number;
  onPath: boolean; // an ancestor of the target leaf (the inclusion path)
  isSibling: boolean; // a co-path witness that hashes into the path
  isTarget: boolean; // the leaf itself
};

// Precompute the tree layout + which nodes are on the inclusion path / are its siblings.
function buildTree(): { nodes: Node[]; edges: { from: Node; to: Node }[] } {
  // Ancestors of the target leaf, by level (level → node index on the path).
  const pathIndexAt: number[] = [];
  let k = TARGET_LEAF;
  for (let level = DEPTH; level >= 0; level--) {
    pathIndexAt[level] = k;
    k = k >> 1;
  }
  const levelY = (level: number) => PAD_Y + (level * (H - 2 * PAD_Y)) / DEPTH;
  const nodeX = (level: number, index: number) => (W * (index + 0.5)) / 2 ** level;

  const nodes: Node[] = [];
  const byKey = new Map<string, Node>();
  for (let level = 0; level <= DEPTH; level++) {
    for (let index = 0; index < 2 ** level; index++) {
      const onPath = pathIndexAt[level] === index;
      const isSibling = !onPath && (index ^ 1) === pathIndexAt[level]; // sibling of the path node
      const node: Node = { level, index, x: nodeX(level, index), y: levelY(level), onPath, isSibling, isTarget: level === DEPTH && onPath };
      nodes.push(node);
      byKey.set(`${level}:${index}`, node);
    }
  }
  const edges: { from: Node; to: Node }[] = [];
  for (const n of nodes) {
    if (n.level === 0) continue;
    const parent = byKey.get(`${n.level - 1}:${n.index >> 1}`)!;
    edges.push({ from: n, to: parent });
  }
  return { nodes, edges };
}

const { nodes: NODES, edges: EDGES } = buildTree();
// Wave delay so the pulse climbs from the leaf (level DEPTH) up to the root (level 0).
const climbDelay = (level: number) => (DEPTH - level) * 0.16;

const CAPTION: Record<ProverStage, string> = {
  idle: "idle",
  "loading-key": "loading proving key",
  proving: "poseidon · merkle · groth16",
  done: "groth16 proof ready",
  error: "proof failed",
};

export function ProofViz({ stage }: { stage: ProverStage }) {
  const reduce = useReducedMotion();
  const climbing = stage === "proving" && !reduce;
  const settled = stage === "done";
  const loading = stage === "loading-key";
  const failed = stage === "error";
  const lit = settled || reduce; // reduced-motion → show the path statically lit

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="relative w-full max-w-[320px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Zero-knowledge Merkle inclusion proof">
          {/* Edges */}
          {EDGES.map((e, i) => {
            const active = e.from.onPath && e.to.onPath;
            const sib = e.from.isSibling; // sibling → path parent (the witness hashing in)
            return (
              <motion.line
                key={`e${i}`}
                x1={e.from.x}
                y1={e.from.y}
                x2={e.to.x}
                y2={e.to.y}
                stroke={active || sib ? SIGNAL : "#2A2A2A"}
                strokeWidth={active ? 1.6 : 1}
                strokeLinecap="round"
                initial={false}
                animate={
                  active
                    ? climbing
                      ? { opacity: [0.15, 0.9, 0.15] }
                      : { opacity: lit ? 0.9 : 0.18 }
                    : sib
                      ? climbing
                        ? { opacity: [0.05, 0.4, 0.05] }
                        : { opacity: lit ? 0.4 : 0.12 }
                      : { opacity: 0.5 }
                }
                transition={active || sib ? { duration: 1.5, repeat: climbing ? Infinity : 0, delay: climbDelay(e.from.level), ease: "easeInOut" } : { duration: 0.3 }}
              />
            );
          })}

          {/* Nodes */}
          {NODES.map((n) => {
            const key = `${n.level}:${n.index}`;
            const base = n.onPath ? SIGNAL : n.isSibling ? SIGNAL : "#3A3A3A";
            const r = n.isTarget || n.level === 0 ? 5.5 : n.onPath ? 4.5 : 3.5;
            const glow = climbing || lit ? `drop-shadow(0 0 6px ${SIGNAL})` : "none";

            if (n.onPath) {
              return (
                <motion.circle
                  key={key}
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={base}
                  style={{ filter: glow }}
                  initial={false}
                  animate={
                    climbing
                      ? { opacity: [0.45, 1, 0.45], r: [r, r * 1.4, r] }
                      : { opacity: lit ? 1 : 0.5, r: settled && n.level === 0 ? [r, r * 1.6, r] : r }
                  }
                  transition={
                    climbing
                      ? { duration: 1.5, repeat: Infinity, delay: climbDelay(n.level), ease: "easeInOut" }
                      : { duration: settled && n.level === 0 ? 0.6 : 0.3 }
                  }
                />
              );
            }
            if (n.isSibling) {
              return (
                <motion.circle
                  key={key}
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill="none"
                  stroke={SIGNAL}
                  strokeWidth={1.4}
                  initial={false}
                  animate={climbing ? { opacity: [0.2, 0.75, 0.2] } : { opacity: lit ? 0.7 : 0.3 }}
                  transition={{ duration: 1.5, repeat: climbing ? Infinity : 0, delay: climbDelay(n.level), ease: "easeInOut" }}
                />
              );
            }
            // Off-path lattice — dim structure so the tree reads as a whole.
            return <circle key={key} cx={n.x} cy={n.y} r={r} fill="#2A2A2A" opacity={0.55} />;
          })}

          {/* loading-key scan shimmer */}
          {loading && !reduce && (
            <motion.rect
              x={0}
              y={0}
              width={40}
              height={H}
              fill={`url(#scan)`}
              initial={{ x: -40 }}
              animate={{ x: W }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            />
          )}
          <defs>
            <linearGradient id="scan" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={SIGNAL} stopOpacity="0" />
              <stop offset="50%" stopColor={SIGNAL} stopOpacity="0.16" />
              <stop offset="100%" stopColor={SIGNAL} stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <p className={`font-mono text-[11px] tracking-wide ${failed ? "text-destructive" : settled ? "text-[#FF3B00]" : "text-muted-foreground"}`}>
        {settled && <span className="mr-1">✓</span>}
        {CAPTION[stage]}
        {(climbing || loading) && <span className="ml-0.5 animate-pulse">…</span>}
      </p>
    </div>
  );
}
