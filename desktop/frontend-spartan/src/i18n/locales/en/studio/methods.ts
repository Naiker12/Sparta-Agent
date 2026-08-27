export const methods = {
  "qlora": {
    "label": "QLoRA",
    "hint": "4-bit quantization. Lowest VRAM, fastest to start.",
    "note": "4-bit"
  },
  "lora": {
    "label": "LoRA",
    "hint": "16-bit adapters. Balanced quality and memory.",
    "note": "16-bit"
  },
  "full": {
    "label": "Full fine-tune",
    "hint": "Trains all weights. Highest quality, needs the most VRAM.",
    "note": "fp16"
  },
  "cpt": {
    "label": "Continued pretraining",
    "hint": "Continued pretraining for new domains or languages.",
    "note": "continued"
  }
} as const;
