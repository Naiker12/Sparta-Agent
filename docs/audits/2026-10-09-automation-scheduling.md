# Revisión del flujo de automatizaciones — 2026-10-09

## Causa del problema reportado

El usuario confirmó que la automatización figuraba como borrador o pausada cuando pasaba la hora. Crear un borrador y ejecutar una prueba manual no activa el horario. La interfaz terminaba la creación con «Guardar borrador», cerraba el editor y no guiaba a la activación. El proveedor y el modelo elegidos para probar tampoco se restauraban al volver a abrir la tarea.

## Cambios

- El editor permite elegir proveedor y modelo y ofrece «Guardar y activar». Abre la confirmación de permisos existente; la activación requiere confirmar explícitamente. Sigue disponible guardar un borrador.
- El detalle restaura el proveedor y modelo guardados, aclara que probar no activa el horario y permite actualizar el modelo de una tarea activa.
- La actualización del modelo conserva la próxima ejecución pendiente, incluso si ya venció.
- El listado distingue borrador, pausada, activa, ejecutándose y una ejecución única completada. Se actualiza periódicamente mientras la página está visible.
- Los errores de ejecución se guardan en la tarea y se muestran en el detalle. Los errores de configuración del proveedor/modelo tienen mensajes concretos.
- Las tareas antiguas sin consentimiento o modelo dejan de aparentar estar activas indefinidamente. Un horario inválido se pausa con explicación y no bloquea otras tareas pendientes.
- Se corrigió la superposición entre el detalle y el diálogo de activación, detectada al probar los controles reales en el navegador.
- CI incluye las pruebas de automatizaciones y la dependencia de zonas horarias necesaria para esas pruebas.

## Verificación

- 51 pruebas de backend aprobadas: creación, activación, ejecución programada con modelo persistido, reinicio, recuperación de horarios vencidos, ejecución única, aislamiento de horarios inválidos, errores visibles, chats de ejecución, concurrencia y entrega.
- Prueba de navegador aprobada con los componentes reales: creación, cancelación de activación, prueba manual sin activar, activación confirmada, reapertura con modelo guardado y cambio de modelo activo.
- 9 pruebas de seguimiento de ejecuciones y registro de notificaciones aprobadas.
- TypeScript e igualdad de claves de traducción aprobados. ESLint sin errores; mantiene dos avisos sobre refs en un efecto anterior a estos cambios.

Las pruebas usan proveedores y entregas simulados. No se enviaron mensajes externos ni se consumieron modelos reales. La aplicación instalada no se recompiló ni actualizó en esta revisión. El planificador necesita que el backend de Sparta siga ejecutándose; cerrar la aplicación no instala un servicio de ejecución en segundo plano.

## Seguimiento: apertura del chat de investigación

El backend ya creaba un chat independiente por ejecución. El consumidor de notificaciones actualizaba el historial, pero no navegaba al chat ni ofrecía una acción para abrirlo en el aviso. Ahora un evento de inicio reciente abre su chat mientras la aplicación está visible, incluso cuando los avisos están desactivados. Los avisos incluyen «Abrir chat». La respuesta de notificaciones incorpora el proyecto para conservar el contexto de navegación. Los eventos anteriores al montaje o de más de 30 segundos no fuerzan navegación al reconectar.

Verificación adicional: prueba real de navegador con inicio simulado y navegación al chat/proyecto aprobada; 30 pruebas del backend y TypeScript aprobados. No se recompiló la aplicación instalada.
