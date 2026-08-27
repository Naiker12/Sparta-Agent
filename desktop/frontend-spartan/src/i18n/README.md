# i18n Contribution Guide

- `src/i18n/locales/en/` is the modular baseline message catalog.
- Each feature/namespace has its own module (`common.ts`, `shell.ts`, `chat.ts`, `tour.ts`, etc.).
- Complex namespaces like `settings/` and `studio/` are further subdivided into per-tab/per-section files.
- Non-English locales (e.g. `src/i18n/locales/es/`) replicate the exact same directory structure and file names.
- When adding a new top-level namespace, create a new file in `locales/en/` and mirror it in `locales/es/`. Never dump raw keys directly into `index.ts`.
- Use BCP 47 locale tags for new languages, for example `zh-CN`, `pt-BR`, `ja-JP`, and `ko-KR`.
- Do not change fallback logic to hide missing translations.
- Do not add automatic DOM translation, MutationObserver text replacement, or runtime guess-based translation.
- Preserve interpolation variables exactly, for example `{count}`, `{model}`, and `{provider}`.
- Keep technical and product names unchanged (`Sparta Agent`, `LoRA`, `GGUF`, `Hugging Face`).
- Run `npm run i18n:check` before committing to ensure there are no shape mismatches or placeholder discrepancies in non-English overlays.
- CI runs `npm run i18n:check:strict`, which enforces complete key parity between `en` and overlays.
