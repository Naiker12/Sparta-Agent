# Reorganización de Canales, Telegram y permisos de Spartan

Fecha: 7 de octubre de 2026.
Estado: fase 1, vinculación personal básica de fase 2 y contexto acotado de fase 3 implementados localmente. Continuidad independiente por proyecto, herramientas y políticas avanzadas siguen pendientes.

### Avance de contexto de proyectos — 7 de octubre de 2026

- Telegram incorpora instrucciones guardadas del proyecto seleccionado y hasta cuatro fragmentos relevantes de sus documentos indexados. Usa búsqueda léxica del índice existente, sin descargar modelos ni abrir carpetas. No consulta documentos de otros proyectos, conversaciones o bases de conocimiento generales.
- La cuenta personal vinculada tiene consulta activada por defecto. Invitados y autorizaciones antiguas sin propietario conservan visibilidad de proyectos sin lectura; el escritorio puede activar explícitamente «Consultar instrucciones y documentos indexados». El permiso se aplica solo a los proyectos concedidos a esa persona. También puede desactivarse para el propietario.
- El panel explica que las instrucciones y fragmentos se envían al proveedor configurado. La aprobación de vinculación personal describe este comportamiento. Los extractos son evidencia no confiable; su contenido no puede otorgar permisos ni ejecutar comandos. El modelo recibe nombres de archivo, sin rutas locales, y la indicación de citar archivo/página cuando usa un fragmento.
- Presupuesto: 6.000 caracteres de instrucciones y cuatro fragmentos de hasta 2.500 caracteres cada uno. Si el índice falla o no encuentra coincidencias, el modelo recibe ese estado y conserva las instrucciones disponibles; no debe afirmar que leyó todo el proyecto.
- Una selección de proyecto desactiva herramientas de búsqueda web pública. `/search`, `/read` y `/images` indican usar `/project off` antes de repetir la operación. Esto evita que herramientas públicas reciban contenido privado del proyecto o historial con extractos.
- Cambiar concesiones borra el historial de esa persona y detiene el worker de la conexión. Cambiar selección también borra el historial; si se archiva/elimina el proyecto, la siguiente consulta invalida el contexto antiguo. Se comprueba acceso antes de iniciar la generación, después de generarla y antes de entregar la respuesta. Un cambio detectado descarta la respuesta y pide repetir la consulta.
- No se conservan conversaciones independientes al volver a otro proyecto: esta entrega mantiene el reinicio anterior para evitar mezclas. Lectura de archivos no indexados, escritura, terminal, ejecución de skills/MCP y políticas de revisión siguen pendientes.
- Validación: 202 pruebas backend en la suite de canales, incluyendo ocho pruebas iniciales de contexto, más comprobaciones posteriores de API y bloqueo de búsquedas. Typecheck, lint, paridad de traducciones y compilación. Navegador con API simulada verifica permiso de propietario, activación/desactivación para invitado y revocación. Sin cambios en bots reales.

### Avance de vinculación personal — 7 de octubre de 2026

- «Esta es mi cuenta» guarda en una transacción autorización del remitente, `owner_user_id`, vínculo de perfil y modo dinámico de proyectos `all`. No hace falta guardar el perfil ni marcar proyectos por separado.
- Los proyectos activos del escritorio local aparecen automáticamente, incluidos los creados después. La entrega posterior descrita arriba añade instrucciones y extractos indexados, sin acceso arbitrario a archivos.
- «Añadir otra persona» usa aprobación explícita de invitado. El backend impide convertir a un invitado en propietario por el modo de proyectos o reasignarle el perfil personal cuando ya existe propietario.
- Las APIs antiguas sin propósito conservan comportamiento de invitado. Ninguna autorización existente se convierte silenciosamente en propietaria ni se amplía automáticamente.
- Un propietario ya confirmado no puede ser sustituido por otro remitente en una aprobación. Primero se debe revocar la cuenta anterior y vincular la nueva.
- Configuración permite alternar entre todos los proyectos y seleccionados, y revocar cuentas. Revocación quita permisos, perfil y selección; invalida controles temporales, cancela la recepción pendiente del usuario y detiene el worker de la conexión. Si no quedan usuarios, la conexión queda pausada. No deshace envíos o acciones ya completados.
- El perfil vinculado automáticamente muestra un resumen y una frase de ejemplo, en lugar de exigir otro selector y guardado.
- Validación: 176 pruebas backend de canales, vinculación, perfil, proyectos, voz y controles; tipos, lint, paridad de traducciones y compilación de producción. Recorrido de navegador con API simulada de propietario, invitado, políticas y revocación; capturas en `output/channels/personal-pairing-*`.

Alcance del almacenamiento actual: los proyectos y el perfil son recursos de esta instalación local; no existe aquí un modelo de propietarios de proyectos por inquilino. Esta entrega no promete aislamiento de proyectos entre distintas cuentas de una instalación multiusuario. Identidades normalizadas por persona, políticas generales de herramientas, exclusiones de proyectos, control de revisiones para conflictos y continuidad por proyecto del diseño completo siguen pendientes.

Para adoptar el flujo en una conexión antigua, abrir **Configuración → Canales y permisos → Vincular mi Telegram** y confirmar la cuenta una vez. Se mantienen los permisos previos hasta esa aprobación. La implementación se validó con almacenamiento de prueba; no se migró ni vinculó el bot real del usuario desde esta conversación.

### Avance de implementación — 7 de octubre de 2026

- Nueva pestaña **Configuración → Canales y permisos**, registrada en navegación, búsqueda, carga diferida y traducciones español/inglés.
- Perfil, proyectos, voz y catálogo de capacidades centralizados en esa pestaña; proveedor de transcripción permanece en Voz.
- Canales conserva Conexiones y Actividad; tarjetas compactas con resumen de acceso, estado del perfil, Configurar y Pausar. Eliminación se administra en ajustes.
- Configurar abre la conexión concreta, conserva el destino durante carga diferida y descarta el destino al cerrar o cambiar de pestaña.
- Selector para varias conexiones; componentes de permisos se reinician al cambiar bot para no mezclar borradores o proyectos.
- Los cambios desde ajustes notifican a la página Canales para actualizar su resumen; se conservan sondeo y autenticación existentes.
- Mensajes y ayuda de Telegram apuntan a la nueva navegación. Contadores de actividad separan etiqueta y cifra.
- No se ha cambiado la política de autorización ni migrado permisos. Vinculación única, propietario/invitados, proyectos dinámicos y contexto real siguen en fases posteriores.

Validación realizada: compilación de producción, comprobación de tipos, paridad de traducciones, lint de archivos modificados, 7 pruebas frontend de navegación/actividad y 34 pruebas backend de perfil/proyectos. Prueba de navegador con API simulada: selección de conexión, aislamiento de vistas de proyectos, búsqueda, móvil, estado vacío y fallo de carga. Capturas y script reproducible en `output/channels/settings-reorganization-*`.

La suite existente `settings-tab-panel-loading.test.ts` presenta dos fallos por supuestos anteriores: exige imports de paneles retirados de la navegación y `Object.values(TAB_LOADERS)` donde el árbol actual precarga solo `TABS`. Sus comprobaciones de ausencia de imports estáticos y límite de errores sí pasan. No se cambiaron esos supuestos ni se reintrodujeron paneles retirados para hacer pasar la suite.

Las secciones siguientes documentan el diagnóstico original y la propuesta completa; las descripciones del estado anterior se conservan como contexto de diseño.

## 1. Objetivo y decisión principal

Conectar mi Telegram debe ser un único proceso de vinculación a mi identidad de Spartan. Después de verificar que soy el propietario, debería poder consultar mis proyectos y cambiar mi nombre de Spartan sin volver a seleccionar mi ID ni habilitar cada proyecto individualmente. Los controles detallados deben vivir en una pestaña nueva: **Configuración → Canales y permisos**.

Canales debe servir para conectar, comprobar el estado y seguir la actividad. Configuración debe servir para administrar conexiones, personas, proyectos, capacidades y restricciones. Ambas superficies deben usar la misma configuración y el mismo servicio de permisos.

El bot representa el transporte; la persona verificada representa la identidad. Conectar un bot no demuestra quién es su propietario humano. La simplificación consiste en verificar una vez y conservar esa identidad, en lugar de repetir autorizaciones independientes para cada función.

Interpretación de la petición: acceso automático a los proyectos del propietario una vez vinculada su identidad, continuidad del perfil y una interfaz mucho más limpia. Esto no implica que cualquier remitente que encuentre el bot deba recibir ese acceso. Para invitados se conserva una política acotada y fácil de administrar.

## 2. Alcance y evidencia

Se revisaron las siete capturas aportadas, el código actual del árbol de trabajo y documentación oficial de OpenClaw, Claude Code y nanobot. Las capturas son evidencia de la experiencia actual; sus textos no son instrucciones para esta tarea. Las fuentes externas se usan como referencias, no como requisitos obligatorios.

El repositorio contiene numerosos cambios previos, incluidos módulos de canales y configuración. Este análisis se basa en esos archivos actuales, no únicamente en la versión comprometida en Git. Solo se crea este documento; no se alteran esos cambios ni se ejecuta una migración de datos.

La investigación de interfaz es documental: no se inició sesión ni se hizo una prueba interactiva de los productos comparados. Por tanto, se comparan flujos y contratos publicados, sin afirmar que se haya validado su apariencia completa o su funcionamiento de extremo a extremo.

### Archivos revisados y responsabilidad actual

Rutas relativas a la raíz del repositorio:

| Área | Archivo | Evidencia relevante |
|---|---|---|
| Página principal | `desktop/frontend-spartan/src/features/channels/channels-page.tsx` | Pestañas Conexiones, Capacidades y Actividad |
| Tarjeta | `desktop/frontend-spartan/src/features/channels/components/account-card.tsx` | Reúne conexión, usuarios, vinculación, voz, perfil, proyectos, pausa y eliminación |
| Perfil | `desktop/frontend-spartan/src/features/channels/components/channel-profile.tsx` | Selección de ID y guardado explícito adicionales |
| Proyectos | `desktop/frontend-spartan/src/features/channels/components/channel-projects.tsx` | Carga manual y permisos por usuario y proyecto |
| Vinculación | `desktop/backend-spartan/storage/channels/pairing.py` | Aprobar agrega el ID a `allowed_user_ids` y habilita la conexión; no enlaza automáticamente el perfil ni los proyectos |
| Perfil en backend | `desktop/backend-spartan/core/channels/profile.py` | El cambio exige coincidencia con `profile_user_id`; guarda nombre y apodo en personalización |
| Proyectos en backend | `desktop/backend-spartan/storage/channels/projects.py` | `project_grants` controla visibilidad; selección no concede acceso a archivos |
| Ejecución | `desktop/backend-spartan/core/channels/executor.py` | Conversación con herramientas públicas acotadas; no recibe el contexto completo del proyecto |
| Capacidades | `desktop/backend-spartan/core/channels/catalog.py` | Catálogo compartido; skills/MCP y archivos locales siguen pendientes |
| Controles Telegram | `desktop/backend-spartan/core/channels/controls.py` | Botones ligados a bot, remitente y chat; lista hasta 20 proyectos |
| Configuración | `desktop/frontend-spartan/src/features/settings/settings-dialog.tsx` y `stores/settings-dialog-store.ts` | Registro de pestañas, carga diferida y persistencia de pestaña activa |
| Actividad | `desktop/frontend-spartan/src/features/channels/components/channel-activity.tsx` | Consumo, contadores, filtros y paginación de eventos |

Las rutas de configuración indicadas en la última fila de ajustes pertenecen a `desktop/frontend-spartan/src/features/settings/`.

## 3. Diagnóstico

### 3.1. La identidad se fragmenta en tres configuraciones

Hoy se puede estar autorizado para hablar, pero no estar vinculado al perfil y no tener proyectos disponibles. La aprobación de vinculación no completa esas otras relaciones. Esto explica que una persona tenga que volver al escritorio después de haber conectado Telegram correctamente.

El flujo del propietario debería resolver esas relaciones mediante una identidad persistente y una política común. Ocultar los controles actuales en otro acordeón no elimina la fragmentación.

### 3.2. La tarjeta mezcla demasiadas tareas

En las capturas, una tarjeta de conexión llega a contener información de transporte, proveedor, IDs, vinculación, transcripción, perfil, permisos de proyectos y acciones de ciclo de vida. La altura obliga a desplazarse incluso con un solo bot.

El desplegable «Configurar voz y proyectos» también contiene perfil, algo que su título no anticipa. Los IDs numéricos dominan una tarea que debería hablar de personas. El estado «Conectada» comunica salud del transporte, pero no explica si el usuario puede usar perfil, voz o proyectos.

### 3.3. Hay una limitación funcional además del problema visual

Actualmente, seleccionar un proyecto vincula la actividad y reinicia el contexto de conversación al cambiar de proyecto. No incorpora automáticamente sus instrucciones o archivos. El ejecutor de canales tampoco ofrece ejecución general de skills o MCP.

Por eso, «tener acceso al proyecto» debe descomponerse internamente en descubrirlo, seleccionarlo, incorporar contexto y ejecutar acciones. La interfaz puede presentar una experiencia sencilla, pero debe describir lo que realmente funciona.

### 3.4. El perfil actual es compartido

El backend escribe en la personalización global de Spartan. Dar esa capacidad a todos los usuarios autorizados permitiría modificar el mismo perfil compartido. La eliminación del paso adicional de vinculación requiere distinguir al propietario de los invitados; no basta con comprobar presencia en `allowed_user_ids`.

### 3.5. Actividad necesita explicar resultados

«Evento registrado» aporta poco para entender qué pasó. Varias entradas de inicio y respuesta seguidas exigen reconstruir manualmente una consulta. Los contadores visibles también necesitan espacio entre etiqueta y número. La ventana de últimos 50 eventos no debe confundirse con un historial completo ni con las métricas de 24 horas.

## 4. Referencias de otros asistentes

### OpenClaw

Su documentación ubica solicitudes de acceso en Settings → Channels. La aprobación de DM no equivale a acceso de grupo y distingue el propietario de comandos. Su documentación de ajustes describe búsqueda, navegación de retorno y conservación de borradores cuando falla un guardado. Son referencias útiles para una administración central y estados persistentes. [Pairing](https://docs.openclaw.ai/channels/pairing), [Settings](https://docs.openclaw.ai/web/control-ui/settings).

Aplicación a Spartan: una bandeja de solicitudes y personas en Configuración, un rol explícito para mi cuenta y cambios guardados con estados claros. No copiar todas sus opciones avanzadas al primer nivel. La documentación de Telegram también diferencia credenciales, acceso y configuración por cuenta. [Telegram](https://docs.openclaw.ai/channels/telegram).

### Claude Code

Remote Control presenta otros dispositivos como entradas a una sesión que continúa ejecutándose localmente, con entorno y configuración del proyecto disponibles. Esa continuidad es una referencia para evitar que Telegram sea un asistente aislado. [Remote Control](https://code.claude.com/docs/en/remote-control).

Sus permisos se aplican desde el programa, con reglas de permitir, preguntar y denegar; las instrucciones del modelo no conceden permisos. Para Spartan, las preferencias persistentes deben evitar pasos repetidos y el backend debe resolver cada acción. Esta comparación describe Remote Control y permisos de Claude Code; no presupone una integración oficial equivalente con Telegram. [Permissions](https://code.claude.com/docs/en/permissions).

### nanobot

Publica un flujo de código de vinculación y aprobación, con revocación por usuario y canal, que evita editar configuración para cada alta. Es una referencia para gestionar identidades y acceso desde un flujo guiado. No demuestra por sí mismo que una aprobación incluya perfil o todos los proyectos. [Configuración y pairing](https://github.com/HKUDS/nanobot/blob/main/docs/configuration.md).

### Síntesis propia

La propuesta para Spartan combina administración central, identidad verificada una vez y continuidad del trabajo. Es una decisión de diseño derivada del problema observado, no una afirmación de que los tres productos compartan el mismo sistema de permisos. No se comparó un producto concreto llamado «Mose», porque la mención no permite identificarlo con certeza.

## 5. Nueva organización de interfaz

### 5.1. Página Canales

Mantener dos vistas principales: **Conexiones** y **Actividad**. Mover el catálogo detallado y los controles de capacidades a Configuración. Mostrar una ayuda breve accesible para saber qué se puede hacer, sin otra pantalla llena de inventario técnico.

Tarjeta propuesta:

```text
Telegram · @mi_bot                           Conectado
Mi Telegram vinculado · Propietario
Modelo: proveedor / modelo
Proyectos: todos mis proyectos activos

[Abrir Telegram] [Configurar] [Pausar] [⋯]
```

«Configurar» abre la nueva pestaña con esa conexión seleccionada. «Eliminar conexión» vive en el menú secundario y conserva confirmación. Si falta identidad, sustituir el resumen por «Vincula tu Telegram para empezar». Si ya está vinculado, no mantener «Vincular mi Telegram» como acción principal; ofrecer «Cambiar cuenta» en ajustes.

Los futuros Discord, WhatsApp y Slack pueden agruparse en «Más canales» o una sección secundaria de próximos canales. No ocupar la navegación principal con opciones inutilizables. Mantener la identidad visual existente y mejorar densidad y jerarquía.

### 5.2. Configuración → Canales y permisos

Nueva pestaña independiente de las conexiones generales que ya existen, para no mezclar acceso remoto o integraciones de otro tipo.

| Sección | Contenido |
|---|---|
| Conexiones | Bot, estado, proveedor, modelo, idioma, reemplazo de credenciales |
| Mi cuenta | Persona propietaria vinculada, nombre mostrado, cuenta de Telegram y desvinculación |
| Personas y acceso | Propietario, invitados, solicitudes, suspensión y revocación |
| Proyectos | Todos los activos, seleccionados o ninguno; excepciones y proyecto predeterminado |
| Capacidades | Conversación, web, documentos, voz, perfil y capacidades futuras |
| Avanzado | Límites, conservación de datos y diagnóstico del transporte |

Usar un selector de conexión cuando haya varias; con una sola, abrir directamente sus ajustes. Secciones con filas compactas, textos breves y detalles bajo demanda. Evitar una matriz gigante de interruptores.

El proveedor de transcripción, la clave y la prueba de audio siguen administrándose en Configuración → Voz. Aquí solo aparece «Recibir notas de voz», disponibilidad y un enlace a esos ajustes. No duplicar credenciales ni consentimientos.

Incluir búsquedas como Telegram, bot, permisos, proyectos, vincular y voz. Los enlaces desde Canales deben seleccionar conexión y sección, conservar el destino durante la carga y devolver el foco al cerrar.

## 6. Modelo de acceso propuesto

### 6.1. Conceptos

Separar conexión del bot, identidad de Spartan, identidad externa de Telegram y política efectiva. Vincular Telegram significa relacionar `(plataforma, bot, user_id)` con una persona y un rol. Los permisos dejan de depender de IDs dispersos en componentes.

| Capacidad | Propietario verificado | Invitado aprobado |
|---|---|---|
| Conversación y web disponible | Automático | Según política asignada al aprobar |
| Proyectos visibles | Todos sus proyectos activos por defecto | Solo seleccionados |
| Nuevos proyectos | Incluidos en modo «Todos» | Excluidos en modo «Seleccionados» |
| Nombre del perfil Spartan | Puede cambiar su propio perfil | No modifica el perfil global del propietario |
| Notas de voz | Disponible si se habilita recepción y hay transcripción preparada | Según política y disponibilidad |
| Contexto del proyecto | Disponible cuando se implemente el proveedor de contexto | Solo en proyectos concedidos |
| Herramientas y MCP | Política de ejecución compartida cuando se integre | Restringidos por capacidades y recursos |
| Credenciales y administración de acceso | Administración en el escritorio | No concedida por vinculación |

«Todos» debe calcularse dinámicamente con proyectos activos del propietario; no guardar una copia de todos los IDs que quede obsoleta. «Seleccionados» conserva una lista explícita. Permitir exclusiones en el modo «Todos» para proyectos concretos. Los proyectos archivados no aparecen ni aceptan selección.

### 6.2. Flujo único para mi Telegram

1. Añadir bot y seleccionar proveedor/modelo, o heredar un valor predeterminado ya válido.
2. Elegir «Vincular mi Telegram». Crear enlace o QR de uso único y caducidad.
3. Abrirlo en Telegram; mostrar identidad capturada y código de verificación.
4. En Spartan, confirmar «Esta es mi cuenta» con un resumen: perfil propio y todos mis proyectos activos.
5. Guardar en una transacción identidad, rol y política. No exigir guardados posteriores de perfil y proyectos.
6. Mostrar «Listo» y enviar una guía breve con selección de proyectos y cambio de nombre.

Esta confirmación es parte de la propuesta de producto para vincular una identidad, no una solicitud de aprobación para crear este documento. Conservar expiración, validación del remitente y rechazo de enlaces reutilizados que ya existen.

Para invitar a otra persona, usar una acción distinta: «Añadir persona». Elegir un conjunto de capacidades y proyectos en la misma aprobación. No inferir propiedad por ser el primer remitente ni por existir un único ID autorizado.

### 6.3. Permisos persistentes y acciones

Las capacidades habituales deben quedar guardadas. Consultar proyectos o cambiar el nombre propio no requiere volver al escritorio. Conectar Telegram tampoco añade herramientas todavía inexistentes.

Las futuras acciones de archivos, comandos y servicios externos deben reutilizar la política de ejecución de Spartan. Las confirmaciones que esa política requiera se podrán resolver en Telegram con botones emitidos por el backend, asociados a persona, acción, recurso, versión y caducidad. Una frase del modelo o un documento adjunto no constituye autorización.

La revocación invalida selecciones y controles pendientes, evita nuevas ejecuciones y vuelve a comprobar acceso antes de entregar resultados privados. Para acciones en curso se debe definir cancelación y resolución por etapa; no prometer que una escritura ya realizada pueda revertirse automáticamente.

## 7. Proyectos con utilidad real

Separar dos entregas:

**Entrega inicial:** proyectos visibles automáticamente para el propietario, selección con botones y búsqueda/paginación; estado «Actividad vinculada». No afirmar que ya se están leyendo archivos.

**Entrega de contexto:** incorporar instrucciones aplicables, referencias y contenido permitido mediante el servicio de contexto de proyectos. Aplicar presupuesto de tokens, selección de documentos y las mismas reglas de acceso que el escritorio. No enviar todos los archivos al modelo por el simple hecho de tener permiso de visibilidad.

El objetivo posterior es abrir o continuar una conversación del proyecto desde Telegram usando un runtime compartido. No basta con llamar directamente al ejecutor de escritorio: primero hay que resolver identidad, aislamiento, recursos, política y entrega remota.

Ejemplo esperado al completar ambas entregas:

```text
Persona: Quiero trabajar en MediaDock.
Spartan: Proyecto MediaDock seleccionado. Tengo disponible su contexto.
Persona: Me quiero llamar Naiker.
Spartan: Guardé Naiker como tu nombre en Spartan.
```

El segundo mensaje solo se emite tras confirmar la escritura. El nombre de Telegram no cambia. El primer mensaje debe decir «Actividad vinculada» mientras el contexto no esté implementado.

Hoy cambiar proyecto borra el contexto reciente. Evolucionar a conversaciones separadas por persona y proyecto, para volver a un proyecto sin perder continuidad ni mezclar su contenido con otro. Mantener aislamiento entre bots cuando la política no permita compartir sesiones.

## 8. Contratos técnicos propuestos

### 8.1. Identidad y política

Esquema conceptual nuevo, sujeto a adaptación al almacenamiento existente:

```json
{
  "schema_version": 2,
  "revision": 7,
  "account_id": "connection-id",
  "principal_id": "spartan-person-id",
  "external_identity": {"platform": "telegram", "user_id": "numeric-id"},
  "role": "owner",
  "projects": {"mode": "all_owned_active", "ids": [], "excluded_ids": []},
  "capabilities": {"profile_self_update": true, "voice_input": true},
  "execution_policy_ref": "existing-spartan-policy"
}
```

`voice_input=true` expresa permiso, no transcripción lista. El backend debe distinguir permitido, desactivado, pendiente de configuración y todavía no implementado. El rol propietario no representa permiso automático para cualquier acción del sistema.

Crear un resolvedor central: identidad → política → recurso → capacidad efectiva. Consumirlo desde perfil, proyectos, recepción de voz, catálogo, ejecución y entrega. Denegaciones y restricciones del recurso prevalecen sobre valores predeterminados.

### 8.2. API y guardado

Extender la aprobación de vinculación con propósito `self` o `guest`, rol y política validados por la sesión administrativa. Proponer lectura/edición de política y revocación de identidad bajo `/api/channels/{account_id}/...`, respetando propiedad y autenticación actuales.

Un guardado de política debe ser transaccional y aceptar una revisión esperada. Si otro cliente cambió los datos, devolver conflicto y conservar el borrador. Si se desconoce el resultado del guardado, recargar estado antes de declarar éxito o repetir operaciones. No basar la aprobación únicamente en parámetros enviados por Telegram.

La interfaz recibe nombre mostrado, rol y resumen de permisos efectivos; el ID técnico queda en detalle. No exponer tokens del bot, cabeceras MCP, rutas privadas o claves dentro de resúmenes.

### 8.3. Archivos a modificar al implementar

| Grupo | Cambios |
|---|---|
| Canales frontend | Simplificar `account-card.tsx`, reorganizar `channels-page.tsx`, adaptar vinculación, proyectos y actividad |
| Configuración frontend | Registrar `channels-permissions` en store, cargadores, navegación, referencias de foco, búsqueda y traducciones; crear pestaña y secciones |
| API/tipos frontend | Identidades, roles, revisión, políticas y capacidades efectivas; enlaces dirigidos a conexión/sección |
| Almacenamiento backend | Migración versionada, identidades externas, políticas y revocación; conservar datos anteriores |
| Pairing/backend | Propósito explícito y aprobación transaccional de vínculo y política |
| Perfil y proyectos | Consumir resolvedor; distinguir perfil propio de perfil global y modo «Todos» de listas explícitas |
| Runtime/catálogo | Construir capacidades por persona y recurso; respuestas sin instrucciones antiguas de navegación |
| Contexto/ejecución | Integración posterior con servicios compartidos de proyectos y política de herramientas |
| Documentación/demo | Actualizar instrucciones y demo de landing después de validar comportamiento real |

## 9. Migración de instalaciones existentes

1. Respaldar la configuración y agregar versión de esquema sin destruir el formato previo.
2. Cuando exista `profile_user_id` válido, presentar esa cuenta como candidata a «Mi Telegram». El campo demuestra vínculo al perfil, pero no demuestra consentimiento para ampliar permisos a todos los proyectos.
3. Conservar proyectos actualmente concedidos como modo «Seleccionados». Ofrecer una única actualización guiada a «Todos mis proyectos» con resumen del cambio.
4. Los otros IDs autorizados pasan a personas aprobadas con sus capacidades existentes; no convertirlos automáticamente en propietarios.
5. Si no existe vínculo de perfil, pedir identificar mi cuenta una sola vez desde el nuevo flujo, sin exigir volver a conectar el bot.
6. Si hay inconsistencias, ofrecer reparación concreta por identidad; conservar proveedor, token cifrado, historial permitido y estado de conexión.
7. Mantener temporalmente compatibilidad con rutas antiguas y cambiar los mensajes «Canales → Telegram → Perfil» a la nueva navegación.

No elegir propietario por posición de una lista ni ampliar permisos silenciosamente durante la migración. Las conexiones nuevas sí reciben los valores de propietario mostrados al completar «Vincular mi Telegram».

## 10. Actividad, consumo y mensajes

- Agrupar por consulta: recibida → procesando → enviada, fallida o cancelada. Abrir eventos técnicos desde detalles.
- Mostrar causa accionable: credencial inválida, conflicto de otro consumidor, límite, red o transcripción no preparada.
- Mostrar «Respuestas 21», con espacio y alcance claro. Métricas de 24 horas y ventana de 50 eventos se rotulan por separado.
- Mantener «Tokens reportados» y «Datos parciales» cuando corresponda; no inventar coste, saldo ni datos ausentes.
- Ofrecer «Ver trabajo en Spartan» dirigido a la operación o proyecto, cuando exista una asociación válida.
- Añadir eventos de identidad, revocación, política y cambio de nombre sin registrar secretos ni texto privado en el feed.
- Usar fechas y números localizados; filtrar por conexión y persona solo cuando el administrador tenga acceso.
- La ayuda Telegram debe derivarse de capacidades efectivas de esa persona. No listar skills/MCP como utilizables por estar instalados.

## 11. Plan de implementación

### Fase 1 — Limpiar y centralizar la experiencia

Crear la pestaña, mover controles existentes, añadir enlaces dirigidos, simplificar tarjetas y mejorar nombres/estados. Reutilizar servicios de voz. Conservar las restricciones actuales hasta integrar el nuevo modelo.

Criterio de salida: todas las configuraciones actuales tienen un destino único y localizable; las tarjetas ya no incluyen formularios de perfil, voz o proyectos.

### Fase 2 — Vinculación única y permisos persistentes

Introducir identidad/rol, resolvedor, aprobación conjunta, políticas de proyectos dinámicas y migración. Propietario nuevo obtiene acceso a sus proyectos activos y perfil propio desde una sola vinculación.

Criterio de salida: vincular, seleccionar proyecto y cambiar nombre funciona sin autorizaciones manuales adicionales; invitados no pueden modificar el perfil del propietario.

### Fase 3 — Contexto y continuidad de proyectos

Integrar contexto permitido, conversaciones por proyecto y acceso paginado desde Telegram. Mostrar disponibilidad real y evitar contaminación entre proyectos.

Criterio de salida: una consulta responde usando contexto comprobable del proyecto elegido; cambiar de proyecto y regresar conserva sesiones aisladas.

### Fase 4 — Herramientas y canales adicionales

Integrar acciones con la política compartida, controles de aprobación remota y revocación en curso. Después incorporar otros transportes mediante adaptadores que reutilicen identidad y políticas.

Criterio de salida: cada herramienta comprueba permiso y recurso en backend y produce un resultado verificable; añadir un canal no duplica el sistema de autorización.

No se asignan fechas ni estimaciones cerradas sin revisar los contratos del runtime compartido. Fases 1 y 2 resuelven la fricción principal; fases 3 y 4 amplían las capacidades reales.

## 12. Validación exigida para la implementación

| Caso | Resultado esperado |
|---|---|
| Vincular mi cuenta nueva | Una aprobación crea identidad, rol y política completos |
| Guardado falla | No queda identidad parcialmente autorizada; borrador recuperable |
| Reutilizar enlace o cuenta diferente | No obtiene vínculo ni permisos |
| Propietario pide cambiar nombre | Se guarda y se confirma sin regresar al escritorio |
| Invitado pide cambiar perfil global | Se deniega sin escribir personalización |
| Crear un proyecto en modo Todos | Aparece automáticamente si pertenece al propietario |
| Archivar o excluir proyecto | Desaparece y no puede seleccionarse mediante un botón anterior |
| Invitado con proyectos seleccionados | No recibe nombres ni contexto de otros proyectos |
| Revocar usuario durante consulta | Bloquea acciones posteriores y entrega privada según política |
| Proyecto con contexto aún pendiente | Mensaje preciso, sin afirmar acceso a archivos |
| Cambiar y regresar a proyecto | Conversaciones aisladas y continuidad según fase implementada |
| Voz autorizada sin proveedor preparado | Estado claro y enlace a Voz; no muestra «Lista» |
| Guardados simultáneos | Conflicto visible, sin pérdida silenciosa de configuración |
| Reiniciar aplicación | Identidad, permisos y selección siguen correctos |
| Migrar configuración antigua | Conserva concesiones sin ampliar permisos silenciosamente |
| Navegación y teclado | Abre sección correcta, retorna foco y funciona con lector de pantalla |

Al implementar: ejecutar pruebas relevantes de pairing, perfil, proyectos, controles, recepción y política, además de checks de tipos/frontend. Validar visualmente con una y varias conexiones, listas extensas, móvil y temas claro/oscuro. La comprobación final requiere un bot real de prueba y dos identidades; pruebas unitarias no sustituyen ese recorrido.

## 13. Resultado de producto esperado

El propietario entiende «Telegram está vinculado a mi Spartan» y puede actuar dentro de sus capacidades sin una cadena de permisos repetidos. Canales comunica conexión y actividad; Configuración concentra administración. Proyectos y herramientas muestran lo que realmente pueden hacer, y una identidad invitada recibe una política coherente sin controlar el perfil global.

Este documento deja definidos los cambios de interfaz, el modelo de acceso, la migración y los criterios de aceptación. La reorganización de fase 1, vinculación personal básica de fase 2 y contexto acotado de fase 3 están implementados localmente. Continuidad por proyecto, herramientas y políticas avanzadas quedan como trabajo posterior.
# Seguimiento: diseño alineado con la vista API

Se aplicó la jerarquía visual de `api-monitor-page.tsx` a Canales: ancho de página, tipografía del título, márgenes adaptables, resumen del canal con borde discreto y tarjetas sin sombra. Las conexiones se distribuyen en dos columnas en pantallas amplias y una en móvil. La navegación móvil reduce el espacio dedicado a integraciones futuras.

Actividad usa tres indicadores separados para respuestas, errores y conexiones, con cifras localizadas y una lista de eventos limitada en altura. Configuración usa un encabezado compacto como API, personas en filas y capacidades detalladas plegadas inicialmente. Se conservan las acciones de conexión, vinculación, proyectos y revocación.

Validación: typecheck, lint de archivos modificados, siete pruebas de navegación/actividad y compilación. Pruebas de navegador con API simulada verifican vinculación personal, invitados, modos de proyectos, revocación, selección de conexión, estados vacíos/error y vista móvil. Capturas en `output/channels/api-design-*.png`. No se modificaron bots reales durante la comprobación.

El seguimiento de contexto al principio del documento describe la entrega posterior a esta iteración de diseño. Las autorizaciones históricas de invitados conservan su alcance; necesitan un permiso explícito para leer instrucciones y extractos indexados.

