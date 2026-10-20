# 05 · Imágenes y recursos visuales

## Estado del inventario

Revisa los archivos existentes antes de enlazarlos. Los nombres de capturas que aparecían en el inventario anterior no corresponden a recursos del repositorio actual. Evita tratar logos, mockups o ilustraciones conceptuales como capturas de la interfaz.

| Recurso | Tipo | Uso recomendado |
| --- | --- | --- |
| `docs/assets/escritorio.png` | Logo cuadrado sobre fondo claro | Identidad; no es una captura del escritorio |
| `docs/assets/sparta-escritorio.png` | Logo cuadrado sobre fondo oscuro | Identidad; no es una captura del escritorio |
| `docs/assets/sparta-contexto.png` | Recorte del composer | Explicar adjuntos y controles del composer; revisar que coincida con la UI actual antes de publicarlo |
| `docs/assets/sparta-permisos.png` | Composición de permisos y composer | Explicar los modos de aprobación; validar las etiquetas frente a la versión documentada |
| `landing/public/proyecto/SPARTAN-PRINCIPAL.png` | Mockup de estado vacío | Ilustrar el concepto de espacio de trabajo; no presentarlo como captura actual de una conversación |
| `landing/public/docs/memory-interface-sample.png` | Captura de la interfaz actual de Memoria | Mapa de recuerdos con registros ficticios; no contiene datos de una cuenta real |

La landing reutiliza la captura actual de Memoria junto a su guía y en la demo. El texto alternativo y el pie aclaran que los registros son ficticios. No reutilizar las capturas antiguas del mapa de memoria: corresponden a iteraciones previas del diseño.

## Criterios de publicación

- Usa capturas obtenidas de la versión que se está documentando; oculta nombres, rutas y credenciales personales.
- Comprueba que la imagen muestra el flujo descrito y que sus etiquetas siguen vigentes.
- Usa SVG o diagramas para explicar relaciones y arquitectura, con texto alternativo o estructura legible.
- Incluye dimensiones, compresión y texto alternativo adecuados; evita una imagen de referencia de terceros como si fuera producto propio.
- Si no existe una captura actual, usa un esquema conceptual con esa etiqueta o deja la sección sin captura.
