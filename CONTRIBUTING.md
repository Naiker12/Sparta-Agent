# Contribuir a Sparta Agent

Gracias por ayudar a mejorar Sparta Agent. Las propuestas pequeñas, enfocadas y fáciles de revisar son las más útiles.

## Antes de empezar

- Busca en [Issues](https://github.com/Naiker12/Sparta-Agent/issues) si el problema o la idea ya existe.
- Para un cambio grande, una función nueva o una modificación de arquitectura, abre primero un Issue y acuerda allí el alcance.
- Si encuentras una vulnerabilidad, no publiques detalles que permitan explotarla en un Issue público. Sigue el proceso de [reporte de seguridad](SECURITY.md).

## Preparar un cambio

1. Haz un fork del repositorio y crea una rama desde `main` (`fix/...`, `feature/...` o `docs/...`).
2. Limita la rama a un propósito. Evita mezclar refactorizaciones, cambios de formato o actualizaciones de dependencias que no sean necesarias para ese propósito.
3. Conserva los límites de seguridad entre la interfaz React, el puente IPC y el proceso principal de Electron. Explica cualquier cambio de permisos, acceso a archivos, comandos o conexiones de red.
4. No incluyas claves, tokens, credenciales, datos personales, binarios generados ni archivos temporales. No agregues telemetría, conexiones ocultas ni acciones destructivas.
5. Añade o actualiza documentación cuando el comportamiento visible, la configuración o el uso cambien.

## Validación

Desde la raíz del proyecto, instala dependencias y ejecuta las comprobaciones relevantes para tu cambio:

```bash
npm ci
npm --prefix desktop/frontend-spartan ci
npm run lint
npm run typecheck
npm test
npm --prefix desktop/frontend-spartan test
npm --prefix desktop/frontend-spartan run test:electron
```

Los pull requests también deben pasar los tres trabajos requeridos de CI: `lint`, `test` y `backend-contracts`. Si un cambio toca el backend, ejecuta las pruebas Python relacionadas y describe el comando y el resultado en el PR. Si toca la interfaz, incluye capturas o un video corto del antes y después cuando ayude a revisar el cambio.

## Enviar un pull request

- Abre el PR contra `main` y completa la plantilla.
- Explica el problema, el comportamiento esperado y la solución; enlaza el Issue relacionado.
- Enumera lo que cambió y las pruebas ejecutadas, incluidos los resultados.
- Responde a las observaciones y mantén el PR actualizado. Un PR puede ser rechazado o devuelto para cambios si excede el alcance, no tiene validación o introduce riesgos sin justificar.
- La integración ocurre después de la revisión y de que pasen los controles automáticos. Abrir un PR no garantiza que el cambio vaya a incorporarse.

## Alcance y seguridad

No envíes cambios que oculten su propósito, debiliten las aprobaciones de seguridad, expongan secretos, borren o sobrescriban datos sin consentimiento, descarguen o ejecuten código sin informar, o añadan dependencias sin justificar. Si no estás seguro del enfoque, pregunta en un Issue antes de invertir tiempo en la implementación.
