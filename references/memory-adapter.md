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

| backend        | search                          | write                          |
|----------------|---------------------------------|--------------------------------|
| `claude-mem`   | `mem-search` / `get_observations` | `add_observations`           |
| other MCP      | the server's query tool         | the server's write tool        |
| `none` → file  | grep `.token-economy/memory.md` | append to `.token-economy/memory.md` |

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
