# token-economy

Plugin de Claude Code. Recorta tokens de entrada/orquestación en trabajo multiagente — sin recortar cobertura.

## El problema

Cuando una tarea abre varios sub-agentes (una revisión de código, una auditoría, una migración), cada agente re-escanea el mismo repo y re-descubre los mismos hechos — y esa re-lectura repetida, no las respuestas, es el coste dominante en tokens del trabajo multiagente. token-economy hace que el descubrimiento ocurra **una vez**, que el informe de cada agente sea terse, y que el hilo principal deje de narrar.

## Qué contiene

| Componente | Qué hace | Cómo se invoca |
|---|---|---|
| **skill** (`SKILL.md`) | La doctrina de orquestación: un gate binario de context-pack + 7 palancas (discover-once, salida terse, prefijo prompt-cache, hilo principal frugal, read-only + mutar-en-una-pasada, memoria enchufable, cap + cache). | Se dispara solo cuando pides a Claude trabajo multiagente (revisión / auditoría / migración / fan-out). Claude aplica las palancas él mismo — tú no ejecutas nada. |
| **script context-pack** (`scripts/context-pack.mjs`) | Escaneo único determinista (sin `Date.now`/`Math.random` → byte-estable, cacheable) → `<raíz-del-repo>/.token-economy/context-pack.md`: contenido del target + mapa del repo (anclas fichero:línea y precedentes por keyword) + `SHARED-FOUND` vacío. `--json` / `--json-out` emiten los mismos datos en JSON para tooling. Los targets que superan `--max-target-lines` (400 por defecto) embeben un **outline** con números de línea en vez del contenido completo, para que N agentes no paguen cada uno un target enorme. | Claude lo ejecuta con su tool Bash: `node "${CLAUDE_PLUGIN_ROOT}/scripts/context-pack.mjs" <target>` |
| **agente lente read-only** (`agents/readonly-lens.md`) | Lente de análisis con `tools: ["Read","Grep","Glob"]` — sin Edit/Write/Bash, así que el read-only está garantizado por construcción. Contrato de salida: `OK`/`KO` + una línea por hallazgo (`KO <fichero>:<línea> <problema> → <fix>`), sin narración, sin re-reportar `SHARED-FOUND`. | Tool Agent como `token-economy:readonly-lens` (el prompt de invocación nombra la lente y sus checks). |
| **output-style frugal** (`output-styles/frugal.md`) | Disciplina de salida del hilo principal: resultado primero, un resumen apretado, sin narración paso a paso ni relleno. `keep-coding-instructions: true` — solo tono, nunca la capacidad de programar. | Se aplica solo (`force-for-plugin: true`). Apagado: deshabilitar el plugin (ver Instalar). |
| **adaptador de memoria** (`references/memory-adapter.md`) | Memoria enchufable search-before / write-after, propiedad del orquestador (un solo escritor, sin carreras). Backends en orden de preferencia: **claude-mem** → otro MCP → fichero (`.token-economy/memory.md`). | Claude lo consulta al persistir hallazgos entre ejecuciones. |
| **tests** (`tests/context-pack.test.sh`) | Harness de 12 casos para el script: forma/determinismo del JSON, flags en cualquier posición, cap de outline, reglas de limpieza de json obsoleto, composición con `--root`. T1 (byte-identidad contra un baseline) requiere `BASELINE=`. | `bash tests/context-pack.test.sh` |

Una palanca más sin fichero propio: **prompt-cache**. Cada lente paralela se invoca con un prefijo de prompt idéntico (`Lens: <nombre>. Checks: <una línea>. Pack: <ruta>`) apuntando al mismo fichero de pack — el prefijo estable compartido es lo que hace baratas N lecturas paralelas; el delta por lente va al FINAL del prompt.

## El gate (binario, por fan-out)

`frugal` + salida terse aplican a todo trabajo multiagente — siempre activos. El **context-pack** es la única palanca con decisión, y es binaria, no una intuición. Antes del 2º agente de cualquier fan-out:

> **¿Estos agentes abrirán alguno de los mismos ficheros?**
> **SÍ → context-pack OBLIGATORIO. NO (módulos disjuntos) → sáltalo.**

SÍ: revisión de código de un PR/diff, build multi-fase sobre un área, migración/sweep, design-review, grill ×3 sobre un spec. NO: research por módulos sin relación, cada agente en su módulo. Desempate: si ≥2 agentes comparten aunque sea un fichero, haz el pack.

Re-evalúa **por fan-out, no por tarea** — a una fase de research disjunta (sin pack) puede seguirle una fase de build sobre el mismo dominio (pack obligatorio); la fase 1 no exime a la fase 2.

## Benchmark

Medido en una pasada real de design-review (Clock Admin, diagnóstico de 4 lentes). Los tokens son aproximados, comparando un baseline (cada lente re-lee el repo + salida verbosa) contra token-economy (un context-pack + terse + read-only):

| métrica | baseline (re-lectura + verboso) | token-economy (context-pack + terse + read-only) | ahorro |
|---|---|---|---|
| por lente | ~108k | ~42k | ~2.6× |
| diagnóstico completo de 4 lentes | ~430k | ~242k (pack 74k una vez + 4×42k) | ~1.8× |
| 2º diseño, mismo componente | ~671k | ~94k (reúso de artefactos) | ~7× |

**Caveats honestos:** un solo componente; construir el pack cuesta ~74k una vez (se amortiza entre lentes y entre ejecuciones); medido específicamente en el pipeline de design-review. El mayor ahorro es el reúso **cross-run** — el pack determinista + la memoria persistida hacen casi gratis una segunda pasada sobre el mismo target.

## Se compone con

### caveman

caveman es un **skill** de compresión de comunicación, no un output-style registrado — comprime cómo se *dice* cada palabra; token-economy recorta cuántos tokens *entran* y mata la narración. El `force-for-plugin` de `frugal` pisa el **ajuste** `outputStyle`, que caveman no ocupa, así que **no hay colisión**: se apilan (caveman-frugal = pidgin terse + resultado primero + sin cháchara paso a paso). Solo si alguien re-empaquetara caveman como output-style real, frugal pisaría ese empaquetado — la forma skill apila sin problema.

### claude-mem

claude-mem es el **backend de memoria preferido** (ver `references/memory-adapter.md`): el search-before sale gratis vía su tool MCP `search`, y registra observaciones automáticamente a través de sus hooks de sesión — no expone tool de escritura explícito, así que el write-after determinista usa el backend fichero (`.token-economy/memory.md`) en paralelo. Ese híbrido es el diseño documentado, no un apaño: claude-mem + token-economy es el emparejamiento recomendado.

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

## Relación con forge-methodology / design-review

token-economy es el **hogar standalone de los mecanismos** que esos plugins ya embeben — sus agentes de grill / lente ya corren read-only + terse sobre un context-pack compartido. Si los usas, ya te beneficias de los mecanismos dentro de esos pipelines; token-economy es donde los mecanismos viven canónicamente (script, agente, tests, benchmark), y los aplica a **cualquier otro** trabajo multiagente — además del output-style `frugal` y el adaptador de memoria, que esos plugins no traen.

## Licencia

MIT © David García Gordo
