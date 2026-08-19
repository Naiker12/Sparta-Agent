import type { ProviderVendor } from 'ia-sparta-core'

export interface ModelQuantOption {
  name: string
  format: string
  size: string
  recommended?: boolean
  unavailable?: boolean
}

export interface ModelHubItem {
  id: string
  name: string
  displayName: string
  author: string
  authorVerified?: boolean
  description: string
  category: 'reasoning' | 'code' | 'general' | 'conversational' | 'vision' | 'local'
  format: 'GGUF' | 'Safetensors' | 'LoRA' | 'PyTorch' | 'Checkpoint' | 'API Cloud'
  size: string
  params: string
  vramReqQ4: string
  vramReqQ8: string
  contextWindow: string
  capabilities: { reasoning: boolean; code: boolean; tools: boolean; vision: boolean }
  vendor: string
  likes?: number | string
  downloads?: string
  updatedAt?: string
  releaseDate?: string
  tags?: string[]
  license?: string
  quants?: ModelQuantOption[]
  guideTitle?: string
  guideNote?: string
  bulletPoints?: string[]
  externalLinks?: Array<{ label: string; url: string }>
  huggingFaceUrl?: string
  ollamaCommand?: string
  vllmCommand?: string
  downloadCommand?: string
  localPath?: string
  isLocalAvailable?: boolean
  providerVendor?: ProviderVendor
}

export type HubTab = 'discover' | 'on_device' | 'all'

export interface ScannedModelFile {
  name: string
  path: string
  size: string
  sizeBytes: number
  format: 'GGUF' | 'Safetensors' | 'LoRA' | 'PyTorch' | 'Checkpoint'
  quantization: string
  lastModified: string
}
