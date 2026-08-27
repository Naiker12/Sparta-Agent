export const methods = {
  "qlora": {
    "label": "QLoRA",
    "hint": "Cuantización de 4 bits. Menor uso de VRAM y arranque más rápido.",
    "note": "4 bits"
  },
  "lora": {
    "label": "LoRA",
    "hint": "Adaptadores de 16 bits. Equilibrio entre calidad y memoria.",
    "note": "16 bits"
  },
  "full": {
    "label": "Fine-tuning completo",
    "hint": "Entrena todos los pesos. Máxima calidad y mayor uso de VRAM.",
    "note": "fp16"
  },
  "cpt": {
    "label": "Preentrenamiento continuo",
    "hint": "Preentrenamiento continuo para nuevos dominios o idiomas.",
    "note": "continuo"
  }
} as const;
