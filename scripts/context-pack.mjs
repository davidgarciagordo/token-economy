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
 *   node context-pack.mjs <target> [--root <dir>] [--out <path>]
 *
 *   <target>  file (spec/plan/component/module) the work is about
 *   --root    repo root (default: git root of cwd)
 *   --out     output path (default: .token-economy/context-pack.md)
 *
 * Output (one markdown file):
 *   1. Target content
 *   2. Repo map  — file:line of anchors (rules/config/docs) + keyword precedents
 *   3. Empty SHARED-FOUND  — orchestrator fills it; agents must NOT re-report it
 *
 * Deterministic: no Date.now / Math.random. Stable output for identical inputs.
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
  /** Returns [{file, line, text}] for matches — in-process, no shell injection. */
  const results = [];
  const re = new RegExp(pattern, 'i');
  for (const rel of files) {
    const content = readSafe(path.join(root, rel));
    if (content === null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) results.push({ file: rel, line: i + 1, text: lines[i].trim() });
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

function formatRepoMap(hits) {
  if (!hits.length) return '_No anchors or keyword precedents found._\n';
  const byFile = {};
  for (const { file, line, text } of hits) (byFile[file] ||= []).push({ line, text });
  return Object.entries(byFile)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, h]) => h.slice(0, 4)
      .map(({ line, text }) => `  ${file}:${line}  ${text.slice(0, 100)}`).join('\n'))
    .join('\n');
}

/* ── main ─────────────────────────────────────────────────────────────────── */

const targetArg = process.argv[2];
if (!targetArg || targetArg.startsWith('--')) {
  process.stdout.write(
    'Usage: node context-pack.mjs <target> [--root <dir>] [--out <path>]\n' +
    '  <target>  file the work is about (spec / plan / component / module)\n' +
    '  --root    repo root (default: git root of cwd)\n' +
    '  --out     output path (default: .token-economy/context-pack.md)\n'
  );
  process.exit(targetArg ? 0 : 2);
}

const rootArg = arg('--root');
const outArg  = arg('--out') || '.token-economy/context-pack.md';

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
  anchorHits.push({ file: rel, line: lineNo, text: lines[lineNo - 1]?.trim() || '' });
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

const outAbs = path.isAbsolute(outArg) ? outArg : path.resolve(cwd, outArg);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });

/* ── write the pack ──────────────────────────────────────────────────────── */

const pack = `# Context Pack
> Single-scan artifact. Downstream agents READ this — they do NOT re-scan the repo.

## Target
\`\`\`
${targetRel}
\`\`\`

### Content
${targetContent}

---

## Repo map  (file:line of anchors + keyword precedents)
Anchors: config, docs, ADRs, conventions (always included).
Keywords extracted from target: ${keywords.join(', ') || '(none)'}

${formatRepoMap(allHits)}

---

## SHARED-FOUND
<!-- The orchestrator fills this with findings discovered ONCE, before dispatching agents.
     Downstream agents must NOT re-report anything already listed here. -->
`;

fs.writeFileSync(outAbs, pack, 'utf8');
process.stdout.write(`context-pack: wrote ${path.relative(cwd, outAbs)}\n`);
process.stdout.write(`  target   : ${targetRel}\n`);
process.stdout.write(`  anchors  : ${anchorFiles.length} files\n`);
process.stdout.write(`  keywords : ${keywords.join(', ') || '(none)'}\n`);
process.stdout.write(`  hits     : ${allHits.length} file:line entries\n`);
