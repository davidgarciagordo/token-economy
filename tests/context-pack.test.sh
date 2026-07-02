#!/usr/bin/env bash
# Test harness for scripts/context-pack.mjs — zero deps, run from anywhere.
# Cases T1-T12 per docs/forge/add-json-output-flag-to-context-pack-mjs/spec.md.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$HERE/scripts/context-pack.mjs"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok   $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }
check(){ if [ "$1" = "0" ]; then ok "$2"; else fail "$2"; fi }

W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
cd "$W"; git init -q
cat > README.md <<'EOF'
# Fixture
Some anchor line for the repo map.
EOF
printf '# small target\n\nA few keyword lines about packing and scanning.\n' > small.md
python3 - <<'PY'
lines = ["# big target"] + [f"## section {i}\ncontent line {i}" for i in range(300)]
open("big.md","w").write("\n".join(lines) + "\n")
PY
git add -A && git commit -qm fixture

MD=".token-economy/context-pack.md"; JS=".token-economy/context-pack.json"

# T1 md byte-identity vs baseline (pre-change copy passed via $BASELINE, optional)
if [ -n "${BASELINE:-}" ] && [ -f "$BASELINE" ]; then
  node "$BASELINE" small.md >/dev/null 2>&1 && cp "$MD" md.old
  node "$SCRIPT"  small.md >/dev/null 2>&1
  cmp -s "$MD" md.old; check $? "T1 md byte-identical to baseline"
else
  echo "  skip T1 (set BASELINE=/path/to/old/context-pack.mjs to enable)"
fi

# T2 JSON shape
node "$SCRIPT" small.md --json >/dev/null
node -e '
const j=require("fs").readFileSync(".token-economy/context-pack.json","utf8");
const d=JSON.parse(j);
const need=["schemaVersion","target","targetLines","targetEmbedding","content","keywords","repoMap","sharedFound"];
for (const k of need) if (!(k in d)) { console.error("missing "+k); process.exit(1); }
if (d.schemaVersion!==1||d.target!=="small.md"||!Array.isArray(d.sharedFound)||d.sharedFound.length!==0) process.exit(1);
if (d.repoMap.length && !("kind" in d.repoMap[0])) process.exit(1);
'; check $? "T2 JSON shape (R2-R5 fields)"

# T3 JSON determinism
cp "$JS" j1 && node "$SCRIPT" small.md --json >/dev/null && cmp -s "$JS" j1; check $? "T3 JSON deterministic"

# T4 both custom paths in one invocation
node "$SCRIPT" small.md --out custom.md --json-out custom.json >/dev/null
[ -f custom.md ] && [ -f custom.json ] && node -e 'JSON.parse(require("fs").readFileSync("custom.json","utf8"))'
check $? "T4 --out + --json-out both land"

# T5 flags-anywhere
node "$SCRIPT" --json small.md >/dev/null && cp "$JS" j5a
node "$SCRIPT" small.md --json >/dev/null && cmp -s "$JS" j5a; check $? "T5 flags-anywhere equivalence"

# T6 outline above cap
node "$SCRIPT" big.md --json --max-target-lines 100 >/dev/null
node -e 'const d=JSON.parse(require("fs").readFileSync(".token-economy/context-pack.json","utf8")); process.exit(d.targetEmbedding==="outline"?0:1)'
check $? "T6 targetEmbedding=outline above cap"

# T7 --json-out alone implies JSON
rm -f "$JS" solo.json; node "$SCRIPT" small.md --json-out solo.json >/dev/null
[ -f solo.json ]; check $? "T7 --json-out alone writes JSON"

# T8 missing target: exit 2, nothing written, stale json NOT deleted
node "$SCRIPT" small.md --json >/dev/null   # seed default json
node "$SCRIPT" nope.md --json >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && [ -f "$JS" ]; check $? "T8 missing target: exit 2, stale json untouched"

# T9 no-json run deletes stale default json
node "$SCRIPT" small.md >/dev/null
[ ! -f "$JS" ]; check $? "T9 no-json run deletes stale default json"

# T10 --json-out custom also deletes stale DEFAULT json
node "$SCRIPT" small.md --json >/dev/null           # seed default
node "$SCRIPT" small.md --json-out other.json >/dev/null
[ ! -f "$JS" ] && [ -f other.json ]; check $? "T10 diverted json-out deletes stale default"

# T11 target == default json path → no delete
node "$SCRIPT" small.md --json >/dev/null           # create default json
node "$SCRIPT" "$JS" >/dev/null                     # pack the json itself, no --json
[ -f "$JS" ]; check $? "T11 default json as target survives"

# T12 --root + --json composition (run from a subdir)
mkdir -p sub && ( cd sub && node "$SCRIPT" ../small.md --root "$W" --json >/dev/null )
[ -f "$JS" ]; check $? "T12 --root + --json (default json at root)"

echo; echo "pass=$PASS fail=$FAIL"
[ "$FAIL" = "0" ]
