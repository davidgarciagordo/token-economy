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
