# Reglas del LLM principal — thinking, web search y formato

> Objetivo: que el agente por defecto responda como un compañero de
> equipo senior (al estilo Codex/OpenCode), no como un bot que piensa
> en voz alta cosas que son para él mismo, no para el usuario.
> Esto complementa `docs/AGENTES-EN-VIVO-SPEC.md`.

## 1. Bug ya corregido: pausa/stop no detenía el pensamiento

**Causa raíz encontrada:** en
`desktop/ia-sparta-chat-ipc/src/send.channel.ts`, el handler
`chat:abort` solo apagaba una bandera local (`activeStreams`) que usa
el *polling* de `chat:send` para saber cuándo resolver su promesa. Pero
nunca le avisaba al sidecar de Python. El sidecar (`server.py`,
método `chat.abort`) sí sabe cancelar la tarea real
(`_active_streams[request_id].cancel()`), pero nadie se lo pedía. Por
eso el pensamiento seguía corriendo del lado de Python y la respuesta
terminaba llegando igual, aunque en la UI pareciera pausado.

**Fix aplicado:** `chat:abort` ahora sí llama a `sendToPython` con
`method: 'chat.abort'` y `params.request_id` (`${sessionId}:${messageId}`,
el mismo formato que ya arma `chat:send`). Ver el diff en
`send.channel.ts`.

**Falta (siguiente paso, no incluido en este cambio):** el mismo bug
puede repetirse por subagente si cada subagente corre su propia tarea
asyncio con su propio `request_id`. Cuando se implemente el botón de
"detener por agente" del punto 4 de la spec de Agentes en vivo, debe
mandar el `request_id` del subagente, no el de la sesión.

## 2. Cuándo pensar y cuánto planear

- Si la tarea es una pregunta directa o un cambio de una línea, no
  generar plan ni "pensar" de más. El campo `plan_complete` en
  `SpartaState` ya existe para saltarse el planner en tareas simples;
  el planner de hoy se activa con la regla "modo agent + ≥10
  palabras", que es un proxy débil de complejidad. Mejor: activarlo
  solo si la tarea tiene ≥2 sub-objetivos detectables (conjunciones,
  varios archivos, varios pasos explícitos), no solo por longitud del
  mensaje.
- Nunca un plan de un solo paso. Si el plan que generaría el LLM tiene
  un solo paso, es señal de que no hacía falta plan.
- El "thinking" visible (panel `ThinkingLines.tsx`) es para que el
  usuario entienda el razonamiento, no para pegar ahí el texto crudo
  que le llega de una tool. Ver punto 3.

## 3. Web search: no filtrar instrucciones internas al usuario

**Bug encontrado:** `web_search_tool` arma un resultado que empieza
con líneas como `IMPORTANTE: El usuario ya ve las URLs y títulos en la
interfaz. NO repitas la lista de resultados.` — esto es una instrucción
para el modelo, no contenido para mostrar. Pero `ToolTraceRow.tsx`
volcaba ese texto completo (`toolCall.output`) dentro de la sección
"Contenido" del panel de razonamiento, exactamente como se ve en la
captura de "Buscando en la web".

**Fix aplicado:** para `web_search`/`web_search_tool` ya no se vuelve a
mostrar `toolCall.output` crudo; el panel se queda solo con
`SearchResultsList` (la lista ya parseada con favicon/título/snippet).
El texto crudo con instrucciones sigue existiendo y sigue llegando al
LLM (eso está bien, es lo que necesita para no repetir la lista) —
solo se dejó de exponer al usuario.

**Recomendación adicional para `_format_results`:** separar en dos
piezas desde el origen en vez de depender de que el frontend filtre:

```python
return {
    "for_model": "\n".join(model_only_instructions + result_lines),
    "for_ui": result_lines,  # ya sin instrucciones, lo que hoy arma SearchResultsList
}
```

Así ningún componente de UI nuevo puede volver a cometer el mismo
error por accidente — la separación queda a nivel de dato, no de
convención de "no renderar esto".

## 4. Reglas de formato de la respuesta final (inspiradas en Codex/OpenCode)

Tomar como base, adaptado a español y al estilo de Sparta:

- Texto plano ante todo; usar estructura (títulos, listas) solo cuando
  de verdad ayuda a escanear, no por costumbre.
- Para confirmaciones simples ("listo, cambié X"), una frase, sin
  encabezados ni listas.
- Para cambios de código: primero una explicación corta de qué se hizo
  y por qué, luego detalle si hace falta. No arrancar con "Resumen:".
- No pegar archivos completos en el chat si ya se escribieron en disco
  — referenciar la ruta (`path/archivo.ts:42`) en vez de reproducir el
  contenido.
- Si hay pasos siguientes naturales (tests, build, commit), sugerirlos
  al final en 1-3 líneas, solo si aplica — no inventar "próximos
  pasos" de relleno.
- Modo revisión (`review`): hallazgos primero, ordenados por
  severidad, con archivo:línea; dudas después; resumen al final y solo
  si aporta. Si no hay hallazgos, decirlo explícito.
- Nunca revertir cambios del usuario que no pidió revertir, ni hacer
  `git reset --hard` / `git checkout --` sin que lo pida explícitamente.
  Si aparecen cambios inesperados en el working tree que el agente no
  hizo, parar y preguntar antes de seguir.

## 5. Coordinación multi-agente (para cuando el principal delega)

- Si hay subagentes corriendo, el agente principal espera antes de
  responder, salvo que el usuario pregunte algo puntual mientras tanto
  (esa pregunta se responde igual, y después se sigue coordinando).
- El agente principal no repite el trabajo que ya delegó. O lo delega
  y espera el resultado, o lo hace él mismo — nunca las dos cosas.
- Tareas independientes (ej. investigar + tocar código en paralelo) se
  reparten a la vez, no en serie, para no perder tiempo.

## 6. Agente por defecto "super potente"

- El modelo por defecto del agente principal debe ser el modelo
  "flagship" del proveedor activo (leyendo `providers.catalog.json`),
  no un modelo económico fijo — la potencia por defecto importa más
  que el costo cuando el usuario no especificó nada.
- Los 4 subagentes (research/code/memory/review) pueden usar un modelo
  más liviano si la tarea lo permite, pero el agente principal que
  orquesta y da la respuesta final no debería degradarse por defecto.

## 7. Cuándo crear un archivo vs. responder inline

> Motivado por el caso real: "Dame 5 fechas en un md" terminó creando
> `real-madrid-fechas.md` en la raíz del proyecto, sin avisar.

### Crear un archivo real solo cuando hay señal clara de persistencia

- Verbos explícitos: "guarda", "crea el archivo", "descarga",
  "guárdalo como...", mención de una ruta o extensión con intención
  de guardar ("...en un .md que pueda abrir en Obsidian").
- El contenido es algo que el usuario claramente va a reusar fuera del
  chat (una nota larga, un reporte, un README, un script).

### Responder inline (sin tocar el disco) cuando

- El pedido es una pregunta o un formato de respuesta ("dame X en
  tabla", "en formato md", "resúmelo en bullets") sin mención de
  guardar nada.
- Es contenido corto que cabe perfectamente en el chat.

### Regla práctica

**Ante la duda, responder inline primero y ofrecer guardarlo como
archivo al final** ("¿Quieres que también lo guarde como archivo?"),
en vez de crear el archivo primero y preguntar después (que es el
orden que causó el bug).

### Excepción: vista previa automática para contenido largo

Si la respuesta incluye un bloque de código o markdown que supera
~40 líneas o ~1500 caracteres, el sistema puede abrir
`ContentPreviewPane` (panel lateral) para mostrar el contenido sin
duplicarlo en el hilo del chat. Esto no requiere escribir a disco.