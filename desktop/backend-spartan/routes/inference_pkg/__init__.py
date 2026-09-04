"""Package routes.inference_pkg

Modular Clean Architecture package decomposing the monolithic inference routes:
- router_images_studio: Local diffusion image generation, download plans, gallery CRUD and monitoring.
- router_audio_stt_studio: Speech-To-Text (Whisper, mtmd), transcription, audio gallery.
- router_sandbox: Sandbox session file serving and revealing.
- router_containers: External OpenAI container lifecycle proxy.
- router_monitor_studio: API monitor logs, stream cancellation and tool confirmation.
- router_lifecycle: Model load, unload, validation, llama-flags and load progress.
- router_openai_compat: Chat completions, models list/retrieve, embeddings, responses.
- router_anthropic: Anthropic messages and token counting.
"""
