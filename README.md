<div align="center">
  <img src="public/sparta-escritorio.png" alt="Sparta Agent" width="112" />
  <h1>Sparta Agent</h1>
  <p><strong>Un espacio de trabajo para construir software con agentes, proveedores de IA por API y control humano.</strong></p>

  <p>
    <a href="https://github.com/Naiker12/Sparta-Agent/releases"><img src="https://img.shields.io/badge/version-v0.3.1-111827?style=flat-square&logo=github&logoColor=white" alt="Versión del proyecto" /></a>
    <img src="https://img.shields.io/badge/desktop-Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/interface-React%2019-111827?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" alt="Licencia MIT" />
  </p>
</div>

---

<div align="center">
  <img src="docs/assets/sparta-principal.png" alt="Entorno de Trabajo Sparta Agent" width="100%" style="border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);" />
</div>

---

> **Conectado por API, con control local.** Sparta Agent combina chat, herramientas y contexto de proyecto en una aplicación de escritorio. Las acciones que afectan archivos o comandos pasan por un control explícito.

## En un vistazo

| Para | Sparta Agent aporta |
| --- | --- |
| Trabajar con tu código | Chat orientado a tareas, contexto de proyecto, diffs y una terminal integrada. |
| Usar IA | Conexiones con proveedores remotos mediante sus APIs y credenciales propias. |
| Conectar servicios | Integraciones mediante Model Context Protocol (MCP), con conectores locales, HTTP y stdio. |
| Mantener el control | Aprobaciones antes de acciones sensibles y almacenamiento local protegido de credenciales. |

## Empieza aquí

Descarga el instalador desde las [releases](https://github.com/Naiker12/Sparta-Agent/releases). En el primer arranque, Sparta Agent prepara su motor local en su propio directorio de datos y muestra el progreso; no reutiliza la instalación de otra aplicación.

Para desarrollo:

```bash
git clone https://github.com/Naiker12/Sparta-Agent.git
cd Sparta-Agent
npm ci
npm --prefix desktop/frontend-spartan ci
npm run dev
```

Requisitos: Node.js 20 o posterior y npm 10 o posterior. El motor Python local se prepara desde la aplicación cuando es necesario.

---

## Capacidades

- **Sesiones de trabajo:** chat normal o temporal, selección de modelo y gestión de contexto.
- **Herramientas con permiso:** revisión de cambios, acciones sobre archivos y terminal con confirmación previa.
- **Documentos en contexto:** previsualización de Markdown, PDF, imágenes y formatos de oficina compatibles.
- **MCP:** Git, sistemas de archivos, bases de datos, navegador y otros servicios configurables.
- **Modo sin conexión:** los proveedores remotos no se presentan como disponibles cuando no hay conectividad.

---

## Arquitectura

| Capa | Responsabilidad | Tecnología principal |
| --- | --- | --- |
| Aplicación | Interfaz, conversaciones y estados de la sesión | React, Vite, Tailwind |
| Escritorio | Ventana, ciclo de vida, permisos e IPC aislado | Electron + ContextBridge |
| Motor local | API, preparación de dependencias y ejecución local | Python |
| Integraciones | Modelos, conectores y herramientas externas | MCP, REST y stdio |

La interfaz no recibe acceso directo al sistema operativo: las operaciones de escritorio pasan por un puente IPC acotado y el proceso principal es quien las autoriza.

---

## Seguridad y privacidad

| Control | Aplicación |
| --- | --- |
| Confirmación de acciones | Las operaciones que pueden modificar archivos o lanzar comandos requieren aprobación. |
| Alcance de archivos | Las rutas se validan contra el espacio de trabajo autorizado. |
| Secretos | Las credenciales se guardan localmente mediante el almacenamiento seguro de Electron cuando está disponible. |
| Ejecución local | El runtime del backend vive en los datos de Sparta Agent, separado de instalaciones de terceros. |

---

## Qué ocurre cuando envías un mensaje

1. Escribes una consulta, eliges un proveedor y un modelo remoto.
2. Sparta Agent prepara la conversación, las instrucciones y, solo cuando corresponde, el resultado de herramientas que autorizaste.
3. La solicitud viaja por HTTPS al proveedor configurado usando su API.
4. La respuesta vuelve a la aplicación, se muestra en el chat y se guarda en el historial local según tus preferencias.
5. Si el modelo propone una acción sobre archivos, terminal o MCP, la aplicación muestra el alcance para que puedas aprobarla o rechazarla.

El código y los archivos no se envían "por defecto" a todos los proveedores. Sin embargo, cualquier contenido incluido en una petición —texto, adjuntos, fragmentos de archivos o resultados de herramientas— sí se comparte con el proveedor seleccionado. Usa credenciales de trabajo con permisos mínimos, revisa los límites de gasto y consulta la política de datos del proveedor antes de usar información sensible.

## Lo que esta edición no incluye

Sparta Agent es **API-only** para la inferencia de IA. No instala ni ejecuta modelos locales y no incluye:

- motores de entrenamiento, Torch o Transformers.
- Ollama, LM Studio, llama.cpp, GGUF, vLLM ni servidores de modelos locales.
- Whisper local, transcripción basada en modelos descargados ni exportación de pesos.
- RAG local, embeddings, índices vectoriales o bases de conocimiento locales.

El runtime Python administrado continúa presente porque las herramientas de proyecto, automatización y terminal pueden necesitarlo. No es un motor de IA y no descarga pesos de modelos. Esta separación reduce el tamaño del paquete, el uso de disco y los problemas de compatibilidad de GPU.

---

## MCP e IA

Sparta Agent usa el estándar Model Context Protocol para conectar Git, sistemas de archivos, bases de datos, herramientas de navegador y servicios configurables. Los conectores pueden operar por procesos locales, HTTP o stdio.

Los modelos se consumen exclusivamente desde proveedores remotos por API. Configura las credenciales de tu proveedor en la aplicación; Sparta no descarga ni carga pesos de modelos locales.

## Límites y decisiones operativas

| Situación | Qué esperar | Recomendación |
| --- | --- | --- |
| Sin conexión a internet | El chat con modelos no estará disponible. | Trabaja en archivos locales y vuelve a conectar antes de solicitar una respuesta. |
| Credencial inválida o cuota agotada | El proveedor devolverá un error de autenticación, permisos o límite. | Renueva la clave, revisa el plan y prueba con un modelo habilitado. |
| Archivo sensible | Puede terminar incluido en la solicitud si lo adjuntas o permites que una herramienta lo lea. | Aplica revisiones, minimiza el contexto y usa un proveedor aprobado por tu organización. |
| Cambio sobre el workspace | La acción se detiene para pedir permiso cuando aplica. | Lee la ruta, el diff o el comando antes de aprobar. |
| Modelo sin soporte de herramientas | El chat sigue disponible, pero algunas acciones no. | Usa un modelo y proveedor con soporte explícito de herramientas si necesitas modo agente. |

---

## Comandos de mantenimiento

```bash
npm run typecheck      # Comprueba TypeScript
npm run lint           # Ejecuta el linter
npm test               # Ejecuta las pruebas
npm run landing:build  # Construye la landing
npm run build          # Empaqueta la aplicación de escritorio
```

---

## Estructura del Proyecto

```text
desktop/
  frontend-spartan/     # Aplicación React
  backend-spartan/      # Motor Python local
  ia-sparta-app-shell/  # Proceso principal de Electron
  ia-sparta-ipc-bridge/ # API IPC expuesta al renderer
docs/                   # Guías, capturas y notas de versión
landing/                # Sitio público
tests/                  # Pruebas del proyecto
```

---

## Contribuir y soporte

Los problemas, ideas y propuestas son bienvenidos en los [issues](https://github.com/Naiker12/Sparta-Agent/issues). Antes de abrir un cambio, ejecuta los comandos de validación anteriores y conserva los límites entre renderer, IPC y proceso principal.

## Licencia

Sparta Agent se distribuye bajo la licencia [MIT](LICENSE)..
