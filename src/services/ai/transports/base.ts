import type { AIProvider } from '../types'

export abstract class BaseTransport implements AIProvider {
  abstract readonly vendor: AIProvider['vendor']
  abstract readonly kind: AIProvider['kind']

  abstract listModels(): ReturnType<AIProvider['listModels']>
  abstract testConnection(): ReturnType<AIProvider['testConnection']>
  abstract streamChat(req: Parameters<AIProvider['streamChat']>[0]): ReturnType<AIProvider['streamChat']>
}
