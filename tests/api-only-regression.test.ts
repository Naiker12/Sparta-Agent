import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const source = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

describe("API-only product contract", () => {
  test("publishes only cloud providers in the shipped catalog", () => {
    const catalog = JSON.parse(source("providers.catalog.json")) as Record<
      string,
      { kind: string }
    >;

    expect(Object.keys(catalog)).not.toHaveLength(0);
    expect(Object.values(catalog).every((provider) => provider.kind === "cloud")).toBe(true);
    expect(catalog).not.toHaveProperty("ollama");
    expect(catalog).not.toHaveProperty("lmstudio");
  });

  test("installs a lightweight API backend rather than local ML runtimes", () => {
    const requirements = source("desktop/backend-spartan/requirements/studio.txt").toLowerCase();

    for (const forbidden of [
      "torch",
      "transformers",
      "huggingface",
      "unsloth",
      "sentence-transformers",
      "sqlite-vec",
      "whisper",
    ]) {
      expect(requirements).not.toContain(forbidden);
    }
    expect(requirements).toContain("fastapi");
    expect(requirements).toContain("httpx");
  });

  test("rejects local inference before any legacy execution path", () => {
    const inference = source("desktop/backend-spartan/routes/inference.py");
    const rejection = inference.indexOf("Local model execution has been removed");
    const legacyMarker = inference.indexOf("get_llama_cpp_backend", rejection);

    expect(rejection).toBeGreaterThan(-1);
    expect(legacyMarker).toBeGreaterThan(rejection);
  });

  test("package configuration excludes retired local-engine resources", () => {
    const builder = source("electron-builder.config.cjs");

    for (const excluded of [
      "vendor/unsloth-installers",
      "install_whisper_prebuilt.py",
      "routes/rag_pkg/**",
      "routes/export.py",
      "core/training/**",
      "requirements/single-env/**",
    ]) {
      expect(builder).toContain(excluded);
    }
  });

  test("API-only startup does not import an excluded RAG module eagerly", () => {
    const settings = source(
      "desktop/backend-spartan/routes/settings_pkg/router_providers_switch.py",
    );

    const response = settings.indexOf("def _embedding_model_response()");
    const guardedImport = settings.indexOf(
      "from core.rag.config import default_gguf_repo, effective_gguf_repo",
    );

    expect(response).toBeGreaterThan(-1);
    expect(guardedImport).toBeGreaterThan(response);
  });

  test("packaged-app validation derives the release version from package metadata", () => {
    const manifest = JSON.parse(source("package.json")) as {
      scripts?: { build?: string };
    };
    const build = manifest.scripts?.build ?? "";

    // npm no longer exposes npm_package_version to lifecycle scripts on all
    // supported npm versions. The validator already imports package.json, so
    // passing that environment expansion makes Windows release builds look in
    // a literal ${npm_package_version} directory.
    expect(build).toContain("node scripts/check-packaged-app.js");
    expect(build).not.toContain("npm_package_version");
  });

  test("startup language describes API connections, not model loading", () => {
    const messages = source("desktop/frontend-spartan/src/components/tauri/startup-messages.ts");
    const toasts = source("desktop/frontend-spartan/src/lib/toast.ts");

    expect(messages).toContain("Preparing API connections");
    expect(messages).not.toContain('MODELS_STARTUP_MESSAGE = "Loading models..."');
    expect(toasts).toContain("preparando una conexión de proveedor");
  });

  test("chat startup does not poll retired local-model routes", () => {
    const runtime = source(
      "desktop/frontend-spartan/src/features/chat/hooks/use-chat-model-runtime.ts",
    );
    const apiOnlyGuard = runtime.indexOf("Never poll the retired `/api/models/*`");
    const legacyRequest = runtime.indexOf("listModels()", apiOnlyGuard);

    expect(apiOnlyGuard).toBeGreaterThan(-1);
    expect(legacyRequest).toBeGreaterThan(apiOnlyGuard);
    expect(runtime.slice(apiOnlyGuard, legacyRequest)).toContain("return;");
  });

  test("application surfaces do not render the retired local model picker", () => {
    for (const screen of [
      "desktop/frontend-spartan/src/features/chat/chat-page.tsx",
      "desktop/frontend-spartan/src/features/chat/components/compare-content.tsx",
      "desktop/frontend-spartan/src/features/audio/audio-page.tsx",
    ]) {
      expect(source(screen)).not.toContain("<ModelSelector");
    }

    const apiSelector = source(
      "desktop/frontend-spartan/src/features/chat/components/api-provider-model-selector.tsx",
    );
    expect(apiSelector).toContain("Configurar proveedor API");
    expect(apiSelector).not.toContain("En el dispositivo");
    expect(apiSelector).not.toContain("Recomendados");
  });

  test("startup hydrates API providers without Hugging Face or Transformers", () => {
    const bootstrap = source(
      "desktop/frontend-spartan/src/features/credentials/bootstrap.ts",
    );
    const rootRoute = source("desktop/frontend-spartan/src/app/routes/__root.tsx");

    expect(bootstrap).toContain("syncExternalProvidersFromBackend");
    expect(bootstrap).not.toContain("hydrateHfTokenFromBackend");
    expect(rootRoute).not.toContain("HfTokenWarningDialog");
    expect(rootRoute).not.toContain("TransformersUpgradeDialog");
    expect(rootRoute).not.toContain('"/hub"');
  });

  test("the application shell does not mount local-engine banners or downloads", () => {
    const provider = source("desktop/frontend-spartan/src/app/provider.tsx");

    for (const retiredSurface of [
      "LlamaUpdateBanner",
      "DownloadManagerPanel",
      "LoadedModelsIndicator",
      "SttDownloadPrompt",
    ]) {
      expect(provider).not.toContain(retiredSurface);
    }
  });
});
