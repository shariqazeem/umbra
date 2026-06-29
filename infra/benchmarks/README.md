# infra/benchmarks

Reproducible output of the Phase-0 harness.

- `results/latest.json` — full machine-readable report (capability matrix, every
  benchmark's criteria, measurements, evidence, timings, summary, exit code).
- `results/latest.md` — human-readable Markdown of the same run.
- `results/run-<timestamp>.json` — immutable per-run snapshot (provenance).

Generated reports are git-ignored except `.gitkeep`; commit a specific
`run-<timestamp>.json` when you want to preserve evidence (e.g. the Day-0 gate
result attached to a PR).

## Reproducibility contract

- Benchmarks run in a fixed order; the report records the exact environment
  (platform, node version, capability matrix) so a verdict is interpretable later.
- `node`/`cargo` benchmarks are deterministic. `testnet` benchmarks record the
  contract id and tx so the on-chain result is independently checkable on an explorer.
- Exit code is non-zero iff any benchmark FAILed or ERRORed; SKIP never fails CI.

```
pnpm benchmark
cat infra/benchmarks/results/latest.md
```
