# Cinco mejoras de presentación conversacional

## 1. Formularios como respuesta final

El bucle compartido de herramientas termina el turno tras ejecutar correctamente un paso compuesto únicamente por `present_ui` que contenga al menos un formulario. Se completan todas las llamadas del paso antes de terminar. Si una presentación falla o hay otras herramientas en el mismo paso, se conserva la continuación ordinaria para no ocultar errores ni respuestas necesarias. Esto evita una segunda generación que vuelva a describir los campos.

## 2. Borradores locales

Los cambios de cada campo se guardan sin esperar al envío. El espacio de nombres incluye conversación persistida, mensaje, llamada, formulario y esquema. Los IDs locales temporales no forman parte de la referencia persistente. Un esquema distinto no hereda valores incompatibles. El envío correcto elimina su borrador; un envío fallido lo conserva. Los chats temporales no escriben borradores. Cerrar sesión elimina esta caché. Se conservan hasta 100 entradas y caducan a los 30 días; si el almacenamiento falla, el formulario permanece editable en memoria.

La recarga de navegador con reconstrucción del historial comprueba que nombre y presupuesto cero reaparecen antes de enviar. No hay sincronización de borradores entre dispositivos.

## 3. Resumen enviado

La tarjeta OpenUI de datos enviados muestra el estado «Enviado al chat» y usa una cuadrícula adaptable. Conserva fechas legibles, Sí/No, cero y la alternativa de texto. Se mantienen el origen y los valores estructurados en el historial y la protección contra doble envío.

## 4. Presentación según contenido

Las instrucciones distinguen respuestas directas, comparaciones, cantidades y recogida de datos. Se ofrecen gráficos inicialmente solo para comparaciones pequeñas de 4 a 8 categorías únicas, con una cantidad reconocible en el encabezado y números inequívocos. Identificadores, porcentajes escritos como texto y datos ambiguos permanecen en tabla. La persona puede alternar entre gráfico y tabla. No se convierte toda respuesta en un panel.

## 5. Investigación y referencias

Los resultados desplegados de búsqueda muestran título enlazado, dominio y extracto; se deduplican fragmentos de la misma página conservando consultas distintas. No se descargan favicons de terceros para estas tarjetas. La actividad de búsqueda sigue plegada en el chat y fuera del compositor. Se conservan las galerías con origen, carga explícita y estados de imagen fallida. Las instrucciones piden citas junto a las afirmaciones y una explicación breve de la relevancia de las imágenes, sin duplicar la galería. No se acredita automáticamente la exactitud de una afirmación ni una licencia de imagen.

## Validación

- 45 pruebas del bucle de herramientas y paneles del backend.
- 17 pruebas frontend de borradores, selección de presentación, referencias y formularios.
- Comprobación de tipos y paridad de traducciones.
- Prueba de navegador con modelo simulado: borrador tras recarga, envío, resumen sin JSON, restauración del historial, gráfico automático reversible, fuentes deduplicadas y fallo deliberado del módulo visual con alternativa textual.

Estas pruebas no sustituyen una comprobación con un proveedor real ni aseguran que todo modelo siga las instrucciones de citas. El cambio de finalización del turno requiere reiniciar el backend ya abierto.
