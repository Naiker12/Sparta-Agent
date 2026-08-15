import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Search, AlertCircle } from 'lucide-react'
import { useSettingsStore, useModelPerformanceStore } from 'ia-sparta-core'
import { useProviderStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { BrandIcon } from 'ia-sparta-design-system'

interface ModelOption {
  id: string
  providerLabel: string
  vendor: string
}

function formatModelDisplayName(id: string): string {
  if (!id) return 'Seleccionar modelo'
  // Pretty labels for common model strings
  if (id.includes('gpt-5.6') || id.includes('luna')) return 'GPT-5.6 Luna'
  if (id.includes('gpt-4o')) return 'GPT-4o'
  if (id.includes('gpt-4') && id.includes('mini')) return 'GPT-4o Mini'
  if (id.includes('gpt-4')) return 'GPT-4 Turbo'
  if (id.includes('gpt-3.5')) return 'GPT-3.5 Turbo'
  if (id.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet'
  if (id.includes('claude-3-haiku')) return 'Claude 3 Haiku'
  if (id.includes('gemini-3.1') || id.includes('gemini-3')) return 'Gemini 3.1 Flash Lite'
  if (id.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro'
  if (id.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash'
  if (id.includes('grok-4.1') || id.includes('grok-4')) return 'Grok 4.1 Fast'
  if (id.includes('deepseek-v4') || id.includes('deepseek-v4-flash')) return 'DeepSeek V4 Flash'
  if (id.includes('deepseek-r1')) return 'DeepSeek R1'
  if (id.includes('deepseek-v3') || id.includes('deepseek-chat')) return 'DeepSeek V3'
  if (id.includes('gpt-oss-120b')) return 'GPT-OSS 120B'
  if (id.includes('gpt-oss-20b')) return 'GPT-OSS 20B'
  if (id.includes('llama-3.3')) return 'Llama 3.3 70B'
  if (id.includes('llama-3.1')) return 'Llama 3.1 8B'

  // Clean raw id (remove openrouter prefix or trailing hashes)
  const clean = id.split('/').pop() || id
  return clean.length > 22 ? clean.substring(0, 20) + '…' : clean
}

export function ModelPicker() {
  const providers = useProviderStore((s) => s.providers)
  const { activeModel: globalDefaultModel, setDefaultModel } = useSettingsStore()
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const activeSession = useSessionStore((s) => s.sessions.find((sess) => sess.id === s.activeSessionId))
  const updateSessionModel = useSessionStore((s) => s.updateSessionModel)
  const performance = useModelPerformanceStore((s) => s.byModel)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const currentModel = activeSession?.model || globalDefaultModel

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const speedLabel = (modelId: string) => {
    const latency = performance[modelId]?.averageLatencyMs
    if (!latency) return 'sin datos'
    if (latency < 10_000) return 'rápido'
    if (latency < 30_000) return 'normal'
    return 'puede tardar'
  }

  const allModelsRaw: ModelOption[] = providers.flatMap((p) => {
    const ids = p.models?.length ? p.models : (p.defaultModel ? [p.defaultModel] : [])
    return ids.map((id) => ({ id, providerLabel: p.label, vendor: p.vendor }))
  })

  const seen = new Set<string>()
  const allModels: ModelOption[] = []
  for (const m of allModelsRaw) {
    const key = `${m.vendor}:${m.id}`
    if (seen.has(key)) continue
    seen.add(key)
    allModels.push(m)
  }

  const activeModelObj = allModels.find((m) => m.id === currentModel)
  const activeVendor = activeModelObj?.vendor || (currentModel.includes('gpt') ? 'openai' : currentModel.includes('claude') ? 'anthropic' : currentModel.includes('gemini') ? 'google' : currentModel.includes('deepseek') ? 'deepseek' : currentModel.includes('grok') ? 'grok' : 'openai')

  const filteredModels = search.trim()
    ? allModels.filter((m) => m.id.toLowerCase().includes(search.toLowerCase()) || m.providerLabel.toLowerCase().includes(search.toLowerCase()))
    : allModels

  if (allModels.length === 0) {
    return (
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', background: 'none',
          border: '1px solid var(--status-warn)', borderRadius: 999,
          color: 'var(--status-warn)', fontSize: 11.5,
          fontFamily: 'var(--font-ui)', cursor: 'pointer',
        }}
        onClick={() => useSettingsStore.getState().openSettings()}
      >
        <AlertCircle size={12} strokeWidth={1.5} />
        Configura un modelo
      </button>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* ── Trigger Pill Button ── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          height: 28,
          padding: '0 12px 0 10px',
          borderRadius: 999,
          background: open ? 'var(--bg-active)' : 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxShadow: open ? '0 0 0 2px var(--accent-muted)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'var(--bg-hover)'
            e.currentTarget.style.borderColor = 'var(--border-normal)'
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'var(--bg-surface)'
            e.currentTarget.style.borderColor = 'var(--border-subtle)'
          }
        }}
      >
        <BrandIcon vendor={activeVendor} size={15} />
        <span style={{
          whiteSpace: 'nowrap',
          maxWidth: 150,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1,
        }}>
          {formatModelDisplayName(currentModel)}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* ── Floating Dropdown Popover ── */}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            width: 215,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-normal)',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {/* Search Box inside popover */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            padding: '2px 3px 4px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 1,
          }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: 10,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo..."
              style={{
                width: '100%',
                height: 26,
                paddingLeft: 26,
                paddingRight: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* List of Models */}
          <div style={{
            maxHeight: 200,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            paddingRight: 1,
          }}>
            {filteredModels.length === 0 ? (
              <div style={{
                padding: '12px 8px',
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)',
              }}>
                No se encontraron modelos
              </div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.id === currentModel
                return (
                  <button
                    key={`${m.vendor}:${m.id}`}
                    type="button"
                    onClick={() => {
                      if (activeSessionId) {
                        updateSessionModel(activeSessionId, m.id)
                      }
                      setDefaultModel(m.id)
                      setOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '5px 7px',
                      borderRadius: 7,
                      border: 'none',
                      background: isSelected ? 'var(--bg-active)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <BrandIcon vendor={m.vendor} size={14} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: isSelected ? 600 : 500,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2,
                      }}>
                        {formatModelDisplayName(m.id)}
                      </span>
                      <span style={{
                        fontSize: 9.5,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2,
                      }}>
                        {m.providerLabel} · {speedLabel(m.id)}
                      </span>
                    </div>

                    {isSelected && (
                      <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} strokeWidth={2.5} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
