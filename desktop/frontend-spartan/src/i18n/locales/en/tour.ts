export const tour = {
  "badge": "guided tour",
  "quickTour": "Quick tour",
  "defaultBody": "Let’s get you oriented.",
  "skipTour": "Skip tour",
  "skip": "Skip",
  "back": "Back",
  "next": "Next",
  "done": "Done",
  "tip": "Tip: `Esc` skips. Tour blocks clicks so you can read.",
  "chat": {
    "modelTitle": "Pick a model",
    "modelBody": "Selects what’s loaded for inference. Recommended is Sparta’s curated base models; On Device is your downloads and fine-tuned outputs (LoRA adapters and full finetunes).",
    "modelTabsTitle": "Find a model",
    "modelTabsBody": "Search Sparta’s models, or hit Search Hub for all of Hugging Face. Switch Recommended and On Device, filter by format, and sort by trending or recent. An OOM tag means it won’t fit in your VRAM.",
    "settingsTitle": "Settings sidebar",
    "settingsBody": "Sampling (temperature/top-p/top-k) + system prompt live here. If you want more deterministic outputs, lower temperature first.",
    "plusMenuTitle": "The + menu",
    "plusMenuBody": "Everything else lives here: attach photos and files, reuse saved prompts, toggle tools and MCP, start a side-by-side compare, and export the chat.",
    "compareViewTitle": "Side-by-side threads",
    "compareViewBody": "Compare any two models side-by-side, available from the + menu. Same prompt, 2 threads. If LoRA is worse than base, it’s usually data formatting, too many epochs, or a bad checkpoint choice."
  },
  "export": {
    "trainingRunTitle": "Pick training run",
    "trainingRunBody": "Start by selecting the training run. Each run groups the checkpoints produced by that specific fine-tuning job.",
    "checkpointTitle": "Pick checkpoint",
    "checkpointBody": "Pick which checkpoint to export. If you trained multiple checkpoints, it’s worth exporting 1-2 candidates and testing in Chat.",
    "methodTitle": "Export method",
    "methodBody": "Choose the packaging. GGUF is for llama.cpp-style runtimes (pick a quant). Safetensors is for HF/Transformers-style usage. If you’re unsure, start with safetensors.",
    "ctaTitle": "Export",
    "ctaBody": "Export to local or push to HF Hub. After export, test in Chat and compare against base to confirm behavior is what you expect."
  }
} as const;
