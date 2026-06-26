import type { ProviderVendor, ProviderKind, ModelInfo, ChatRequest, ChatStreamChunk } from '@/interfaces'

export interface AIProvider {
  readonly vendor: ProviderVendor
  readonly kind: ProviderKind
  listModels(): Promise<ModelInfo[]>
  testConnection(): Promise<{ ok: boolean; error?: string }>
  streamChat(req: ChatRequest): AsyncIterable<ChatStreamChunk>
}
