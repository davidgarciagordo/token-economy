# Memory adapter (pluggable)

Persistent memory is the biggest cross-run saving: don't re-discover what a prior session
already found. But it must be **pluggable** (not everyone has claude-mem) and **race-free**
(N agents must not all read/write at once). One interface, three backends, orchestrator-owned I/O.

## Interface

```
search(query)            → [observation]   # before exploring: what do we already know?
write(observations[])    → void            # after a phase: persist new findings
```

That's it. Two operations. Everything below is a backend behind this interface.

## Backends (in preference order)

| backend        | search                                              | write                                    |
|----------------|-----------------------------------------------------|------------------------------------------|
| `claude-mem`   | `search` MCP tool (or the `mem-search` skill)       | automatic via its hooks — see note below |
| other MCP      | the server's query tool                             | the server's write tool                  |
| `none` → file  | grep `.token-economy/memory.md`                     | append to `.token-economy/memory.md`     |

**claude-mem write note (verified):** claude-mem records observations automatically through its
session hooks — it exposes NO explicit write tool (`add_observations` does not exist; don't
hallucinate a tool call). For explicit write-after, use the **file backend** alongside it:
claude-mem gives you search-before for free, the file gives you deterministic write-after.
(`get_observations` is fetch-by-id, not search — use `search` for querying.)

**Backend detection:** at phase start, check the tool list for `mem-*`/memory MCP tools (via
ToolSearch if deferred). Found → that backend for search. Not found → file backend for both ops.

Degrade gracefully: no MCP → fall back to the file backend. The file backend also doubles
as the durable form of the **context-pack** (`SHARED-FOUND` persisted across runs).

## Orchestrator-owned I/O (the no-races rule)

- **Only the orchestrator (main thread) calls `search` and `write`.** Sub-agents never touch memory directly.
- **search-before:** orchestrator searches ONCE at the start, folds the hits into the context-pack `SHARED-FOUND`. Agents read the pack, not memory.
- **write-after:** orchestrator collects agent findings, dedupes against `SHARED-FOUND`, writes the NEW ones ONCE at the end of the phase.
- This serializes all memory access through one writer → no lost updates, no N-way read storms, no duplicate observations.

## Why this saves tokens

- **search-before** stops every agent re-reading files a prior run already mapped.
- **write-after** turns this run's discovery into next run's free context (cross-run is the biggest win).
- **one writer** means memory I/O cost is O(1) per phase, not O(agents).
