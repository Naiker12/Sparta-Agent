import { translate as uiTranslate } from "@/i18n";
import { isTauri } from "@/lib/api-base";
import type {
  NativeIntent,
  NativePathLeaseResponse,
  NativePathOperation,
} from "./types";

async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri) {
    throw new Error(
      uiTranslate("ui.native_desktop_features_are_only_available_in_the_tauri_app"),
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export interface NativeDocumentFolderSelection {
  /** Opaque directory lease. This is deliberately not a filesystem path. */
  token: string;
  displayName: string;
}

export async function pickNativeDocumentFolder(): Promise<NativeDocumentFolderSelection | null> {
  if (!isTauri) {
    throw new Error(
      uiTranslate("ui.persistent_local_folder_sync_is_only_available_in_the_desktop_app"),
    );
  }
  return invokeNative<NativeDocumentFolderSelection | null>(
    "pick_native_document_folder",
  );
}

export async function drainNativeIntents(): Promise<NativeIntent[]> {
  if (!isTauri) {
    return [];
  }
  return invokeNative<NativeIntent[]>("drain_native_intents");
}

export async function pickHuggingFaceCacheDir(): Promise<string | null> {
  if (!isTauri) {
    return null;
  }
  return invokeNative<string | null>("pick_hugging_face_cache_dir");
}

export async function registerNativeModelPath(
  path: string,
): Promise<NativeIntent> {
  return invokeNative<NativeIntent>("register_native_model_path", { path });
}

export async function registerNativeAttachmentPath(
  path: string,
): Promise<NativeIntent> {
  return invokeNative<NativeIntent>("register_native_attachment_path", {
    path,
  });
}

export async function registerNativeDatasetPath(
  path: string,
): Promise<NativeIntent> {
  return invokeNative<NativeIntent>("register_native_dataset_path", { path });
}

export async function readNativeAttachmentFile(
  token: string,
): Promise<{ name: string; mimeType: string; base64: string }> {
  return invokeNative<{ name: string; mimeType: string; base64: string }>(
    "read_native_attachment_file",
    { token },
  );
}

export async function consumeNativePathToken(
  token: string,
  operation: NativePathOperation,
): Promise<NativePathLeaseResponse> {
  return invokeNative<NativePathLeaseResponse>("consume_native_path_token", {
    token,
    operation,
  });
}

export async function revealPathToken(token: string): Promise<void> {
  return invokeNative<void>("reveal_path_token", { token });
}

export async function openPathToken(token: string): Promise<void> {
  return invokeNative<void>("open_path_token", { token });
}

// Open a backend-resolved directory in the OS file manager; Tauri validates it is a real directory.
export async function openModelsDir(path: string): Promise<void> {
  return invokeNative<void>("open_models_dir", { path });
}
