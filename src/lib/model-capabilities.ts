import type { ProviderVendor } from '@/types'

/**
 * Pattern-based check for thinking/reasoning support.
 *
 * The backend handles thinking differently per vendor:
 * - Anthropic: `thinking.budget_tokens` (Claude 3.7+, 4.x)
 * - Google: `thinking_budget` (Gemini 2.5+)
 * - OpenAI-compatible: `extra_body.reasoning` (o1, o3, o4, GPT-5) or `reasoning_effort` (DeepSeek)
 * - Ollama: ignored entirely (popped and discarded)
 *
 * This function checks the model ID string against known patterns.
 * Returns false for unknown models (conservative default).
 */
export function modelSupportsThinking(modelId: string, vendor?: ProviderVendor): boolean {
  const id = modelId.toLowerCase()

  // Ollama / local: backend explicitly ignores reasoning kwargs
  if (vendor === 'ollama' || vendor === 'lmstudio' || vendor === 'llamacpp' || vendor === 'custom') {
    return false
  }

  // Anthropic: Claude 3.7+ and 4.x support extended thinking
  if (id.includes('claude-3-7') || id.includes('claude-sonnet-4') || id.includes('claude-opus-4')) {
    return true
  }

  // OpenAI: o1, o3, o4, gpt-5 support reasoning
  if (/^(o1|o3|o4|gpt-5)/.test(id)) {
    return true
  }

  // Google: Gemini 2.5+ supports thinking
  if (id.includes('gemini-2.5') || id.includes('gemini-3')) {
    return true
  }

  // DeepSeek: R1 and V3.x support reasoning via reasoning_effort
  if (id.includes('deepseek-r1') || id.includes('deepseek-v3')) {
    return true
  }

  // Qwen3 with thinking mode (if exposed via API)
  if (id.includes('qwen3') && id.includes('thinking')) {
    return true
  }

  return false
}

/**
 * Returns a human-readable reason why thinking is not supported,
 * or null if the model supports it.
 */
export function thinkingUnsupportedReason(modelId: string, vendor?: ProviderVendor): string | null {
  if (modelSupportsThinking(modelId, vendor)) return null

  if (vendor === 'ollama' || vendor === 'lmstudio' || vendor === 'llamacpp' || vendor === 'custom') {
    return 'Los modelos locales no soportan razonamiento habilitado vía API.'
  }

  return 'Este modelo no soporta razonamiento extendido. Probá con Claude 3.7+, o1, o3, Gemini 2.5+ o DeepSeek-R1.'
}
