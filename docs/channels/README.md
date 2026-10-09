# Canales

Trabajo aislado en la rama `canales`, creada desde `main`. Integra los cambios de memoria e idiomas que ya se fusionaron en `main`. Estado del desarrollo revisado el 6 de octubre de 2026. No equivale a una versión publicada.

## Interfaz real

La actividad muestra ocho eventos por página dentro de los últimos 50 cargados. Los filtros reinician la página y los contadores resumen todo el conjunto cargado. Consumo, ayuda de voz y límites tienen detalles plegables; los ajustes de voz y proyectos se abren desde la tarjeta del bot. Las tarjetas de introducción solo aparecen antes de conectar el primer bot.

La guía para usuarios vive en [Canales y Telegram](../../landing/src/components/docs/content/pages/features/channels.mdx), integrada en la navegación y búsqueda de la documentación de la landing. Incluye los flujos de conexión y procesamiento de entradas como diagramas, límites y capacidades pendientes. Los cambios siguen locales, sin publicar la landing ni subir la rama.

La ruta `/channels` forma parte del router de Spartan y la fila Canales de la barra lateral abre esa ruta. El módulo usa los mismos componentes, colores e idiomas de la aplicación. No requiere un HTML independiente ni sustituye respuestas del backend.

Canales está permitido por el filtro de equipos sin GPU: utiliza proveedores API, así que ese filtro no debe redirigirlo al chat. El título de la ventana también utiliza la traducción de Canales.

La navegación interna distingue Telegram disponible de Discord, WhatsApp y Slack próximos. Seleccionar una integración próxima muestra su estado, sin ofrecer una conexión ficticia. Telegram muestra las conexiones existentes o una guía inicial. El asistente de configuración tiene tres pasos: bot, proveedor/modelo y acceso. Guarda pausado; conectar requiere una acción posterior del usuario.

## Responsabilidades

| Carpeta | Responsabilidad |
| --- | --- |
| `desktop/frontend-spartan/src/features/channels/` | Pantalla, API, estado y contratos de Canales |
| `features/channels/components/` | Navegación, configuración, conexiones, capacidades y actividad |
| `desktop/backend-spartan/routes/channels/` | Plano de control protegido por sesión de interfaz y propiedad |
| `desktop/backend-spartan/core/channels/` | Transporte Telegram, identidad, catálogo, ejecución limitada y ciclo de vida |
| `desktop/backend-spartan/storage/channels/` | Configuración, recepción durable, presupuesto y eventos |
| `desktop/backend-spartan/core/inference/voice_state.py` | Estado y preparación de la voz local |
| `desktop/backend-spartan/core/inference/voice_providers.py` | Configuración cifrada y adaptadores de transcripción externa |
| `desktop/backend-spartan/routes/voice/` | Configuración y pruebas de voz protegidas por sesión de interfaz |
| `features/settings/tabs/voice-tab.tsx` | Selector, claves, consentimiento, errores y prueba de audio |

Canales consume `/api/channels`; los ajustes compartidos de Voz consumen `/api/voice`. Las rutas antiguas `/api/channels/voice` permanecen como alias del mismo servicio. El transporte no recibe un JWT administrativo ni llama endpoints de la aplicación. Las credenciales reutilizan el almacén cifrado existente, con tipo `channel_bot_token` y alcance por conexión. Los módulos IPC existentes llamados `channels` pertenecen a otra función y permanecen intactos.

## Disponible en esta entrega

- Verificación del bot por `getMe`; detección de webhook existente y bot duplicado.
- Token cifrado, excluido de respuestas y validaciones. Redacción de la URL del bot en logs HTTP.
- Una conexión se guarda pausada y puede conectarse, pausarse o eliminarse desde Spartan.
- Recepción por long polling mientras el backend está abierto; cierre de clientes y cancelación al salir.
- Solo conversaciones privadas, con IDs numéricos autorizados. Grupos, bots y remitentes no autorizados no acceden al proveedor ni al inventario.
- El menú nativo muestra `/help`, `/projects`, `/usage`, `/cancel` y `/reset`. `/status`, `/provider`, `/tools`, `/skills`, `/mcp`, `/search`, `/read`, `/images` y `/voice` conservan sus handlers de compatibilidad. El inventario omite secretos, cabeceras MCP, rutas e instrucciones de skills.
- Respuestas de texto mediante un proveedor API y modelo configurados, con búsqueda y lectura web públicas acotadas; sin archivos locales, ejecución de skills/MCP ni memoria de escritorio. El contexto reciente está aislado por bot y usuario: hasta seis intercambios completados, 24000 caracteres de contexto y siete días. Solo se guardan respuestas confirmadas por Telegram; /reset borra el contexto de ese usuario.
- Límite de 30 consultas al proveedor por hora y conexión, 90 segundos por solicitud, 1500 tokens de salida y 12000 caracteres de respuesta. Los intentos fallidos cuentan.
- Cursor y mensajes aceptados guardados en una transacción antes de avanzar el offset. IDs repetidos no duplican ejecución.
- Las operaciones interrumpidas o cuyo envío resulte ambiguo se marcan fallidas y no se reejecutan automáticamente. No se garantiza entrega exactamente una vez.
- Actividad limitada a códigos y fechas; nunca muestra contenido del mensaje o token. El registro interno de recepción sí conserva texto autorizado localmente hasta siete días cuando continúa la recepción. La eliminación de la conexión borra sus registros y credenciales.

## Entradas implementadas y límites

- Texto y búsqueda pública explícita en español e inglés; lectura de páginas públicas y hasta dos imágenes de referencia con enlaces. Búsqueda automática según soporte de herramientas del modelo.
- TXT, Markdown, CSV y JSON UTF-8: hasta 256 KB y 24.000 caracteres, leídos en memoria. PDF y Word siguen pendientes.
- Voz: hasta cinco minutos y 20 MB; transcripción local o proveedor externo elegido explícitamente, respuestas por texto, permisos por bot y usuario.
- ElevenLabs, Groq y API compatible: claves cifradas, consentimiento y prueba de audio. Los destinos compatibles son públicos HTTPS y no aceptan redirecciones. La configuración guardada no certifica que la clave funcione.
- Proyectos: selección autorizada por usuario, asociación de actividad y reinicio del contexto al cambiar. No incorpora instrucciones ni archivos del proyecto.

El selector de transcripción permanece disponible ante un fallo de carga; permite completar los campos de otro proveedor. Reintentar no sobrescribe una selección editada. Solo un guardado correcto cambia la configuración activa.

## Siguientes etapas

1. Resolver el fallo de arranque del paquete Whisper CPU en el equipo afectado. El archivo descargado pasó su comprobación, pero el ejecutable no inició; no afirmar voz lista ni cambiar de proveedor automáticamente.
2. Validar transcripción real en español e inglés con un audio breve y una clave externa introducida por el usuario, sin incluirla en logs o documentación.
3. Validar el flujo completo Telegram: nota de voz, indicador de escritura, respuesta, cancelación, usuario denegado y recuperación ante errores de proveedor. Las pruebas automatizadas de transporte no sustituyen esta validación.
4. Archivos de proyectos, sincronización de perfil y ejecución de skills/MCP requieren contratos específicos de permisos y confirmaciones. Mantenerlos como pendientes.
5. Discord: adaptador separado, permisos mínimos y restricciones por usuario, servidor y canal. WhatsApp y Slack después. Micrófono del chat, síntesis y asistente de voz en tiempo real en una fase posterior.

## Validación

La comprobación enfocada más reciente del backend completó **79 pruebas** de proveedores de voz, integración de voz de Canales y preparación local. Usa almacenamiento temporal y transportes simulados; no demuestra que todas las API funcionen con claves reales.

Desde `desktop/backend-spartan`:

```powershell
.venv/Scripts/python.exe -X utf8 -m pytest --noconftest tests/test_voice_providers.py tests/test_channels_voice.py tests/test_voice_setup.py -q
```

Se usa `--noconftest` porque la configuración general importa `core.inference.diffusion_prequant`, ausente en este checkout. Se comprobaron compilación del frontend, paridad de traducciones y lint dirigido. El último ajuste del selector pasó TypeScript y ESLint. La última revisión visual sigue pendiente con la aplicación abierta.

Documentación de la landing: `npm run docs:check`; el catálogo se regenera con `node scripts/docs-catalog.mjs`. Los cambios continúan locales en `canales`, sin publicar la landing ni subir la rama.

## Fuentes primarias

- [Telegram Bot API](https://core.telegram.org/bots/api): recepción, offsets, comandos y límites del transporte.
- [OpenClaw: Telegram](https://docs.openclaw.ai/channels/telegram/transports): separar recepción durable del procesamiento.
- [OpenClaw: control de acceso](https://docs.openclaw.ai/channels/telegram/access-control): identidad y restricciones de remitentes.
- [Claude Code: referencia de Channels](https://code.claude.com/docs/en/channels-reference): recepción y ejecución requieren límites separados; notificar no equivale a procesar.
- [Discord Gateway](https://docs.discord.com/developers/events/gateway): protocolo y permisos para la siguiente integración.

Las APIs de esas aplicaciones son referencias arquitectónicas; Spartan no utiliza sus credenciales, clientes ni sesiones.

La guía muestra el enlace oficial de BotFather antes de abrir el asistente. Los indicadores SVG cubren carga, actualización, verificación y cambios de conexión. La consulta tiene un límite de 15 segundos, evita consultas simultáneas y ofrece reintento sin dejar un esqueleto permanente cuando falla. Los textos nuevos están disponibles en español e inglés. El último ajuste visual requiere revisión en la aplicación abierta.

La rama `canales` incorpora `main` después de fusionar memoria y traducciones. El contexto local de Telegram no se expone en el inventario ni en la actividad. /reset borra el contexto para futuras respuestas; el registro durable de recepción mantiene su política de retención independiente. La caducidad del contexto se aplica al leer o guardar intercambios.

## Vinculación de Telegram

El asistente verifica y guarda el bot pausado sin exigir IDs. Crea un enlace oficial `t.me/<bot>?start=link_<nonce>` y un QR SVG generado localmente con la dependencia existente `react-qr-code`. El usuario pulsa Iniciar en Telegram, compara el código de comprobación y aprueba la cuenta en Spartan. Aprobar agrega el ID detectado y activa la conexión; se pueden vincular cuentas adicionales desde su tarjeta.

El nonce tiene 256 bits aleatorios, caduca a los diez minutos y solo se guarda su hash. Cada bot tiene una solicitud activa; regenerarla invalida la anterior. El primer remitente privado válido queda pendiente de revisión, sin permisos. El nombre visible no autentica: la comprobación usa el código recibido en el propio chat. La aprobación exige sesión de interfaz, propiedad de la conexión, solicitud vigente y cupo de usuarios; una API key no puede autorizarla.

Un bot pausado escucha temporalmente mientras su vinculación está vigente. Solo procesa la identificación asociada al enlace: no persiste el comando con el nonce, no consulta inventarios ni ejecuta el modelo. Cancelar o caducar finaliza esta recepción en el siguiente ciclo del supervisor. No se crea un segundo consumidor de getUpdates.

La interfaz cubre espera, cuenta detectada, cancelación, renovación, caducidad, errores de transporte y reintento, en español e inglés. La revisión completa con Telegram externo requiere el bot del usuario; las pruebas utilizan almacenamiento temporal y transportes simulados.

Fuentes: [Deep linking de Telegram](https://core.telegram.org/bots/features#deep-linking) y [User en Bot API](https://core.telegram.org/bots/api#user).

Los datos de una cuenta no aprobada se borran de la solicitud cuando se cancela o caduca; el supervisor limpia solicitudes caducadas una vez por minuto. La interfaz recupera una aprobación completada si su respuesta HTTP se perdió. Las consultas y operaciones de vinculación tienen un límite de quince segundos; la verificación inicial del bot dispone de noventa segundos.

## Actividad

La vista resume respuestas, errores y cambios de conexión sobre los últimos 50 eventos recibidos, no sobre todo el historial ni un periodo diario. Permite filtrar por tipo y por bot, agrupa por fecha local y muestra la hora y orientaciones para errores de autenticación, consumidor duplicado y límites de Telegram. Los eventos nuevos cubren guardado, activación, conexión confirmada, pausa, vinculación, autorización, cancelación y reinicio del contexto. Los eventos desconocidos se presentan como información, sin inventar un fallo.

El contenido del mensaje, los tokens y códigos de vinculación no se incluyen en la actividad. Se conserva el límite existente de eventos por conexión. Los límites de Telegram al enviar se registran y respetan la espera del transporte, sin reintentar un envío ambiguo. Los eventos antiguos no se reconstruyen retroactivamente.

## Voz compartida y enlaces oficiales

La configuración se separa del transporte: `routes/voice` utiliza `core/inference/voice_state` y `voice_providers`; `core/channels/voice` aplica los permisos y límites de Telegram al servicio compartido. Los futuros canales y la entrada del chat podrán consumir ese servicio cuando se implementen.

- [ElevenLabs: crear claves](https://elevenlabs.io/app/developers/api-keys), con permiso Speech to Text.
- [ElevenLabs: contrato de transcripción](https://elevenlabs.io/docs/overview/capabilities/speech-to-text).
- [Groq: claves API](https://console.groq.com/keys) y [contrato de transcripción](https://console.groq.com/docs/speech-to-text).

La documentación para usuarios incluye diagramas de vinculación, procesamiento de entradas y configuración de voz. Los límites de Spartan se documentan desde el código; modelos, cuotas y precios externos se consultan en las fuentes oficiales.
# Consulta de permisos

`/permissions` permite consultar las capacidades actuales del remitente con el mismo inventario que `/tools`. Es una consulta; no cambia permisos ni concede acceso. El menú nativo mantiene sus comandos principales.

