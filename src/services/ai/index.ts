import type { Provider, AIProvider } from '@/types'
import { AnthropicTransport, ChatCompletionsTransport, OllamaTransport } from './transports'

export function createProvider(provider: Provider): AIProvider {
  switch (provider.vendor) {
    case 'anthropic':
      return new AnthropicTransport(provider.apiKey ?? '')
    case 'ollama':
      return new OllamaTransport(provider.serverUrl)
    case 'lmstudio':
    case 'llamacpp':
    case 'custom':
      return new ChatCompletionsTransport(provider.vendor, provider.apiKey ?? '', provider.serverUrl)
    case 'openai':
    case 'openrouter':
    case 'groq':
    case 'mistral':
    case 'deepseek':
    case 'together':
    case 'fireworks':
    case 'cohere':
    case 'perplexity':
    case 'xai':
      return new ChatCompletionsTransport(provider.vendor, provider.apiKey ?? '')
    default:
      throw new Error(`Unknown vendor/provider: ${provider.vendor}`)
  }
}

export type { AIProvider } from './types'
