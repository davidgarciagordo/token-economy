# Re-grill verdicts — 2 focused passes on the SPEC

## Pass A — regression (do the checkpoint-1 fixes hold?)
- G1, G2, G4, G5, M1, M2, M4: **OK** — spec encodes them unambiguously; cap numbers, stdout
  padding, rename targets all verified against the real script (no contradictions).
- **G3 KO** — deletion trigger is "invocation lacks `--json`", so `B.md --json-out custom.json`
  leaves a stale DEFAULT json(A) next to a fresh default md(B): the exact mismatch G3 was meant to
  prevent. → trigger deletion whenever this run's JSON did not land at the default path.
- **M3 KO** — no Tests section in the spec; no home named for the R9/R8 tests. → spec must name
  the harness (versioned test script).
- **M5 KO** — exact-match `--json` detection absent from the spec's CLI contract.

## Pass B — new seams (what did the fixes themselves create?)
- **P1 KO** — M5's strict `argv.includes('--json')` returns false for `--json-out foo.json` alone
  → JSON never written despite the contract. Fix: `jsonFlag = includes('--json') || jsonOut != null`.
- **P2 KO** — if the TARGET is the stale default json itself, the delete destroys the file being
  packed. Fix: skip delete when default-json path === targetAbs.
- **P3 KO** — delete has no error handling; EACCES on a stale artifact would crash a plain
  md-only run (new failure surface on a previously always-green path). Fix: best-effort, swallow.
- **P4 KO (posture)** — plain runs deleting the default json can ENOENT a concurrent reader (the
  tool's whole point is parallel readers). Fix options: document as known limitation vs atomic
  write-then-rename discipline.
- **P5 KO** — "file asc" doesn't pin the comparator; md uses `localeCompare`, a default sort
  differs on mixed-case names → silent R7 break. Fix: spec mandates localeCompare.
- **P6 KO (subtle)** — the real cap is two-stage: keyword hits ≤3/file at COLLECTION (the render
  `slice(0,4)` is currently dead code). A "single cap 4" refactor would change md output for
  files with ≥4 matches. Fix: spec requires preserving BOTH stages.
- **P7 KO** — delete-vs-target-validation order unspecified: a missing-target run (exit 2,
  "writes nothing") could still delete the stale json as a side effect. Fix: delete only after
  target validation, alongside the write.
- P8 OK — `targetEmbedded` rename is a clean seam (no third reference in the file).
