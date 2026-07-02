# Intent — add `--json` output flag to context-pack.mjs

## Value question (answered first)
**Who needs this and why:** downstream tooling — an orchestrator, CI step, or sibling plugin
(design-review's preflight, working-methods' grill-context) that wants the repo map / keywords /
anchors WITHOUT parsing markdown. Today the pack is markdown-only; any programmatic consumer has
to scrape it. A `--json` flag turns the same single scan into a machine-readable artifact.

## Brainstorm — option space
- **A. `--json` flag, same scan, second serialization** (recommended): one code path builds a data
  object; `--json` writes `context-pack.json` next to the .md (or to `--out`). Markdown stays the
  default and the human/agent-facing form.
- **B. JSON-only mode replacing markdown:** breaks the existing lens contract (agents read the .md).
  Rejected.
- **C. Separate script (`context-pack-json.mjs`):** duplicates the scan logic — violates the
  plugin's own discover-once doctrine. Rejected.

## Decisions
- Option A. Markdown remains default; `--json` is additive.
- JSON must carry the same information: target, keywords, anchors+keyword hits (file/line/text),
  and an empty `sharedFound` array; plus `schemaVersion` for future evolution.
- Determinism requirement applies to the JSON too (byte-stable across reruns).

## Non-goals
- No JSON→markdown converter, no streaming, no config file.
- No change to the default markdown output (byte-compatible with today's).

## Constraints
- Node >= 14, zero deps (the script's existing bar).
- The flag must compose with existing flags (`--root`, `--out`, `--max-target-lines`).
