import { ChevronDown, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'

export function ModelPicker() {
  const providers = useProviderStore((s) => s.providers)
  const { activeModel, setDefaultModel } = useSettingsStore()

  const availableModels = providers
    .filter((p) => p.defaultModel)
    .map((p) => ({ id: p.defaultModel!, label: `${p.defaultModel} (${p.label})`, providerId: p.id, vendor: p.vendor }))

  const activeProvider = providers.find((p) => p.defaultModel === activeModel)

  if (availableModels.length === 0) {
    return (
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          background: 'none',
          border: '1px solid var(--status-warn)',
          borderRadius: 999,
          color: 'var(--status-warn)',
          fontSize: 11.5,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onClick={() => useSettingsStore.getState().openSettings()}
      >
        <AlertCircle size={11} strokeWidth={1.5} />
        Configura un modelo
      </button>
    )
  }

  const handleSelect = (modelId: string) => {
    try {
      setDefaultModel(modelId)
    } catch (err) {
      console.error('[ModelPicker] Error al seleccionar modelo:', err)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          background: 'none',
          border: '1px solid var(--border-subtle)',
          borderRadius: 999,
          color: 'var(--text-secondary)',
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-normal)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
      >
        {activeProvider ? (
          <BrandIcon vendor={activeProvider.vendor} size={14} />
        ) : (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', flexShrink: 0,
          }} />
        )}
        {activeModel}
        <ChevronDown size={10} strokeWidth={2} style={{ marginLeft: 2 }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8}>
        <DropdownMenuLabel>Select Model</DropdownMenuLabel>
        {availableModels.map((m) => (
          <DropdownMenuItem
            key={m.providerId}
            onClick={() => handleSelect(m.id)}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <BrandIcon vendor={m.vendor} size={16} />
              <div style={{
                display: 'flex',
                flexDirection: 'column',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.id}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label.split('(')[1]?.replace(')', '') || ''}</span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
