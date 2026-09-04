import { authFetch } from "@/features/auth";
import { prepareHfTokenForUse } from "@/features/hf-auth";
import { hubTokenHeader } from "@/features/hub/lib/hub-token-header";
import { isHuggingFaceOffline } from "@/features/hub/lib/network";
import { consumeNativePathToken } from "@/features/native-intents/api";
import { withModelLoadNotice } from "@/lib/model-lifecycle-events";
import type {
  GgufVariantsResponse,
  ListLorasResponse,
  ListModelsResponse,
  LoadModelRequest,
  LoadModelResponse,
  UnloadModelRequest,
  ValidateModelResponse,
} from "../../types/api";
import {
  type GgufVariantsRequestOptions,
  ggufVariantsQuery,
  runBoundedVariantsRequest,
} from "../gguf-variants-request";
import { parseJsonOrThrow } from "./base";

export interface CachedRepoCapabilities {
  can_chat?: boolean;
}

export interface CachedGgufRepo {
  repo_id: string;
  load_id?: string | null;
  size_bytes: number;
  cache_path: string;
  last_modified?: number;
  has_vision?: boolean;
  task?: string | null;
  has_variant_state?: boolean;
  partial?: boolean;
  capabilities?: CachedRepoCapabilities | null;
}

export interface DownloadProgressResponse {
  downloaded_bytes: number;
  completed_bytes: number;
  complete_on_disk: boolean;
  expected_bytes: number;
  progress: number;
  cache_path: string | null;
}

export type ModelLoadPhase = "mmap" | "ready" | null;

export interface LoadProgressResponse {
  phase: ModelLoadPhase;
  bytes_loaded: number;
  bytes_total: number;
  fraction: number;
}

export interface LocalModelInfo {
  id: string;
  display_name: string;
  path: string;
  source: "models_dir" | "hf_cache" | "lmstudio" | "custom";
  model_id?: string | null;
  model_format?: string | null;
  partial?: boolean;
  updated_at?: number | null;
  task?: string | null;
}

interface LocalModelListResponse {
  models_dir: string;
  hf_cache_dir?: string | null;
  lmstudio_dirs: string[];
  models: LocalModelInfo[];
}

export interface CachedModelRepo {
  repo_id: string;
  load_id?: string | null;
  size_bytes: number;
  model_format?: string | null;
  last_modified?: number;
  task?: string | null;
  partial?: boolean;
  single_file?: boolean;
  companion?: boolean;
  cache_path?: string | null;
  capabilities?: CachedRepoCapabilities | null;
  tags?: string[];
  library_name?: string | null;
}

export interface CachedModelPath {
  path: string;
  is_dir: boolean;
}

export interface ScanFolderInfo {
  id: number;
  path: string;
  created_at: string;
  status?: "ok" | "permission_denied" | "missing" | "unreadable" | "partial";
}

export interface BrowseEntry {
  name: string;
  has_models: boolean;
  hidden: boolean;
}

export interface BrowseFoldersResponse {
  current: string;
  parent: string | null;
  entries: BrowseEntry[];
  suggestions: string[];
  truncated?: boolean;
  model_files_here?: number;
}

export interface KvCacheEstimate {
  kv_bytes: number | null;
  weights_bytes: number | null;
  native_context: number | null;
}

export async function listModels(): Promise<ListModelsResponse> {
  const response = await authFetch("/api/models/list");
  return parseJsonOrThrow<ListModelsResponse>(response);
}

export async function listLoras(
  outputsDir?: string,
): Promise<ListLorasResponse> {
  const query = outputsDir
    ? `?${new URLSearchParams({ outputs_dir: outputsDir }).toString()}`
    : "";
  const response = await authFetch(`/api/models/loras${query}`);
  return parseJsonOrThrow<ListLorasResponse>(response);
}

export async function loadModel(
  payload: LoadModelRequest,
  options?: {
    signal?: AbortSignal;
    onRequestStart?: () => void;
  },
): Promise<LoadModelResponse> {
  const preparedToken = await prepareHfTokenForUse(payload.hf_token);
  if (!preparedToken.proceed)
    throw Object.assign(new Error("Model load cancelled."), {
      unslothUserCancelled: true,
    });
  if (options?.signal?.aborted)
    throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
  options?.onRequestStart?.();
  return withModelLoadNotice("chat", payload.model_path ?? null, async () => {
    const response = await authFetch("/api/inference/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        hf_token: preparedToken.token,
        native_path_lease: payload.nativePathLease ?? null,
        nativePathLease: undefined,
      }),
      signal: options?.signal,
    });
    return parseJsonOrThrow<LoadModelResponse>(response, "Model load");
  });
}

export async function validateModel(
  payload: LoadModelRequest,
): Promise<ValidateModelResponse> {
  const preparedToken = await prepareHfTokenForUse(payload.hf_token);
  if (!preparedToken.proceed)
    throw Object.assign(new Error("Model load cancelled."), {
      unslothUserCancelled: true,
    });
  const response = await authFetch("/api/inference/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model_path: payload.model_path,
      native_path_lease: payload.nativePathLease ?? null,
      hf_token: preparedToken.token,
      gguf_variant: payload.gguf_variant ?? null,
      max_seq_length: payload.max_seq_length,
      load_in_4bit: payload.load_in_4bit,
      cache_type_kv: payload.cache_type_kv ?? null,
      tensor_parallel: payload.tensor_parallel ?? false,
      gpu_ids: payload.gpu_ids,
      gpu_memory_mode: payload.gpu_memory_mode,
      gpu_layers: payload.gpu_layers,
      n_parallel: payload.n_parallel,
      ...(payload.llama_extra_args !== undefined
        ? { llama_extra_args: payload.llama_extra_args }
        : {}),
      ...(payload.n_batch != null ? { n_batch: payload.n_batch } : {}),
      ...(payload.n_ubatch != null ? { n_ubatch: payload.n_ubatch } : {}),
      speculative_type: payload.speculative_type ?? null,
      spec_draft_n_max: payload.spec_draft_n_max ?? null,
    }),
  });
  return parseJsonOrThrow<ValidateModelResponse>(response);
}

export async function fetchGgufStagedMetadata(payload: {
  model_path: string;
  gguf_variant?: string | null;
  hf_token?: string | null;
  nativePathToken?: string | null;
}): Promise<{
  contextLength: number | null;
  layerCount: number | null;
  moeLayerCount: number | null;
  isDiffusion: boolean;
  diffusionUnknown: boolean;
}> {
  let nativePathLease: string | null = null;
  if (payload.nativePathToken) {
    try {
      nativePathLease = (
        await consumeNativePathToken(payload.nativePathToken, "validate-model")
      ).nativePathLease;
    } catch {
      return {
        contextLength: null,
        layerCount: null,
        moeLayerCount: null,
        isDiffusion: false,
        diffusionUnknown: true,
      };
    }
  }
  const response = await authFetch("/api/inference/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model_path: payload.model_path,
      gguf_variant: payload.gguf_variant ?? null,
      hf_token: payload.hf_token ?? null,
      native_path_lease: nativePathLease,
      include_context_length: true,
    }),
  });
  const res = await parseJsonOrThrow<ValidateModelResponse>(response);
  return {
    contextLength: res.context_length ?? null,
    layerCount: res.layer_count ?? null,
    moeLayerCount: res.moe_layer_count ?? null,
    isDiffusion: res.is_diffusion ?? false,
    diffusionUnknown: res.diffusion_unknown ?? false,
  };
}

export async function unloadModel(payload: UnloadModelRequest): Promise<void> {
  const response = await authFetch("/api/inference/unload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseJsonOrThrow<unknown>(response, "Model unload");
}

export async function getGgufDownloadProgress(
  repoId: string,
  variant: string,
  expectedBytes: number,
): Promise<{
  downloaded_bytes: number;
  expected_bytes: number;
  progress: number;
  }> {
  const params = new URLSearchParams({
    repo_id: repoId,
    variant,
    expected_bytes: String(expectedBytes),
  });
  const response = await authFetch(
    `/api/models/gguf-download-progress?${params}`,
  );
  return parseJsonOrThrow(response);
}

export async function getDownloadProgress(
  repoId: string,
): Promise<DownloadProgressResponse> {
  const params = new URLSearchParams({ repo_id: repoId });
  const response = await authFetch(`/api/models/download-progress?${params}`);
  return parseJsonOrThrow(response);
}

export async function getDatasetDownloadProgress(
  repoId: string,
): Promise<DownloadProgressResponse> {
  const params = new URLSearchParams({ repo_id: repoId });
  const response = await authFetch(
    `/api/hub/datasets/download-progress?${params}`,
  );
  return parseJsonOrThrow(response);
}

export async function getLoadProgress(): Promise<LoadProgressResponse> {
  const response = await authFetch("/api/inference/load-progress");
  return parseJsonOrThrow(response);
}

export async function listLocalModels(
  signal?: AbortSignal,
): Promise<LocalModelListResponse> {
  const response = await authFetch("/api/models/local", { signal });
  return parseJsonOrThrow<LocalModelListResponse>(response);
}

export async function listCachedGguf(
  signal?: AbortSignal,
): Promise<CachedGgufRepo[]> {
  const response = await authFetch("/api/hub/cached-gguf", { signal });
  const data = await parseJsonOrThrow<{ cached: CachedGgufRepo[] }>(response);
  return data.cached;
}

export async function listCachedModels(
  hfToken?: string | null,
  signal?: AbortSignal,
): Promise<CachedModelRepo[]> {
  const response = await authFetch("/api/hub/cached-models", {
    headers: hubTokenHeader(hfToken),
    signal,
  });
  const data = await parseJsonOrThrow<{ cached: CachedModelRepo[] }>(response);
  return data.cached;
}

export async function getCachedModelPath(
  repoId: string,
  variant?: string,
): Promise<CachedModelPath> {
  const params = new URLSearchParams({ repo_id: repoId });
  if (variant) params.set("variant", variant);
  const response = await authFetch(
    `/api/models/cached-model-path?${params.toString()}`,
  );
  return parseJsonOrThrow<CachedModelPath>(response);
}

export async function revealCachedModel(
  repoId: string,
  variant?: string,
): Promise<void> {
  const payload: Record<string, string> = { repo_id: repoId };
  if (variant) payload.variant = variant;
  const response = await authFetch("/api/models/reveal-cached-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseJsonOrThrow<unknown>(response);
}

export async function deleteFineTunedModel(args: {
  modelPath: string;
  source: "training" | "exported";
  exportType?: "lora" | "merged" | "gguf";
  ggufVariant?: string;
}): Promise<void> {
  const response = await authFetch("/api/models/delete-finetuned", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model_path: args.modelPath,
      source: args.source,
      export_type: args.exportType ?? null,
      gguf_variant: args.ggufVariant ?? null,
    }),
  });
  await parseJsonOrThrow<unknown>(response);
}

export async function listScanFolders(): Promise<ScanFolderInfo[]> {
  const response = await authFetch("/api/models/scan-folders");
  const data = await parseJsonOrThrow<{ folders: ScanFolderInfo[] }>(response);
  return data.folders;
}

export async function addScanFolder(path: string): Promise<ScanFolderInfo> {
  const response = await authFetch("/api/models/scan-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return parseJsonOrThrow<ScanFolderInfo>(response);
}

export async function removeScanFolder(id: number): Promise<void> {
  const response = await authFetch(`/api/models/scan-folders/${id}`, {
    method: "DELETE",
  });
  await parseJsonOrThrow<unknown>(response);
}

export async function listRecommendedFolders(): Promise<string[]> {
  const response = await authFetch("/api/models/recommended-folders");
  const data = await parseJsonOrThrow<{ folders: string[] }>(response);
  return data.folders;
}

export async function browseFolders(
  path?: string,
  showHidden = false,
  signal?: AbortSignal,
): Promise<BrowseFoldersResponse> {
  const params = new URLSearchParams();
  if (path !== undefined && path !== null) params.set("path", path);
  if (showHidden) params.set("show_hidden", "true");
  const qs = params.toString();
  const response = await authFetch(
    `/api/models/browse-folders${qs ? `?${qs}` : ""}`,
    signal ? { signal } : undefined,
  );
  return parseJsonOrThrow<BrowseFoldersResponse>(response);
}

export async function listGgufVariants(
  repoId: string,
  hfToken?: string,
  options?: GgufVariantsRequestOptions,
): Promise<GgufVariantsResponse> {
  const params = ggufVariantsQuery(repoId, options, isHuggingFaceOffline());
  return runBoundedVariantsRequest(options?.signal, async (signal) => {
    const response = await authFetch(`/api/models/gguf-variants?${params}`, {
      headers: hubTokenHeader(hfToken),
      signal,
    });
    return parseJsonOrThrow<GgufVariantsResponse>(response);
  });
}

export async function estimateKvCache(
  repoId: string,
  quant: string,
  nCtx: number,
  cacheTypeKv?: string | null,
  signal?: AbortSignal,
): Promise<KvCacheEstimate> {
  const params = new URLSearchParams({
    repo_id: repoId,
    quant,
    n_ctx: String(nCtx),
  });
  if (cacheTypeKv) params.set("cache_type_kv", cacheTypeKv);
  const response = await authFetch(
    `/api/models/kv-cache-estimate?${params}`,
    signal ? { signal } : undefined,
  );
  return parseJsonOrThrow<KvCacheEstimate>(response);
}
