# Programación de tareas desde conversaciones

## Flujo implementado

En el chat de Sparta, un modelo con herramientas puede usar `propose_automation` al recibir una solicitud para programar una tarea. La herramienta solo valida y devuelve un plan: no escribe tareas ni activa horarios. La respuesta muestra instrucciones y horario con una acción «Revisar y programar». El editor se abre sobre el mismo chat y permite elegir horario, zona, proyecto, modelo y capacidades antes de guardar y confirmar la activación.

El menú «+» del compositor incluye «Programar tarea». Usa como punto de partida el texto escrito, conserva el compositor y abre el mismo editor. También sirve cuando el modelo no soporta herramientas. La prueba de navegador abre ese menú, cancela el editor y comprueba que el texto del compositor se conserva.

En Telegram, el propietario enlazado puede solicitar un plan en lenguaje natural. El bot presenta instrucciones, horario, modelo y permiso de búsqueda pública, con botones para confirmar o cancelar. La confirmación usa los controles existentes, ligados al usuario, chat y conexión. Invitados no pueden crear horarios del propietario. La tarea usa el proveedor/modelo guardados en esa conexión y no concede acceso a archivos. Para modificar el plan se solicita una nueva propuesta; la anterior se invalida. Los planes caducan a los diez minutos y se pierden al reiniciar el proceso, sin activar tareas.

La activación requiere confirmar el plan. Cancelaciones, planes incompletos, controles caducados, cambio de modelo o revocación de acceso no activan tareas. Si una activación falla después de guardar el borrador, el reintento utiliza ese borrador.

## Documentos y animación

La tarjeta de creación ahora tiene un tamaño compacto, icono de documento, líneas de contenido y un brillo suave. La preferencia de reducir movimiento desactiva el brillo y las animaciones del indicador. No muestra porcentajes inventados. Las instrucciones de `generate_document` indican preferir el generador integrado para PDF, Word, Excel, CSV y texto, en lugar de comprobar o instalar bibliotecas Python, y usar la tarjeta de descarga de la aplicación sin inventar enlaces `sandbox:`.

## Validación

- Navegador: propuesta en chat → revisión de horario → selección de modelo → borrador → confirmación → tarea activa; también las regresiones de modelo guardado y apertura del chat de ejecución.
- Navegador: apertura y reapertura de Word, PDF, hoja y Markdown sin recarga; animación desactivada con movimiento reducido.
- Backend: 135 pruebas de propuestas, canales, controles, planificador y documentos; 39 pruebas adicionales de perfil de canales y ejecución de automatizaciones.
- Después del ajuste final para pedir detalles cuando un plan de canal es incompleto y aceptar respuestas posteriores de horario, las 15 pruebas de propuestas se volvieron a ejecutar y aprobaron.
- 83 pruebas raíz, dos pruebas del lector de propuestas, TypeScript, lint raíz e igualdad de traducciones aprobados.

Se usan proveedores y transportes simulados; no se enviaron mensajes reales ni se ejecutaron modelos de pago. Se añadió la cobertura a CI. La programación necesita que el backend de Sparta permanezca ejecutándose. No se recompiló ni publicó la aplicación instalada. La propuesta natural depende del soporte de herramientas del modelo; el acceso manual del compositor no lo requiere.
