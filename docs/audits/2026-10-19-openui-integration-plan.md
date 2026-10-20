# Plan de integración de OpenUI en Spartan

Fecha: 2026-10-19. Estado: propuesta técnica; en esta tarea no se instalaron paquetes ni se cambió el comportamiento de la aplicación.

Actualización posterior: el usuario autorizó actualizar assistant-ui. La migración a `@assistant-ui/react@0.15.27` está implementada; ver `2026-10-19-assistant-ui-upgrade.md`. La tabla siguiente conserva la situación al preparar este plan. El requisito de Zustand 4 del conector de OpenUI sigue pendiente de resolver; no se instaló el conector.

El usuario autorizó continuar: la primera integración funcional del renderer, las vistas de lectura y la búsqueda de imágenes está implementada. El alcance validado, las decisiones sobre historial y los límites restantes se detallan en `2026-10-19-openui-implementation.md`.

## Decisión recomendada

Integrar OpenUI como un renderizador opcional dentro de las respuestas existentes. Conservar assistant-ui, el adaptador de inferencia, el historial, las herramientas y los controles de permisos. Empezar con contenido de lectura y un catálogo visual pequeño, usando los componentes y estilos de Spartan.

No se puede garantizar ausencia total de regresiones. La estrategia para reducirlas es aislar el cambio, validar compatibilidad antes de instalarlo en el producto, mantener texto alternativo y poder desactivarlo sin perder mensajes.

## Hallazgo que condiciona la instalación

Consulta de metadatos de npm realizada el 19 de octubre de 2026:

| Dependencia | Spartan actual | Requisito publicado |
| --- | --- | --- |
| `@assistant-ui/react` | 0.12.28 | `@openuidev/assistant-ui@0.2.0` exige ^0.15.0 |
| Zustand | ^5.0.11 | El conector exige ^4.5.5 |
| React | ^19.2.4 | El conector admite ^18.3.1 o ^19.0.0 |
| `@openuidev/react-lang` | No instalado | 1.0.1 declara React, React DOM, Zod y MCP SDK como peers |

La existencia de peers no demuestra por sí sola que todos sean obligatorios en ejecución: revisar `peerDependenciesMeta`, exports y árbol resuelto durante la prueba. No resolver conflictos con `--force` o `--legacy-peer-deps`.

Ruta A, recomendada: probar `@openuidev/react-lang` con una biblioteca propia y un adaptador estrecho. Ruta B, posterior: evaluar el toolkit `@openuidev/assistant-ui` junto con una actualización separada del runtime. No mezclar la actualización del chat con el primer lanzamiento visual.

## Cómo debe verse una respuesta

El contenido manda sobre el formato. Una respuesta corta sigue siendo texto; OpenUI se usa cuando aporta una comparación, una imagen relevante o una visualización útil.

Orden propuesto:

1. Durante la búsqueda, una sola fila de actividad en el mensaje: «Buscando información», ampliable para ver consultas y páginas. Los permisos pendientes y errores que requieren intervención permanecen visibles.
2. Respuesta principal clara, sin repetir el mismo contenido en texto y tarjetas.
3. Un bloque visual principal cuando ayude: comparación, galería o gráfico. La primera versión limita la composición a un máximo de tres bloques por respuesta.
4. Fuentes agrupadas al final, sin duplicados; las citas del contenido apuntan a esas mismas evidencias.
5. Acciones habituales del mensaje en una barra estable: copiar, regenerar y detalles. «Ver como texto» ofrece el equivalente accesible y exportable.

Ejemplos: una definición breve no necesita tarjeta; una comparación de tres productos puede usar tabla; imágenes de referencia se muestran en galería con origen; un gráfico solo aparece si existen datos adecuados y unidades claras. No convertir cada párrafo en una caja ni mostrar código OpenUI al usuario.

La limpieza de la actividad se hará con los componentes actuales y se entregará por separado: no depende de que la generación visual funcione.

## Arquitectura propuesta

Flujo: petición del usuario → agente y herramientas actuales → respuesta textual + presentación opcional → validación → componentes de Spartan.

El formato visual no debe decidir qué hechos son ciertos. Los datos y referencias proceden de la respuesta y los resultados de herramientas; el renderizador solo decide su presentación. La revisión de cuándo buscar y contrastar fuentes sigue siendo un trabajo independiente.

### Contrato de presentación

Definir un contenedor versionado de aplicación con los siguientes campos conceptuales:

- `version`: versión del contrato de Spartan.
- `format`: identificador explícito de OpenUI Lang.
- `libraryVersion`: vocabulario de componentes con el que se generó.
- `document`: documento OpenUI completo o parcial según el estado del stream.
- `fallbackText`: respuesta completa equivalente en texto, no el código del documento.
- `evidenceIds`: referencias a evidencias registradas para ese turno.
- `status`: parcial, completo, cancelado o inválido.

Los nombres y la ubicación exacta se fijan tras comprobar los contratos de almacenamiento. No añadir un nuevo tipo de parte de mensaje sin verificar los validadores de assistant-ui, backend e importación/exportación.

Opción inicial a validar: conservar `content` de texto como representación canónica y guardar el contenedor en metadatos versionados del mensaje. Debe demostrarse que el viaje completo cliente → almacenamiento → historial conserva esos metadatos y que la serialización de contexto no los reinyecta accidentalmente al modelo. Si eso exige cambios invasivos, detener la fase y diseñar un campo aditivo con migración explícita.

Los chats antiguos se siguen leyendo como hasta ahora. Los clientes sin soporte visual pueden mostrar el texto. Copiar, buscar, exportar y leer en voz alta usan el texto canónico; exportaciones enriquecidas podrán incluir ambos formatos más adelante.

### Puente con el agente

El adaptador actual construye `enabled_tools` y las instrucciones de forma propia. Registrar un toolkit React no garantiza que sus herramientas lleguen al modelo o se ejecuten en el backend.

Para el piloto, usar documentos fijos para comprobar únicamente renderizado y persistencia. Después introducir una capacidad explícita de presentación, de lectura, solo en rutas compatibles. Su esquema, eventos y despacho deben estar definidos por Spartan; nunca aceptar nombres de herramientas arbitrarios enviados por el modelo.

Si se elige una herramienta de presentación, debe producir un resultado terminal de visualización sin iniciar automáticamente otra generación. Verificar que no se interprete como herramienta desconocida ni como permiso de escritura, y que no cambie el presupuesto de herramientas de investigación. No incorporar `prompt_openui` ni formularios en esta primera etapa.

Generar texto alternativo en la misma respuesta o con una representación determinista de los datos validados. No programar una segunda llamada al LLM por defecto para redibujar respuestas: puede aumentar demora, coste y discrepancias. Si un componente no puede producir un equivalente fiel, queda fuera del piloto.

### Componentes iniciales

| Componente de Spartan | Entrada | Regla de presentación |
| --- | --- | --- |
| Comparación | Columnas, filas, unidades y evidencias | Tabla accesible; desplazamiento contenido en pantallas pequeñas |
| Galería de referencias | Identificadores de imagen y origen | Carga diferida, proporción reservada y recuperación ante errores |
| Gráfico sencillo | Series y etiquetas verificadas | Alternativa tabular; sin datos o unidades inventados |

Fuentes, actividad y controles del mensaje permanecen bajo control de Spartan. El modelo no puede ocultarlos, cambiar permisos o fabricar citas mediante un componente visual.

Los wrappers reutilizan shadcn y los tokens actuales. No importar una segunda apariencia completa de chat. Cualquier dependencia de gráficos se carga solo al necesitarla.

## Fases y condiciones para avanzar

| Fase | Entrega revisable | Condición para avanzar |
| --- | --- | --- |
| 0. Base | Capturas y mediciones del chat actual; reproducción del primer envío | Identificar fallos existentes y separar sus correcciones del cambio visual |
| 1. Compatibilidad | Prueba aislada con renderer y documentos fijos; versiones exactas y análisis del bundle | Instalación sin forzar peers, compilación de producción y ejecución en Electron correctas |
| 2. Presentación | Comparación, galería y gráfico con texto alternativo; límites y error boundary | Documento inválido, stream incompleto o imagen rota no rompen el mensaje |
| 3. Historial | Contrato versionado, guardado, recarga y exportación | Texto e interfaz sobreviven a reinicio; chats antiguos y clientes sin soporte siguen legibles |
| 4. Agente | Capacidad de presentación en un proveedor compatible | Una solicitud produce una respuesta coherente, sin duplicados ni llamadas adicionales involuntarias |
| 5. Limpieza | Actividad plegable, fuentes deduplicadas y barra consistente | Sin consultas en el compositor; permisos y errores siguen accesibles |
| 6. Piloto | Activación optativa para un grupo pequeño de modelos y usuarios | Pruebas funcionales y presupuesto de rendimiento aprobados |
| 7. Ampliación | Más modelos y componentes de forma incremental | Evidencia suficiente de estabilidad por ruta; retirada inmediata mediante bandera si falla |

Cada fase se entrega como cambio separado. La integración completa de formularios, mapas o acciones requiere su propio diseño después del piloto.

## Archivos y responsabilidades previstas

Rutas nuevas propuestas bajo `desktop/frontend-spartan/src/features/chat/response-ui/`:

- `contracts.ts`: contenedor versionado y estado de presentación.
- `validate.ts`: límites, componentes admitidos y resolución de evidencias.
- `library.tsx`: wrappers de componentes de Spartan registrados para OpenUI.
- `response-ui.tsx`: carga diferida, error boundary y alternativa en texto.
- `policy.ts`: activación por capacidad del modelo y tipo de respuesta.

Puntos existentes que requieren revisión al implementar:

- `components/assistant-ui/thread/assistant-message-view.tsx`: ubicación del bloque visual, herramientas, fuentes y barra de acciones.
- `features/chat/api/chat-adapter/stream-orchestrator.ts`: instrucciones, eventos, finalización y cancelación. No introducir lógica visual dispersa en todo el archivo.
- `features/chat/api/chat-adapter/message-serialization.ts`: excluir metadatos visuales del contexto salvo conversión explícita.
- `features/chat/runtime-provider.tsx`: persistencia y reconstrucción del mensaje; mantener separado el arreglo del primer envío.
- `features/chat/types.ts`, almacenamiento y rutas del backend: comprobar que el contrato sobrevive a guardado, importación y exportación.
- `components/assistant-ui/tool-group.tsx` y `sources.tsx`: actividad plegable y deduplicación, conservando detalles y confirmaciones.

Estas son ubicaciones propuestas, no archivos ya creados ni una migración autorizada de todo el runtime.

## Protección frente a fallos y reversión

- Bandera general apagada inicialmente y selección por proveedor/modelo. Capturar esa selección al empezar el turno; cambiar de chat o modelo no debe mezclar estados.
- Desactivar impide nuevas generaciones visuales y permite leer mensajes existentes en texto. Ningún rollback requiere borrar historial.
- OpenUI se carga bajo demanda. El fallo de importación, parsing o renderizado afecta solo al bloque visual; no cambia el estado de inferencia del mensaje a error.
- Límites iniciales del piloto: tres bloques, 100 filas por tabla, seis imágenes y 200 puntos por gráfico. Ajustar tras medir; no son límites de la biblioteca.
- Durante el stream, mostrar únicamente nodos que el parser considere renderizables. Las partes incompletas no disparan solicitudes de reparación por cada token.
- Validar URLs y referencias con las políticas existentes; el modelo referencia evidencias conocidas en lugar de decidir rutas locales, destinos IPC o comandos.
- Los componentes no ejecutan JavaScript generado. Toda futura acción con efectos pasa por la herramienta y la confirmación actuales; un formulario visual no equivale a autorización.
- Primera versión con renderizado local y proveedores existentes. Gateway, Autofix alojado y observabilidad externa quedan como evaluaciones independientes por sus efectos sobre red, privacidad, coste y latencia.

## Pruebas y métricas necesarias

Funcionales: primer envío, cancelar, regenerar, continuar, editar y ramificar, múltiples chats, cambio de modelo, historial antiguo, reinicio, copiar, exportar y borrar historial. Probar errores del renderer, fragmentos truncados, componente desconocido, referencias inexistentes y fallo de carga de paquete.

Visuales: claro/oscuro, español/inglés, ventana estrecha, zoom 200 %, teclado, lector de pantalla, desplazamiento al recibir contenido y estabilidad del tamaño de las imágenes. El usuario no debe perder su posición al expandir una fuente.

Rendimiento: medir por separado tiempo hasta primer texto, primer bloque visual, fin de generación, tareas largas, tamaño de bundle y memoria con historial extenso. Comparar la misma entrada, modelo y equipo con la bandera apagada y encendida; separar coste de inferencia del de renderizado. Fijar presupuestos con la línea base antes del piloto. No prometer mejoras de rapidez porque la respuesta sea visual.

Un modelo que produce documentos inválidos repetidamente queda en modo texto hasta mejorar su compatibilidad. Un caso funcional no prueba soporte general de todos los proveedores.

## Qué hacer primero

Primer cambio de implementación: prueba aislada del renderer con una comparación fija y su texto equivalente, sin conectar al LLM ni actualizar assistant-ui. Confirmar carga de producción en Electron, vuelta a texto ante fallo y tamaño del bundle. Solo después conectar streaming, persistencia y generación real, en ese orden.

## Fuentes y alcance de la revisión

- Documentación oficial: https://www.openui.com/docs
- Integración oficial con assistant-ui: https://www.openui.com/integrations/assistant-ui
- Repositorio y paquetes: https://github.com/thesysdev/openui
- Metadatos consultados con `npm view @openuidev/assistant-ui version peerDependencies dependencies --json` y `npm view @openuidev/react-lang version peerDependencies --json`.

La documentación confirma la posibilidad de usar componentes propios, renderizado progresivo e integración con assistant-ui. No confirma compatibilidad automática con el adaptador personalizado de Spartan. La compatibilidad de paquetes se comprobó en metadatos; no se ejecutó una instalación ni un prototipo en esta tarea.
