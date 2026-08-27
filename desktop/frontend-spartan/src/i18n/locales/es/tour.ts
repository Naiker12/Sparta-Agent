export const tour = {
  "badge": "recorrido guiado",
  "quickTour": "Recorrido rápido",
  "defaultBody": "Te orientamos paso a paso.",
  "skipTour": "Omitir recorrido",
  "skip": "Omitir",
  "back": "Atrás",
  "next": "Siguiente",
  "done": "Listo",
  "tip": "Consejo: `Esc` omite. El recorrido bloquea clics para que puedas leer.",
  "chat": {
    "modelTitle": "Elige un modelo",
    "modelBody": "Selecciona el modelo cargado para inferencia. Recomendados son los modelos base seleccionados por Sparta; En dispositivo son tus descargas y modelos ajustados (adaptadores LoRA y finetunes completos).",
    "modelTabsTitle": "Buscar un modelo",
    "modelTabsBody": "Busca modelos de Sparta o pulsa en Buscar en el Centro para ver todo Hugging Face. Alterna entre Recomendados y En dispositivo, filtra por formato y ordena por tendencias o recientes. La etiqueta OOM indica que no cabe en tu VRAM.",
    "settingsTitle": "Barra lateral de ajustes",
    "settingsBody": "El muestreo (temperatura/top-p/top-k) y el prompt del sistema están aquí. Si buscas respuestas más deterministas, reduce primero la temperatura.",
    "plusMenuTitle": "El menú +",
    "plusMenuBody": "Todo lo demás está aquí: adjuntar fotos y archivos, reutilizar prompts guardados, alternar herramientas y MCP, iniciar una comparación paralela y exportar el chat.",
    "compareViewTitle": "Hilos en paralelo",
    "compareViewBody": "Compara dos modelos cualesquiera lado a lado desde el menú +. Mismo prompt, 2 hilos. Si LoRA da peores resultados que la base, suele deberse al formateo de datos, demasiadas épocas o un punto de control no óptimo."
  },
  "export": {
    "trainingRunTitle": "Elegir ejecución de entrenamiento",
    "trainingRunBody": "Comienza seleccionando la ejecución de entrenamiento. Cada ejecución agrupa los puntos de control producidos por ese ajuste fino.",
    "checkpointTitle": "Elegir punto de control",
    "checkpointBody": "Elige qué punto de control exportar. Si entrenaste múltiples puntos de control, vale la pena exportar 1 o 2 candidatos y probarlos en el Chat.",
    "methodTitle": "Método de exportación",
    "methodBody": "Elige el empaquetado. GGUF es para motores estilo llama.cpp (elige una cuantización). Safetensors es para uso con Hugging Face/Transformers. Si tienes dudas, empieza con safetensors.",
    "ctaTitle": "Exportar",
    "ctaBody": "Exporta en local o sube a HF Hub. Tras la exportación, pruébalo en el Chat y compáralo con la base para confirmar que el comportamiento es el esperado."
  }
} as const;
