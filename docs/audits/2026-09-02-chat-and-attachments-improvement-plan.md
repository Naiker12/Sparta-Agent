# Plan de mejora: título de chats y carga de documentos

**Fecha:** 2026-09-02  
**Alcance:** Chat de Sparta Agent (títulos automáticos, adjuntos y documentos RAG).

## Resumen ejecutivo

Se identificaron dos problemas independientes:

1. Un chat puede conservar el título temporal `Nuevo chat` en vez de adoptar el texto del primer mensaje.
2. Al adjuntar PDF u otros documentos puede aparecer `Maximum update depth exceeded`, señal de un ciclo de actualizaciones de estado en React.

La prioridad es corregir primero el ciclo de React, porque bloquea la carga de archivos y puede dejar el compositor inestable. Después se debe unificar el manejo del título temporal para que no dependa del idioma de la interfaz.

## Hallazgos confirmados

### 1. El título automático depende de una cadena en inglés

El registro nuevo se crea con el título interno `New Chat` en `runtime-provider.tsx`. Las tres rutas que intentan reemplazar el título al guardar o restaurar el primer mensaje sólo continúan si el título es exactamente `New Chat`.

La captura muestra, en cambio, `Nuevo chat` en la barra lateral. Si un chat guardado, migrado o creado por una ruta localizada utiliza esa cadena, la condición falla y la aplicación asume que ya es un título definitivo. Por eso el primer mensaje (`hola` en la evidencia) no reemplaza el título.

**Archivos implicados**

- `desktop/frontend-spartan/src/features/chat/runtime-provider.tsx`
- `desktop/frontend-spartan/src/features/chat/utils/chat-title.ts`
- `desktop/frontend-spartan/src/i18n/locales/es/shell.ts`

**Defecto de diseño:** usar texto visible y localizado como marcador de estado. Un valor de presentación no debe determinar si el chat todavía no tiene título.

### 2. La carga de documentos puede formar un ciclo de renderizado

La ruta de documentos RAG es:

`ThreadDocumentsBar` → `useRagDocuments` → estado de carga/indexación → `onIndexingChange` → estado del compositor → nuevo render de `ThreadDocumentsBar`.

El componente hijo notifica en un `useEffect` cada cambio de `hasIndexing`. El padre ya contiene una protección parcial para ignorar el mismo valor repetido, con un comentario que menciona explícitamente que sin ella React puede exceder la profundidad de actualización. Esto confirma que esa frontera es sensible a ciclos durante la materialización de un chat y la carga inicial de un documento.

Además, el hook de documentos publica nuevos arreglos de `documents` durante carga, refresco, progreso SSE y reconciliación. Si una notificación se produce antes de que la referencia del padre esté sincronizada, o un callback cambia de identidad en una ruta futura, el efecto hijo puede volver a disparar una actualización que vuelve a renderizar al hijo.

**Archivos implicados**

- `desktop/frontend-spartan/src/features/rag/components/thread-documents-bar.tsx`
- `desktop/frontend-spartan/src/features/rag/components/use-rag-documents.ts`
- `desktop/frontend-spartan/src/components/assistant-ui/thread.tsx`

## Cambios propuestos

### P0 — Eliminar el ciclo de actualizaciones al adjuntar

1. Mantener la deduplicación de `handleIndexingChange` en el padre, pero convertirla en un contrato explícito: sólo llamar `setIndexingActive` si el valor cambia.
2. En `ThreadDocumentsBar`, conservar el último valor emitido en un `ref` y no invocar `onIndexingChange` si `hasIndexing` no cambió. Así se bloquea el ciclo en su origen, no sólo en el consumidor.
3. Estabilizar el callback con `useCallback` (ya está hecho en el padre) y no incluir objetos o arreglos recreados como dependencias de efectos que notifican al padre.
4. Separar el estado de visualización de chips (`documents`) del estado booleano de bloqueo de envío (`hasIndexing`). El segundo debe derivarse y notificarse sólo por transición `false → true` o `true → false`.
5. Añadir trazas temporales con identificador de chat, `scopeKey`, `hasIndexing` y contador de emisiones. Retirarlas cuando se confirme que una carga genera como máximo dos transiciones: inicio y fin.

### P0 — Hacer robusto el título del primer mensaje

1. Introducir un estado semántico, por ejemplo `titleSource: "default" | "auto" | "manual"`, en `ThreadRecord`; no inferirlo comparando texto.
2. Mientras llega esa migración, centralizar una función `isDefaultChatTitle(title)` que reconozca los valores históricos conocidos (`New Chat`, `Nuevo chat`) y usarla en todas las rutas de título.
3. Centralizar también `DEFAULT_CHAT_TITLE`; evitar los literales repetidos en `runtime-provider.tsx` y `chat-title.ts`.
4. Al guardar el primer mensaje de usuario, actualizar sólo si `titleSource` es `default`; una edición manual jamás debe ser sobrescrita.
5. Ejecutar una migración segura de chats existentes: para cada chat cuyo título sea temporal, tomar el primer mensaje de usuario y aplicar `fallbackTitleFromUserText`.

### P1 — Fortalecer el procesamiento de PDF y otros adjuntos

1. Añadir límites configurables de tamaño, páginas y caracteres extraídos antes de convertir un PDF completo a texto en memoria.
2. Encapsular los errores de `unpdf` por archivo y mostrar una notificación clara: archivo, causa y acción sugerida.
3. Comprobar que un PDF escaneado sin texto genere un resultado controlado (ofrecer OCR o avisar que no hay texto extraíble), no un adjunto vacío.
4. Cancelar extracción/indexación al cambiar de chat o retirar el archivo, para impedir que una tarea tardía actualice un compositor desmontado.

## Pruebas de regresión requeridas

| Caso | Resultado esperado |
| --- | --- |
| Interfaz en español; nuevo chat; enviar `hola` | La barra lateral muestra `hola`, no `Nuevo chat`. |
| Interfaz en inglés; nuevo chat; enviar una pregunta | Muestra la primera línea de la pregunta. |
| Chat heredado con `Nuevo chat` y primer mensaje existente | Se repara una sola vez sin sobrescribir títulos manuales. |
| Adjuntar PDF pequeño y enviar | Sin `Maximum update depth exceeded`; aparece un único chip y el mensaje se envía. |
| Adjuntar DOCX, TXT, CSV y PDF consecutivamente | No hay render recursivo ni duplicados; el bloqueo de envío finaliza al indexar. |
| Cambiar de chat durante indexación | No se actualiza el chat nuevo con el estado del anterior. |
| PDF dañado o escaneado | Error controlado y recuperable, sin bloquear la interfaz. |

## Criterios de aceptación

- No se reproduce `Maximum update depth exceeded` al cargar documentos en 30 intentos consecutivos.
- Todo chat nuevo obtiene el título del primer mensaje de usuario, independientemente del idioma.
- Un título manual permanece intacto.
- Los fallos de PDF se muestran por archivo y no rompen el compositor.
- Las pruebas unitarias cubren los marcadores históricos de título y las transiciones de indexación.

## Orden recomendado de implementación

1. Añadir prueba que reproduce el bucle de indexación y corregir la emisión duplicada.
2. Añadir prueba para `Nuevo chat` y centralizar la detección de título temporal.
3. Implementar la migración de títulos heredados.
4. Añadir límites, cancelación y mensajes de error para PDF.
5. Ejecutar las pruebas de chat y adjuntos, además de una verificación manual en español e inglés.

## Evidencia revisada

- `runtime-provider.tsx` crea y compara repetidamente contra `New Chat`.
- `shell.ts` define la interfaz española como `Nuevo chat`.
- `ThreadDocumentsBar` emite `onIndexingChange` desde un efecto.
- `thread.tsx` contiene una protección explícita frente al mismo bucle de profundidad de actualización durante la subida de documentos.
- Las pruebas actuales validan el formateo del título, pero no cubren el marcador español ni el ciclo de indexación.
