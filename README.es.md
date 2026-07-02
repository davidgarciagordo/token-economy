# token-economy

Plugin de Claude Code. Recorta tokens de entrada/orquestación en trabajo multiagente (revisión, auditoría, migración, cualquier tarea que abra sub-agentes), y añade disciplina de salida al hilo principal.

## Instalar

Solo este plugin:

```bash
/plugin marketplace add davidgarciagordo/token-economy
/plugin install token-economy
```

O la suite completa (esto + design-review, forge-methodology, working-methods, automations) desde [un solo catálogo](https://github.com/davidgarciagordo/claude-plugins):

```bash
/plugin marketplace add davidgarciagordo/claude-plugins
/plugin install token-economy@davidgarciagordo-plugins
```

Nada más que hacer — el output-style `frugal` se aplica solo (`force-for-plugin: true`). Como se fuerza mientras el plugin está activo, el apagado real es **deshabilitar el plugin** (`/plugin` → token-economy → disable), no `/config` — `force-for-plugin` pisa el ajuste outputStyle del usuario por diseño.

## Cómo funciona

Sin pasos manuales. Cuando le pides a Claude trabajo multiagente, el skill `token-economy` se dispara y Claude aplica estos mecanismos él mismo:

- **context-pack** (`scripts/context-pack.mjs`, Claude lo ejecuta como `node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <target>`) — escanea el repo una vez → `<raíz-del-repo>/.token-economy/context-pack.md` (mapa fichero:línea). Los sub-agentes leen esto en vez de re-escanear; cada lente recibe el mismo prefijo estable de prompt apuntando al pack (palanca de prompt-cache).
- **agente lente read-only** (`agents/readonly-lens.md`) — solo `Read`/`Grep`/`Glob`, sin Edit/Write/Bash. Salida terse `OK`/`KO` por hallazgo.
- **output-style frugal** (`output-styles/frugal.md`) — resultado primero, sin narración paso a paso.
- **memoria enchufable** (`references/memory-adapter.md`) — search-before/write-after, degrada a `.token-economy/memory.md` (backend fichero) si no hay memoria MCP configurada.

## Ventajas

- Menos tokens de entrada por pasada multiagente (sin re-escaneo, sin re-narración), misma cobertura.
- Se suma a `caveman` (eso comprime el estilo de salida; esto recorta el número de tokens).
- Gratis si ya usas `forge-methodology` o `design-review` — sus agentes ya corren read-only + terse sobre un context-pack compartido.

## Licencia

MIT © David García Gordo
