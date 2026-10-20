# Guía lateral de conversación

Se añadió una marca por mensaje de usuario o asistente en el borde izquierdo del chat. Las marcas forman un grupo compacto, con altura máxima de 10 px por botón y sin separación adicional. Al pasar el cursor muestra una vista previa textual acotada hacia el interior del chat; al pulsar se desplaza al mensaje. Las marcas de usuario y asistente tienen longitudes distintas, y la del mensaje visible se destaca con el color principal.

El componente conserva la identidad de mensajes de la rama activa, por lo que cambia con la conversación o selección de rama sin mezclar historial. No se reconstruye toda la guía por cada token de texto. IntersectionObserver sigue los mensajes visibles dentro del viewport del chat; el salto usa el sistema existente para dejar de seguir automáticamente el final. Respeta movimiento reducido y ofrece flechas, Inicio/Fin y Enter para navegación por teclado. La vista previa no interpreta Markdown ni carga imágenes o archivos.

Validación: comprobación de tipos y paridad de traducciones; prueba de navegador con doce mensajes, vista previa, clic al último mensaje y regreso al primero mediante teclado, sin errores de página. Se inspeccionó la captura del navegador. No se probó manualmente en el ejecutable de escritorio.
