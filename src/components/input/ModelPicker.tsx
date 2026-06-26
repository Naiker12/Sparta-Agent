import { AlertCircle } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { BrandIcon } from '@/components/ui/BrandIcon'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'

export function ModelPicker() {
  const providers = useProviderStore((s) => s.providers)
  const { activeModel, setDefaultModel } = useSettingsStore()

  const availableModels = providers
    .filter((p) => p.defaultModel)
    .map((p) => ({
      id: p.defaultModel!,
      label: `${p.defaultModel} (${p.label})`,
      providerId: p.id,
      vendor: p.vendor,
    }))

  const modelIds = availableModels.map((m) => m.id)
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

  return (
    <Combobox
      items={modelIds}
      value={activeModel}
      onValueChange={(v) => setDefaultModel(v)}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {activeProvider && (
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <BrandIcon vendor={activeProvider.vendor} size={14} />
          </div>
        )}
        <ComboboxInput
          placeholder="Buscar modelo..."
          style={{
            paddingLeft: activeProvider ? 28 : 10,
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
      </div>
      <ComboboxContent>
        <ComboboxEmpty>No se encontraron modelos</ComboboxEmpty>
        <ComboboxList>
          {(item) => {
            const model = availableModels.find((m) => m.id === item)!
            return (
              <ComboboxItem key={item} value={item}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrandIcon vendor={model.vendor} size={16} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {model.label.split('(')[1]?.replace(')', '') || ''}
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
