# Spec v2 (LOCKED at checkpoint-2) — `--json` / `--json-out` for context-pack.mjs

Integrates: draft.md + grill-verdicts.md + decisions-1.md + regrill-verdicts.md + decisions-2.md.

## CLI contract
- `--json` — boolean, no value, any position. Detection is an EXACT token match
  (`process.argv.includes('--json')`) — never a prefix/startsWith check (`--json-out` contains it).
  Emits a JSON serialization of the pack **to a file** (never stdout). Default path:
  `<root>/.token-economy/context-pack.json`.
- `--json-out <path>` — names the JSON file and **implies JSON emission by itself**:
  `jsonWanted = argv.includes('--json') || jsonOutArg != null`. Must be in `FLAGS_WITH_VALUE`
  (or its value would be taken as the target). `--out` keeps meaning the md path unconditionally.
- **Stale-pair prevention (G3, reworked):** whenever this run does NOT write the DEFAULT json path
  (either no JSON requested, or `--json-out` diverted elsewhere), a pre-existing default-path JSON
  is deleted — best-effort (`try { unlinkSync } catch {}` — never aborts the md write), only AFTER
  target validation succeeds (a missing-target exit-2 run mutates nothing), and SKIPPED when the
  default json path IS the run's target. A custom `--json-out` file from a prior run is the
  caller's to manage.
- Known limitation (documented in header + README): a concurrent reader of the default json can
  see ENOENT during that delete — treat as retryable; the single-orchestrator-writer doctrine
  avoids it.
- Usage text documents: both flags, file-only output, `--json` takes no value.

## JSON shape (schemaVersion 1)
```json
{
  "schemaVersion": 1,
  "target": "<repo-relative path>",
  "targetLines": <int>,
  "targetEmbedding": "full" | "outline",
  "content": "<embedded text — full below cap, outline above (same cap as md)>",
  "keywords": ["..."],
  "repoMap": [ { "file": "...", "line": <int>, "text": "<≤100 chars>", "kind": "anchor" | "keyword" } ],
  "sharedFound": []
}
```
- `repoMap` = **exactly the md's truncated view**. The truncation is TWO-STAGE and BOTH stages
  must be preserved in the shared data-building step: (1) keyword hits capped at ≤3/file at
  COLLECTION time (today's line ~193 — the render-time `slice(0,4)` is currently dead code for
  keyword hits; do not "simplify" to a single cap of 4, that changes md output for files with ≥4
  matches); (2) render caps: ≤4 entries/file after grouping, text truncated to 100 chars. File
  ordering MUST use `String.prototype.localeCompare` (as today) — a default `sort()` differs on
  mixed-case names and silently breaks R7.
- `JSON.stringify(data, null, 2) + '\n'`. No timestamps, no absolute paths.
- Field name is `targetEmbedding` (enum) — NOT `targetEmbedded` (existing variable holding text);
  that variable gets renamed to `embeddedText` to kill the collision.

## Implementation constraints
- Zero deps, Node >= 14, flags-anywhere parsing preserved (`--json`/`--json-out` added correctly:
  `--json` NOT in FLAGS_WITH_VALUE, `--json-out` IS).
- `fs.mkdirSync(dirname, {recursive:true})` independently for BOTH output paths before writing.
- Exit codes unchanged: 2 usage/no-target, 2 missing target — with `--json` present, still exit 2
  and write NOTHING.
- Md output stays byte-identical to pre-change output for identical inputs (R7).
- Header comment + README: determinism is same-machine; cross-machine depends on checkout
  line-endings; non-UTF8 targets degrade via U+FFFD (documented limits, no runtime checks).
- Stdout summary gains `  json     : <path>` when JSON was written (R13).

## Tests (M3 — versioned harness)
`tests/context-pack.test.sh` — bash, zero deps, run manually or in CI. Cases: T1 md byte-identity
pre/post (against git HEAD version) · T2 JSON shape (all R2-R5 fields, parses) · T3 JSON
determinism (two runs, cmp) · T4 `--out custom.md` + `--json-out custom.json` both land · T5
flags-anywhere (`--json SKILL.md` ≡ `SKILL.md --json`) · T6 outline above cap
(`targetEmbedding: "outline"`) · T7 `--json-out` ALONE writes JSON · T8 missing target + `--json`
→ exit 2, nothing written, stale json NOT deleted · T9 no-json run deletes stale default json ·
T10 `--json-out custom` run also deletes stale DEFAULT json · T11 target == default json path →
no delete · T12 `--root <dir> --json` composition.

## Non-goals
JSON on stdout · streaming · JSON→md conversion · line-ending normalization · encoding validation
· atomic write-then-rename (P4 documented instead).

## Acceptance Matrix
→ `acceptance-matrix.md` (same directory) — canonical DoD; the hook gates on it.
