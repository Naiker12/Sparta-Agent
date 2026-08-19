import { useState, useEffect, useMemo } from 'react'
import {
  X,
  Search,
  ExternalLink,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Info,
} from 'lucide-react'
import type { ProviderVendor, Provider } from 'ia-sparta-core'
import {
  useProviderStore,
  useSettingsStore,
  useSessionStore,
  getVendorLabel,
  fetchModelsByVendor,
} from 'ia-sparta-core'
import { storeInVault, getProviderKey } from 'ia-sparta-platform'
import { BrandIcon } from 'ia-sparta-design-system'

export type ProviderCategory = 'todos' | 'locales' | 'cloud' | 'gateways'

export interface VendorCatalogItem {
  vendor: ProviderVendor
  name: string
  category: 'locales' | 'cloud' | 'gateways'
  sublabel: string
  docsUrl: string
  defaultUrl: string
  requiresKey: boolean
  instructions: string
  defaultModels?: string[]
}

export const VENDOR_CATALOG: VendorCatalogItem[] = [
  {
    vendor: 'ollama',
    name: 'Ollama',
    category: 'locales',
    sublabel: 'Local Offline',
    docsUrl: 'https://ollama.ai',
    defaultUrl: 'http://localhost:11434',
    requiresKey: false,
    instructions: 'Instala Ollama y ejecuta `ollama run llama3.3` o `ollama run deepseek-r1:8b` en tu terminal.',
    defaultModels: [
      'deepseek-r1:8b',
      'deepseek-r1:70b',
      'deepseek-r1:14b',
      'qwen2.5-coder:32b',
      'qwen2.5-coder:14b',
      'qwen2.5-coder:7b',
      'llama3.3:70b',
      'llama3.2:3b',
      'llama3.2-vision:11b',
      'mistral-small',
      'phi4',
      'gemma2:9b',
      'codellama:34b',
    ],
  },
  {
    vendor: 'lmstudio',
    name: 'LM Studio',
    category: 'locales',
    sublabel: 'Local Offline',
    docsUrl: 'https://lmstudio.ai',
    defaultUrl: 'http://localhost:1234/v1',
    requiresKey: false,
    instructions: 'Inicia el servidor local en LM Studio en la pestaña "Local Server" (puerto 1234 por defecto).',
    defaultModels: [
      'qwen2.5-coder-32b-instruct',
      'deepseek-r1-distill-qwen-8b',
      'llama-3.3-70b-instruct',
      'phi-4',
      'mistral-small-24b-instruct',
      'gemma-2-9b-it',
    ],
  },
  {
    vendor: 'unsloth',
    name: 'Unsloth AI & Pesos Locales',
    category: 'locales',
    sublabel: 'Local Offline',
    docsUrl: 'https://unsloth.ai',
    defaultUrl: 'http://localhost:8000/v1',
    requiresKey: false,
    instructions: 'Inferencia ultra-optimizada con pesos fine-tuneados o cuantizados mediante servidor local vLLM / GGUF.',
    defaultModels: [
      'unsloth/DeepSeek-R1-Distill-Qwen-8B-GGUF',
      'unsloth/Qwen2.5-Coder-32B-Instruct-GGUF',
      'unsloth/Llama-3.3-70B-Instruct-bnb-4bit',
      'unsloth/DeepSeek-R1-Distill-Llama-70B-GGUF',
      'unsloth/phi-4-GGUF',
    ],
  },
  {
    vendor: 'custom',
    name: 'vLLM / Servidor Local',
    category: 'locales',
    sublabel: 'Local Offline',
    docsUrl: 'https://docs.vllm.ai',
    defaultUrl: 'http://localhost:8000/v1',
    requiresKey: false,
    instructions: 'Inicia vLLM con `vllm serve <modelo>` o apunta a cualquier endpoint local compatible con OpenAI.',
    defaultModels: [
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'deepseek-ai/DeepSeek-R1-Distill-Qwen-8B',
      'meta-llama/Llama-3.3-70B-Instruct',
      'mistralai/Mistral-Small-24B-Instruct-2501',
    ],
  },
  {
    vendor: 'huggingface',
    name: 'Hugging Face Inference',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://huggingface.co/docs/api-inference',
    defaultUrl: 'https://api-inference.huggingface.co/v1',
    requiresKey: true,
    instructions: 'Genera tu User Access Token en huggingface.co/settings/tokens para acceder a miles de modelos.',
    defaultModels: [
      'deepseek-ai/DeepSeek-R1-Distill-Qwen-8B',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct',
      'mistralai/Mistral-Small-24B-Instruct-2501',
      'google/gemma-2-9b-it',
      'microsoft/phi-4',
    ],
  },
  {
    vendor: 'openai',
    name: 'OpenAI',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://platform.openai.com/docs',
    defaultUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    instructions: 'Genera tu API key en platform.openai.com/api-keys para acceder a GPT-4o, o1, o3-mini.',
    defaultModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
    ],
  },
  {
    vendor: 'anthropic',
    name: 'Anthropic Claude',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://docs.anthropic.com',
    defaultUrl: 'https://api.anthropic.com/v1',
    requiresKey: true,
    instructions: 'Obtén tu API key en console.anthropic.com/settings/keys para usar Claude 3.7 y Claude 3.5.',
    defaultModels: [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
  {
    vendor: 'google',
    name: 'Google Gemini',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://ai.google.dev',
    defaultUrl: 'https://generativelanguage.googleapis.com',
    requiresKey: true,
    instructions: 'Crea tu clave en Google AI Studio (aistudio.google.com) con cuota gratuita disponible.',
    defaultModels: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
  },
  {
    vendor: 'deepseek',
    name: 'DeepSeek',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://platform.deepseek.com',
    defaultUrl: 'https://api.deepseek.com/v1',
    requiresKey: true,
    instructions: 'Crea tu API Key en platform.deepseek.com/api_keys para usar DeepSeek-R1 y V3.',
    defaultModels: [
      'deepseek-reasoner',
      'deepseek-chat',
      'deepseek-coder',
    ],
  },
  {
    vendor: 'groq',
    name: 'Groq',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://console.groq.com',
    defaultUrl: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    instructions: 'Obtén tu clave de inferencia ultrarrápida LPU en console.groq.com/keys.',
    defaultModels: [
      'deepseek-r1-distill-llama-70b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'qwen-2.5-coder-32b',
    ],
  },
  {
    vendor: 'openrouter',
    name: 'OpenRouter',
    category: 'gateways',
    sublabel: 'Gateway Cloud',
    docsUrl: 'https://openrouter.ai/docs',
    defaultUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    instructions: 'Enruta cientos de modelos open-source y comerciales con una sola clave en openrouter.ai/keys.',
    defaultModels: [
      'deepseek/deepseek-r1',
      'deepseek/deepseek-chat',
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct',
      'qwen/qwen-2.5-coder-32b-instruct',
      'google/gemini-2.0-flash-exp:free',
      'z-ai/glm-5.3',
      'mistralai/mistral-large-2411',
    ],
  },
  {
    vendor: 'mistral',
    name: 'Mistral AI',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://docs.mistral.ai',
    defaultUrl: 'https://api.mistral.ai/v1',
    requiresKey: true,
    instructions: 'Obtén tu API key en console.mistral.ai/api-keys para Mistral Large y Codestral.',
    defaultModels: [
      'mistral-large-latest',
      'codestral-latest',
      'mistral-small-latest',
      'pixtral-large-latest',
    ],
  },
  {
    vendor: 'xai',
    name: 'xAI (Grok)',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://docs.x.ai',
    defaultUrl: 'https://api.x.ai/v1',
    requiresKey: true,
    instructions: 'Obtén tu API key en console.x.ai para usar Grok 2.',
    defaultModels: [
      'grok-2-latest',
      'grok-2-vision-latest',
      'grok-beta',
    ],
  },
  {
    vendor: 'together',
    name: 'Together AI',
    category: 'gateways',
    sublabel: 'Gateway Cloud',
    docsUrl: 'https://docs.together.ai',
    defaultUrl: 'https://api.together.xyz/v1',
    requiresKey: true,
    instructions: 'Obtén tu clave en api.together.xyz/settings/api-keys.',
    defaultModels: [
      'deepseek-ai/DeepSeek-R1',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'mistralai/Mistral-Small-24B-Instruct-2501',
    ],
  },
  {
    vendor: 'fireworks',
    name: 'Fireworks AI',
    category: 'gateways',
    sublabel: 'Gateway Cloud',
    docsUrl: 'https://docs.fireworks.ai',
    defaultUrl: 'https://api.fireworks.ai/inference/v1',
    requiresKey: true,
    instructions: 'Obtén tu API key en fireworks.ai/account/api-keys.',
    defaultModels: [
      'accounts/fireworks/models/deepseek-r1',
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/qwen2p5-coder-32b-instruct',
    ],
  },
  {
    vendor: 'cohere',
    name: 'Cohere',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://docs.cohere.com',
    defaultUrl: 'https://api.cohere.ai/v1',
    requiresKey: true,
    instructions: 'Genera tu API key en dashboard.cohere.com/api-keys.',
    defaultModels: [
      'command-r-plus-08-2024',
      'command-r-plus',
      'command-r-08-2024',
      'command-r',
    ],
  },
  {
    vendor: 'perplexity',
    name: 'Perplexity',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://docs.perplexity.ai',
    defaultUrl: 'https://api.perplexity.ai/v1',
    requiresKey: true,
    instructions: 'Genera tu API key en perplexity.ai/settings/api.',
    defaultModels: [
      'sonar-pro',
      'sonar',
      'sonar-reasoning',
      'sonar-reasoning-pro',
    ],
  },
  {
    vendor: 'nvidia',
    name: 'NVIDIA NIM',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://build.nvidia.com',
    defaultUrl: 'https://integrate.api.nvidia.com/v1',
    requiresKey: true,
    instructions: 'Obtén tu clave de inferencia acelerada en build.nvidia.com.',
    defaultModels: [
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'qwen/qwen2.5-coder-32b-instruct',
    ],
  },
  {
    vendor: 'azure',
    name: 'Azure OpenAI',
    category: 'cloud',
    sublabel: 'API Cloud',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai',
    defaultUrl: '',
    requiresKey: true,
    instructions: 'Configura tu endpoint y clave de recurso de Azure OpenAI Foundry.',
    defaultModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o1-mini',
      'o1-preview',
    ],
  },
]

interface AIProviderModalProps {
  open: boolean
  initialVendor?: ProviderVendor | null
  editProvider?: Provider | null
  onSave?: () => void
  onClose: () => void
}

export function AIProviderModal({
  open,
  initialVendor = 'ollama',
  editProvider,
  onSave,
  onClose,
}: AIProviderModalProps) {
  const { addProvider, updateProvider } = useProviderStore()
  const { setDefaultModel } = useSettingsStore()

  // Master sidebar state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>('todos')
  const [selectedVendorKey, setSelectedVendorKey] = useState<ProviderVendor>(
    editProvider?.vendor || initialVendor || 'ollama',
  )

  // Detail Form state
  const [connectionName, setConnectionName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setModel] = useState('')
  const [setAsActive, setSetAsActive] = useState(true)
  const [revealedKey, setRevealedKey] = useState(false)

  // Testing & Model discovery state
  const [isTesting, setIsTesting] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [testStatus, setTestStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [detectedModels, setDetectedModels] = useState<string[]>([])

  // Find active vendor catalog meta
  const activeMeta = useMemo(() => {
    return (
      VENDOR_CATALOG.find((v) => v.vendor === selectedVendorKey) ||
      VENDOR_CATALOG[0]
    )
  }, [selectedVendorKey])

  // Filter vendors by category and search query
  const filteredVendors = useMemo(() => {
    return VENDOR_CATALOG.filter((item) => {
      const matchesCategory =
        selectedCategory === 'todos' || item.category === selectedCategory
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.vendor.toLowerCase().includes(q) ||
        item.sublabel.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  // Initialize or switch vendor form fields
  useEffect(() => {
    if (editProvider) {
      setSelectedVendorKey(editProvider.vendor)
      setConnectionName(editProvider.label || getVendorLabel(editProvider.vendor))
      setEndpointUrl(editProvider.serverUrl || activeMeta?.defaultUrl || '')
      setModel(editProvider.defaultModel || activeMeta?.defaultModels?.[0] || '')
      getProviderKey(editProvider).then((k) => {
        setApiKey(k || editProvider.apiKey || '')
      })
    } else {
      setConnectionName(activeMeta?.name || getVendorLabel(selectedVendorKey))
      setEndpointUrl(activeMeta?.defaultUrl || '')
      setApiKey('')
      setModel(activeMeta?.defaultModels?.[0] || '')
    }
    setTestStatus(null)
    setDetectedModels([])
    setIsTesting(false)
    setIsDetecting(false)
  }, [selectedVendorKey, editProvider, activeMeta])

  // Lista unificada de todos los modelos disponibles para este proveedor
  const availableModels = useMemo(() => {
    const list = [
      ...detectedModels,
      ...(activeMeta?.defaultModels || []),
    ]
    if (defaultModel && !list.includes(defaultModel)) {
      list.unshift(defaultModel)
    }
    return Array.from(new Set(list.filter(Boolean)))
  }, [detectedModels, activeMeta, defaultModel])

  if (!open) return null

  // Test Connection
  async function handleTestConnection() {
    setIsTesting(true)
    setTestStatus(null)
    try {
      const keyToTest = apiKey.trim()
      const result = await fetchModelsByVendor(selectedVendorKey, keyToTest, endpointUrl.trim())
      if (result.error) {
        setTestStatus({ ok: false, message: result.error })
      } else {
        setTestStatus({
          ok: true,
          message: `Conexión exitosa. Se detectaron ${result.models.length} modelos disponibles.`,
        })
        if (result.models.length > 0) {
          setDetectedModels(result.models)
          if (!defaultModel) {
            setModel(result.models[0])
          }
        }
      }
    } catch (err: any) {
      setTestStatus({ ok: false, message: err?.message || 'Error al probar conexión' })
    } finally {
      setIsTesting(false)
    }
  }

  // Detect Models
  async function handleDetectModels() {
    setIsDetecting(true)
    setTestStatus(null)
    try {
      const keyToTest = apiKey.trim()
      const result = await fetchModelsByVendor(selectedVendorKey, keyToTest, endpointUrl.trim())
      if (result.error) {
        setTestStatus({ ok: false, message: `Error al detectar modelos: ${result.error}` })
      } else if (result.models.length > 0) {
        setDetectedModels(result.models)
        setModel(result.models[0])
        setTestStatus({
          ok: true,
          message: `Se detectaron ${result.models.length} modelos disponibles.`,
        })
      } else {
        setTestStatus({
          ok: false,
          message: 'No se encontraron modelos. Verifica la URL o la API Key.',
        })
      }
    } catch (err: any) {
      setTestStatus({ ok: false, message: err?.message || 'Error al consultar modelos' })
    } finally {
      setIsDetecting(false)
    }
  }

  // Save Provider
  async function handleSave() {
    const cleanLabel = connectionName.trim() || activeMeta.name
    const cleanUrl = endpointUrl.trim() || undefined
    const cleanKey = apiKey.trim() || undefined
    const cleanModel = defaultModel.trim() || undefined

    let providerId = editProvider?.id

    if (editProvider) {
      if (cleanKey) {
        await storeInVault(editProvider.id, cleanKey, editProvider.vendor)
        useSettingsStore.getState().setApiKey(editProvider.vendor, cleanKey)
        updateProvider(editProvider.id, {
          label: cleanLabel,
          apiKey: cleanKey,
          hasVaultKey: true,
          serverUrl: cleanUrl,
          defaultModel: cleanModel,
          models: detectedModels.length > 0 ? detectedModels : editProvider.models,
        })
      } else {
        updateProvider(editProvider.id, {
          label: cleanLabel,
          serverUrl: cleanUrl,
          defaultModel: cleanModel,
          models: detectedModels.length > 0 ? detectedModels : editProvider.models,
        })
      }
    } else {
      providerId = addProvider({
        vendor: selectedVendorKey,
        kind: activeMeta.category === 'locales' ? 'local' : 'cloud',
        label: cleanLabel,
        apiKey: cleanKey,
        serverUrl: cleanUrl,
        defaultModel: cleanModel,
      })

      if (detectedModels.length > 0 && providerId) {
        updateProvider(providerId, { models: detectedModels })
      }

      if (cleanKey && providerId) {
        await storeInVault(providerId, cleanKey, selectedVendorKey)
        useSettingsStore.getState().setApiKey(selectedVendorKey, cleanKey)
        updateProvider(providerId, { hasVaultKey: true })
      }
    }

    if (setAsActive && cleanModel) {
      setDefaultModel(cleanModel)
      const activeSessionId = useSessionStore.getState().activeSessionId
      if (activeSessionId) {
        useSessionStore.getState().updateSessionModel(activeSessionId, cleanModel)
      }
    }

    if (onSave) onSave()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(25, 20, 15, 0.45)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 900,
          maxWidth: '96vw',
          height: '86vh',
          maxHeight: 680,
          minHeight: 500,
          backgroundColor: '#FAF8F5',
          color: '#2A241E',
          borderRadius: 20,
          border: '1px solid #E6DFD5',
          boxShadow: '0 25px 60px -15px rgba(40, 25, 10, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #EBE5DB',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            backgroundColor: '#FAF8F5',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#1C1713',
                margin: '0 0 4px 0',
                letterSpacing: '-0.01em',
              }}
            >
              Proveedores de Inteligencia Artificial
            </h2>
            <p
              style={{
                fontSize: 12.5,
                color: '#786C5E',
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Conecta modelos locales (Ollama, LM Studio, vLLM) o APIs comerciales (OpenAI, Anthropic, Gemini, DeepSeek, Groq).
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#8A7D6F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EFEAE1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Master-Detail Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Left Master Sidebar */}
          <div
            style={{
              width: 280,
              minWidth: 250,
              flexShrink: 0,
              borderRight: '1px solid #EBE5DB',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FAF8F5',
              padding: '14px 14px 8px',
            }}
          >
            {/* Search Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2DBD0',
                borderRadius: 999,
                padding: '6px 12px',
                marginBottom: 10,
              }}
            >
              <Search size={14} color="#9C8F80" />
              <input
                type="text"
                placeholder="Buscar proveedor o modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  width: '100%',
                  background: 'transparent',
                  color: '#2A241E',
                }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
              {(['todos', 'locales', 'cloud', 'gateways'] as ProviderCategory[]).map((cat) => {
                const isCatActive = selectedCategory === cat
                const labels: Record<ProviderCategory, string> = {
                  todos: 'Todos',
                  locales: 'Locales',
                  cloud: 'Cloud',
                  gateways: 'Gateways',
                }
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: isCatActive ? 600 : 500,
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: isCatActive ? '#B45309' : 'transparent',
                      color: isCatActive ? '#FFFFFF' : '#786C5E',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {labels[cat]}
                  </button>
                )
              })}
            </div>

            {/* Provider Items Scroll List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                paddingRight: 2,
              }}
            >
              {filteredVendors.map((item) => {
                const isSelected = selectedVendorKey === item.vendor
                return (
                  <button
                    key={item.vendor}
                    onClick={() => {
                      setSelectedVendorKey(item.vendor)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: isSelected ? '1px solid #D6C8B5' : '1px solid transparent',
                      backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.03)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F0ECE4'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #EBE5DB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BrandIcon vendor={item.vendor} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#2A241E',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#8A7D6F' }}>
                        {item.sublabel}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Detail Pane */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              backgroundColor: '#FAF8F5',
            }}
          >
            {/* Vendor Header Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'nowrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2DBD0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    flexShrink: 0,
                  }}
                >
                  <BrandIcon vendor={activeMeta.vendor} size={24} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1713', whiteSpace: 'nowrap' }}>
                      {activeMeta.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        backgroundColor: activeMeta.requiresKey ? '#F5EBE0' : '#EFEAE1',
                        color: activeMeta.requiresKey ? '#B45309' : '#5C5245',
                        padding: '2px 8px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activeMeta.requiresKey ? 'API Key Requerida' : 'Sin API Key'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#786C5E', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeMeta.category === 'locales'
                      ? 'Servidor local offline-first con soporte para GGUF y modelos open-source.'
                      : activeMeta.category === 'gateways'
                      ? 'Plataforma de acceso unificado a múltiples proveedores e inferencia acelerada.'
                      : 'Servicio de inferencia de IA comercial de alta capacidad.'}
                  </div>
                </div>
              </div>

              {activeMeta.docsUrl && (
                <a
                  href={activeMeta.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5C5245',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2DBD0',
                    padding: '7px 14px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F4EFE6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF'
                  }}
                >
                  <span>Documentación Oficial</span>
                  <ExternalLink size={13} style={{ flexShrink: 0 }} />
                </a>
              )}
            </div>

            {/* Instruction Guide Banner */}
            <div
              style={{
                backgroundColor: '#F5EFE6',
                border: '1px solid #E8DFD3',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <Info size={16} color="#B45309" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#5C5245', lineHeight: 1.45 }}>
                <strong style={{ color: '#B45309' }}>Cómo conectar:</strong> {activeMeta.instructions}
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Field 1: Connection Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#423A31',
                    marginBottom: 6,
                  }}
                >
                  Nombre de la Conexión
                </label>
                <input
                  type="text"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder={activeMeta.name}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: 13,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DED7CB',
                    borderRadius: 8,
                    outline: 'none',
                    color: '#2A241E',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Field 2: API Key (if cloud or gateway) */}
              {activeMeta.requiresKey && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#423A31',
                      }}
                    >
                      API Key
                    </label>
                    <span style={{ fontSize: 10.5, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Shield size={11} /> Cifrado Vault (0600)
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={revealedKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      style={{
                        width: '100%',
                        padding: '9px 36px 9px 12px',
                        fontSize: 13,
                        fontFamily: 'var(--font-mono, monospace)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #DED7CB',
                        borderRadius: 8,
                        outline: 'none',
                        color: '#2A241E',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRevealedKey(!revealedKey)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#8A7D6F',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      {revealedKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Field 3: Endpoint URL */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#423A31',
                    marginBottom: 6,
                  }}
                >
                  Endpoint / Base URL
                </label>
                <input
                  type="text"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder={activeMeta.defaultUrl || 'http://localhost:...'}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: 12.5,
                    fontFamily: 'var(--font-mono, monospace)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #DED7CB',
                    borderRadius: 8,
                    outline: 'none',
                    color: '#2A241E',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Field 4: Default Model + Detect Models */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#423A31',
                    }}
                  >
                    Modelo Predeterminado
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectModels}
                    disabled={isDetecting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#B45309',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {isDetecting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Detectar Modelos
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {availableModels.length > 0 ? (
                    <select
                      value={availableModels.includes(defaultModel) ? defaultModel : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          setModel(e.target.value)
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: 12.5,
                        fontFamily: 'var(--font-mono, monospace)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #DED7CB',
                        borderRadius: 8,
                        outline: 'none',
                        color: '#2A241E',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                      }}
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="__custom__">✏️ Escribir otro modelo manualmente...</option>
                    </select>
                  ) : null}

                  {(!availableModels.includes(defaultModel) || availableModels.length === 0) && (
                    <input
                      type="text"
                      value={defaultModel}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Escribe el nombre exacto del modelo..."
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        fontSize: 12.5,
                        fontFamily: 'var(--font-mono, monospace)',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #DED7CB',
                        borderRadius: 8,
                        outline: 'none',
                        color: '#2A241E',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#8A7D6F',
                    marginTop: 4,
                  }}
                >
                  💡 {activeMeta.requiresKey ? 'Ingresa tu API Key y pulsa' : 'Asegura tu servidor activo y pulsa'}{' '}
                  <strong>"Detectar Modelos"</strong> para listar los modelos reales disponibles en tu cuenta.
                </div>
              </div>

              {/* Field 5: Set as Primary Active Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#2A241E',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={setAsActive}
                  onChange={(e) => setSetAsActive(e.target.checked)}
                  style={{
                    accentColor: '#B45309',
                    width: 16,
                    height: 16,
                    cursor: 'pointer',
                  }}
                />
                Establecer como proveedor activo principal para el Chat
              </label>

              {/* Diagnostic status message */}
              {testStatus && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: testStatus.ok ? '#DCFCE7' : '#FEE2E2',
                    color: testStatus.ok ? '#166534' : '#991B1B',
                    border: `1px solid ${testStatus.ok ? '#86EFAC' : '#FCA5A5'}`,
                  }}
                >
                  {testStatus.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #EBE5DB',
            backgroundColor: '#FAF8F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {/* Test connection action */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 500,
              backgroundColor: '#FFFFFF',
              border: '1px solid #DED7CB',
              borderRadius: 8,
              color: '#423A31',
              cursor: 'pointer',
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F4EFE6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF'
            }}
          >
            {isTesting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Probar Conexión
          </button>

          {/* Dialog confirmation actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: 500,
                backgroundColor: 'transparent',
                border: 'none',
                color: '#5C5245',
                cursor: 'pointer',
                borderRadius: 8,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#EFEAE1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '8px 18px',
                fontSize: 12.5,
                fontWeight: 600,
                backgroundColor: '#B45309',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(180, 83, 9, 0.25)',
                transition: 'background 0.12s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#92400E'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#B45309'
              }}
            >
              Guardar Proveedor
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
