import { useState, useEffect } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import type { ProviderVendor, Provider } from '@/types'
import { useProviderStore, getVendorLabel } from '@/stores/provider.store'
import { useTranslation } from '@/i18n'
import { fetchModelsByVendor } from '@/lib/fetch-models'
import { storeInVault, isVaultAvailable } from '@/lib/vault-helper'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'

interface ConfigureProviderDialogProps {
  open: boolean
  vendor: ProviderVendor | null
  editProvider?: Provider | null
  onSave: () => void
  onBack: () => void
  onClose: () => void
}

const VENDOR_DEFAULTS: Partial<Record<ProviderVendor, { serverUrl?: string; kind: 'cloud' | 'local' }>> = {
  ollama: { serverUrl: 'http://localhost:11434', kind: 'local' },
  lmstudio: { serverUrl: 'http://localhost:1234', kind: 'local' },
  llamacpp: { serverUrl: 'http://localhost:8080', kind: 'local' },
  custom: { serverUrl: '', kind: 'local' },
  anthropic: { kind: 'cloud' },
  openai: { kind: 'cloud' },
  google: { kind: 'cloud' },
  groq: { kind: 'cloud' },
  mistral: { kind: 'cloud' },
  azure: { kind: 'cloud' },
  deepseek: { kind: 'cloud' },
  together: { kind: 'cloud' },
  fireworks: { kind: 'cloud' },
  openrouter: { kind: 'cloud' },
  cohere: { kind: 'cloud' },
  perplexity: { kind: 'cloud' },
  xai: { kind: 'cloud' },
  nvidia: { kind: 'cloud' },
}

export function ConfigureProviderDialog({
  open, vendor, editProvider, onSave, onBack, onClose,
}: ConfigureProviderDialogProps) {
  const { addProvider, updateProvider } = useProviderStore()
  const { t } = useTranslation()
  const isLocal = vendor ? (VENDOR_DEFAULTS[vendor]?.kind === 'local') : false

  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [defaultModel, setDefaultModel] = useState('')

  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [fetchedModels, setFetchedModels] = useState<string[]>([])

  useEffect(() => {
    if (editProvider) {
      setLabel(editProvider.label)
      setApiKey(editProvider.apiKey || '')
      setServerUrl(editProvider.serverUrl || '')
      setDefaultModel(editProvider.defaultModel || '')
    } else if (vendor) {
      const defaults = VENDOR_DEFAULTS[vendor]
      setLabel(getVendorLabel(vendor))
      setApiKey('')
      setServerUrl(defaults?.serverUrl || '')
      setDefaultModel('')
    }
    setTesting(false)
    setTestError('')
    setFetchedModels([])
  }, [vendor, editProvider])

  function isNetworkError(message: string): boolean {
    const lower = message.toLowerCase()
    return (
      lower.includes('failed to fetch') ||
      lower.includes('load failed') ||
      lower.includes('networkerror') ||
      lower.includes('cors') ||
      lower.includes('connection failed') ||
      lower.includes('network request failed')
    )
  }

  async function handleTest() {
    if (!vendor) return
    setTesting(true)
    setTestError('')
    setFetchedModels([])

    const result = await fetchModelsByVendor(vendor, apiKey.trim(), serverUrl)
    setTesting(false)

    if (result.error) {
      if (isNetworkError(result.error)) {
        setTestError(
          `${result.error} — ${t('models.testNetworkHint') || 'Si la clave es correcta, prueba guardar y usar el chat directamente; algunos proveedores restringen la prueba de conexión.'}`,
        )
      } else {
        setTestError(result.error)
      }
      return
    }

    if (result.models.length === 0) {
      setTestError('No models returned')
      return
    }

    setFetchedModels(result.models)
    if (defaultModel && result.models.includes(defaultModel)) {
      // Preserve existing default model if still valid
    } else {
      setDefaultModel('')
    }
  }

  async function handleSave() {
    const cleanKey = apiKey.trim() || undefined
    const cleanUrl = serverUrl.trim() || undefined
    const cleanLabel = label.trim()

    const vaultOk = cleanKey ? await isVaultAvailable() : false

    const models = fetchedModels.length > 0 ? fetchedModels : undefined

    if (editProvider) {
      if (cleanKey && vaultOk) {
        await storeInVault(editProvider.id, cleanKey, editProvider.vendor)
        updateProvider(editProvider.id, {
          label: cleanLabel,
          apiKey: undefined,
          hasVaultKey: true,
          serverUrl: cleanUrl,
          defaultModel: defaultModel || undefined,
          models,
        })
      } else {
        updateProvider(editProvider.id, {
          label: cleanLabel,
          apiKey: cleanKey,
          hasVaultKey: false,
          serverUrl: cleanUrl,
          defaultModel: defaultModel || undefined,
          models,
        })
      }
    } else {
      const id = addProvider({
        vendor: currentVendor,
        kind: isLocal ? 'local' : 'cloud',
        label: cleanLabel,
        apiKey: vaultOk ? undefined : cleanKey,
        serverUrl: cleanUrl,
        defaultModel: defaultModel || undefined,
      })

      if (fetchedModels.length > 0) {
        updateProvider(id, { models: fetchedModels })
      }

      if (cleanKey && vaultOk) {
        await storeInVault(id, cleanKey, currentVendor)
        updateProvider(id, { hasVaultKey: true })
      }
    }
    onSave()
  }

  if (!open || !vendor) return null
  const currentVendor: ProviderVendor = vendor

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520, maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
              {editProvider ? t('models.edit') : t('models.configureTitle')} {vendor && getVendorLabel(vendor)}
            </h3>
          </div>
          <button onClick={onClose} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: -2,
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
              {t('models.name')}
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('models.namePlaceholder')}
              style={{
                width: '100%', padding: '7px 10px', fontSize: 12,
                background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)', outline: 'none',
              }}
            />
          </div>

          {!isLocal && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                {t('models.apiKey')}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('models.apiKeyPlaceholder')}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 12,
                    background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                />
                <button
                  onClick={handleTest}
                  disabled={testing || !apiKey.trim()}
                  style={{
                    padding: '7px 12px',
                    background: testing ? 'var(--bg-active)' : 'var(--accent)',
                    border: 'none', borderRadius: 'var(--radius-md)', color: 'white',
                    fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
                    cursor: testing || !apiKey.trim() ? 'default' : 'pointer',
                    opacity: testing || !apiKey.trim() ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  }}
                >
                  {testing ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                  {testing ? t('models.testing') : t('models.testConnection')}
                </button>
              </div>
            </div>
          )}

          {isLocal && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
                {t('models.serverUrl')}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={t('models.serverUrlPlaceholder')}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 12,
                    background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                />
                <button
                  onClick={handleTest}
                  disabled={testing || !serverUrl.trim()}
                  style={{
                    padding: '7px 12px',
                    background: testing ? 'var(--bg-active)' : 'var(--accent)',
                    border: 'none', borderRadius: 'var(--radius-md)', color: 'white',
                    fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
                    cursor: testing || !serverUrl.trim() ? 'default' : 'pointer',
                    opacity: testing || !serverUrl.trim() ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  }}
                >
                  {testing ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                  {testing ? t('models.testing') : t('models.testConnection')}
                </button>
              </div>
            </div>
          )}

          {testError && (
            <div style={{ fontSize: 11, color: 'var(--destructive)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>{t('models.testError')}</span>
              {testError}
            </div>
          )}

          {!testError && fetchedModels.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)' }}>
              {t('models.testSuccess')} ({fetchedModels.length})
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 4 }}>
              {t('models.defaultModelLabel')}
            </label>
            {fetchedModels.length === 0 ? (
              <div style={{
                padding: '7px 10px', fontSize: 12, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
              }}>
                {t('models.testFirst')}
              </div>
            ) : (
              <Combobox
                items={fetchedModels}
                value={defaultModel}
                onValueChange={setDefaultModel}
              >
                <ComboboxInput
                  placeholder="Buscar modelo..."
                  style={{ width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                />
                <ComboboxContent>
                  <ComboboxEmpty>No se encontraron modelos</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item} value={item}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item}</span>
                          {item === defaultModel && (
                            <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          )}
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <Button variant="ghost" onClick={onBack}>
            {t('models.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('models.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
