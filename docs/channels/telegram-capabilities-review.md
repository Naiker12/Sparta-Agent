# Revisión de capacidades de Telegram

Fecha: 6 de octubre de 2026. Comparación con documentación oficial de OpenClaw; no supone equivalencia de implementación ni pruebas reales de todas sus funciones.

## Hallazgo corregido

El mensaje de sistema de Spartan prohibía todos los cambios de perfil, aunque el canal ya implementaba un cambio explícito de nombre. El modelo recibe ahora información del permiso del remitente y una descripción actualizada. Solo confirma una modificación efectuada por el backend; no promete ejecutar acciones sin herramientas.

## Estado de Spartan

| Capacidad | Estado |
|---|---|
| Texto, contexto, cancelación | Implementados; recorrido real adicional pendiente |
| Notas de voz | Transcripción implementada; ElevenLabs reportó missing_permissions en la prueba real |
| Documentos de texto | Lectura limitada; PDF y Word pendientes |
| Búsqueda web, URL y referencias de imágenes | Implementadas con límites |
| Perfil | Nombre visible y apodo, únicamente para usuario vinculado |
| Proyectos | Selección y permisos; no concede acceso automático a archivos |
| Skills/MCP | Inventario; ejecución desde Telegram pendiente |
| Respuestas de voz | Pendientes |

## Qué aporta la referencia y orden propuesto

OpenClaw documenta botones inline, manejo de adjuntos, políticas por conversación, sesiones y aprobaciones de ejecución. Para Spartan conviene priorizar:

1. Inventario único de capacidades consumido por ayuda, instrucciones del modelo e interfaz para evitar contradicciones.
2. Botones inline para seleccionar proyecto, cancelar y confirmar acciones; callbacks vinculados a usuario, solicitud y caducidad.
3. Documentos PDF/Word y archivos de carpetas autorizadas: límites, rutas reales verificadas y confirmación antes de enviar contenido local.
4. Herramientas y MCP por usuario/proyecto a través del puente existente de permisos, con registro y revocación.
5. Respuestas por voz opcionales; separación de transcripción y síntesis, proveedores y costes.
6. Progreso mediante actualización del mismo mensaje, evitando mensajes repetidos y límites de Telegram.

Fuentes: https://docs.openclaw.ai/channels/telegram ; https://docs.openclaw.ai/tools/exec-approvals-advanced

No se habilitan estas funciones pendientes por cambiar las instrucciones del modelo. Cada una necesita adaptador, autorización y pruebas.

## Actualización de implementación

El catálogo de capacidades es ahora compartido por las instrucciones del modelo, `/help`, `/tools` y el inventario que consume la interfaz. Las respuestas de ayuda distinguen el vínculo de perfil del remitente y la activación de voz de la conexión. El proveedor de voz aún necesita estar preparado; habilitar la conexión no prueba la transcripción.

## Botones de Telegram

- `/projects` ofrece hasta 20 proyectos autorizados como botones y una opción para salir. Al seleccionar se comprueban de nuevo los permisos; cambiar de proyecto reinicia el contexto y sigue sin conceder acceso a archivos.
- Una consulta que dure más de un segundo puede mostrar «Cancelar». El botón queda vinculado a esa consulta concreta y se retira al terminar.
- Los controles caducan a los diez minutos, son de un solo uso y dejan de funcionar al reiniciar el backend. No contienen credenciales ni instrucciones generadas por el modelo.
- El bot responde a las pulsaciones para cerrar el indicador de Telegram. Los controles no disponibles muestran un aviso breve.

Implementación local con pruebas automatizadas; validación real con Telegram pendiente. Referencia: [Bot API: CallbackQuery](https://core.telegram.org/bots/api#callbackquery).

## Nombre de perfil: conversación y permisos

Las consultas «quiero cambiar mi nombre», «quiero cambis mi nombre y dema» y las preguntas sobre esta capacidad reciben una respuesta basada en el vínculo real del remitente, sin llamar al proveedor. Un seguimiento como «sí puedes» solo usa el historial para reconocer el tema, nunca para conceder permisos.

También se aceptan solicitudes explícitas como `cambia mi nombre a Naiker Codes` y `quiero cambiar mi nombre a Naiker Codes`. El backend valida el vínculo y el acceso antes de escribir. Preguntar cómo cambiar el nombre no modifica el perfil. La cuenta de Telegram no se modifica.

## Validación de voz del 6 de octubre

La conexión tiene entrada de voz habilitada y usa ElevenLabs con `scribe_v2`. Dos pruebas reales con la configuración guardada devolvieron `voice_permission_missing`, incluso tras la confirmación del usuario de haber actualizado los permisos. Esto no valida aún la transcripción de voz real en español ni inglés.

Se verificó con pruebas automatizadas que los fallos de conexión, tiempo de espera, modelo y permisos tienen avisos específicos y no impiden procesar la siguiente solicitud. Las transcripciones simuladas en español e inglés conservan su contenido; esta comprobación no sustituye una prueba con notas reales.

Referencias: [Crear transcripción](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [Claves API](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys).

## Correcciones consecutivas del nombre

Después de un cambio guardado, el mismo remitente puede corregirlo durante dos minutos con «O Naiker Gomez» o «Mejor Naiker Codes». Cada escritura vuelve a comprobar el vínculo y los permisos; estos no son de un solo uso. Un cambio de tema, la caducidad o el reinicio del backend desactiva esta interpretación breve. Siempre se puede usar la frase completa «me quiero llamar…».
