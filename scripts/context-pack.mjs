#!/usr/bin/env node
/**
 * context-pack.mjs — deterministic, single-scan context-pack assembler.
 * No external deps. Node >= 14 (ESM via .mjs).
 *
 * Why: in multi-agent / multi-lens work, every agent re-reading the repo and
 * re-discovering the same anchors is the dominant token cost. This scans the
 * repo ONCE (git ls-files + in-process grep) and emits a single artifact that
 * all downstream agents read instead of re-scanning.
 *
 * Usage:
 *   node context-pack.mjs <target> [--root <dir>] [--out <path>] [--json] [--json-out <path>] [--max-target-lines <n>]
 *
 *   <target>    file (spec/plan/component/module) the work is about
 *   --root      repo root (default: git root of cwd)
 *   --out       markdown output path (default: <root>/.token-economy/context-pack.md)
 *   --json      also emit JSON (schemaVersion 1) to <root>/.token-economy/context-pack.json —
 *               file only, never stdout; takes NO value
 *   --json-out  JSON output path (implies --json)
 *
 * Output: markdown pack (target content + repo map file:line + empty SHARED-FOUND) and,
 * when requested, the same data as JSON (one shared truncated view — md and JSON always match).
 *
 * Determinism & limits: no Date.now / Math.random — byte-stable for identical inputs on the
 * SAME machine. Cross-machine byte-identity depends on checkout line-endings (core.autocrlf).
 * Non-UTF8 targets degrade via U+FFFD replacement (no validation). A concurrent reader of the
 * default json may see ENOENT during stale-pair cleanup (retryable).
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function die(msg) { process.stderr.write(`context-pack: ${msg}\n`); process.exit(2); }

function arg(flag) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const hit = process.argv.find((a) => a.startsWith(flag + '='));
  return hit ? hit.slice(flag.length + 1) : null;
}

function gitRoot(from) {
  try {
    return execFileSync('git', ['-C', from, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', timeout: 8000 }).trim();
  } catch (_) { return from; }
}

function gitLsFiles(root) {
  try {
    return execFileSync('git', ['-C', root, 'ls-files'],
      { encoding: 'utf8', timeout: 15000 }).trim().split('\n').filter(Boolean);
  } catch (_) {
    // Not a git repo: fall back to a shallow walk (capped) so the tool still works.
    return walkFallback(root);
  }
}

function walkFallback(root, rel = '', acc = [], cap = 2000) {
  if (acc.length >= cap) return acc;
  let entries;
  try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); }
  catch (_) { return acc; }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name.startsWith('.token-economy')) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walkFallback(root, r, acc, cap);
    else if (acc.length < cap) acc.push(r);
  }
  return acc;
}

function readSafe(abs) {
  try { return fs.readFileSync(abs, 'utf8'); } catch (_) { return null; }
}

function grepLines(root, files, pattern) {
  /** Returns [{file, line, text, kind}] for matches — in-process, no shell injection. */
  const results = [];
  const re = new RegExp(pattern, 'i');
  for (const rel of files) {
    const content = readSafe(path.join(root, rel));
    if (content === null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) results.push({ file: rel, line: i + 1, text: lines[i].trim(), kind: 'keyword' });
    }
  }
  return results;
}

/** Extract up to 8 keyword tokens from the target path + first ~80 lines. */
function extractKeywords(targetPath, content) {
  const STOP = new Set(['this', 'that', 'with', 'from', 'your', 'will', 'must',
    'have', 'each', 'when', 'then', 'they', 'their', 'into', 'than', 'them']);
  const fromPath = path.basename(targetPath, path.extname(targetPath))
    .split(/[-_./\s]+/).filter((w) => w.length > 3);
  const firstLines = content.split('\n').slice(0, 80).join(' ');
  const fromContent = (firstLines.match(/##\s+(\S+)|`([^`]{4,})`|\b([A-Z][a-z]{3,})\b/g) || [])
    .map((m) => m.replace(/^##\s+|`/g, '').trim().toLowerCase())
    .filter((w) => w.length > 3 && !STOP.has(w));
  return [...new Set([...fromPath.map((w) => w.toLowerCase()), ...fromContent])].slice(0, 8);
}

/**
 * Generic anchor patterns — config / docs / conventions that hold the invariants
 * of almost any repo. Intentionally project-agnostic.
 */
const ANCHOR_GLOBS = [
  /^(CLAUDE|AGENTS|CONTRIBUTING|README|ARCHITECTURE|CONVENTIONS)\.mdx?$/i,
  /^docs\/(adr|ADR|decisions)\//,
  /^docs\/[^/]*\.mdx?$/i,
  /^\.editorconfig$/,
  /^\.claude\/settings\.json$/,
  /^(package\.json|tsconfig\.json|pyproject\.toml|go\.mod|Cargo\.toml|composer\.json)$/,
];

function isAnchor(rel) { return ANCHOR_GLOBS.some((re) => re.test(rel)); }

/**
 * Shared truncated view — the SINGLE source both serializations (md + JSON) render from, so they
 * always report the same data. Truncation is TWO-STAGE by design: keyword hits are already capped
 * at ≤3/file at collection time; this step applies the render caps (≤4 entries/file after
 * grouping, text ≤100 chars) and the file ordering (MUST be localeCompare — a default sort()
 * differs on mixed-case names and would silently change the md output).
 */
function buildRepoMapView(hits) {
  const byFile = {};
  for (const h of hits) (byFile[h.file] ||= []).push(h);
  const view = [];
  for (const [file, h] of Object.entries(byFile).sort(([a], [b]) => a.localeCompare(b))) {
    for (const { line, text, kind } of h.slice(0, 4)) {
      view.push({ file, line, text: text.slice(0, 100), kind });
    }
  }
  return view;
}

function formatRepoMap(view) {
  if (!view.length) return '_No anchors or keyword precedents found._\n';
  return view.map(({ file, line, text }) => `  ${file}:${line}  ${text}`).join('\n');
}

/* ── main ─────────────────────────────────────────────────────────────────── */

// Target = first non-flag arg that isn't the value of a preceding flag, so
// `node context-pack.mjs --root . SKILL.md` works the same as `... SKILL.md --root .`.
const FLAGS_WITH_VALUE = new Set(['--root', '--out', '--json-out', '--max-target-lines']);
let targetArg = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { if (FLAGS_WITH_VALUE.has(a)) i++; continue; }
  targetArg = a; break;
}
if (!targetArg) {
  process.stdout.write(
    'Usage: node context-pack.mjs <target> [--root <dir>] [--out <path>]\n' +
    '  <target>  file the work is about (spec / plan / component / module)\n' +
    '  --root    repo root (default: git root of cwd)\n' +
    '  --out     output path (default: <root>/.token-economy/context-pack.md)\n' +
    '  --max-target-lines  embed cap; larger targets embed an outline (default: 400)\n' +
    '  --json    also emit JSON to <root>/.token-economy/context-pack.json (file only, never stdout; takes NO value)\n' +
    '  --json-out <path>   name the JSON file (implies --json)\n'
  );
  process.exit(2); // no pack was written — never exit 0 here
}

const rootArg = arg('--root');
const outArg  = arg('--out');
// EXACT token match — '--json-out' contains '--json' as a prefix; startsWith would misfire.
const jsonOutArg = arg('--json-out');
const jsonWanted = process.argv.includes('--json') || jsonOutArg != null;

const cwd  = process.cwd();
const root = rootArg ? path.resolve(rootArg) : gitRoot(cwd);

const targetAbs = path.isAbsolute(targetArg) ? targetArg : path.resolve(cwd, targetArg);
if (!fs.existsSync(targetAbs)) die(`target not found: ${targetAbs}`);

const targetContent = readSafe(targetAbs);
if (targetContent === null) die(`cannot read target: ${targetAbs}`);
const targetRel = path.relative(root, targetAbs);

// One scan of the repo file list.
const allFiles = gitLsFiles(root);
const anchorFiles = allFiles.filter(isAnchor);
const otherFiles  = allFiles.filter((f) => !isAnchor(f));

// Anchors: first meaningful (non-empty, non-heading) line of each.
const anchorHits = [];
for (const rel of anchorFiles) {
  const txt = readSafe(path.join(root, rel));
  if (!txt) continue;
  const lines = txt.split('\n');
  const idx = lines.findIndex((l) => l.trim() && !l.trim().startsWith('#'));
  const lineNo = idx >= 0 ? idx + 1 : 1;
  anchorHits.push({ file: rel, line: lineNo, text: lines[lineNo - 1]?.trim() || '', kind: 'anchor' });
}

// Keyword precedents in the remaining files (cap 40 files, 3 hits each).
const keywords = extractKeywords(targetArg, targetContent);
const keywordPattern = keywords.length
  ? keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : null;

const keywordHits = [];
if (keywordPattern) {
  const byFile = {};
  for (const h of grepLines(root, otherFiles, keywordPattern)) {
    (byFile[h.file] ||= []);
    if (byFile[h.file].length < 3) byFile[h.file].push(h);
  }
  for (const f of Object.keys(byFile).slice(0, 40)) keywordHits.push(...byFile[f]);
}

const allHits = [...anchorHits, ...keywordHits];

/* ── target embedding cap ─────────────────────────────────────────────────── */
// Every lens reads the whole pack; embedding a huge target multiplies its cost by N agents.
// Above the cap, embed a line-numbered OUTLINE (headings / top-level decls + section head lines)
// instead — lenses open the real file at the cited line only when they need it.
const MAX_TARGET_LINES = (() => {
  const v = parseInt(arg('--max-target-lines') || '', 10);
  return Number.isFinite(v) && v > 0 ? v : 400;
})();

function outlineOf(content) {
  const lines = content.split('\n');
  const out = [];
  const isAnchorLine = (l) =>
    /^#{1,6}\s/.test(l) ||                                            // md headings
    /^\s*(export\s+)?(async\s+)?(function|class|const|let|interface|type|def|func|fn|impl|struct|enum)\b/.test(l);
  for (let i = 0; i < lines.length; i++) {
    if (isAnchorLine(lines[i])) {
      out.push(`  ${i + 1}: ${lines[i].trim().slice(0, 120)}`);
      for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
        const t = lines[j].trim();
        if (t && !isAnchorLine(lines[j])) { out.push(`  ${j + 1}:   ${t.slice(0, 100)}`); break; }
      }
    }
  }
  return out.join('\n');
}

const targetLineCount = targetContent.split('\n').length;
const targetEmbedding = targetLineCount <= MAX_TARGET_LINES ? 'full' : 'outline';
const embeddedText = targetLineCount <= MAX_TARGET_LINES
  ? targetContent
  : `_Target is ${targetLineCount} lines (> ${MAX_TARGET_LINES} cap) — OUTLINE below (line: content). ` +
    `Read the excerpt you need from \`${targetRel}\` at the cited line; do NOT read the whole file._\n\n` +
    outlineOf(targetContent);

// Default outputs are anchored to the REPO ROOT (not cwd), so agents can rely on
// <root>/.token-economy/context-pack.{md,json} regardless of where the script was run from.
const outAbs = outArg
  ? (path.isAbsolute(outArg) ? outArg : path.resolve(cwd, outArg))
  : path.join(root, '.token-economy', 'context-pack.md');
const jsonDefaultAbs = path.join(root, '.token-economy', 'context-pack.json');
const jsonAbs = jsonOutArg
  ? (path.isAbsolute(jsonOutArg) ? jsonOutArg : path.resolve(cwd, jsonOutArg))
  : jsonDefaultAbs;
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
if (jsonWanted) fs.mkdirSync(path.dirname(jsonAbs), { recursive: true });

/* ── build the data once, render twice ───────────────────────────────────── */

const repoMapView = buildRepoMapView(allHits);

const packData = {
  schemaVersion: 1,
  target: targetRel,
  targetLines: targetLineCount,
  targetEmbedding,
  content: embeddedText,
  keywords,
  repoMap: repoMapView,
  sharedFound: [],
};

const pack = `# Context Pack
> Single-scan artifact. Downstream agents READ this — they do NOT re-scan the repo.

## Target
\`\`\`
${targetRel}
\`\`\`

### Content
${embeddedText}

---

## Repo map  (file:line of anchors + keyword precedents)
Anchors: config, docs, ADRs, conventions (always included).
Keywords extracted from target: ${keywords.join(', ') || '(none)'}

${formatRepoMap(repoMapView)}

---

## SHARED-FOUND
<!-- The orchestrator fills this with findings discovered ONCE, before dispatching agents.
     Downstream agents must NOT re-report anything already listed here. -->
`;

fs.writeFileSync(outAbs, pack, 'utf8');
if (jsonWanted) {
  fs.writeFileSync(jsonAbs, JSON.stringify(packData, null, 2) + '\n', 'utf8');
}

// Stale-pair prevention: if this run did NOT write the default json path, a leftover default
// json (from an earlier --json run) would silently mismatch the fresh default md. Delete it —
// best-effort (never abort the md write over a stale artifact), only after target validation
// (we are past die()), and never when the default json IS the file we just packed as target.
// Known limitation: a concurrent reader may see ENOENT during this delete (retryable); the
// single-orchestrator-writer doctrine avoids it.
const wroteDefaultJson = jsonWanted && jsonAbs === jsonDefaultAbs;
if (!wroteDefaultJson && jsonDefaultAbs !== targetAbs) {
  try { fs.unlinkSync(jsonDefaultAbs); } catch (_) { /* ENOENT/EACCES — best-effort */ }
}

process.stdout.write(`context-pack: wrote ${path.relative(cwd, outAbs)}\n`);
process.stdout.write(`  target   : ${targetRel}\n`);
process.stdout.write(`  anchors  : ${anchorFiles.length} files\n`);
process.stdout.write(`  keywords : ${keywords.join(', ') || '(none)'}\n`);
process.stdout.write(`  hits     : ${allHits.length} file:line entries\n`);
if (jsonWanted) process.stdout.write(`  json     : ${path.relative(cwd, jsonAbs)}\n`);
