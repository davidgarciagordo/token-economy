# Global plan — single-phase run

| unit | what | files | depends on | done when |
|------|------|-------|------------|-----------|
| U1 | Shared data-building step (packData: both cap stages, localeCompare, kind field, embeddedText rename, targetEmbedding enum) | scripts/context-pack.mjs | — | md output byte-identical (T1) |
| U2 | CLI: `--json` exact-match + `--json-out` (FLAGS_WITH_VALUE) + jsonWanted composition + usage text | scripts/context-pack.mjs | U1 | T5, T7 |
| U3 | JSON emission (mkdir own dir, stringify(null,2)+'\n', stdout summary line) + stale-default delete (after validation, best-effort, skip-if-target) | scripts/context-pack.mjs | U2 | T2-T4, T8-T11 |
| U4 | Documented limits (header comment + README line) | scripts/context-pack.mjs, README.md, README.es.md | — | R15 row |
| U5 | Test harness | tests/context-pack.test.sh | U1-U3 | all 12 cases green |
| U6 | Independent verify (matrix audit + hook check) | docs/forge/.../verify.md | U1-U5 | every in-scope row evidenced, verifier ≠ executor |

## Execution proposal (most effective for THIS task)
One file + one test script = **single sequential unit, one editor (Sonnet-tier work), no fan-out**
— multi-agent would add worktree/context overhead with zero parallelism gain (all units touch the
same file). Where the multi-agent doctrine DOES apply here: the **verify** stays independent (a
separate read-only agent audits the matrix — never the editor), and the grill/regrill already ran
as parallel read-only lenses over a shared pack. Deterministic tools before model: the test
harness is bash, run directly.
