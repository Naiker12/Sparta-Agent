# Videos de documentación de Sparta con Hyperframes

Estado: 3 videos renderizados e integrados en la documentación (`guides/first-task`, `core-concepts/chat-vs-agent-mode`, `quickstart`). Cadena de renderizado local (FFmpeg 9.0.1, Chrome Headless Shell, Hyperframes 0.8.30) y componente `DocsVideo` en producción. Fecha: 6 de septiembre de 2026.

## Decisión editorial

Producir una biblioteca de tutoriales cortos orientados a resultados: conectar un modelo, adjuntar un documento, aprobar una acción y revisar lo que cambió. Cada video debe dejar al usuario capaz de repetir una tarea. La documentación escrita sigue siendo la referencia actualizable y consultable.

Hyperframes encaja como herramienta de montaje y animación: compone HTML/CSS y medios en MP4 con una línea de tiempo reproducible. Las demostraciones de Sparta necesitan capturas reales; las animaciones se reservan para títulos, señales visuales y explicaciones de arquitectura. La herramienta no verifica que una función de Sparta opere correctamente. [Repositorio oficial](https://github.com/heygen-com/hyperframes).

No conviene generar automáticamente una película por cada archivo MDX: algunas guías comparten el mismo flujo y otras requieren varios tutoriales. Se propone un video principal por tarea y fragmentos reutilizables en páginas relacionadas. Las duraciones de este documento son objetivos editoriales, no límites de Hyperframes.

## Preparación realizada

- Se ejecutó `npx skills add heygen-com/hyperframes --full-depth --list` para inspeccionar el catálogo. La búsqueda profunda encontró también habilidades internas del repositorio.
- Se instalaron en Codex ocho habilidades publicadas: `hyperframes`, `hyperframes-core`, `hyperframes-cli`, `hyperframes-creative`, `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-audio` y `media-use`.
- Los flujos especializados se instalarán al producir la pieza correspondiente. Para tutoriales personalizados, evaluar `general-video`; para una pieza comercial, `product-launch-video`.
- Se ejecutó el diagnóstico de Hyperframes 0.8.30 con telemetría desactivada. Node cumple el requisito. El diagnóstico no encontró FFmpeg, FFprobe ni Chrome Headless Shell para renderizar. Chrome de escritorio instalado no equivale al navegador fijado por Hyperframes. Docker tampoco está disponible, pero no es obligatorio para el render local.
- La memoria disponible observada fue aproximadamente 4,7 GB: empezar con un render borrador a la vez y cerrar inferencia pesada durante la exportación. No iniciar 24 renders simultáneos.

El comando de instalación de habilidades no instala por sí solo toda la cadena de renderizado. Antes de producir MP4 hay que preparar esas dependencias y repetir el diagnóstico, comprobando el campo `ok`, no solamente el código de salida. No se contrataron servicios, generaron voces cloud ni subieron capturas.

## Qué revela el proyecto

La navegación documental contiene 24 páginas. El frontend contiene además rutas `/images`, `/projects`, `/hub` y `/export`; su existencia en código no demuestra que todos sus flujos funcionen en el entorno actual.

Referencias locales revisadas:

- `landing/src/components/docs/lib/navigation.ts`: cobertura de guías actual.
- `desktop/frontend-spartan/src/features/setup/startup-gate.tsx`: estados de preparación y autenticación del motor; un video de inicio debe mostrar estas esperas y sus errores recuperables.
- `desktop/frontend-spartan/src/features/chat/chat-providers-dialog.tsx`: entrada al flujo de proveedores; grabar el diálogo real y ocultar las credenciales desde el origen.
- `desktop/frontend-spartan/src/features/tour/types.ts` y `src/components/sidebar/sidebar-nav-items.tsx`: ya existen identificadores `data-tour` y `data-testid` que pueden ayudar a localizar controles durante pruebas y capturas.
- `desktop/frontend-spartan/src/features/images/workflows.ts`: crear, transformar, inpaint, extender, upscale, referencia y editar. Varias opciones dependen de capacidades del modelo cargado: no mostrarlas todas como universales.
- `desktop/frontend-spartan/src/app/routes/export.tsx`: exportación relacionada con modelos/checkpoints. No presentarla como copia de seguridad completa de conversaciones.
- [Revisión del sistema](./system-review.md): siguen pendientes 166 resultados de frontend y 224 errores de colección del backend. Antes de grabar una demostración funcional, ejecutar su escenario y verificar el resultado.

## Catálogo de los 24 artículos

P0: primer lote de tutoriales. P1: ampliación después del piloto. P2: depende de validar entorno, hardware o integración. Cada fila describe una propuesta, no un video existente.

| Página | Pieza y resultado que debe enseñar | Duración objetivo | Estado / Prioridad |
|---|---|---:|---|
| `index` | Qué puedes hacer: recorrido contexto → acción → resultado → revisión | 45–60 s | P1 |
| `quickstart` | Preparar el motor y obtener una primera respuesta; marcar los cortes de descarga | 60 s | **Listo e integrado** (P0) |
| `guides/first-task` | Leer un archivo, autorizar un cambio pequeño y revisar el resultado | 60 s | **Listo e integrado** (Piloto P0) |
| `core-concepts/chat-vs-agent-mode` | Misma petición en consulta y con herramientas; explicar cuándo intervienen permisos | 60 s | **Listo e integrado** (P0) |
| `core-concepts/models-and-providers` | Conectar un proveedor y comprobar una respuesta; local y remoto en capítulos distintos | 75–120 s | P0 |
| `features/attachments-and-files` | Adjuntar una muestra y comprobar qué información usa el modelo | 45–75 s | P0 |
| `features/code-execution` | Revisar comando, autorización, salida y un error comprensible | 60–90 s | P0 |
| `features/live-tools` | Seguir una herramienta desde propuesta hasta resultado; indicar dónde revisar su estado | 45–60 s | P1 |
| `features/multimodal-rag` | Añadir una fuente y responder una pregunta comprobable contra ella | 75–120 s | P2 |
| `features/deep-research` | Delimitar pregunta, revisar fuentes y contrastar una conclusión | 90–150 s | P2 |
| `skills/overview` | Aplicar una regla del proyecto y comprobar un cambio de comportamiento | 60–90 s | P1 |
| `mcp/introduction` | Diagrama breve y demostración de una herramienta externa de lectura | 45–75 s | P1 |
| `mcp/configuration` | Configurar, conectar y ejecutar una consulta de prueba | 90–150 s | P2 |
| `mcp/supported-servers` | Evaluar permisos, credenciales y compatibilidad de un servidor concreto | 45–75 s | P2 |
| `core-concepts/security-and-sandbox` | Qué datos y permisos intervienen; rechazar una acción y comprobar el resultado | 60–90 s | P0 |
| `guides/troubleshooting` | Un problema por clip: motor, sesión o proveedor; síntoma → diagnóstico → recuperación | 45–90 s por clip | P1 |
| `guides/performance` | Distinguir arranque, carga del modelo y generación; medir un caso en hardware identificado | 60–100 s | P1 |
| `features/remote-access` | Conexión remota, alcance y desconexión en entorno de demostración | 90–120 s | P2 |
| `features/api-monitor` | Interpretar estado y consumo de una petición conocida | 45–75 s | P2 |
| `features/voice-audio` | Seleccionar entrada, procesar una muestra y revisar la salida | 60–100 s | P2 |
| `features/recipe-studio` | Preparar una muestra de datos, lanzar un trabajo y comprobar su artefacto | 90–150 s | P2 |
| `architecture/frontend-ui` | Ubicar renderer, estado y rutas en un diagrama con referencias al código | 60–90 s | P1 |
| `architecture/backend-architecture` | Delimitar API, inferencia y herramientas; indicar qué corre localmente | 60–90 s | P1 |
| `architecture/ipc-bridge` | Explicar renderer ↔ preload ↔ proceso principal y la frontera HTTP con Python | 60–90 s | P1 |

## Cobertura que falta escribir antes de grabar

| Función encontrada | Guía propuesta | Evidencia necesaria para el video |
|---|---|---|
| Proyectos | `features/projects` | Crear o abrir proyecto, asociar contexto y verificar su conservación |
| Hub y modelos cargados | `features/model-hub` | Buscar un modelo compatible, cargarlo y comprobar su estado; indicar requisitos |
| Imágenes | `features/images` + capítulos por operación | Un resultado real por flujo habilitado; conservar entrada, configuración y salida |
| Exportación de modelos | `features/model-export` | Exportar un modelo/checkpoint compatible y comprobar el artefacto; no confundir con backup |

Preferencias, perfiles y presets merecen microtutoriales cuando una opción cambie un resultado observable. Las carpetas internas y los botones secundarios no necesitan un video independiente por existir.

## Dirección visual

Formato principal 1920 × 1080, 16:9 y 30 fps. Es una decisión de producción adecuada a documentación de escritorio; no una promesa de tamaño final. Entregar una versión 720p si mejora la lectura en conexiones lentas. Las piezas verticales se editarían aparte para difusión.

Usar los colores de la documentación: fondo `#111210`, paneles `#191a17`, texto `#edede7`, acento `#dfd68b`. Tipografía Inter para títulos y anotaciones. Mantener intacta la interfaz real capturada; evitar recolorear o reconstruir controles de modo que parezcan una función diferente.

La aplicación debe ocupar la mayor parte del encuadre. Abrir con una frase que diga el resultado, mostrar un control por vez y acercar el área necesaria sin perder la referencia del panel. Transiciones cortas; detener el movimiento durante lectura de comandos y resultados. No usar rotaciones 3D, partículas ni montajes rápidos para explicar dónde hacer clic.

Objetivo de legibilidad: los rótulos de producción deben seguir siendo cómodos a 720p. Comprobar a tamaño real dentro del artículo, no solo a pantalla completa. No superponer subtítulos sobre la salida o el control explicado.

Narración propuesta: español claro, aproximadamente 125–145 palabras por minuto como punto de partida, ajustado después de leer en voz alta. Describir acciones concretas y nombres visibles. No añadir un avatar por defecto: ocupa espacio necesario para ver la interfaz. Empezar sin música; si se incorpora, mantener la voz inteligible y verificar derechos del audio.

## Piloto: tu primera tarea, 90 segundos

Fixture propuesto: una carpeta de demostración con un README pequeño que contenga una instrucción incorrecta deliberada. El objetivo es corregir una frase, volver a leerla y mostrar el cambio. No usar un repositorio personal ni pedir operaciones irreversibles.

| Tiempo | Imagen y acción | Narración propuesta |
|---|---|---|
| 0–7 s | Título y vista del README antes/después | «Vamos a corregir una instrucción de este proyecto y comprobar exactamente qué cambió.» |
| 7–20 s | Abrir la carpeta y señalar el modelo conectado | «Selecciona tu proyecto y un modelo que ya pueda responder. Usaremos una carpeta pequeña de demostración.» |
| 20–34 s | Mostrar la petición de lectura y su resultado real | «Primero pide que lea el README y explique el problema. Comprueba que está trabajando con el archivo correcto.» |
| 34–49 s | Solicitar una edición acotada; mostrar el control de permisos que aparezca realmente | «Ahora solicita cambiar solo esta frase. Si Sparta pide autorización, revisa la acción y su alcance antes de aprobarla.» |
| 49–65 s | Mostrar estado de herramienta y salida | «Espera el resultado de la herramienta. Una respuesta del chat no sustituye la comprobación del archivo.» |
| 65–82 s | Releer el README y mostrar diferencia verificable | «Vuelve a leer el documento y compara el cambio. Debe conservar el resto del contenido.» |
| 82–90 s | Resultado final y referencia a la guía escrita | «Ya tienes un cambio que puedes revisar. Sigue la guía para repetir este flujo en tu proyecto.» |

El guion no presupone que todos los modelos soporten herramientas ni que siempre aparezca el mismo diálogo. Los nombres de controles se ajustan a la grabación de la versión concreta. Si una espera se recorta, indicar «espera recortada»; no hacer pasar el montaje por un benchmark.

Alternativa para empezar sin una ejecución completa de Electron: un video conceptual del puente de escritorio, rotulado como explicación de arquitectura. No reemplazar capturas faltantes por una interfaz inventada presentada como uso real.

## Flujo de producción

1. Elegir una tarea y registrar versión de Sparta, idioma, modelo/proveedor y requisitos.
2. Ejecutar el escenario completo, guardar el resultado comprobado y limpiar los datos de demostración.
3. Escribir narración y lista de planos; fijar objetivo, duración y fuentes de cada afirmación.
4. Capturar la interfaz real. Conservar por separado el material original y la edición.
5. Crear la composición Hyperframes con medios locales, tiempos explícitos y animaciones que puedan buscarse por tiempo. Seguir `hyperframes-core` antes de escribir HTML.
6. Preparar voz, subtítulos WebVTT, transcripción y poster. Una voz sintética es opcional y su proveedor se decide antes de enviar texto o consumir servicios.
7. Validar la composición con el CLI instalado, revisar fotogramas de cada escena y de las transiciones y exportar un borrador. Renderizar en serie mientras haya poca memoria libre.
8. Revisar el MP4 entero: inicio, sincronía, lectura, final, subtítulos y correspondencia con la función real. Solo entonces marcarlo como listo.
9. Incorporar a la guía y comprobar reproducción, teclado, móvil y solicitudes de red. Publicar es un paso posterior a la revisión local.

## Integración en Fumadocs sin penalizar la carga

Propuesta de componente `DocsVideo` registrado entre los componentes MDX. Recibe un ID de un manifiesto; no una URL improvisada en cada artículo. Cada registro contiene título, slug, versión verificada, duración, poster, MP4, subtítulos y transcripción. Solo los registros con estado `ready` aparecen en la documentación.

Mostrar primero el poster con título, duración y un botón accesible «Reproducir…». Montar el elemento de video cuando el usuario lo active; usar controles nativos, `playsInline` y `preload="none"`. No cargar los 24 MP4 al entrar ni incorporar el runtime de Hyperframes a la landing: Hyperframes produce el archivo y el navegador reproduce el resultado. Ver [elemento video en MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video).

Colocar la pieza después del objetivo y los requisitos del artículo, sin desplazar toda la explicación escrita. Mantener relación 16:9 para evitar saltos de layout. Añadir transcripción visible o desplegable, subtítulos en español y descripción verbal de la información visual necesaria. Estos recursos se planifican desde el guion. Ver [W3C: medios accesibles](https://www.w3.org/WAI/media/av/).

Guardar fuentes y guiones en `docs/videos/`; composiciones de producción en una subcarpeta con dependencias separadas de la aplicación. Los binarios grandes se sirven desde almacenamiento de medios cuando exista un destino acordado. Para el piloto local puede usarse `landing/public/videos/`. No agregar URLs vacías ni reproductores de videos que todavía no existen.

## Criterios de aceptación y mantenimiento

- El usuario puede repetir la tarea con los requisitos indicados.
- La interfaz corresponde a una versión identificada y el resultado mostrado existe.
- No aparecen credenciales, conversaciones privadas ni rutas personales en las capturas.
- El control señalado es legible dentro de la documentación y también en móvil.
- Hay subtítulos revisados, transcripción y controles accesibles; no hay reproducción automática con sonido.
- El video no se solicita antes de pulsar reproducir; el poster no produce saltos de diseño.
- Se conservan fuente, medios, guion, versión del CLI y parámetros de render.
- Si cambia un flujo, marcar su video para revisión. No volver a renderizar toda la biblioteca por un cambio que afecta solo una función.

Orden recomendado: producir el piloto de primera tarea; ajustar la plantilla según su revisión; completar modelos, adjuntos, modos y terminal; después ampliar a MCP y funciones que necesitan hardware. La preparación de habilidades está terminada. La instalación de dependencias de render, la captura real y la producción de los MP4 siguen pendientes.
