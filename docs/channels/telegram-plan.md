# Plan de evolución de Telegram

Fecha: 2026-10-05. Rama: `canales`. Estado: propuesta para revisión; las capacidades futuras descritas aquí todavía no están implementadas.

Avance de implementación: indicador nativo renovable, `/cancel` durante generación, recepción de nuevos mensajes durante la consulta, eventos de inicio/cancelación en Actividad y descripciones ES/EN. La cancelación interrumpe la espera local y descarta la respuesta; no garantiza que el proveedor remoto deje de facturar una solicitud ya recibida.

Segundo bloque: `/usage` con tokens reportados por usuario durante las últimas 24 horas y límite local compartido del bot; resumen por bot en Actividad; proyección de consultas en Tareas → Bandeja de trabajo. La proyección muestra origen, ejecución, respuesta entregada, cancelación, error o necesidad de revisión. No agrega un segundo ejecutor ni da acceso a proyectos/carpetas. Las consultas completadas conservan una vista previa y su respuesta en esa bandeja hasta eliminar el bot, independientemente del contexto conversacional de siete días; los registros de consumo se conservan durante 30 días y el resumen utiliza 24 horas. La vinculación con un chat/proyecto, el ejecutor de herramientas compartido, web, voz, archivos y perfil siguen pendientes. Falta comprobar ambos bloques con Telegram real después de reiniciar Spartan.

## Objetivo y punto de partida

Usar Telegram como una entrada a Spartan: conversación, investigación, audios, archivos y trabajo por proyecto, con progreso visible también en la aplicación. Mantener el diseño actual de Canales y mejorar su claridad mediante capacidades reales y estados de conexión, preparación, ejecución y error.

Actualmente existen conexión por bot, vinculación por enlace/QR con aprobación en Spartan, usuarios autorizados, conversaciones privadas, respuestas de texto, historial separado por usuario, comandos informativos, reinicio de contexto y actividad. El ejecutor de Telegram bloquea herramientas; habilitar búsqueda, archivos o acciones requiere una integración explícita, no solamente cambiar su prompt.

La vinculación de un usuario permite conversar. No implica acceso a los archivos, al perfil global ni al control de la PC. Esas capacidades tendrán permisos propios por conexión y usuario.

## Entregas y criterios de aceptación

| Orden | Entrega | Resultado verificable |
| --- | --- | --- |
| 1 | Respuesta y progreso | Indicador nativo «escribiendo», espera comprensible, errores claros y fin del indicador al terminar o cancelar. Los mensajes nuevos siguen llegando durante una consulta larga. |
| 2 | Trabajo compartido y comandos | Trabajo persistente con identificador, `/cancel`, proveedor/modelo y consumo; estado visible en Spartan, sin repetir acciones tras un reinicio. |
| 3 | Investigación web | Búsqueda cuando se solicita o hace falta información actual; respuesta con fuentes, enlaces y fotos de referencia cuando están disponibles. |
| 4 | Notas de voz locales | Descargar y transcribir audios autorizados con el motor existente, mostrar transcripción corregible y enviarla al mismo flujo de conversación. |
| 5 | Proyectos y archivos | Elegir un proyecto autorizado, leer/buscar dentro de sus carpetas y enviar un archivo seleccionado con permiso de envío. |
| 6 | Nombre y control limitado | Alias personal, cambio confirmado del perfil de Spartan para su propietario y acciones de proyecto con las mismas autorizaciones que en escritorio. |

Cada entrega incluye español/inglés, estados de carga, cancelación y errores, pruebas de sus límites y comprobación con el bot real. Discord reutilizará los contratos de trabajo, permisos y adjuntos después de estabilizar Telegram.

### 1. Indicador y experiencia de respuesta

- Agregar `sendChatAction` al transporte existente y un gestor que renueve `typing` aproximadamente cada cuatro segundos mientras exista trabajo activo. Telegram mantiene el estado durante cinco segundos o menos; el mensaje final lo limpia. Un fallo del indicador no debe perder la respuesta.
- Para tareas largas, usar un único mensaje de progreso que se actualice al cambiar de fase: «En espera», «Buscando información», «Transcribiendo audio», «Esperando tu autorización». No publicar un mensaje por token ni fingir fases que no existen.
- Usar `upload_photo` y `upload_document` cuando corresponda. Detener renovaciones en `finally`, al desconectar y al cancelar; respetar límites y `retry_after`.
- Evaluar posteriormente `sendMessageDraft` y sus eventos de detención para respuestas parciales, con alternativa compatible. El indicador de escritura es la primera entrega y no depende de esa ampliación.
- Separar recepción y ejecución mediante una cola acotada. Una tarea larga no debe impedir recibir `/cancel`. Mantener orden por conversación, límites de concurrencia y aislamiento entre usuarios.

### 2. Trabajo compartido, comandos y consumo

Reutilizar el sistema de trabajo existente donde sea compatible. `core/work_requests.py` actualmente acepta solamente `origin="manual"` y no permite enlazar proyecto/chat. Extender ese contrato exige validar propiedad de bot, usuario, proyecto y conversación de forma atómica; no basta con enviar un ID desde Telegram.

Guardar identidad de origen, selección de modelo, proyecto, permisos, estado, revisión, cancelación y resultado. El trabajo debe aparecer en el chat o vista de trabajo de Spartan con la etiqueta «Telegram». Compartir ejecución y estados; evitar dos motores que se comporten de forma diferente.

Menú `/` propuesto, con descripciones en ambos idiomas y botones cuando eviten escribir identificadores:

| Comando | Función |
| --- | --- |
| `/help`, `/status` | Capacidades realmente disponibles, estado del bot y trabajo actual. |
| `/provider` | Proveedor y modelo seleccionados; cambios sujetos al alcance autorizado. |
| `/usage` | Tokens de entrada/salida, total, periodo y presupuesto local configurado. |
| `/projects`, `/project` | Listar y elegir proyectos compartidos con ese usuario. |
| `/folders` | Carpetas autorizadas del proyecto seleccionado. |
| `/permissions` | Consultar permisos y solicitar ampliación en Spartan. |
| `/skills`, `/mcp`, `/tools` | Inventario permitido y disponibilidad real de ejecución. |
| `/voice` | Motor/modelo, preparación y ajustes de transcripción. |
| `/name` | Consultar o cambiar el alias; ofrecer sincronización del perfil al propietario. |
| `/cancel`, `/reset` | Cancelar el trabajo propio o reiniciar el contexto de conversación. |

Capturar uso reportado por cada proveedor. Si solo hay estimaciones, etiquetarlas. Mostrar tokens restantes únicamente cuando exista un presupuesto conocido o una API del proveedor que lo permita; la ventana de contexto no equivale a saldo y el límite local de solicitudes no equivale a tokens. Los comandos informativos no necesitan una llamada al modelo.

### 3. Web, enlaces e imágenes

Conectar el servicio de búsqueda/herramientas existente al ejecutor compartido mediante su política de acceso. Consultar la web para datos actuales o cuando el usuario lo solicite. Para dudas que dependen de datos privados, pedir el contexto necesario; una búsqueda pública no reemplaza esos datos.

Cada resultado conservará título, URL de origen y fecha de consulta. Las imágenes de referencia deben ser recuperadas de una fuente real y acompañarse de su enlace; si no existe una imagen utilizable, entregar el enlace y explicarlo. Una imagen generada se etiquetará como generada y será otra capacidad.

Validar direcciones y redirecciones, impedir acceso a servicios internos mediante URLs externas, limitar tamaño/tiempo y tratar páginas/documentos como contenido no confiable. Ningún texto encontrado puede conceder permisos o cambiar el proyecto activo. Los adaptadores deben comunicar con claridad cuando búsqueda o imágenes no estén disponibles para el proveedor configurado.

### 4. Voz local

Hardware observado: Intel Core i3-10105, cuatro núcleos/ocho hilos, 12 GB RAM e Intel UHD Graphics 630. Propuesta inicial: Whisper `base` multilingüe en CPU; probar `small` si el tiempo de respuesta y la memoria durante el uso real son adecuados. No usar modelos `.en`, ya que necesitamos español e inglés.

Spartan ya dispone de rutas STT, registro de motores, procesos auxiliares y conversión de audio. Reutilizarlos mediante un servicio común. Comprobar disponibilidad del binario/modelo antes de ofrecer «Listo»: el código existente contempla alternativas cuando whisper.cpp no está disponible. No agregar faster-whisper ni otro runtime sin medir primero el existente.

Transcripción local sin tarifa por minuto de un proveedor; requiere descargar un modelo y consume recursos de la PC. Si la conversación usa un proveedor remoto, el texto transcrito se enviará a ese proveedor, aunque el reconocimiento de voz sea local. Responder con voz sería una entrega posterior de TTS, independiente de Whisper.

Límites iniciales propuestos: 20 MB de descarga por la Bot API alojada y cinco minutos por audio; validar también duración real, formato y tamaño decodificado. Descargar solo después de autorizar remitente, usar temporales aislados, limpiar en éxito/error/cancelación y no registrar URLs que contengan el token del bot. Una transcripción no autoriza por sí misma acciones delicadas.

Medición necesaria: audios de 15, 60 y 180 segundos en español/inglés, tiempo de transcripción, consumo máximo y comportamiento mientras Spartan trabaja. La recomendación `base` es una elección inicial, no una promesa de velocidad.

### 5. Carpetas, documentos y proyectos

En Spartan, el propietario selecciona qué proyectos/carpetas comparte con cada usuario del canal y los permisos: consultar, enviar archivos y solicitar modificaciones. Mostrar nombres comprensibles en Telegram; no divulgar todas las rutas de la PC ni las carpetas de otros usuarios.

Resolver rutas canónicas y verificar que permanezcan dentro del alcance autorizado, incluidos enlaces simbólicos/junctions. Bloquear credenciales y secretos conocidos, limitar extensiones/tamaño y distinguir permiso de lectura del permiso de enviar un archivo fuera de la PC. Pedir selección si hay varios resultados, sin enviar una carpeta completa automáticamente.

Los documentos recibidos se procesan como adjuntos del trabajo; no se ejecutan ni se abren automáticamente como programas. Definir formatos soportados antes de habilitarlos. La Bot API alojada permite actualmente subir por multipart hasta 50 MB para documentos y 10 MB para fotos; empezar con límites propios menores y mensajes claros.

Al elegir proyecto, enlazar una conversación identificable en Spartan y mostrar trabajo, archivos involucrados y solicitudes de autorización. Conservar permisos por usuario/proyecto aunque se cambie de modelo. Al revocar una carpeta, rechazar también trabajos pendientes que intenten usarla.

### 6. Nombre y acciones remotas

«Llámame Naiker Gómez» modifica primero el alias de ese usuario de Telegram. Para actualizar también el perfil de Spartan, comprobar que sea el propietario vinculado y mostrar una propuesta clara con el nombre exacto. Otros usuarios autorizados no pueden cambiar el perfil global.

El perfil actual usa Zustand persistido en el frontend (`sparta_user_profile`). Introducir almacenamiento y servicio compartido con migración de los valores existentes, sincronización al abrir la aplicación y notificación de cambios; Telegram no debe intentar editar directamente localStorage ni crear una segunda fuente de verdad.

Control inicial permitido: consultar estado, seleccionar proyecto, iniciar una consulta y cancelar su trabajo. Crear/editar/eliminar recursos se realizará en modo Agente y pasará por el diálogo de permisos existente. La aprobación se conserva en Spartan en esta primera versión; un botón de Telegram puede solicitar la acción, pero no saltarse ese control. La ejecución MCP usa exclusivamente el puente nativo `mcp:call-tool`/`McpProcessManager`.

## Estructura y reutilización

Mantener transporte, reglas del canal y adaptación en `core/channels/`; contratos/ejecución compartidos fuera del transporte. Los nombres siguientes son propuestas, no archivos que ya existan:

```text
desktop/backend-spartan/
  core/channels/
    telegram.py              # transporte existente: acciones, mensajes y adjuntos
    runtime.py               # recepción y coordinación; no lógica de cada herramienta
    progress.py              # indicador, fases y actualización limitada
    commands.py              # acciones deterministas; evolución de catalog.py
    work_adapter.py          # identidad Telegram -> trabajo compartido
    attachments.py           # recepción/envío y temporales controlados
  storage/channels/
    repository.py            # cuentas, cursor e inbox existentes
    history.py               # contexto existente
    work_links.py            # vínculo usuario/proyecto/conversación/trabajo
    grants.py                # permisos por usuario y proyecto
  core/work_requests.py      # ampliar contrato existente con validación de propiedad
  routes/channels/            # configuración UI; no endpoints administrativos del bot

desktop/frontend-spartan/src/features/channels/
  components/
    channel-permissions.tsx  # capacidades y carpetas compartidas
    channel-projects.tsx     # selección de proyectos permitidos
    channel-voice.tsx        # motor, descarga y preparación reales
    channel-work-status.tsx  # progreso y entrada al chat correspondiente
```

Reutilizar `core/inference/tools.py`, `web_access_policy.py`, los ejecutores de herramientas existentes, las rutas y el registro STT, el store/API de workspaces, las carpetas vinculadas y la vista de trabajo. El código STT actualmente contenido en rutas debe exponerse como servicio antes de reutilizarlo; evitar llamar una ruta HTTP interna con credenciales del escritorio.

La migración de perfil pertenece a la función Perfil, aunque Canales la consuma. Mantener español e inglés en el namespace de cada función. Extraer responsabilidades de `runtime.py` gradualmente con pruebas de comportamiento; no borrar librerías o código reutilizado antes de demostrar que ya no tiene consumidores.

## Validación y siguiente bloque concreto

Primero implementar la entrega 1: transporte `sendChatAction`, gestor de progreso, ejecución que permita recibir cancelación y estado en la actividad existente. Pruebas: renovación sin duplicados, limpieza ante error/cancelación/desconexión, aislamiento por usuario, reintentos limitados y respuesta final entregada una sola vez. Verificar con Telegram real.

Después incorporar el contrato de trabajo y `/usage`; cerrar esa base antes de conceder herramientas. Las etapas siguientes añaden pruebas de permisos, rutas que escapan del alcance, contenido que intenta dar instrucciones, archivos grandes, reinicios y sincronización de perfil. Ninguna entrega exige fusionar `canales` a `main` o publicar una versión.

## Avance de búsqueda pública

Tercer bloque implementado: búsqueda pública por `/search` para proveedores de texto y una herramienta `search_public_web` que los modelos compatibles pueden solicitar automáticamente. Reutiliza el buscador existente, con una búsqueda de hasta tres fuentes por consulta y dos llamadas máximas al modelo. Las fuentes se añaden desde resultados reales y se identifican como extractos; todavía no se descargan imágenes ni se leen páginas completas. Se rechazan credenciales identificables, rutas locales y URLs internas conocidas; no se transmiten automáticamente historiales privados como consulta. La cancelación descarta el resultado y señala al buscador que se detenga; la petición bloqueante en curso puede terminar hasta su timeout. El uso de las llamadas al modelo se agrega sin duplicar informes acumulados y marca los datos incompletos. La búsqueda automática depende del soporte de herramientas del modelo; `/search` no requiere ese soporte. Permanece pendiente conectar chat/proyectos, voz, archivos y perfil.

## Fuentes primarias consultadas

- [Telegram: sendChatAction](https://core.telegram.org/bots/api#sendchataction): duración y acciones nativas.
- [Telegram: sendMessageDraft](https://core.telegram.org/bots/api#sendmessagedraft): respuestas parciales y detención.
- [Telegram: getFile](https://core.telegram.org/bots/api#getfile) y [envío de archivos](https://core.telegram.org/bots/api#sending-files): límites y métodos de transferencia.
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp): ejecución en CPU, cuantización y modelos multilingües.
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper): alternativa a evaluar solo si el motor existente no satisface las mediciones.

Los límites externos se comprobarán de nuevo al implementar. La arquitectura propuesta se basa también en los módulos reales del repositorio revisados; no supone que enumerar una skill o un MCP signifique que Telegram ya puede ejecutarlo.
