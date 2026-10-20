# 404 repetidos en el primer envío

El registro aportado por el usuario muestra solicitudes a `/api/rag/threads/{id}/documents` desde `composer-mentions.tsx`, además del GET previo a la creación de la fila en `ensureThreadRecord`. El aviso de React DevTools es informativo; el texto no contiene una excepción JavaScript fatal ni un error de generación del proveedor.

Se comprobó que `main.py` no montaba el router existente de `routes.rag_pkg`. Se restauró su registro bajo `/api/rag`, conservando las dependencias de autenticación y la respuesta de indisponibilidad de sqlite-vec implementadas en ese router.

Dos pruebas sobre la aplicación principal comprueban que la ruta responde con `200 {documents: []}` cuando no hay archivos y `503` con el motivo de indisponibilidad cuando el motor no puede funcionar. Ambas pasan.

El proceso Python activo requiere un reinicio completo de Spartan para cargar el registro nuevo. Esto corrige las rutas ausentes, pero no acredita por sí mismo el envío completo al proveedor ni permite afirmar que todas las causas de una respuesta vacía estén resueltas.
