# Owner checkpoint #2 — decisions (2026-07-02) — SPEC LOCKED after this

- **All 10 re-grill KOs integrated into the spec** (G3 trigger reworked, `--json-out` implies
  json for real, delete best-effort + after target validation + skip-if-target, localeCompare
  mandated, both cap stages preserved, tests homed, exact-match `--json` + jsonOut presence).
- **P4 race → documented as a known limitation** (ENOENT during concurrent read = retryable;
  single-orchestrator-writer doctrine already avoids it). No atomic-rename machinery.
- **M3 tests → versioned `tests/context-pack.test.sh`** (bash, zero deps, ~10 cases; the
  Acceptance Matrix evidence column points at its output).

Spec bumped to v2 and locked. No cut lines: all in-scope rows ship in this run (single small unit).
