# Experiencia de interacción de Canales

Estado: primera implementación del personaje lateral conectada al registro de trabajos de Telegram, con nombre de perfil, minimizar y preferencia local activada por defecto. Actualización mediante consultas cada dos segundos; los trabajos que terminen entre consultas pueden no mostrarse. Etapas de transcripción, lectura de documento y preparación de respuesta conectadas al backend; cierre breve de completado, cancelado o fallo. Estados de búsqueda pública y lectura de página conectados al ejecutor; vinculación explícita de usuario propietario y cambio de nombre mediante texto o audio transcrito implementados. Sincronización del nombre en la aplicación abierta mediante consulta cada tres segundos, cuando no hay una edición local pendiente. Validación visual y recorrido real completo pendientes. Entrada de voz de la conexión actual activada. No implica que la transcripción de ElevenLabs esté validada.

## Identidad y perfil

El nombre encima del personaje será el nombre de perfil del usuario, según su elección. El personaje es una representación de actividad de Spartan, no un usuario nuevo.

Una petición explícita como «me quiero llamar Naiker Codes» debe actualizar displayName y nickname, preservando avatar, apariencia e idioma. Primero debe existir una vinculación explícita entre el propietario del perfil y su usuario de Telegram. Estar en allowed_user_ids permite conversar; no concede automáticamente permiso para cambiar el perfil global.

La actualización se ejecutará en un servicio de core/channels/profile.py. El transporte no escribe directamente preferencias. Se validan longitud, caracteres de control y autorización nuevamente antes de guardar. Se registra un evento sin incluir la clave ni el contenido privado. La interfaz aplica la actualización desde el servidor sin sobrescribir cambios locales pendientes.

## Personaje y actividad

Componente de aplicación en features/channels/components/channel-assistant-activity.tsx. Aparece centrado al iniciar una interacción de canal; incluye nombre de perfil encima y estado breve debajo. Puede minimizarse y cerrarse, no captura el teclado ni bloquea otros controles. En pantallas pequeñas usa un panel compacto.

Estados derivados de eventos reales: recibido, transcribiendo, consultando, buscando en internet, actualizando perfil, leyendo documento, cancelado, completado y error. No se anuncian acciones que no estén implementadas o autorizadas. Buscar y enviar archivos del PC sigue pendiente de permisos por carpeta y no se presentará como disponible.

Las transiciones deben respetar movimiento reducido. El personaje usa SVG propio de Spartan y movimientos breves; sin marcas o recursos de Unsloth. La indicación de carga comunica trabajo en curso, sin inventar porcentajes.

## Orden de entrega y comprobación

1. Confirmar transcripción con permisos de ElevenLabs y nota real desde Telegram.
2. Añadir vinculación del usuario propietario y servicio de cambio de nombre.
3. Sincronizar el perfil en la aplicación abierta, evitando escrituras concurrentes perdidas.
4. Conectar el personaje a eventos del trabajo y añadir minimizar, errores y cancelación.
5. Verificar español e inglés, dos usuarios autorizados, revocación durante una operación, varias solicitudes simultáneas y movimiento reducido.

Los cambios permanecen en canales; sin merge, publicación ni despliegue.

## Vincular el perfil

En Canales → Telegram → Conexiones → Perfil de Spartan, selecciona tu ID autorizado y guarda la vinculación. La lista de usuarios autorizados por sí sola no concede este permiso. Seleccionar «Sin permiso para cambiar el perfil» lo revoca. Después puedes escribir «me quiero llamar Naiker Codes» o «call me Jane». Una nota de voz requiere además transcripción funcional.
