# Refresh de UI: Thinking y actividad del agente

## Objetivo

Hacer que la actividad del agente se perciba como una secuencia breve y
legible, no como una consola ni una colección de tarjetas. El diseño toma
como referencia el patrón editorial de asistentes de código: estado compacto,
línea temporal discreta y detalle bajo demanda.

## Jerarquía visual

1. **Resumen** — muestra si el agente está pensando o si completó actividad,
   con duración y número de acciones.
2. **Riel temporal** — conecta visualmente los pasos de una misma respuesta.
3. **Acciones** — una línea por operación: icono de estado, verbo, objetivo y
   duración opcional.
4. **Detalle** — salida de comandos, resultados y errores solo al expandir.

## Reglas de interacción

- Durante streaming, el bloque se expande automáticamente.
- Al completar, se contrae para que la respuesta sea el foco.
- Una acción terminada empieza contraída; una en curso permanece abierta.
- El usuario puede conservar su preferencia de expansión por mensaje.

## Lenguaje de acciones

Usar verbos concretos y consistentes:

- `Ejecutó` para comandos.
- `Editó` para cambios en archivos.
- `Leyó` para contenido de archivos o URLs.
- `Buscó` para investigación.
- `Creó` para artefactos nuevos.

## Accesibilidad

- El encabezado expone `aria-expanded` y `aria-controls`.
- Los iconos de estado se complementan con texto y duración.
- No depender únicamente del color para éxito, error o ejecución.
