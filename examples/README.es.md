[English](README.md) | **Español**

# token-economy — Ejemplos de uso

> Prompts copy-paste que muestran cuándo salta el gate del context-pack, cuándo no, y qué cambia en el coste.

Son prompts reales — pégalos en Claude Code con token-economy instalado. Cada ejemplo muestra qué se dispara (el chequeo del gate, el script, los agentes-lente) y cómo queda el coste resultante.

---

## El gate, en corto

Antes del 2º agente de cualquier fan-out: **¿van a abrir los mismos ficheros?** SÍ → context-pack obligatorio. NO (módulos disjuntos) → se salta. Se revisa por cada fan-out, no una vez por tarea.

---

## 1. Revisión multi-lente de un diff (el caso estrella)

```
Revisa este pull request en arquitectura, seguridad, rendimiento y modelo de datos —
usa cuatro lentes separadas en paralelo.
```

**Qué se dispara:** cuatro lentes revisando el *mismo diff* comparten ficheros a la fuerza — el context-pack es obligatorio. Claude corre el escáner una vez:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <ruta/al/fichero/cambiado>
```

que escribe `.token-economy/context-pack.md` (contenido del diff + mapa del repo con anclas `fichero:línea` + una sección `SHARED-FOUND` vacía). Cada una de las cuatro `token-economy:readonly-lens` recibe el mismo prefijo de prompt — `Lens: security. Checks: injection, auth, secrets. Pack: .token-economy/context-pack.md` — cambiando solo el nombre de la lente y su checklist. Ninguna de las cuatro vuelve a leer el repo; cada una abre el pack una vez y devuelve `OK` o `KO <fichero>:<línea> <problema> → <fix>`, sin narración.

**Qué cambia:** medido en una pasada real de diseño con 4 lentes — unos ~108k tokens por lente si cada una re-leyera el repo y escribiera en verboso, ~42k con el pack + contrato terse. La construcción del pack (~74k, una sola vez) se amortiza entre las cuatro lentes y entre cualquier pasada posterior sobre el mismo objetivo.

## 2. Un barrido de migración por muchos ficheros

```
Migra todos los usos de la clase `Logger` antigua a la nueva API `StructuredLogger`
en todo el código, y luego verifica que nada siga importando la antigua.
```

**Qué se dispara:** un barrido es justo el caso "build multi-fase sobre una misma área" de la tabla del gate — obligatorio. El mapa del repo del pack le da a cada sub-agente la lista de sitios de uso desde el principio (anclas `fichero:línea` del escaneo inicial), así que los agentes de migración no vuelven a grepear todo el árbol para redescubrir lo que el primero ya encontró.

## 3. Research disjunto y luego un build del mismo dominio (se revisa por fan-out)

```
Primero, investiga cómo tres servicios no relacionados de este monorepo (billing,
notifications, search) manejan hoy los reintentos — un agente por servicio, no
necesitan hablar entre sí. Luego, una vez elegido el enfoque, impleméntalo en los tres.
```

**Qué se dispara — dos respuestas distintas en una sola tarea:** la fase 1 es disjunta (cada agente de research es dueño de su propio módulo, nunca abre los ficheros de otro) — **sin pack**. La fase 2 es un build del mismo dominio sobre los tres servicios con un enfoque compartido — **pack obligatorio**, aunque la fase 1 acabara de terminar sin ninguno. El gate se revisa por fan-out, no se hereda de la fase anterior.

## 4. Sesión de un solo agente — solo frugal, sin pack

```
Añade un flag `--dry-run` a scripts/deploy.sh.
```

**Qué se dispara:** un agente, un objetivo — el gate del context-pack trata de *varios* agentes abriendo los *mismos* ficheros, así que aquí nunca aplica. Lo único que se dispara es `frugal`, activo en cada respuesta sin importar el fan-out: la respuesta empieza por el diff, sin narración paso a paso tipo "ahora edito el fichero", una línea al final solo si hay algo que avisar.

## 5. Una segunda pasada sobre el mismo objetivo (el mayor ahorro)

```
[misma sesión o una posterior] Ahora revisa también la lógica de export en el
mismo fichero, con las mismas cuatro lentes.
```

**Qué se dispara:** el chequeo de frescura equivalente a `mem-stale.sh` sobre el pack existente — si el hash del árbol del fichero objetivo no cambió, el pack se reusa tal cual, sin reescanear. Medido en una segunda pasada real de diseño sobre el mismo componente: ~671k tokens si se reconstruye todo desde cero cada vez, ~94k reusando el pack y los hallazgos previos — el reuso entre runs es la palanca más grande del mecanismo, mayor que el ahorro por lente en la primera pasada.

---

## Componiendo con la familia

- **`caveman`** (compresión de estilo) apila con `frugal` (recorte de tokens/narración) — ejes distintos, sin colisión.
- **`claude-mem`**, si está instalado, es el backend de memoria preferido para el paso write-after (el search-before sale gratis vía su tool MCP `search`); si no, se usa el backend de fichero (`.token-economy/memory.md`).
- **`working-methods`**'s `/grill` y las lentes de **`design-review`** ya corren read-only + terse sobre un pack compartido internamente — token-economy es donde ese mecanismo vive de forma canónica, no una dependencia a la que esos plugins llamen (ver "Relation to forge-methodology / design-review" del README).
