# Owner checkpoint #1 — decisions (2026-07-02)

One multi-select batch presented; owner picked (all = orchestrator's recommendation):

- **G1 → separate `--json-out <path>` flag.** `--out` keeps meaning the md path unconditionally
  (backward compatible); `--json-out` names the JSON. Both settable in one invocation.
- **G2 → JSON `repoMap` = the md's exact truncated view** (≤4 hits/file, 100-char text) — md and
  JSON always report the same data for the same run.
- **G3 → running without `--json` deletes a pre-existing default-path JSON** — the default md+json
  pair is always coherent or the json doesn't exist.
- **G4 → document the limits, no runtime cost**: same-machine determinism guaranteed; cross-machine
  depends on checkout line-endings; non-UTF8 degrades via U+FFFD. Header + README line.
- **G5 → keep the stdout summary line and formalize it as R13** in the Reference Standard.

Mechanical items M1-M5 from grill-verdicts.md go into the spec without further owner input.
