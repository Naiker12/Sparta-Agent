export const agents = {
  "title": "Agentes",
  "description": "Conecta agentes de programación como Claude Code y Codex a un modelo local con Spartan start.",
  "intro": "conecta Claude Code, Codex, Hermes, OpenClaw, OpenCode y otros agentes a un modelo servido localmente por Spartan, totalmente sin conexión. Ejecuta un servidor compatible con OpenAI y nunca modifica los archivos de configuración de tu agente.",
  "readDocs": "Leer la documentación",
  "copy": "Copiar",
  "copied": "Copiado",
  "commandBuilder": "Generador de comandos",
  "agent": "Agente de programación",
  "model": "Modelo",
  "searchModels": "Buscar modelos GGUF...",
  "noModels": "No hay modelos GGUF que coincidan.",
  "showingModels": "Mostrando {shown} de {total} coincidencias. Sigue escribiendo para acotar la lista.",
  "quantization": "Cuantización",
  "loadingQuantizations": "Cargando cuantizaciones...",
  "noQuantizations": "Sin cuantización independiente",
  "recommended": "Recomendado",
  "downloaded": "Descargado",
  "quantizationLoadError": "No se pudieron cargar todas las cuantizaciones. El comando usará el valor de modelo que esté disponible.",
  "generatedCommand": "Comando generado",
  "docs": "Documentación",
  "agentDocs": "Abrir la documentación de configuración de {agent}",
  "copyGeneratedCommand": "Copiar el comando generado",
  "modelNote": "Codex requiere un modelo GGUF servido por llama-server. Otros agentes también pueden usar modelos basados en transformers; quita --model para usar el modelo ya cargado en Spartan.",
  "subagent": {
    "title": "Usar un modelo local como subagente",
    "description": "Mantén {agent} en su modelo actual y delega tareas concretas en este modelo local de Spartan.",
    "setupCommand": "Comando de configuración",
    "copySetupCommand": "Copiar el comando de configuración del subagente",
    "usagePrompt": "Luego, en {agent}, escribe:",
    "copyUsagePrompt": "Copiar el prompt de uso del subagente",
    "defaultPrompt": "Crea un agente local para implementar esta función.",
    "opencodePrompt": "@Spartan encuentra la causa de este fallo en las pruebas"
  },
  "quickstart": {
    "title": "Crear un comando",
    "description": "Inicia un agente con el modelo cargado actualmente en Studio. Carga primero un modelo y luego cambia claude por cualquiera de los agentes compatibles que aparecen abajo.",
    "noneDetected": "No se encontró ninguna CLI de agente compatible en tu PATH.",
    "installed": "Instalado"
  },
  "supportedAgents": {
    "title": "Agentes compatibles",
    "description": "Cada agente se inicia con su propio comando:",
    "requiresGguf": "Necesita un modelo GGUF"
  },
  "models": {
    "title": "Elegir un modelo",
    "description": "Usa --model para elegir un modelo y una cuantización, y --context-length para definir la ventana. Usa un sufijo de cuantización o la opción explícita --gguf-variant.",
    "suffixLabel": "Con un sufijo de cuantización",
    "variantLabel": "Con una opción explícita de variante"
  },
  "options": {
    "title": "Opciones comunes",
    "description": "Primero se procesan las opciones de Spartan; todo lo que Spartan no reconoce se pasa directamente al agente.",
    "model": "Selecciona un modelo. Sin --model, Spartan start usa el modelo cargado actualmente en Studio y da error si no hay ninguno.",
    "contextLength": "Define la longitud de contexto solicitada (alias: --max-seq-length).",
    "ggufVariant": "Elige la variante de cuantización GGUF.",
    "loadIn4bit": "Activa o desactiva la carga en 4 bits para modelos de Hugging Face.",
    "tensorParallel": "Activa o desactiva el paralelismo de tensores entre varias GPU.",
    "serve": "Activa o desactiva el servidor local automático.",
    "launch": "Inicia el agente, o solo imprime el comando y el entorno.",
    "persist": "Conserva entre ejecuciones el almacenamiento de agentes que gestiona Spartan.",
    "asSubagent": "Mantén el agente principal en su modelo actual y registra Spartan como subagente local (Claude Code, Codex y OpenCode).",
    "apiKey": "Indica tu clave de API de Spartan (o define SPARTAN_API_KEY).",
    "yolo": "Omite las solicitudes de aprobación. Úsalo solo en entornos de confianza."
  },
  "remote": {
    "title": "Conectar con un Studio remoto",
    "description": "Apunta Spartan start a un Studio que se ejecuta en otro lugar definiendo estas variables antes de iniciar el agente (o pasa --api-key directamente):"
  },
  "passthrough": {
    "title": "Pasar argumentos al agente",
    "description": "Los argumentos que van después de las opciones de Spartan se reenvían al propio agente, así que comandos nativos como resume siguen funcionando:"
  },
  "dryRun": {
    "title": "Previsualizar sin iniciar",
    "description": "Añade --no-launch para imprimir el entorno y el comando en vez de iniciar el agente. Si --model está definido, el modelo aún puede resolverse y cargarse."
  }
} as const;
