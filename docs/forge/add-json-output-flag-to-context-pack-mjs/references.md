# Reference Standard — enumerated capabilities

**Reference:** the existing `scripts/context-pack.mjs` CLI contract (inspectable, this repo) +
the markdown pack's information content (what any consumer can extract today). Greenfield only
for the serialization format itself (declared: JSON shape is first-principles, `schemaVersion`d).

| req-id | capability (from the reference) | in-scope |
|--------|----------------------------------|----------|
| R1 | `--json` flag accepted in any argument position (matches existing flags-anywhere parsing) | yes |
| R2 | JSON carries the target path (repo-relative) exactly as the md does | yes |
| R3 | JSON carries extracted keywords (same list, same order as md) | yes |
| R4 | JSON carries every repo-map hit as `{file, line, text}` (same caps: ≤3 hits/file keyword, ≤40 files, anchors always) | yes |
| R5 | JSON carries `sharedFound: []` (empty, orchestrator-fillable) + `schemaVersion` | yes |
| R6 | JSON output is byte-deterministic across reruns (same guarantee as md) | yes |
| R7 | Default md output remains byte-identical to pre-change output (no regression) | yes |
| R8 | `--json` composes with `--root`, `--out`, `--max-target-lines`; `--out` with `--json` writes JSON to that path | yes |
| R9 | Exit codes preserved: 2 on no-target/usage, 2 on missing target file | yes |
| R10 | Usage text documents the new flag | yes |
| R11 | Target-embedding cap applies to JSON too (outline object above the cap, full content below) | yes |
| R12 | Streaming/stdout mode | no — out of scope (Non-goals) |
