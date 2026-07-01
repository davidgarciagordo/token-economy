# token-economy

Plugin de Claude Code. Recorta tokens de entrada/orquestación en trabajo multiagente (revisión, auditoría, migración, cualquier tarea que abra sub-agentes), y añade disciplina de salida al hilo principal.

## Instalar

Solo este plugin:

```bash
/plugin marketplace add davidgarciagordo/token-economy
/plugin install token-economy
```

O la suite completa (esto + design-review, forge-methodology, working-methods, automations) desde un solo catálogo:

```bash
/plugin marketplace add davidgarciagordo/claude-plugins
/plugin install token-economy@davidgarciagordo-plugins
```

Nada más que hacer — el output-style `frugal` se aplica solo (`force-for-plugin: true`). Para apagarlo: `/config` → **Output style** → `Default`.

## Cómo funciona

Sin pasos manuales. Cuando le pides a Claude trabajo multiagente, el skill `token-economy` se dispara y Claude aplica estos mecanismos él mismo:

- **context-pack** (`scripts/context-pack.mjs`) — escanea el repo una vez → `.token-economy/context-pack.md` (mapa fichero:línea). Los sub-agentes leen esto en vez de re-escanear.
- **agente lente read-only** (`agents/readonly-lens.md`) — solo `Read`/`Grep`/`Glob`, sin Edit/Write/Bash. Salida terse `OK`/`KO` por hallazgo.
- **output-style frugal** (`output-styles/frugal.md`) — resultado primero, sin narración paso a paso.
- **memoria enchufable** (`references/memory-adapter.md`) — search-before/write-after, degrada al fichero context-pack si no hay memoria MCP configurada.

## Ventajas

- Menos tokens de entrada por pasada multiagente (sin re-escaneo, sin re-narración), misma cobertura.
- Se suma a `caveman` (eso comprime el estilo de salida; esto recorta el número de tokens).
- Gratis si ya usas `forge-methodology` o `design-review` — sus agentes ya corren read-only + terse sobre un context-pack compartido.

## Licencia

MIT © David García Gordo
