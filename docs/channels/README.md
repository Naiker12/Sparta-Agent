# Canales

Trabajo aislado en la rama `canales`, creada desde `main`. Integra los cambios de memoria e idiomas que ya se fusionaron en `main`. No añade dependencias de producción.

## Interfaz real

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

El frontend consume únicamente `/api/channels`. El transporte no recibe un JWT administrativo ni llama endpoints de la aplicación. Las credenciales reutilizan el almacén cifrado existente, con tipo `channel_bot_token` y alcance por conexión. Los módulos IPC existentes llamados `channels` pertenecen a otra función y permanecen intactos.

## Disponible en esta entrega

- Verificación del bot por `getMe`; detección de webhook existente y bot duplicado.
- Token cifrado, excluido de respuestas y validaciones. Redacción de la URL del bot en logs HTTP.
- Una conexión se guarda pausada y puede conectarse, pausarse o eliminarse desde Spartan.
- Recepción por long polling mientras el backend está abierto; cierre de clientes y cancelación al salir.
- Solo conversaciones privadas, con IDs numéricos autorizados. Grupos, bots y remitentes no autorizados no acceden al proveedor ni al inventario.
- Comandos `/help`, `/status`, `/provider`, `/tools`, `/skills`, `/mcp`, `/reset`, registrados en el menú de Telegram. El inventario omite secretos, cabeceras MCP, rutas e instrucciones de skills.
- Respuestas de texto mediante un proveedor API y modelo configurados, sin herramientas, archivos locales ni memoria de escritorio. El contexto reciente está aislado por bot y usuario: hasta seis intercambios completados, 24000 caracteres de contexto y siete días. Solo se guardan respuestas confirmadas por Telegram; /reset borra el contexto de ese usuario.
- Límite de 30 consultas al proveedor por hora y conexión, 90 segundos por solicitud, 1500 tokens de salida y 12000 caracteres de respuesta. Los intentos fallidos cuentan.
- Cursor y mensajes aceptados guardados en una transacción antes de avanzar el offset. IDs repetidos no duplican ejecución.
- Las operaciones interrumpidas o cuyo envío resulte ambiguo se marcan fallidas y no se reejecutan automáticamente. No se garantiza entrega exactamente una vez.
- Actividad limitada a códigos y fechas; nunca muestra contenido del mensaje o token. El registro interno de recepción sí conserva texto autorizado localmente hasta siete días cuando continúa la recepción. La eliminación de la conexión borra sus registros y credenciales.

## Siguientes etapas

1. Validar un bot real con el usuario: usuarios autorizados y denegados, comandos, modelo, reconexión, pausa y cierre.
2. Facilitar vinculación mediante solicitudes con códigos de un solo uso y aprobación en Spartan. Actualmente se requieren IDs conocidos.
3. Contexto reciente implementado por bot y remitente; validar continuidad y /reset con un bot real. Los chats de escritorio, proyectos y memoria del grafo permanecen separados.
4. Audios: límites de tamaño/duración, transcripción con proveedor configurado y eliminación de temporales. Documentos: descarga limitada, detección real de formato, extracción reutilizando ingestión y prevención de rutas externas. En esta entrega se informa que no están habilitados y no se descargan.
5. Ejecución web, skills y MCP mediante un contrato común con políticas por conexión, confirmaciones persistentes, caducidad y cancelación. Consultar inventario no autoriza ejecución. No sustituir el modo de confirmación por acceso completo.
6. Discord: adaptador separado, permisos mínimos, restricciones por usuario/servidor/canal, comandos nativos y límites de la plataforma. WhatsApp y Slack después.

## Validación

`desktop/backend-spartan/.venv/Scripts/python.exe -m pytest --noconftest tests/test_channels.py -q` desde el backend: 27 pruebas de Canales, almacenamiento temporal, transporte simulado, ninguna credencial real ni mensaje externo.

Se usa `--noconftest` porque la configuración general de pruebas de `main` importa `core.inference.diffusion_prequant`, ausente en este checkout. La suite de Canales define su propio aislamiento y no modifica esa configuración general.

Frontend: `npm run typecheck`, `npm run i18n:check`, lint dirigido al módulo y `npm run build`. La compilación mantiene advertencias previas de tamaño de paquetes e imports dinámicos.

Se revisó visualmente el formulario, sus tres pasos, el selector de modelos y la selección de canales próximos con datos ficticios. Esa vista temporal se retiró: la entrega está integrada en la aplicación real. La prueba completa con Telegram externo todavía requiere un bot del usuario.

## Fuentes primarias

- [Telegram Bot API](https://core.telegram.org/bots/api): recepción, offsets, comandos y límites del transporte.
- [OpenClaw: Telegram](https://docs.openclaw.ai/channels/telegram/transports): separar recepción durable del procesamiento.
- [OpenClaw: control de acceso](https://docs.openclaw.ai/channels/telegram/access-control): identidad y restricciones de remitentes.
- [Claude Code: referencia de Channels](https://code.claude.com/docs/en/channels-reference): recepción y ejecución requieren límites separados; notificar no equivale a procesar.
- [Discord Gateway](https://docs.discord.com/developers/events/gateway): protocolo y permisos para la siguiente integración.

Las APIs de esas aplicaciones son referencias arquitectónicas; Spartan no utiliza sus credenciales, clientes ni sesiones.

La guía muestra el enlace oficial de BotFather antes de abrir el asistente. Los indicadores SVG cubren carga, actualización, verificación y cambios de conexión. La consulta tiene un límite de 15 segundos, evita consultas simultáneas y ofrece reintento sin dejar un esqueleto permanente cuando falla. Los textos nuevos están disponibles en español e inglés. El último ajuste visual requiere revisión en la aplicación abierta.

La rama `canales` incorpora `main` después de fusionar memoria y traducciones. El contexto local de Telegram no se expone en el inventario ni en la actividad. /reset borra el contexto para futuras respuestas; el registro durable de recepción mantiene su política de retención independiente. La caducidad del contexto se aplica al leer o guardar intercambios.
