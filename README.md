# token-economy

Claude Code plugin. Cuts input/orchestration tokens in multi-agent work (review, audit, migration, any task that fans out sub-agents), plus output discipline for the main thread.

## Install

```bash
/plugin marketplace add davidgarciagordo/token-economy
/plugin install token-economy
```

Nothing else to do — the `frugal` output-style applies automatically (`force-for-plugin: true`). To turn it off: `/config` → **Output style** → `Default`.

## How it works

No manual steps. When you ask Claude for multi-agent work, the `token-economy` skill triggers and Claude applies these mechanisms itself:

- **context-pack** (`scripts/context-pack.mjs`) — scans the repo once → `.token-economy/context-pack.md` (file:line map). Sub-agents read this instead of re-scanning.
- **read-only lens agent** (`agents/readonly-lens.md`) — `Read`/`Grep`/`Glob` only, no Edit/Write/Bash. Terse `OK`/`KO` output per finding.
- **frugal output-style** (`output-styles/frugal.md`) — result-first, no per-step narration.
- **pluggable memory** (`references/memory-adapter.md`) — search-before/write-after, degrades to the context-pack file if no MCP memory is configured.

## Advantages

- Fewer input tokens per multi-agent pass (no re-scanning, no re-narration), same coverage.
- Stacks with `caveman` (that compresses output style; this cuts token count).
- Free if you already use `forge-methodology` or `design-review` — their agents already run read-only + terse over a shared context-pack.

## License

MIT © David García Gordo
