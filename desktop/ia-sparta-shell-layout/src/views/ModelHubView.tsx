import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  RotateCw,
  SlidersHorizontal,
  Settings,
  X,
  Layers,
} from 'lucide-react'
import { useSettingsStore, useTheme } from 'ia-sparta-core'
import type { ModelHubItem, HubTab, ScannedModelFile } from './model-hub/types'
import { HUGGING_FACE_CATALOG } from './model-hub/catalog'
import { LocalWeightsScanner } from './model-hub/LocalWeightsScanner'
import { ModelCard } from './model-hub/ModelCard'
import { ModelDetailPanel } from './model-hub/ModelDetailPanel'

export function ModelHubView() {
  const { isDark } = useTheme()
  const { activeModel, setDefaultModel } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<HubTab>('discover')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<string>('GGUF')
  const [selectedCapability, setSelectedCapability] = useState<string>('all')
  const [selectedSort, setSelectedSort] = useState<string>('newest')
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [scannedPath, setScannedPath] = useState('D:\\sparta-agent\\models')
  const [dynamicLocalModels, setDynamicLocalModels] = useState<ModelHubItem[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('deepseek-v4-pro-0813')

  // Auto-scan D:\sparta-agent\models on mount if electron is available
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron?.invoke) {
      window.electron.invoke('fs:scanModelWeights', 'D:\\sparta-agent\\models')
        .then((res: any) => {
          if (res && res.success && res.models && res.models.length > 0) {
            handleModelsDiscovered(res.models, 'D:\\sparta-agent\\models')
          }
        })
        .catch(() => {})
    }
  }, [])

  function handleModelsDiscovered(scanned: ScannedModelFile[], path: string) {
    setScannedPath(path)
    const converted: ModelHubItem[] = scanned.map((s, idx) => {
      let vendor = 'unsloth'
      const lower = s.name.toLowerCase()
      if (lower.includes('deepseek')) vendor = 'deepseek'
      else if (lower.includes('qwen')) vendor = 'qwen'
      else if (lower.includes('llama')) vendor = 'meta'
      else if (lower.includes('mistral') || lower.includes('codestral')) vendor = 'mistral'
      else if (lower.includes('phi')) vendor = 'microsoft'
      else if (lower.includes('gemma')) vendor = 'google'
      else if (lower.includes('kimi')) vendor = 'kimi'

      return {
        id: `local-scanned-${idx}-${s.name}`,
        name: s.name,
        displayName: s.name.replace(/[-_]/g, ' '),
        author: 'unsloth',
        authorVerified: true,
        vendor,
        description: `Pesos locales cuantizados (${s.format} ${s.quantization}) cargados directamente desde ${s.path}.`,
        category: 'local',
        format: s.format,
        size: s.size,
        params: s.quantization || 'Local Quant',
        vramReqQ4: s.size,
        vramReqQ8: s.size,
        contextWindow: 'Auto',
        capabilities: { reasoning: true, code: true, tools: true, vision: false },
        likes: 'Local',
        downloads: 'Ready',
        updatedAt: s.lastModified || 'En tu PC',
        license: 'local',
        tags: ['Local Weights', s.format, s.quantization || 'GGUF'],
        quants: [
          { name: `${s.quantization || 'Direct'} • ${s.format}`, size: s.size, format: s.format, recommended: true },
        ],
        localPath: s.path,
        isLocalAvailable: true,
        ollamaCommand: s.format === 'GGUF' ? `ollama run ${s.name.split('.')[0]}` : undefined,
        vllmCommand: `vllm serve "${s.path}" --port 8000`,
      }
    })

    setDynamicLocalModels(converted)
  }

  // Unified Catalog
  const allModels = useMemo(() => {
    const combined = [...dynamicLocalModels, ...HUGGING_FACE_CATALOG]
    const seen = new Set<string>()
    return combined.filter((m) => {
      const key = m.localPath || m.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [dynamicLocalModels])

  // Filtering
  const filteredModels = useMemo(() => {
    return allModels.filter((item) => {
      if (activeTab === 'on_device' && !item.isLocalAvailable) return false

      // Format filter
      if (selectedFormat !== 'all' && selectedFormat !== 'GGUF') {
        if (item.format !== selectedFormat) return false
      }

      // Capability filter
      if (selectedCapability === 'reasoning' && !item.capabilities?.reasoning) return false
      if (selectedCapability === 'code' && !item.capabilities?.code) return false
      if (selectedCapability === 'conversational' && item.category !== 'conversational') return false

      // Search query
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        item.displayName.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
      )
    })
  }, [allModels, activeTab, selectedFormat, selectedCapability, searchQuery])

  // Currently selected item
  const currentSelectedModel = useMemo(() => {
    const found = filteredModels.find((m) => m.id === selectedModelId)
    return found || filteredModels[0] || null
  }, [filteredModels, selectedModelId])

  // Dynamic theme variables
  const containerBg = isDark ? '#090B0E' : '#F7F4EE'
  const headerBg = isDark ? '#0E1117' : '#FAF8F5'
  const subheaderBg = isDark ? '#0C0E14' : '#FAF8F5'
  const borderPrimary = isDark ? '#1A1F2B' : '#EAE3D8'
  const borderSecondary = isDark ? '#171B26' : '#EAE3D8'
  const inputBg = isDark ? '#151923' : '#FFFFFF'
  const inputBorder = isDark ? '#222938' : '#DED7CB'
  const textPrimary = isDark ? '#FFFFFF' : '#1C1713'
  const textSecondary = isDark ? '#94A3B8' : '#786C5E'

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: containerBg,
        color: textPrimary,
        overflow: 'hidden',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* 1. TOP HEADER (Title + System Telemetry Badges) */}
      <div
        style={{
          padding: '16px 28px',
          borderBottom: `1px solid ${borderPrimary}`,
          backgroundColor: headerBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: textPrimary,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Model hub
          </h1>
          <p style={{ fontSize: 12, color: textSecondary, margin: '2px 0 0 0' }}>
            Discover, download, and run inference models locally.
          </p>
        </div>

        {/* System Telemetry & Resource Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Protocol Modes */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: 6,
              padding: '2px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#EF4444' }} />
              Auto
            </span>
            <span style={{ padding: '3px 8px', color: textSecondary }}>HTTP</span>
            <span style={{ padding: '3px 8px', color: textSecondary }}>Xet</span>
          </div>

          {/* Cache & Local Counts */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              fontSize: 11,
              color: textSecondary,
              fontFamily: 'monospace',
            }}
          >
            <span>📦 2 Cache</span>
            <span style={{ color: isDark ? '#475569' : '#CBD5E1' }}>|</span>
            <span style={{ color: dynamicLocalModels.length > 0 ? '#10B981' : textSecondary }}>
              📁 {dynamicLocalModels.length} Local
            </span>
          </div>

          {/* Hardware Specs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 6,
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              fontSize: 11,
              color: textSecondary,
              fontFamily: 'monospace',
            }}
          >
            <span style={{ color: textSecondary }}>⚡ Unavailable VRAM</span>
            <span style={{ color: isDark ? '#475569' : '#CBD5E1' }}>•</span>
            <span style={{ color: '#0284C7' }}>💻 12 GiB RAM</span>
            <span style={{ color: isDark ? '#475569' : '#CBD5E1' }}>•</span>
            <span style={{ color: textPrimary }}>⚙️ 4/8 CPU</span>
          </div>
        </div>
      </div>

      {/* 2. SUBHEADER FILTER & CONTROL BAR */}
      <div
        style={{
          padding: '12px 28px',
          borderBottom: `1px solid ${borderSecondary}`,
          backgroundColor: subheaderBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Discover vs On Device Segmented Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? '#151923' : '#F0ECE4',
              border: `1px solid ${inputBorder}`,
              borderRadius: 8,
              padding: 3,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('discover')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                backgroundColor: activeTab === 'discover' ? (isDark ? '#252D3D' : '#FFFFFF') : 'transparent',
                color: activeTab === 'discover' ? textPrimary : textSecondary,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeTab === 'discover' && !isDark ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              Discover
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('on_device')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                backgroundColor: activeTab === 'on_device' ? (isDark ? '#252D3D' : '#FFFFFF') : 'transparent',
                color: activeTab === 'on_device' ? textPrimary : textSecondary,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeTab === 'on_device' && !isDark ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              On Device {dynamicLocalModels.length > 0 && `(${dynamicLocalModels.length})`}
            </button>
          </div>

          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              width: 260,
            }}
          >
            <Search size={13} color={textSecondary} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all models"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 12,
                color: textPrimary,
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: textSecondary }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Dropdowns (GGUF, Capabilities, Sorting) & Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Format Dropdown */}
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: 7,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: textPrimary,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="GGUF">GGUF</option>
            <option value="all">All Formats</option>
            <option value="Safetensors">Safetensors</option>
            <option value="LoRA">LoRA</option>
          </select>

          {/* Capabilities Dropdown */}
          <select
            value={selectedCapability}
            onChange={(e) => setSelectedCapability(e.target.value)}
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: 7,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: textPrimary,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All capabilities</option>
            <option value="reasoning">Reasoning (CoT)</option>
            <option value="code">Coding & Dev</option>
            <option value="conversational">Conversational</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: 7,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: textPrimary,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="newest">Newest</option>
            <option value="downloads">Most Downloads</option>
            <option value="likes">Most Likes</option>
          </select>

          {/* Settings button */}
          <button
            type="button"
            title="Ajustes de Escaneo de Modelos Locales"
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            style={{
              backgroundColor: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: 7,
              padding: '6px 8px',
              color: textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Optional Scanner Bar if Settings Drawer is opened or activeTab is on_device */}
      {(showSettingsDrawer || activeTab === 'on_device') && (
        <div style={{ padding: '14px 28px', backgroundColor: isDark ? '#0A0D12' : '#F5EFE6', borderBottom: `1px solid ${borderSecondary}` }}>
          <LocalWeightsScanner
            currentPath={scannedPath}
            scannedCount={dynamicLocalModels.length}
            onModelsDiscovered={handleModelsDiscovered}
          />
        </div>
      )}

      {/* 3. TWO-COLUMN MASTER-DETAIL MAIN BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Column: Latest Unsloth Models List */}
        <div
          style={{
            width: 360,
            borderRight: `1px solid ${borderSecondary}`,
            backgroundColor: isDark ? '#0C0E14' : '#F5EFE6',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* List Header */}
          <div
            style={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${borderSecondary}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: textPrimary,
                  letterSpacing: '-0.01em',
                }}
              >
                {activeTab === 'on_device' ? 'Pesos Locales en Disco' : 'Latest Unsloth Models'}
              </span>
              <button
                type="button"
                title="Actualizar catálogo"
                style={{
                  background: 'none',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RotateCw size={12} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textSecondary }}>
              <SlidersHorizontal size={13} style={{ cursor: 'pointer' }} />
              <Layers size={13} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* List Items */}
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredModels.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: textSecondary, fontSize: 12 }}>
                No se encontraron modelos con los filtros seleccionados.
              </div>
            ) : (
              filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={currentSelectedModel?.id === model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  onSelect={() => setDefaultModel(model.name)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Selected Model Details / Inspector & Readme */}
        <ModelDetailPanel
          model={currentSelectedModel}
          onUseModel={(modelName) => setDefaultModel(modelName)}
          activeModelName={activeModel}
        />
      </div>
    </div>
  )
}
