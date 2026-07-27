import { useState, useEffect } from 'react'
import { Loader2, Check, X, Eye, EyeOff } from 'lucide-react'
import type { ProviderVendor, Provider } from 'ia-sparta-core'
import { useProviderStore, useSettingsStore, getVendorLabel } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { fetchModelsByVendor } from 'ia-sparta-core'
import { storeInVault, getProviderKey } from 'ia-sparta-platform'
import { Button } from 'ia-sparta-design-system'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from 'ia-sparta-design-system'

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
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (editProvider) {
      setLabel(editProvider.label)
      setServerUrl(editProvider.serverUrl || '')
      setDefaultModel(editProvider.defaultModel || '')
      getProviderKey(editProvider).then((k) => {
        setApiKey(k || editProvider.apiKey || '')
      })
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

    let keyToTest = apiKey.trim()
    if (!keyToTest && editProvider) {
      const resolvedKey = await getProviderKey(editProvider)
      if (resolvedKey) keyToTest = resolvedKey
    }

    const result = await fetchModelsByVendor(vendor, keyToTest, serverUrl)
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
    const models = fetchedModels.length > 0 ? fetchedModels : undefined

    if (editProvider) {
      if (cleanKey) {
        await storeInVault(editProvider.id, cleanKey, editProvider.vendor)
        useSettingsStore.getState().setApiKey(editProvider.vendor, cleanKey)
        updateProvider(editProvider.id, {
          label: cleanLabel,
          apiKey: cleanKey,
          hasVaultKey: true,
          serverUrl: cleanUrl,
          defaultModel: defaultModel || undefined,
          models,
        })
      } else {
        updateProvider(editProvider.id, {
          label: cleanLabel,
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
        apiKey: cleanKey,
        serverUrl: cleanUrl,
        defaultModel: defaultModel || undefined,
      })

      if (fetchedModels.length > 0) {
        updateProvider(id, { models: fetchedModels })
      }

      if (cleanKey) {
        await storeInVault(id, cleanKey, currentVendor)
        useSettingsStore.getState().setApiKey(currentVendor, cleanKey)
        updateProvider(id, {
          hasVaultKey: true,
          apiKey: cleanKey,
        })
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                  {t('models.apiKey')}
                </label>
                {editProvider?.hasVaultKey && (
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'var(--font-ui)',
                  }}>
                    <Check size={10} /> Cifrado en Vault
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type={revealed ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder={editProvider?.hasVaultKey ? 'Ingresa una nueva API Key...' : t('models.apiKeyPlaceholder')}
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 12,
                    background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                />
                {apiKey && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRevealed(!revealed)}
                      title={revealed ? 'Ocultar clave' : 'Mostrar clave'}
                      style={{
                        padding: '7px 10px', background: 'var(--bg-input)',
                        border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                    >
                      {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiKey('')}
                      title="Limpiar para ingresar nueva clave"
                      style={{
                        padding: '7px 10px', background: 'var(--bg-input)',
                        border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || (!apiKey.trim() && !editProvider?.hasVaultKey && !editProvider?.apiKey)}
                  style={{
                    padding: '7px 12px',
                    background: testing ? 'var(--bg-active)' : 'var(--accent)',
                    border: 'none', borderRadius: 'var(--radius-md)', color: 'white',
                    fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
                    cursor: testing || (!apiKey.trim() && !editProvider?.hasVaultKey && !editProvider?.apiKey) ? 'default' : 'pointer',
                    opacity: testing || (!apiKey.trim() && !editProvider?.hasVaultKey && !editProvider?.apiKey) ? 0.6 : 1,
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
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: 11, color: 'var(--destructive)', fontFamily: 'var(--font-ui)',
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={13} /> {t('models.testError')}
              </span>
              <span style={{ lineHeight: '1.4', opacity: 0.9 }}>{testError}</span>
            </div>
          )}

          {!testError && fetchedModels.length > 0 && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              fontSize: 11, color: '#22c55e', fontFamily: 'var(--font-ui)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Check size={13} />
              <span>{t('models.testSuccess')} ({fetchedModels.length} modelos detectados)</span>
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
