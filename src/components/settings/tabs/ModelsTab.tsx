import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { useProviderStore } from '@/stores/provider.store'
import { useTranslation } from '@/i18n'
import { SettingGroup } from './primitives'
import { ProviderCard } from '@/components/providers/ProviderCard'
import { ChooseProviderDialog } from '@/components/providers/ChooseProviderDialog'
import { ConfigureProviderDialog } from '@/components/providers/ConfigureProviderDialog'
import type { ProviderVendor, Provider } from '@/types'

export function ModelsTab() {
  const { defaultModel, setDefaultModel } = useSettingsStore()
  const { providers } = useProviderStore()
  const { t } = useTranslation()

  const [step, setStep] = useState<'closed' | 'choose' | 'configure'>('closed')
  const [selectedVendor, setSelectedVendor] = useState<ProviderVendor | null>(null)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)

  function handleChoose(vendor: ProviderVendor) {
    setSelectedVendor(vendor)
    setEditingProvider(null)
    setStep('configure')
  }

  function handleEdit(provider: Provider) {
    setSelectedVendor(provider.vendor)
    setEditingProvider(provider)
    setStep('configure')
  }

  function handleSave() {
    setStep('closed')
    setSelectedVendor(null)
    setEditingProvider(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup title={t('models.title')} description={t('models.titleDesc')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          {providers.length === 0 ? (
            <p style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              padding: '8px 0',
            }}>
              {t('models.noProviders')}
            </p>
          ) : (
            providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onEdit={() => handleEdit(p)}
              />
            ))
          )}

          <button
            onClick={() => setStep('choose')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'none',
              border: '1px dashed var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              transition: 'all 0.12s',
              width: '100%',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Plus size={13} strokeWidth={2} />
            {t('models.addProvider')}
          </button>
        </div>
      </SettingGroup>

      <SettingGroup title={t('models.defaultModel')} description={t('models.defaultModelDesc')}>
        <div style={{ paddingTop: 4 }}>
          <label
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            {t('general.defaultModel')}
          </label>
          <input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
        </div>
      </SettingGroup>

      <ChooseProviderDialog
        open={step === 'choose'}
        onSelect={handleChoose}
        onClose={() => setStep('closed')}
      />

      <ConfigureProviderDialog
        open={step === 'configure'}
        vendor={selectedVendor}
        editProvider={editingProvider}
        onSave={handleSave}
        onBack={() => setStep('choose')}
        onClose={() => setStep('closed')}
      />
    </div>
  )
}
