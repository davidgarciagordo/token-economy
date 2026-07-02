# Acceptance Matrix — `--json` / `--json-out` for context-pack.mjs

Evidence = test-case ids from `tests/context-pack.test.sh` (12/12 pass, run independently by the
verifier) + the verifier's own re-runs recorded in `verify.md`.

## Acceptance Matrix

| req-id | fuente (ref §) | in-scope? | built? | evidence (test/output/link) | verified-by (≠ executor) |
|--------|----------------|-----------|--------|------------------------------|--------------------------|
| R1  | references.md R1 — flags any position, exact-token detection | yes | yes | T5 + verifier `--json-out` target check | independent-verifier agent |
| R2  | R2 — target repo-relative in JSON | yes | yes | T2 + verifier dump `target=spec.md` | independent-verifier agent |
| R3  | R3 — keywords same list/order | yes | yes | verifier md/json keyword cross-check | independent-verifier agent |
| R4  | R4 — repoMap = md's truncated view (both cap stages, localeCompare) | yes | yes | T1 byte-identity + T2 `kind` field | independent-verifier agent |
| R5  | R5 — sharedFound[] + schemaVersion | yes | yes | T2 + verifier dump | independent-verifier agent |
| R6  | R6 — JSON byte-deterministic (same machine) | yes | yes | T3 + verifier cmp | independent-verifier agent |
| R7  | R7 — md byte-identical pre/post change | yes | yes | T1 + verifier `git show HEAD` old-vs-new cmp (mixed-case repo) | independent-verifier agent |
| R8  | R8 — composes with --root/--out/--max-target-lines; --json-out names JSON | yes | yes | T4, T12 + verifier compose run | independent-verifier agent |
| R9  | R9 — exit 2 usage/missing target, nothing written | yes | yes | T8 + verifier missing-target run | independent-verifier agent |
| R10 | R10 — usage text: both flags, file-only, no value | yes | yes | verifier usage-text read (L161-169) | independent-verifier agent |
| R11 | R11 — embedding cap applies to JSON (targetEmbedding enum) | yes | yes | T6 + verifier big.md run | independent-verifier agent |
| R13 | decisions-1 G5 — stdout summary `json: <path>` | yes | yes | verifier stdout check (present with flag, absent without) | independent-verifier agent |
| R14 | decisions-1 G3 (reworked) — stale-default deletion, safe | yes | yes | T9, T10, T8 (no delete on exit-2), T11 (skip-if-target) | independent-verifier agent |
| R15 | decisions-1 G4 — limits documented | yes | yes | verifier header L24-27 + both READMEs check | independent-verifier agent |
| R12 | references.md R12 — streaming/stdout mode | no | — | (out of scope — Non-goals) | — |
