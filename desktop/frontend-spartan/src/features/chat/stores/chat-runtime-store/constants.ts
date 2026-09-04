/**
 * Sparta Agent - Constantes y Claves de Persistencia para Chat Runtime
 * Centraliza todas las claves de localStorage y configuraciones por defecto.
 */

import type { ResearchWebsitePolicy } from "../../types/research";
import type { RagAutoInject, RagMode, RagSource } from "./types";

export const CHAT_REASONING_ENABLED_KEY = "unsloth_chat_reasoning_enabled";
export const CHAT_TOOLS_ENABLED_KEY = "unsloth_chat_tools_enabled";
export const CHAT_CODE_TOOLS_ENABLED_KEY = "unsloth_chat_code_tools_enabled";
export const CHAT_IMAGE_TOOLS_ENABLED_KEY = "unsloth_chat_image_tools_enabled";
export const CHAT_DEEP_RESEARCH_ENABLED_KEY =
  "unsloth_chat_deep_research_enabled";
export const CHAT_DEEP_RESEARCH_WEBSITE_POLICY_KEY =
  "unsloth_chat_deep_research_website_policy";
export const CHAT_DEEP_RESEARCH_MODEL_TIMEOUT_KEY =
  "unsloth_chat_deep_research_model_timeout";
export const CHAT_ARTIFACTS_ENABLED_KEY = "unsloth_chat_artifacts_enabled";
export const CHAT_SHOW_CANVAS_MENU_ITEM_KEY =
  "unsloth_chat_show_canvas_menu_item";
export const CHAT_COLLAPSE_HTML_ARTIFACTS_KEY =
  "unsloth_chat_collapse_html_artifacts";
export const CHAT_ALLOW_ARTIFACT_NETWORK_ACCESS_KEY =
  "unsloth_chat_allow_artifact_network_access";
export const CHAT_MCP_ENABLED_KEY = "unsloth_chat_mcp_enabled";
export const CHAT_CONFIRM_TOOL_CALLS_KEY = "unsloth_chat_confirm_tool_calls";
export const CHAT_EXPAND_QUANTIZATIONS_KEY =
  "unsloth_chat_expand_quantizations";
export const CHAT_SHOW_ALL_QUANTIZATIONS_KEY =
  "unsloth_chat_show_all_quantizations";
export const MODELS_FIT_ON_DEVICE_ONLY_KEY =
  "unsloth_models_fit_on_device_only";
export const CHAT_BYPASS_PERMISSIONS_KEY = "unsloth_chat_bypass_permissions";
export const CHAT_PERMISSION_MODE_KEY = "unsloth_chat_permission_mode";
export const CHAT_WEB_FETCH_TOOLS_ENABLED_KEY =
  "unsloth_chat_web_fetch_tools_enabled";
export const CHAT_RAG_SOURCE_KEY = "unsloth_chat_rag_source";
export const CHAT_RAG_MODE_KEY = "unsloth_chat_rag_mode";
export const CHAT_RAG_TOP_K_KEY = "unsloth_chat_rag_top_k";
export const CHAT_RAG_AUTOINJECT_KEY = "unsloth_chat_rag_autoinject";
export const CHAT_RAG_AUTOINJECT_MIN_SCORE_KEY =
  "unsloth_chat_rag_autoinject_min_score";
export const CHAT_RAG_OCR_KEY = "unsloth_chat_rag_ocr_scanned";
export const CHAT_RAG_CAPTION_KEY = "unsloth_chat_rag_caption_figures";
export const CHAT_SPECULATIVE_TYPE_KEY = "unsloth_chat_speculative_type";
export const CHAT_GPU_MEMORY_MODE_KEY = "unsloth_chat_gpu_memory_mode";
export const LAST_EXTERNAL_CHECKPOINT_KEY = "unsloth_chat_last_external_checkpoint";
export const PENDING_CHAT_ATTACHMENT_KEY = "__pending__";

export const PERSISTED_SPEC_MODES = new Set(["auto", "ngram", "off"]);
export const ATOMIC_SETTING_KEYS = new Set<string>(["ragSource"]);

export const DEFAULT_RAG_SOURCE: RagSource = { type: "thread" };
export const DEFAULT_RAG_MODE: RagMode = "hybrid";
export const DEFAULT_RAG_TOP_K = 5;
export const DEFAULT_RAG_AUTOINJECT: RagAutoInject = "auto";
export const DEFAULT_RAG_AUTOINJECT_MIN_SCORE = 0.7;
export const DEFAULT_RAG_OCR = true;
export const DEFAULT_RAG_CAPTION = true;
export const DEFAULT_RESEARCH_WEBSITE_POLICY: ResearchWebsitePolicy = {
  allowedDomains: [],
  blockedDomains: [],
};
export const DEFAULT_RESEARCH_MODEL_TIMEOUT_SECONDS = 900;
export const SETTINGS_DEBOUNCE_MS = 400;
