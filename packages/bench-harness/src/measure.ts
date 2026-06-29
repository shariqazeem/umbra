/** Timing and descriptive-statistics helpers. No global clock state. */

/** High-resolution elapsed milliseconds for a synchronous or async thunk. */
export async function timed<T>(fn: () => Promise<T> | T): Promise<{ value: T; ms: number }> {
  const start = process.hrtime.bigint();
  const value = await fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { value, ms };
}

export interface Stats {
  n: number;
  mean: number;
  median: number;
  p95: number;
  min: number;
  max: number;
  stddev: number;
}

/** Descriptive statistics over a sample (e.g. repeated proving latencies). */
export function stats(samples: number[]): Stats {
  if (samples.length === 0) {
    return { n: 0, mean: 0, median: 0, p95: 0, min: 0, max: 0, stddev: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const quantile = (q: number): number => {
    const idx = Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1));
    return sorted[idx]!;
  };
  return {
    n,
    mean,
    median: quantile(0.5),
    p95: quantile(0.95),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    stddev: Math.sqrt(variance),
  };
}

/** Run a sampled measurement: `iters` repetitions of `fn`, returning per-iter ms. */
export async function sample(iters: number, fn: (i: number) => Promise<void> | void): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < iters; i++) {
    const { ms } = await timed(() => fn(i));
    out.push(ms);
  }
  return out;
}

/** Format a large integer (e.g. CPU instructions) with thousands separators. */
export function groupDigits(n: number | bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "_");
}
