export const agents = {
  "title": "Agents",
  "description": "Connect coding agents like Claude Code and Codex to a local model with Spartan start.",
  "intro": "connects Claude Code, Codex, Hermes, OpenClaw, OpenCode and other agents to a model served locally by Spartan, fully offline. It runs an OpenAI-compatible server and never touches your agent's config files.",
  "readDocs": "Read the docs",
  "copy": "Copy",
  "copied": "Copied",
  "commandBuilder": "Command builder",
  "agent": "Coding agent",
  "model": "Model",
  "searchModels": "Search GGUF models...",
  "noModels": "No matching GGUF models.",
  "showingModels": "Showing {shown} of {total} matches. Keep typing to narrow the list.",
  "quantization": "Quantization",
  "loadingQuantizations": "Loading quantizations...",
  "noQuantizations": "No separate quantization",
  "recommended": "Recommended",
  "downloaded": "Downloaded",
  "quantizationLoadError": "Couldn't load all quantizations. The command will use the available model value.",
  "generatedCommand": "Generated command",
  "docs": "Docs",
  "agentDocs": "Open {agent} setup docs",
  "copyGeneratedCommand": "Copy generated command",
  "modelNote": "Codex requires a GGUF model served by llama-server. Other agents can also use transformer-backed models; remove --model to use the model already loaded in Spartan.",
  "subagent": {
    "title": "Use a local model as a subagent",
    "description": "Keep {agent} on its current model and delegate selected tasks to this local Spartan model.",
    "setupCommand": "Setup command",
    "copySetupCommand": "Copy subagent setup command",
    "usagePrompt": "Then in {agent}, type:",
    "copyUsagePrompt": "Copy subagent usage prompt",
    "defaultPrompt": "Spawn a local agent to implement this function.",
    "opencodePrompt": "@Spartan find the cause of this test failure"
  },
  "quickstart": {
    "title": "Build a command",
    "description": "Launch an agent against the model currently loaded in Studio. Load a model first, then swap claude for any supported agent below.",
    "noneDetected": "No supported agent CLIs were found on your PATH.",
    "installed": "Installed"
  },
  "supportedAgents": {
    "title": "Supported agents",
    "description": "Each agent launches with its own command:",
    "requiresGguf": "Needs a GGUF model"
  },
  "models": {
    "title": "Choosing a model",
    "description": "Pass --model to pick a model and quantization, and --context-length to set the window. Use a quantization suffix, or an explicit --gguf-variant flag.",
    "suffixLabel": "With a quantization suffix",
    "variantLabel": "With an explicit variant flag"
  },
  "options": {
    "title": "Common options",
    "description": "Spartan flags are parsed first; anything it doesn't recognize is passed straight through to the agent.",
    "model": "Select a model. Without --model, Spartan start uses the model currently loaded in Studio and errors if none is loaded.",
    "contextLength": "Set the requested context length (alias: --max-seq-length).",
    "ggufVariant": "Choose the GGUF quantization variant.",
    "loadIn4bit": "Toggle 4-bit loading for Hugging Face models.",
    "tensorParallel": "Toggle tensor-parallel across multiple GPUs.",
    "serve": "Enable or disable the automatic local server.",
    "launch": "Launch the agent, or just print the command and environment.",
    "persist": "Keep Spartan-managed agent storage between runs.",
    "asSubagent": "Keep the parent on its current model and register Spartan as a local subagent (Claude Code, Codex, and OpenCode).",
    "apiKey": "Provide your Spartan API key (or set SPARTAN_API_KEY).",
    "yolo": "Skip approval prompts. Use only in trusted environments."
  },
  "remote": {
    "title": "Connect to a remote Studio",
    "description": "Point Spartan start at a Studio running elsewhere by setting these before launching (or pass --api-key directly):"
  },
  "passthrough": {
    "title": "Passing agent arguments",
    "description": "Arguments after the Spartan flags are forwarded to the agent itself, so native commands like resume still work:"
  },
  "dryRun": {
    "title": "Preview without launching",
    "description": "Add --no-launch to print the environment and command instead of launching the agent. If --model is set, the model may still be resolved and loaded."
  }
} as const;
