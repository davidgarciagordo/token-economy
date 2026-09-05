**English** | [Español](README.es.md)

# token-economy — Usage Examples

> Copy-paste prompts showing when the context-pack gate fires, when it doesn't, and what changes in the output.

These are real prompts — paste one into Claude Code with token-economy installed. Each example shows what fires (the gate check, the script, the lens agents), and what the resulting cost looks like.

---

## The gate, restated

Before the 2nd agent of any fan-out: **will these agents open any of the same files?** YES → context-pack mandatory. NO (disjoint modules) → skip it. Re-checked per fan-out, not per task.

---

## 1. Multi-lens code review of one diff (the flagship case)

```
Review this pull request for architecture, security, performance and data-model concerns —
use four separate lenses in parallel.
```

**What fires:** four lenses reviewing the *same diff* obviously share files — context-pack is mandatory. Claude runs the scanner once:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <path/to/changed/file>
```

writing `.token-economy/context-pack.md` (diff content + repo map with `file:line` anchors + an empty `SHARED-FOUND` section). Each of the four `token-economy:readonly-lens` agents gets the identical prompt prefix — `Lens: security. Checks: injection, auth, secrets. Pack: .token-economy/context-pack.md` — with only the lens name and checklist changing. None of the four re-reads the repo; each opens the pack once and reports back `OK` or `KO <file>:<line> <problem> → <fix>`, no narration.

**What changes:** measured on a real 4-lens design-review pass — roughly ~108k tokens per lens if each re-read the repo and wrote verbose output, ~42k with the pack + terse contract. The pack build itself (~74k, one-time) amortizes across all four lenses and across any later pass on the same target.

## 2. A migration sweep across many files

```
Migrate every usage of the old `Logger` class to the new `StructuredLogger` API
across the codebase, then verify nothing still imports the old one.
```

**What fires:** a sweep is exactly the "multi-phase build over one area" case from the gate table — mandatory. The pack's repo map gives every sub-agent the list of call sites up front (`file:line` anchors from the initial scan), so the migration agents don't each grep the whole tree to rediscover what the first one already found.

## 3. Disjoint research, then a same-domain build (re-check per fan-out)

```
First, research how three unrelated services in this monorepo (billing, notifications,
search) each handle retries today — one agent per service, they don't need to talk to
each other. Then, once we've picked an approach, implement it across all three.
```

**What fires — two different answers in one task:** phase 1 is disjoint (each research agent owns its own module, never opens another's files) — **no pack**. Phase 2 is a same-domain build over the three services with a shared approach — **pack mandatory**, even though phase 1 just finished without one. The gate is re-checked per fan-out, not inherited from the previous phase.

## 4. Single-agent session — frugal only, no pack

```
Add a `--dry-run` flag to scripts/deploy.sh.
```

**What fires:** one agent, one target — the context-pack gate is about *multiple* agents opening the *same* files, so it never applies here. The only thing that fires is `frugal`, active on every response regardless of fan-out: the reply leads with the diff, no per-step "now I'll edit the file" narration, one line at the end if anything is worth flagging.

## 5. A second pass on the same target (the biggest win)

```
[same session or a later one] Now also review the export logic in the same file
for the same four concerns.
```

**What fires:** `mem-stale.sh`-equivalent freshness check on the existing pack — if the target file's tree hash hasn't changed, the pack is reused as-is, no rescan. Measured on a real second design pass over the same component: ~671k tokens if rebuilt from scratch every time, ~94k reusing the pack and prior findings — the cross-run reuse is the mechanism's largest lever, bigger than the per-lens saving on a first pass.

---

## Composing with the family

- **`caveman`** (style compression) stacks with `frugal` (token/narration cutting) — different axes, no collision.
- **`claude-mem`**, if installed, is the preferred memory backend for the write-after step (search-before comes free via its MCP `search` tool); otherwise the file backend (`.token-economy/memory.md`) is used.
- **`working-methods`**'s `/grill` and **`design-review`**'s lenses already run read-only + terse over a shared pack internally — token-economy is where that mechanism lives canonically, not a dependency those plugins call into (see the README's "Relation to forge-methodology / design-review").
