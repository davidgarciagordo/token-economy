# Execution proposal

One file + one test script = **single sequential unit, one editor (Sonnet-tier work), no fan-out**
— multi-agent would add worktree/context overhead with zero parallelism gain (all units touch the
same file). Where the multi-agent doctrine DOES apply here: the **verify** stays independent (a
separate read-only agent audits the matrix — never the editor), and the grill/regrill already ran
as parallel read-only lenses over a shared pack. Deterministic tools before model: the test
harness is bash, run directly.
