# Botones del encabezado y diseño de chats en paneles

## Corrección del encabezado

`main.tsx` dibuja una región fija de arrastre de Electron entre x=48 y el espacio reservado a los controles de ventana. A altura de los botones de búsqueda y barra lateral, esa región pasaba por encima del encabezado de Spartan. Los eventos de clic podían convertirse en arrastre de ventana.

`SidebarBrandHeader` publica ahora su límite derecho mediante `useElectronDragBoundary`. La región de arrastre empieza después de ese límite y se actualiza al redimensionar u ocultar la barra. No se elimina el arrastre de la ventana ni se cambia el comportamiento de búsqueda/fijación.

La prueba de navegador monta una región superpuesta con el mismo posicionamiento y verifica clics en ambos botones a 260 px y después de ampliar el encabezado a 480 px. La prueba y la comprobación de tipos pasan. No acredita el clic manual en el ejecutable de Electron.

## Alcance confirmado por el usuario

Debe permitir chats independientes lado a lado y una opción explícita para consultar otro modelo con una copia del contexto actual. Arrastrar un chat desde la barra lateral al área central debe abrirlo en un panel, sin convertirlo silenciosamente en una copia ni moverlo de proyecto.

## Por qué no reutilizar directamente el comparador

`ComparePane` ya crea proveedores separados, pero `GeneralCompareContent` y los selectores usan dos posiciones fijas (`model1`/`model2`) y un compositor compartido. `ThreadScopedSettingsSync`, el modelo seleccionado y algunos controles se apoyan en el chat activo global. Montar varios `SingleContent` sin más podría cambiar ajustes de otro panel, compartir un destino de envío o adoptar incorrectamente el hilo activo.

## Diseño propuesto

1. **Estado por panel.** Identidad propia de panel y runtime, threadId, modelo/proveedor, parámetros, borrador, permisos efectivos y error. El panel activo solo controla foco y resaltado; no es el destino implícito de todas las operaciones. Los envíos reciben una instantánea de la configuración del panel.
2. **Diseño de paneles.** Contenedor redimensionable con hasta cuatro paneles visibles como primer límite, encabezado con título y selector de modelo y compositor propio. En ventanas estrechas, pestañas para los mismos paneles, conservando sus runtimes. El límite es una propuesta de diseño, no una limitación implementada.
3. **Arrastre con intención explícita.** MIME específico para chats, validación del ID y zona de soltar visible en el área central. Soltar abre el chat existente. Si ya está abierto, se enfoca su panel para evitar dos escritores sobre la misma conversación. Mantener el reordenamiento de la barra lateral y las caídas de archivos/carpetas como operaciones distintas. Ofrecer también «Abrir en otro panel» por teclado/menú.
4. **Copia de contexto.** Acción separada «Continuar con otro modelo». Crear un hilo nuevo a partir de la rama visible hasta un mensaje elegido; conservar el original. Incluir objetivo, decisiones y pendientes de la tarea y los mensajes necesarios. Mostrar qué se copiará. No copiar aprobaciones, ejecuciones activas ni estados de herramientas pendientes como si hubiesen terminado. Para paneles/formularios y adjuntos, remapear referencias y validar acceso antes de presentar la copia como operativa.
5. **Continuidad de tarea.** Asociación explícita entre tarea y chats relacionados. Una nota de traspaso compartida contiene objetivo, decisiones, restricciones y pendientes; cada conversación conserva su historial independiente. Compartir contexto no autoriza acciones ni transmite automáticamente nuevas conversaciones a otros modelos.

## Orden de implementación y aceptación

- Primero: estado y resolución de envíos por panel, probando que cambiar modelo, escribir o cancelar en uno no modifica otro.
- Después: abrir dos chats independientes mediante menú, con compositores y permisos separados; recarga y errores sin pérdida de borradores.
- Después: arrastre al centro, reordenación, redimensionamiento y cierre. Cerrar un panel no borra su chat. Una ejecución activa necesita una política explícita que conserve el trabajo o permita detenerlo; no desmontarla de forma accidental.
- Después: copiar contexto hacia un hilo nuevo y cambiar de modelo, con restauración del historial y referencias correctas.
- Finalmente: ampliar a más paneles y continuidad de tareas, con pruebas de concurrencia y varias respuestas en curso.

La infraestructura multipanel todavía no está implementada ni activada. Este documento fija el alcance y las condiciones de aislamiento antes de modificar el flujo de ejecución, precisamente para evitar repetir los fallos de remonte y desaparición de hilos del primer envío.
