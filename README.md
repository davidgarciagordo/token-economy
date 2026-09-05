# token-economy

Claude Code plugin. Cuts input/orchestration tokens in multi-agent work — without cutting coverage.

## The problem

When a task fans out several sub-agents (a code review, an audit, a migration), each agent re-scans the same repo and re-discovers the same facts — and that repeated re-reading, not the answers, is the dominant token cost of multi-agent work. token-economy makes discovery happen **once**, makes every agent's report terse, and stops the main thread from narrating.

## What's inside

| Component | What it does | How it's invoked |
|---|---|---|
| **skill** (`SKILL.md`) | The orchestration doctrine: a binary context-pack gate + 7 levers (discover-once, terse output, prompt-cache prefix, frugal main thread, read-only + mutate-in-one-pass, pluggable memory, cap + cache). | Auto-triggers when you ask Claude for multi-agent work (review / audit / migrate / fan-out). Claude applies the levers itself — you never run anything. |
| **context-pack script** (`scripts/context-pack.mjs`) | Deterministic single scan (no `Date.now`/`Math.random` → byte-stable, cacheable) → `<repo-root>/.token-economy/context-pack.md`: target content + repo map (file:line anchors and keyword precedents) + empty `SHARED-FOUND`. `--json` / `--json-out` emit the same data as JSON for tooling. Targets longer than `--max-target-lines` (default 400) embed a line-numbered **outline** instead of full content, so N agents don't each pay for a huge target. | Claude runs it via its Bash tool: `node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <target>` |
| **read-only lens agent** (`agents/readonly-lens.md`) | Analysis lens with `tools: ["Read","Grep","Glob"]` — no Edit/Write/Bash, so read-only is enforced by construction. Output contract: `OK`/`KO` + one line per finding (`KO <file>:<line> <problem> → <fix>`), no narration, no re-reporting `SHARED-FOUND`. | Agent tool as `token-economy:readonly-lens` (the invocation prompt names the lens and its checks). |
| **frugal output-style** (`output-styles/frugal.md`) | Main-thread output discipline: lead with the result, one tight summary, no per-step narration or filler. `keep-coding-instructions: true` — tone only, never coding ability. | Applies automatically (`force-for-plugin: true`). Off-switch: disable the plugin (see Install). |
| **memory adapter** (`references/memory-adapter.md`) | Pluggable search-before / write-after memory, orchestrator-owned (one writer, no races). Backends in preference order: **claude-mem** → other MCP → file (`.token-economy/memory.md`). | Claude consults it when persisting findings across runs. |
| **tests** (`tests/context-pack.test.sh`) | 12-case harness for the script: JSON shape/determinism, flags-anywhere, outline cap, stale-json cleanup rules, `--root` composition. T1 (byte-identity vs a baseline) needs `BASELINE=` set. | `bash tests/context-pack.test.sh` |

One more lever with no file of its own: **prompt-cache**. Every parallel lens is invoked with an identical prompt prefix (`Lens: <name>. Checks: <one line>. Pack: <path>`) pointing at the same pack file — the stable shared prefix is what makes N parallel reads cheap; the per-lens delta goes at the END of the prompt.

## The gate (binary, per fan-out)

`frugal` + terse output apply to all multi-agent work — always on. The **context-pack** is the one lever with a decision, and it's binary, not a vibe. Before the 2nd agent of any fan-out:

> **Will these agents open any of the same files?**
> **YES → context-pack MANDATORY. NO (disjoint modules) → skip it.**

YES: code review of one PR/diff, multi-phase build over one area, migration/sweep, design-review, grill ×3 on one spec. NO: research across unrelated modules, each agent in its own module. Tie-break: if ≥2 agents share even one file, pack it.

Re-check **per fan-out, not per task** — a disjoint research phase (no pack) can be followed by a same-domain build phase (pack mandatory); phase 1 doesn't exempt phase 2.

## Benchmark

Measured on a real design-review pass (Clock Admin, 4-lens diagnosis). Tokens are approximate, comparing a baseline (each lens re-reads the repo + verbose output) against token-economy (one context-pack + terse + read-only):

| metric | baseline (re-read + verbose) | token-economy (context-pack + terse + read-only) | saving |
|---|---|---|---|
| per lens | ~108k | ~42k | ~2.6× |
| full 4-lens diagnosis | ~430k | ~242k (74k one-time pack + 4×42k) | ~1.8× |
| 2nd design, same component | ~671k | ~94k (reuse artifacts) | ~7× |

**Honest caveats:** single component; the pack build is ~74k one-time (it amortizes across lenses and across runs); measured on the design-review pipeline specifically. The biggest win is **cross-run** reuse — the deterministic pack + persisted memory make a second pass on the same target nearly free.

**Proof, not just a claim:** [`docs/forge/add-json-output-flag-to-context-pack-mjs/`](docs/forge/add-json-output-flag-to-context-pack-mjs/) is a complete Forge run built *on this repo, using its own `--json` feature* — spec, plan, grill verdicts, and [`verify.md`](docs/forge/add-json-output-flag-to-context-pack-mjs/verify.md): 12/12 tests passing, confirmed by an independent verifier (someone other than the executor), with the real PreToolUse hook observed blocking a `gh pr create` that had unevidenced rows and then passing once they were filled in.

## Composes with

### caveman

caveman is a communication-compression **skill**, not a registered output-style — it compresses how each word is *said*; token-economy cuts how many tokens go *in* and kills narration. `frugal`'s `force-for-plugin` overrides the `outputStyle` **setting**, which caveman does not occupy, so there is **no collision**: they stack (caveman-frugal = terse pidgin + result-first + no per-step chatter). Only if someone repackaged caveman as an actual output-style would frugal override that packaging — the skill form stacks fine.

### claude-mem

claude-mem is the **preferred memory backend** (see `references/memory-adapter.md`): search-before comes free via its MCP `search` tool, and it records observations automatically through its session hooks — it exposes no explicit write tool, so deterministic write-after uses the file backend (`.token-economy/memory.md`) alongside it. That hybrid is the documented design, not a workaround: claude-mem + token-economy is the recommended pairing.

## Install

Just this plugin:

```bash
/plugin marketplace add davidgarciagordo/token-economy
/plugin install token-economy
```

Or the whole suite (this + design-review, forge-methodology, working-methods, automations, swarm) from [one catalog](https://github.com/davidgarciagordo/claude-plugins):

```bash
/plugin marketplace add davidgarciagordo/claude-plugins
/plugin install token-economy@davidgarciagordo-plugins
```

Nothing else to do — the `frugal` output-style applies automatically (`force-for-plugin: true`). Because it forces itself while the plugin is enabled, the off-switch is **disabling the plugin** (`/plugin` → token-economy → disable), not `/config` — `force-for-plugin` overrides the user's outputStyle setting by design.

## Relation to forge-methodology / design-review

token-economy is the **standalone home of the mechanisms** those plugins already embed — their grill / lens agents run read-only + terse over a shared context-pack. If you use them, you already benefit from the mechanisms inside those pipelines; token-economy is where the mechanisms live canonically (script, agent, tests, benchmark), and it applies them to **any other** multi-agent work — plus the `frugal` output-style and the memory adapter, which those plugins don't ship.

## License

MIT © David García Gordo
