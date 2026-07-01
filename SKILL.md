---
name: token-economy
description: Use when orchestrating MULTI-AGENT work in Claude Code — fanning out sub-agents, a review/audit across many files, a migration/sweep, or any task where several agents would each re-scan the same code. Cuts INPUT/orchestration tokens without losing quality. The orchestrator (you, the model) applies the levers ITSELF — build a discover-once context-pack (run scripts/context-pack.mjs via your Bash tool), dispatch sub-agents READ-ONLY + TERSE over that pack, mutate in one pass, use pluggable memory across runs; pair with the `frugal` output-style. The USER never runs the scripts — you do, as part of normal orchestration. Complements caveman (output-style compression); they stack.
---

# token-economy

caveman compresses how each word is *said* (output, always-on). token-economy cuts how many
tokens go *in* — the orchestration, the re-scanning, the re-reporting — and adds output
discipline for the main thread. Complementary; they stack.

Each lever below is a real mechanism, not advice. Apply the ones the task needs.

## The levers

1. **Discover once → context-pack.** Scan the repo a single time; every agent reads the
   artifact instead of re-scanning. → `scripts/context-pack.mjs`
   ```
   node scripts/context-pack.mjs <target>   # → .token-economy/context-pack.md
   ```

2. **Terse agent output.** Sub-agents report `OK`/`KO` + one line per finding, no narration,
   no re-stating the task. Enforced by an output contract. → `agents/readonly-lens.md`

3. **Frugal main-thread output-style.** The main thread does the work but leads with the
   result and gives one tight summary — no per-step status, no filler. → `output-styles/frugal.md`
   (the caveman-complement for output; stacks with caveman.)

4. **Read-only analysis + mutate-in-one-pass.** Diagnosis agents get `tools: ["Read","Grep","Glob"]`
   (no Edit/Write = read-only by construction). Collect ALL findings, then mutate in a single
   editing pass — don't interleave analyze/edit/re-analyze. → `agents/readonly-lens.md`

5. **Pluggable memory.** search-before / write-after, orchestrator-owned (no per-agent races),
   degrades MCP → file. Turns this run's discovery into next run's free context.
   → `references/memory-adapter.md`

6. **Cap + cache.** Cap fan-out per file (anchors + ≤3 keyword hits/file, ≤40 files in the pack);
   cache artifacts (`context-pack`, `SHARED-FOUND`, memory) so a second pass on the same target
   reuses them instead of rebuilding. The deterministic pack (no Date.now/random) is byte-stable,
   so caching is safe. → `scripts/context-pack.mjs` + `references/memory-adapter.md`

## When to reach for it

Multi-phase / multi-file / multi-agent work (research, audit, design-review, migration):
build the pack once, dispatch read-only lenses with the terse contract, run the main thread in
`frugal`, persist findings via the memory adapter. For a trivial one-file edit, skip it — the
overhead isn't worth it.

## Benchmark

See `README.md` → Benchmark. Measured on a design-review pass (Clock Admin): ~2.6× per lens,
~1.8× for a full 4-lens diagnosis, ~7× for a second pass on the same component (artifact reuse).
Cross-run reuse is the biggest win.
