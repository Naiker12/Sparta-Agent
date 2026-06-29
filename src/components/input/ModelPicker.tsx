import { AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { useChatStore } from '@/stores/chat.store'
import { BrandIcon } from '@/components/ui/BrandIcon'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'

interface ModelOption {
  id: string
  providerLabel: string
  vendor: string
}

export function ModelPicker() {
  const providers = useProviderStore((s) => s.providers)
  const { activeModel, setDefaultModel } = useSettingsStore()
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const updateSessionModel = useChatStore((s) => s.updateSessionModel)

  const allModels: ModelOption[] = providers.flatMap((p) => {
    const ids = p.models?.length ? p.models : (p.defaultModel ? [p.defaultModel] : [])
    return ids.map((id) => ({ id, providerLabel: p.label, vendor: p.vendor }))
  })

  const modelIds = allModels.map((m) => m.id)
  const activeVendor = allModels.find((m) => m.id === activeModel)?.vendor

  if (allModels.length === 0) {
    return (
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', background: 'none',
          border: '1px solid var(--status-warn)', borderRadius: 999,
          color: 'var(--status-warn)', fontSize: 11.5,
          fontFamily: 'var(--font-ui)', cursor: 'pointer',
        }}
        onClick={() => useSettingsStore.getState().openSettings()}
      >
        <AlertCircle size={11} strokeWidth={1.5} />
        Configura un modelo
      </button>
    )
  }

  return (
    <Combobox
      items={modelIds}
      value={activeModel}
      onValueChange={(v) => {
        setDefaultModel(v)
        if (activeSessionId) updateSessionModel(activeSessionId, v)
      }}
    >
      <ComboboxInput
        placeholder="Buscar modelo..."
        style={{
          paddingLeft: activeVendor ? 28 : 10,
          paddingRight: 24,
          paddingTop: 3,
          paddingBottom: 3,
          minWidth: 140,
          maxWidth: 200,
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          height: 'auto',
          borderRadius: 999,
          border: '1px solid var(--border-subtle)',
          background: 'none',
          cursor: 'pointer',
        }}
      />
      {activeVendor && (
        <div
          style={{
            position: 'absolute', left: 8,
            top: '50%', transform: 'translateY(-50%)',
            zIndex: 1, pointerEvents: 'none',
            display: 'flex', alignItems: 'center',
          }}
        >
          <BrandIcon vendor={activeVendor as any} size={14} />
        </div>
      )}
      <ComboboxContent>
        <ComboboxEmpty>No se encontraron modelos</ComboboxEmpty>
        <ComboboxList>
          {(item) => {
            const model = allModels.find((m) => m.id === item)
            if (!model) return null
            return (
              <ComboboxItem key={item} value={item}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrandIcon vendor={model.vendor as any} size={16} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {model.providerLabel}
                    </div>
                  </div>
                </div>
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
