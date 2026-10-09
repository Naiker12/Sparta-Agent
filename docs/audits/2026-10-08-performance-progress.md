# Spartan: ejecución del plan de rendimiento

## Corrección previa: aviso de actualización

Se retiró el icono decorativo de destellos del aviso Electron y web. Un fallo se titula con la traducción existente de «La actualización falló», usa un mensaje legible y no muestra rutas internas de archivos. Al cerrar un fallo no queda una insignia de descarga que sugiera una versión disponible; las versiones reales conservan su botón minimizado.

El actualizador omite la comprobación automática cuando falta `resources/app-update.yml` (paquetes de directorio sin metadata). Una comprobación manual en ese caso devuelve un fallo explícito de configuración, sin intentar abrir el archivo. Las distribuciones configuradas conservan sus comprobaciones; también se captura el rechazo de la comprobación automática. Cinco pruebas verifican estas rutas, desarrollo y el marcador de versión ya instalada. TypeScript, compilación renderer/main/preload, control de dependencias del main y generación del paquete aprobados. Evidencias: `output/performance/update-banner-fix-build.log` y `update-banner-fix-package.log`. La ventana abierta sigue usando el paquete anterior; no se ha eludido el bloqueo de ejecución de Windows.

## Orden actual: puntos 1–3

1. **Validación de producción, en curso.** Paquete Electron `--dir` generado y contenido comprobado, con perfil aislado; no es una instalación NSIS nueva. PDF real de nueve páginas y Word de prueba abiertos en Spartan con hoja y controles. Excel reveló un fallo de aceptación del adjunto, corregido abajo. Excel corregido, código, prompts y exportaciones siguen pendientes de completar en la interfaz. Windows bloqueó el nuevo ejecutable `package-validation-next` mediante Control de aplicaciones; no se modificó esa protección. El paquete anterior abierto permite continuar parte de la revisión, pero no ejecuta los ajustes nuevos de notificaciones y Excel.
2. **Medición, parcial.** Dos capturas de 30 intervalos sobre el árbol del proceso 15000. Primera: media de memoria privada comprometida 564,89 MiB, sin incremento de CPU observado; no se certificó visibilidad/ausencia de interacción durante toda la captura. Sesión con PDF: media 765,76 MiB y CPU 2,14%, máximo de CPU 31,38%, con interacción posible. No son una comparación antes/después controlada, ni memoria física exclusiva. Faltan arranque frío/caliente, reposo visible/minimizado controlado y apertura de herramientas.
3. **Trabajo en reposo, implementaciones comprobadas; validación de ejecución pendiente.** Consultas compartidas por hilo ya implementadas. Notificaciones globales ahora reciben un indicador de ejecuciones activas, aislado por propietario: dos segundos activas, diez sin actividad, dos con una página de 100 eventos pendiente de drenar. Servidores anteriores sin el indicador mantienen dos segundos. Errores reintentan con espera creciente hasta treinta segundos; al recuperar visibilidad se refresca sin solapar peticiones. Se conserva el cursor y ledger. Un inicio detectado tras reposo puede tardar hasta el siguiente intervalo de diez segundos, más la duración de la petición. No se pausa el scheduler ni Telegram.

En modo API se omiten el calentamiento ML, la reparación posterior MLX/RAG y la detección de hardware desde health. El bootstrap detecta lectores ausentes antes de emitir el handshake y solicita actualizar el entorno; la comprobación usa `find_spec`, sin importar los lectores. Las pruebas comprueban fallo sin credencial emitida y arranque con lectores disponibles.

**Excel: fallo encontrado en la aplicación.** El selector/composite rechazaba el MIME real de XLSX pese a existir una vista de hojas de cálculo. Se añadió un adaptador para XLSX/XLS/XLSM/XLSB con sus extensiones y MIME, antes del lector de texto. Adjuntar no inicia el análisis; al enviar, reutiliza el worker existente (25 MiB de archivo, 32 hojas, 500 filas/64 columnas por hoja, 1.000 caracteres por celda, tiempo máximo de 15 segundos). El texto del prompt se limita adicionalmente a 100.000 caracteres y señala contenido parcial. No se ejecutan macros ni se recalculan fórmulas: se usa el lector existente y sus valores disponibles. Eliminar durante la lectura cancela el worker y descarta resultados tardíos. No se incorporó otra biblioteca.

Pruebas de esta corrección: 23 de enrutamiento con MIME real, genérico y ausente; cuatro con libros reales XLSX/XLS/XLSM/XLSB y varias hojas; tres de lectura diferida, límites y liberación del worker por éxito/cancelación/timeout. Pasan además 22 pruebas existentes de snapshots de adjuntos, pestañas, retención y exportación Markdown. TypeScript y compilación renderer/main/preload aprobados. Paquete `package-validation-next` regenerado y comprobado con el adaptador nuevo; no se intentó eludir el bloqueo de ejecución de Windows.

**Medición adicional:** ventana minimizada al iniciar la captura, después de abrir documentos: 30 intervalos, media 654,22 MiB privados, sin incremento de CPU registrado. No confirma ausencia de fugas ni ahorro permanente. Consultas HTTP al backend existente: diez respuestas 200 por ruta. Mediana health 4,77 ms, liveness 4,84 ms; primera health 6.038,49 ms, media 609,79 ms, con sobrecoste del cliente incluido. No se descartó ese valor ni se atribuyó sólo al servidor. Falta medir el arranque y repetir una base controlada antes/después.

Validación nueva: TypeScript raíz/frontend; compilación renderer/main/preload; comprobación de dependencias del main; contenido del paquete nuevo; 11 pruebas de coordinador/ledger/intervalos, 12 de tareas y arranque frío, y 16 de bootstrap/chats de automatizaciones. Los grupos Python incluyen dos pruebas de arranque frío ya contabilizadas entre las 57 de la revisión anterior. No sumar grupos como pruebas únicas sin descontar solapamientos.

Evidencias: `output/performance/production-idle-visible.json`, `production-document-session.json`, `production-minimized.json`, `production-health-latency.json`, `notification-backoff-build.log`, `spreadsheet-attachment-build.log` y `package-validation-next-build.log`. Las medidas corresponden al paquete anterior; el paquete nuevo no pudo ejecutarse. No se acredita todavía un porcentaje de ahorro de CPU/RAM.

Después de cerrar estos puntos: memoria retenida al abrir/cerrar documentos, fluidez de conversaciones largas, indicadores de actividad y animaciones. El informe conserva abajo las verificaciones anteriores y sus límites históricos.

## Lectores en distribución

La distribución excluía `core/rag/**`, aunque las herramientas de automatizaciones importan sus lectores. Se añadió un recurso independiente que incluye únicamente `__init__.py`, `config.py` y `parsers.py`. No se incluyen embeddings, recuperación ni motores de RAG. PyMuPDF, python-docx y openpyxl se declararon para el entorno API; sus imports siguen diferidos hasta abrir el formato correspondiente.

El control del paquete ahora exige estos tres archivos. La prueba aislada genera TXT, PDF, DOCX y XLSX, copia sólo esos lectores a recursos temporales y ejecuta Python con `-I` fuera del repositorio. Comprueba contenido real y que no se carguen Torch ni Transformers. No sustituye una prueba del instalador completo.

Validación: 13 pruebas de lectores/ejecutor y 12 del contrato API aprobadas; filtros del builder comprobados; control de empaquetado válido sintácticamente.

## Medición de procesos

Nuevo recolector: `scripts/measure-spartan-processes.ps1`.

Ejemplo para la aplicación de producción, usando el PID del proceso principal:

```powershell
./scripts/measure-spartan-processes.ps1 -RootProcessId 12345 -Samples 60 -Scenario 'production idle visible' -OutputPath output/performance/production-idle.json
```

No inicia ni reinicia la aplicación. Registra el proceso seleccionado y sus descendientes, incluyendo procesos nuevos cuando aparecen. CPU normalizada por procesadores lógicos; memoria privada comprometida y working set separados. No suma working sets como si fueran memoria física exclusiva.

La captura de comprobación `output/performance/development-process-sample.json` tiene 70 observaciones en 10 intervalos, con la aplicación de desarrollo abierta y carga no controlada. Media de memoria privada sumada: aproximadamente 719 MiB. Es una fotografía de diagnóstico, no una base de producción ni evidencia de mejora. Un intervalo breve de CPU sin incremento observado tampoco acredita consumo permanente cero.

## Separación de gráficos

Se eliminó la regla que reunía Mermaid, todas las dependencias D3 y thinking-orbs en `vendor-charts`. Rollup puede separar esos módulos según sus consumidores y sus imports diferidos. No se retiró ninguna función ni dependencia.

Inventario anterior conservado en `output/performance/before-chart-split.json`; nuevo inventario en `output/performance/baseline.json`. Build de producción completo (renderer, main y preload), TypeScript del shell y control de dependencias del main aprobados.

| Métrica estática | Antes | Después |
|---|---:|---:|
| JavaScript inicial | 7.615.538 bytes / 7,26 MiB | 4.736.538 bytes / 4,52 MiB |
| JavaScript inicial, gzip | 2.199.004 bytes | 1.423.184 bytes |
| Frontend completo | 51,87 MiB | 51,86 MiB |

Reducción de JavaScript inicial: **37,8%**. El módulo de entrada individual crece, pero desaparece el bloque obligatorio de gráficos y el total inicial disminuye. No equivale a una reducción demostrada de CPU/RAM ni del instalador. El build conserva advertencias de imports circulares/reexports del chat e imports estáticos/dinámicos mezclados; su resolución queda pendiente junto con la verificación de ejecución del producto.

Pendiente: medición de producción controlada, arranque en frío/caliente y primera apertura de un diagrama en Spartan instalada. Las consultas de automatizaciones y los indicadores visuales todavía no se han modificado en esta fase.

## Consultas compartidas de ejecuciones

El chat y el botón de detener usaban loops independientes contra `runs/by-thread`. Ahora comparten una suscripción por hilo, sin peticiones solapadas. Las respuestas se distribuyen a los consumidores; al terminar la ejecución, el loop se detiene. Al desmontar el último consumidor se limpia el temporizador y se ignoran respuestas tardías.

La consulta compartida conserva un intervalo de un segundo con ventana visible y usa diez segundos cuando está oculta. Al volver a mostrarla se refresca inmediatamente. El botón no vuelve a renderizar por cambios de salida cuando su identificador/estado siguen iguales. El detalle de automatizaciones consulta cada dos segundos si hay ejecución activa, cada diez sin actividad y cada treinta con ventana oculta.

Los eventos de notificaciones nativas conservan su loop y ledger; no se ha modificado la frecuencia ni el cursor. Tampoco se alteró el scheduler del backend o Telegram. SSE y backoff de notificaciones quedan para una fase posterior.

Validación del coordinador y ledger: nueve pruebas aprobadas, incluyendo peticiones compartidas, fin terminal, errores, baja de consumidores, respuestas tardías, no solapamiento y reactivación por visibilidad. TypeScript del frontend, build de producción de renderer/main/preload y control de dependencias del main aprobados. Se comprobó que el bundle final incluye el refresco por visibilidad. Persisten las advertencias previas de imports circulares y mezclados. Estas pruebas verifican reducción de trabajo lógico, no acreditan todavía un porcentaje de ahorro de CPU/RAM en producción.

## Reexportaciones circulares entre bloques

Se sustituyeron imports desde el índice general del chat por imports del módulo que declara cada función/tipo en siete consumidores: proyectos, memoria, ajustes del chat, receta de exportación, chats archivados, gestión de chats y datos. No se modificó su lógica ni la API pública del índice.

La comparación de logs da **18 advertencias de reexportación circular entre chunks antes y cero después**. Evidencia: `output/performance/automation-polling-build.log` frente a `output/performance/chat-imports-build.log`. Esto no certifica que el repositorio entero carezca de ciclos: resuelve las advertencias concretas de esta compilación.

TypeScript del frontend, compilación de producción (renderer/main/preload), control del main y revisión de espacios aprobados. Auditoría nueva: 4.737.341 bytes de JavaScript inicial, aproximadamente 4,52 MiB; frontend completo 51,86 MiB. La carga inicial permanece esencialmente igual a la medición de la separación de gráficos. No se atribuye un ahorro adicional de CPU/RAM a este cambio sin perfiles.

Pendientes actuales: imports estáticos y dinámicos mezclados, chunks grandes, mediciones controladas en instalación de producción y revisión del indicador de actividad. La desaparición de las 18 advertencias tampoco sustituye probar visualmente las pantallas afectadas en Spartan instalada.

## Resaltadores y OpenDocument bajo demanda

Las vistas de archivos y artefactos ya no importan ni crean al arrancar el plugin de Shiki y los temas. Un hook solicita ambos módulos al mostrar código y comparte una instancia entre esas vistas. El texto sigue disponible como `pre` durante la carga o si falla; se conservan los temas Spartan y las claves de actualización de artefactos.

Los bloques de código de herramientas solicitan `@streamdown/code` cuando se acercan a la pantalla, sin streaming en modo plano ni contenido que exceda el límite de resaltado. El lector de OpenDocument solicita `fflate` al leer un archivo de ese formato, después de comprobar el tamaño del archivo. No se cambió el límite de extracción ni la selección de XML.

Resultado de la compilación y auditoría estática:

| JavaScript inicial | Bytes | MiB |
|---|---:|---:|
| Antes de esta fase | 4.737.341 | 4,52 |
| Después | 4.466.397 | 4,26 |

Reducción adicional: **5,7%**. No representa ahorro de CPU/RAM medido. Desaparecen las cuatro advertencias de mezcla de imports correspondientes a `@streamdown/code`, `code-plugin`, `code-themes` y `fflate`. Quedan cinco advertencias de esa clase: autenticación automática, almacenamiento del chat, diálogo de prompts y dos módulos de Office del proceso principal. Reexportaciones circulares entre chunks: cero.

TypeScript del frontend, compilación de producción de renderer/main/preload y control de dependencias del main aprobados. Las 20 pruebas existentes de motor de regex, caché, gramáticas embebidas, remount y claves de fuente pasan. Una comprobación antigua de ubicación del constructor se actualizó para admitir inicialización bajo una promesa compartida a nivel de módulo; sigue rechazando constructores repetidos o sin esa caché.

Pendiente: comprobación visual de carga/fallback del código en Spartan instalada y medición de CPU/RAM con la base de producción. No se eliminan bibliotecas de resaltado ni soporte de formatos.

## Diálogo de prompts y exportaciones diferidos

El catálogo de formatos se extrajo a un módulo pequeño. Las funciones de exportación conservan sus implementaciones y firmas, con un acceso que importa el módulo original al ejecutar la acción. La interfaz del diálogo usa React.lazy/Suspense: antes de su primera apertura no se monta ni se solicita el módulo. Después permanece montada al cerrar para conservar estado. Durante la carga aparece el diálogo existente con título, texto de carga traducido y opción de cerrar.

El build genera `prompt-storage-dialog-D5a8SIP_.js`, fuera de la cadena estática inicial. Esa ruta concreta corresponde a esta compilación y cambiará con el contenido. Las exportaciones cargan el módulo original cuando se usan; no se ha dividido todavía toda su lógica interna en módulos independientes.

JavaScript inicial: **4.466.397 → 4.428.173 bytes**, aproximadamente **4,26 → 4,22 MiB**. Reducción de esta fase: 38.224 bytes, 0,86%. La compilación tiene cero advertencias de reexportación circular entre bloques y cuatro de imports estáticos/dinámicos mezclados: autenticación automática, almacenamiento de chat y dos módulos de Office. La advertencia del diálogo desapareció.

TypeScript, build de producción renderer/main/preload, control de dependencias del main y 77 pruebas de exportación Markdown/carga de acciones aprobados. La prueba de carga de acciones se ajustó para comprobar el flujo real: receta mediante import diferido del workflow y exportación mediante API diferida; se ignoran reexports de tipos, que no cargan módulos en ejecución.

Pendiente: probar primera apertura, cierre durante carga y reapertura con estado conservado en Spartan instalada. No se atribuye un ahorro de CPU/RAM sin mediciones de producción.
