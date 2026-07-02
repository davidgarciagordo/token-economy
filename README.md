# token-economy

Claude Code plugin. Cuts input/orchestration tokens in multi-agent work (review, audit, migration, any task that fans out sub-agents), plus output discipline for the main thread.

## Install

Just this plugin:

```bash
/plugin marketplace add davidgarciagordo/token-economy
/plugin install token-economy
```

Or the whole suite (this + design-review, forge-methodology, working-methods, automations) from [one catalog](https://github.com/davidgarciagordo/claude-plugins):

```bash
/plugin marketplace add davidgarciagordo/claude-plugins
/plugin install token-economy@davidgarciagordo-plugins
```

Nothing else to do — the `frugal` output-style applies automatically (`force-for-plugin: true`). Because it forces itself while the plugin is enabled, the off-switch is **disabling the plugin** (`/plugin` → token-economy → disable), not `/config` — `force-for-plugin` overrides the user's outputStyle setting by design.

## How it works

No manual steps. When you ask Claude for multi-agent work, the `token-economy` skill triggers and Claude applies these mechanisms itself:

- **context-pack** (`scripts/context-pack.mjs`, run by Claude as `node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <target>`) — scans the repo once → `<repo-root>/.token-economy/context-pack.md` (file:line map), plus the same data as JSON with `--json`/`--json-out` for downstream tooling. Sub-agents read this instead of re-scanning; every lens gets the same stable prompt prefix pointing at the pack (prompt-cache lever). Determinism is same-machine (cross-machine depends on checkout line-endings).
- **read-only lens agent** (`agents/readonly-lens.md`) — `Read`/`Grep`/`Glob` only, no Edit/Write/Bash. Terse `OK`/`KO` output per finding.
- **frugal output-style** (`output-styles/frugal.md`) — result-first, no per-step narration.
- **pluggable memory** (`references/memory-adapter.md`) — search-before/write-after, degrades to `.token-economy/memory.md` (file backend) if no MCP memory is configured.

## Advantages

- Fewer input tokens per multi-agent pass (no re-scanning, no re-narration), same coverage.
- Stacks with `caveman` (that compresses output style; this cuts token count).
- Free if you already use `forge-methodology` or `design-review` — their agents already run read-only + terse over a shared context-pack.

## License

MIT © David García Gordo
