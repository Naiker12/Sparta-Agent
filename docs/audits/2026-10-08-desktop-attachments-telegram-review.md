# Revisión de adjuntos del escritorio y pendientes de Telegram

Fecha: 8 de octubre de 2026. Revisión del código de trabajo actual, que contiene cambios anteriores sin confirmar. Son dos asuntos independientes: errores del compositor y evolución de Telegram.

## 1. Compositor del chat

### Hallazgos corregidos

1. **PDF y DOCX dependían exclusivamente del MIME.** Windows, los arrastres y archivos construidos desde integraciones nativas pueden entregar un MIME vacío o genérico. El adaptador compuesto rechazaba esos archivos antes de llegar al lector. Ahora se reconocen también `.pdf` y `.docx`, incluyendo mayúsculas.
2. **HTML entraba al adaptador genérico de texto.** Su patrón `text/*` se evaluaba antes del lector HTML. El lector específico que elimina scripts y estilos no se utilizaba con `text/html`. Se añadieron `.html`/`.htm` y se movieron los lectores de documentos antes del genérico.
3. **El selector del botón + dejaba rechazos sin manejar.** `void addAttachment(file)` no capturaba el error. Ahora captura cada fallo y muestra un aviso con su causa; un archivo rechazado no impide intentar los demás.

Estas correcciones cubren defectos comprobados del código. No confirman que sean la causa del error concreto reportado: no se proporcionó el archivo, el mensaje del error ni el paso exacto que falla.

### Capacidades y límites actuales

| Entrada | Comportamiento actual |
| --- | --- |
| Texto y código | Lectura como texto; incluye CSV y JSON |
| HTML | Extracción de texto con eliminación de scripts/estilos |
| PDF | Extracción de texto al enviar; máximo 50 MB; documentos escaneados requieren una capacidad OCR adicional |
| DOCX | Extracción de texto al enviar mediante Mammoth |
| ODT/ODS | Lector OpenDocument con límites de archivo/XML |
| Imágenes JPEG/PNG/WebP/GIF | Requieren un modelo compatible con imágenes; máximo 20 MB |
| Audio/video | Adaptadores propios y comprobación de capacidades del modelo |
| XLS/XLSX/PPT/PPTX/DOC/RTF/ZIP | Sin lector de adjuntos correspondiente en este runtime; tener icono o vista previa no habilita su envío |
| Modo comparación | Tiene otro flujo: imágenes y audio; no lectores de documentos |

### Trabajo siguiente recomendado

- Reproducir por separado selección con +, arrastre, pegado y envío. Registrar extensión, MIME, tamaño, modelo y error exacto, sin registrar el contenido privado.
- Probar PDF/DOCX válidos y corruptos en Electron. Las pruebas de enrutamiento no verifican extracción real ni interacción visual.
- Unificar avisos: algunos adaptadores muestran su propio toast y el llamador puede mostrar otro. El arrastre fuera del compositor captura errores suponiendo que todos los adaptadores los muestran, lo que puede ocultar un rechazo.
- Añadir límites coherentes de tamaño/texto extraído a TXT, HTML y DOCX; los límites de archivo actuales no garantizan que el contenido quepa en el contexto del modelo.
- Incorporar lectores de Excel/PowerPoint si se desea admitirlos y reflejar soporte real en selector, ayuda y modo comparación.

## 2. Telegram

### Implementado en el código actual

- Bots, vinculación, usuarios autorizados y conversaciones privadas.
- Historial por bot/usuario, cancelación, uso y actividad.
- Búsqueda pública, lectura de páginas y fotos de referencia con fuentes.
- Documentos UTF-8 TXT/MD/CSV/JSON: hasta 256 KB y 24.000 caracteres.
- Entrada de voz mediante el servicio de transcripción configurado; preparación del proveedor y validación real siguen siendo necesarias.
- Cambio de nombre/apodo de Spartan para el usuario vinculado al perfil.
- Selección de proyectos autorizados y consulta de instrucciones/documentos indexados con permiso.
- Botones para seleccionar proyecto y cancelar; estado nativo de escritura.

### Pendientes confirmados

| Prioridad propuesta | Capacidad | Brecha concreta / criterio de entrega |
| --- | --- | --- |
| 1 | PDF y DOCX recibidos | La normalización solo acepta cuatro extensiones de texto. Hace falta extracción real, límites, errores y pruebas de documentos válidos/corruptos; actualizar política, lector y catálogo juntos |
| 2 | Fotos recibidas y visión | La normalización no procesa `message.photo`; las imágenes de referencia que el bot envía no equivalen a analizar una foto del usuario |
| 3 | Herramientas, skills y MCP | Se muestra inventario, pero el ejecutor solo admite las herramientas públicas previstas. Integrar ejecución con permisos, cancelación y registro antes de anunciar soporte |
| 4 | Archivos locales del proyecto | El contexto indexado no abre carpetas ni modifica archivos. Hace falta resolver rutas autorizadas y una entrega explícita de archivos |
| 5 | Respuestas de voz | Existe `send_voice` en transporte, pero la entrega actual envía texto y fotos. Falta síntesis, configuración y conexión con entrega |
| 6 | Progreso por fases | Hay renovación de typing y botón de cancelación; el gestor de progreso no mantiene un mensaje con fases actualizado |
| 7 | Conversación compartida con escritorio | Se proyecta trabajo/actividad; no implica continuar el mismo hilo y ejecutor del compositor local |

El orden es una propuesta de implementación, no una habilitación automática. Las funciones disponibles deben mantenerse sincronizadas entre catálogo, instrucciones del modelo, ayuda e interfaz.

### Defectos del transporte corregidos en esta revisión

- El envío HTML reintentaba como texto plano ante **cualquier** `TelegramError`. Un error de red puede representar una entrega ambigua; reintentar puede duplicar la respuesta. Ahora solo hay alternativa a texto plano cuando Telegram informa un fallo de parseo de entidades. Se conservan los errores de red, credenciales, conflicto y límites para que el runtime los gestione.
- Los enlaces con parámetros escapaban `&` dos veces, alterando la URL. Ahora se escapan una sola vez.

### Documentación anterior

`docs/channels/telegram-plan.md` mezcla propuesta original y estado de fechas anteriores: por ejemplo, llama pendiente a sincronización de perfil pese al cambio de nombre ya implementado. Para decidir qué implementar hay que contrastar cada entrega con el código actual y separar implementación local de validación real.

## Validación

- 154 pruebas existentes: canales, controles, documentos y voz.
- 6 pruebas nuevas: errores de entrega, alternativa por parseo HTML y enlaces con parámetros.
- 46 pruebas frontend: enrutamiento de documentos, borrador pegado y guardas de envío.
- Paridad de traducciones ES/EN comprobada.
- Typecheck del frontend completado sin errores.
- Sin mensajes al bot real ni validación visual en Electron durante esta revisión.
