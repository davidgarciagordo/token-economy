# Grill verdicts — 4 lenses on the DRAFT (deduped)

Lenses: architect (KO) · operator (OK w/ 6 traps) · engineer (OK w/ 3 gaps + 2 ambiguities) ·
completeness (KO: R9 uncovered, R8 partial).

## Blocking (owner decision at checkpoint-1)

**G1 · `--out` overload — flagged by ALL THREE technical lenses.**
Draft makes `--out` mean "md path" normally but "JSON path" when `--json` is present: same flag,
two meanings depending on an unrelated boolean; no way to set both custom paths; existing callers
adding `--json` get their md silently relocated. → Options: (a) separate `--json-out`, `--out`
stays md-only [architect+operator+engineer recommendation]; (b) keep overload + stderr warning;
(c) `--out` sets both basenames (`x.md`/`x.json`).

**G2 · JSON `repoMap`: same truncated view as md, or raw?** (architect, engineer)
The 4-hits/file cap + 100-char truncation live in the md RENDERER, not in the data. Unstated →
md and JSON silently diverge; raw anchors are uncapped (monorepo → unbounded JSON). → Options:
(a) JSON = exactly the md's truncated view [consistency, bounded]; (b) raw + total cap [richer
for tooling, divergent].

**G3 · Stale default JSON.** (operator)
Run 1 `A.md --json` writes json; run 2 `B.md` (no flag) updates md only → consumer reads md(B) +
json(A) mismatched. → Options: (a) running WITHOUT `--json` deletes a default-path json
[deterministic]; (b) consumers must check the `target` field [document only]; (c) nothing.

**G4 · Encoding/CRLF honesty.** (engineer)
Non-UTF8 targets get U+FFFD silently; CRLF/LF checkout differences break CROSS-MACHINE cache
claims (same-machine determinism unaffected). → Options: (a) document both limits (header + README
line), no runtime cost [lightweight]; (b) add decode-loss detection + warning; (c) normalize line
endings (changes md output — violates R7).

**G5 · Scope creep: stdout summary line `json: <path>`.** (completeness)
Not in R1-R12. → keep (add as R13) or drop.

## Mechanical (no decision needed — go straight into the spec)

- M1 `fs.mkdirSync` for the JSON dir independently of md's (operator P3, engineer P1, architect P2).
- M2 Rename the existing `targetEmbedded` variable (holds TEXT) before introducing the enum JSON
  field of the same name (architect P3, engineer P3).
- M3 Tests missing: R9 exit codes under `--json` (exit 2 + nothing written), `--root`+`--json`
  composition (completeness P1/P2).
- M4 Usage text must say `--json` writes a FILE (never stdout) and takes NO value; with a separate
  `--json-out`, the "--json <path>" misuse gets a natural home (operator P4/P5).
- M5 Boolean flag detection: explicit `process.argv.includes('--json')` (architect P3-minor).
