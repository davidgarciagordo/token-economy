# Context Pack
> Single-scan artifact. Downstream agents READ this — they do NOT re-scan the repo.

## Target
```
docs/forge/add-json-output-flag-to-context-pack-mjs/draft.md
```

### Content
# Draft — `--json` for context-pack.mjs (concrete design sketch)

## Approach (option A from intent)
Refactor the tail of `context-pack.mjs` minimally: build one in-memory `packData` object, then
serialize it twice — markdown (existing template, unchanged) always, JSON only when `--json`.

## CLI
- New boolean flag `--json` (no value). Add to arg loop as a no-value flag (NOT in
  `FLAGS_WITH_VALUE`).
- Default JSON path: same directory/basename as the md → `<root>/.token-economy/context-pack.json`.
- `--out <path>` + `--json`: `--out` names the JSON file (md keeps its default path). Rationale:
  when you ask for JSON explicitly, `--out` should point at the thing you asked for.

## JSON shape (schemaVersion 1)
```json
{
  "schemaVersion": 1,
  "target": "SKILL.md",
  "targetLines": 74,
  "targetEmbedded": "full | outline",
  "content": "<full text or outline text>",
  "keywords": ["…"],
  "repoMap": [ { "file": "README.md", "line": 3, "text": "…", "kind": "anchor|keyword" } ],
  "sharedFound": []
}
```
- Serialize with `JSON.stringify(data, null, 2)` — key order is insertion order → deterministic.
- No timestamps, no absolute paths (repo-relative only) → byte-stable, cache-safe.

## Code changes (scripts/context-pack.mjs)
1. Collect hits with a `kind` field ('anchor' | 'keyword') at the two collection sites.
2. Build `packData` object right before the markdown template.
3. Markdown template reads from the same fields it uses today (no output change).
4. `if (jsonFlag) fs.writeFileSync(jsonOut, JSON.stringify(packData, null, 2) + '\n')`.
5. Usage text: add `--json` line.
6. Summary stdout lines: add `  json     : <path>` when emitted.

## Tests (manual, scripted in the plan)
- T1 md unchanged: run pre-change and post-change on same target → `cmp` md outputs.
- T2 `--json` writes valid JSON (node -e JSON.parse) with all R2-R5 fields.
- T3 determinism: two `--json` runs → `cmp` byte-identical.
- T4 `--out custom.json --json` → JSON lands at custom path, md at default.
- T5 flags-anywhere: `--json SKILL.md` and `SKILL.md --json` equivalent.
- T6 big target: JSON `targetEmbedded: "outline"` above cap.


---

## Repo map  (file:line of anchors + keyword precedents)
Anchors: config, docs, ADRs, conventions (always included).
Keywords extracted from target: draft, --json, approach, refactor, context-pack.mjs, packdata, flags_with_value, default

  agents/readonly-lens.md:17  1. The **context-pack** — at the path given in your invocation prompt, or (default)
  output-styles/frugal.md:12  the default urge to narrate.
  README.es.md:27  - **context-pack** (`scripts/context-pack.mjs`, Claude lo ejecuta como `node "${CLAUDE_PLUGIN_ROOT}/
  README.md:3  Claude Code plugin. Cuts input/orchestration tokens in multi-agent work (review, audit, migration, a
  scripts/context-pack.mjs:3  * context-pack.mjs — deterministic, single-scan context-pack assembler.
  scripts/context-pack.mjs:12  *   node context-pack.mjs <target> [--root <dir>] [--out <path>]
  scripts/context-pack.mjs:15  *   --root    repo root (default: git root of cwd)
  SKILL.md:3  description: Use when orchestrating MULTI-AGENT work in Claude Code — fanning out sub-agents, a revi
  SKILL.md:17  artifact instead of re-scanning. → `scripts/context-pack.mjs`
  SKILL.md:19  node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <target>   # → .token-economy/context-pack.md 

---

## SHARED-FOUND
<!-- The orchestrator fills this with findings discovered ONCE, before dispatching agents.
     Downstream agents must NOT re-report anything already listed here. -->
