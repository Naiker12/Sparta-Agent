import { useState, useEffect } from 'react'
import { Plus, Check, Shield, AlertCircle, Loader2, Cpu, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react'
import type { ProviderVendor } from 'ia-sparta-core'
import { useProviderStore, useSettingsStore, useSessionStore, getVendorLabel, fetchModelsByVendor } from 'ia-sparta-core'
import { storeInVault, getProviderKey, removeFromVault } from 'ia-sparta-platform'
import {
  BrandIcon,
  Button,
  ConfirmDeleteDialog,
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from 'ia-sparta-design-system'
import { ChooseProviderDialog, LocalModelsDiscoveryBadge } from 'ia-sparta-providers'

const DEFAULT_VENDOR_MODELS: Record<string, string[]> = {
  openrouter: [
    'z-ai/glm-5.2',
    'anthropic/claude-3.7-sonnet',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.3-70b-instruct',
    'mistralai/mistral-large-2411',
    'qwen/qwen-2.5-72b-instruct',
  ],
  anthropic: [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'o3-mini',
    'gpt-4-turbo',
  ],
  google: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'deepseek-r1-distill-llama-70b',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  ollama: [
    'llama3.3',
    'llama3.1',
    'mistral',
    'deepseek-r1',
    'qwen2.5-coder',
  ],
  lmstudio: [
    'local-model',
  ],
  xai: [
    'grok-2-latest',
    'grok-2-vision-latest',
  ],
  mistral: [
    'mistral-large-latest',
    'pixtral-large-latest',
    'codestral-latest',
  ],
  nvidia: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'deepseek-ai/deepseek-r1',
  ],
}

const POPULAR_VENDORS: { vendor: ProviderVendor; name: string; kind: 'cloud' | 'local' }[] = [
  { vendor: 'openai', name: 'OpenAI', kind: 'cloud' },
  { vendor: 'anthropic', name: 'Anthropic', kind: 'cloud' },
  { vendor: 'openrouter', name: 'OpenRouter', kind: 'cloud' },
  { vendor: 'google', name: 'Google Gemini', kind: 'cloud' },
  { vendor: 'groq', name: 'Groq', kind: 'cloud' },
  { vendor: 'deepseek', name: 'DeepSeek', kind: 'cloud' },
  { vendor: 'ollama', name: 'Ollama', kind: 'local' },
  { vendor: 'lmstudio', name: 'LM Studio', kind: 'local' },
  { vendor: 'mistral', name: 'Mistral AI', kind: 'cloud' },
  { vendor: 'xai', name: 'xAI (Grok)', kind: 'cloud' },
  { vendor: 'custom', name: 'Servidor Personalizado', kind: 'local' },
]

export function ModelsTab() {
  const { setDefaultModel } = useSettingsStore()
  const { providers, addProvider, updateProvider, removeProvider } = useProviderStore()

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(providers[0]?.id ?? null)
  const [chooseOpen, setChooseOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Selected provider edit state
  const selectedProvider = providers.find((p) => p.id === selectedProviderId) || providers[0] || null

  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [selectedDefaultModel, setSelectedDefaultModel] = useState('')
  const [revealed, setRevealed] = useState(false)

  // Diagnostics & testing state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; models?: string[] } | null>(null)

  useEffect(() => {
    const prov = providers.find((p) => p.id === selectedProviderId) || providers[0]
    if (prov) {
      setLabel(prov.label)
      setServerUrl(prov.serverUrl || '')
      setSelectedDefaultModel(prov.defaultModel || '')
      setTestResult(null)
      setRevealed(false)

      getProviderKey(prov).then((k) => {
        setApiKey(k || prov.apiKey || '')
      })
    }
  }, [selectedProviderId])

  async function handleTestConnection() {
    if (!selectedProvider) return
    setTesting(true)
    setTestResult(null)

    let keyToTest = apiKey.trim()
    if (!keyToTest) {
      const resolved = await getProviderKey(selectedProvider)
      if (resolved) keyToTest = resolved
    }

    const result = await fetchModelsByVendor(selectedProvider.vendor, keyToTest, serverUrl)
    setTesting(false)

    if (result.error) {
      setTestResult({ ok: false, message: result.error })
    } else {
      setTestResult({
        ok: true,
        message: `Conexión exitosa. Se detectaron ${result.models.length} modelos disponibles.`,
        models: result.models,
      })
      if (result.models.length > 0) {
        updateProvider(selectedProvider.id, { models: result.models })
      }
    }
  }

  async function handleSaveProvider() {
    if (!selectedProvider) return

    const cleanKey = apiKey.trim() || undefined
    const cleanUrl = serverUrl.trim() || undefined
    const cleanLabel = label.trim() || getVendorLabel(selectedProvider.vendor)
    const modelToSave = selectedDefaultModel.trim() || undefined

    if (cleanKey) {
      await storeInVault(selectedProvider.id, cleanKey, selectedProvider.vendor)
      useSettingsStore.getState().setApiKey(selectedProvider.vendor, cleanKey)
      updateProvider(selectedProvider.id, {
        label: cleanLabel,
        apiKey: cleanKey,
        hasVaultKey: true,
        serverUrl: cleanUrl,
        defaultModel: modelToSave,
      })
    } else {
      updateProvider(selectedProvider.id, {
        label: cleanLabel,
        serverUrl: cleanUrl,
        defaultModel: modelToSave,
      })
    }

    if (modelToSave) {
      setDefaultModel(modelToSave)
      const activeSessionId = useSessionStore.getState().activeSessionId
      if (activeSessionId) {
        useSessionStore.getState().updateSessionModel(activeSessionId, modelToSave)
      }
    }

    setTestResult({
      ok: true,
      message: `✓ Cambios guardados correctamente.${modelToSave ? ` Modelo predeterminado activo: ${modelToSave}` : ''}`,
    })
  }

  function handleChooseVendor(vendor: ProviderVendor) {
    const isLocal = POPULAR_VENDORS.find((v) => v.vendor === vendor)?.kind === 'local'
    const newId = addProvider({
      vendor,
      kind: isLocal ? 'local' : 'cloud',
      label: getVendorLabel(vendor),
      apiKey: undefined,
      serverUrl: isLocal ? (vendor === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234') : undefined,
    })
    setSelectedProviderId(newId)
    setChooseOpen(false)
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: 520, minHeight: 0, overflow: 'hidden' }}>
      {/* LEFT MASTER SIDEBAR: List of Configured Providers (Traycer Master List) */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-input)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Proveedores ({providers.length})
          </span>
          <button
            onClick={() => setChooseOpen(true)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 500,
            }}
          >
            <Plus size={12} /> Nuevo
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {providers.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No hay proveedores configurados. Haz clic en <strong>+ Nuevo</strong> para agregar uno.
            </div>
          ) : (
            providers.map((p) => {
              const isSelected = p.id === (selectedProvider?.id ?? selectedProviderId)
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProviderId(p.id)}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--accent-muted)' : 'transparent',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'all 0.1s',
                  }}
                >
                  <BrandIcon vendor={p.vendor} size={16} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: isSelected ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {p.defaultModel || getVendorLabel(p.vendor)}
                    </div>
                  </div>
                  {p.hasVaultKey ? (
                    <span title="Clave Cifrada en Vault (0600)" style={{ color: '#22c55e', display: 'flex' }}>
                      <Shield size={13} />
                    </span>
                  ) : p.kind === 'local' ? (
                    <span title="Servidor Local" style={{ color: 'var(--accent)', display: 'flex' }}>
                      <Cpu size={13} />
                    </span>
                  ) : !p.apiKey ? (
                    <span title="Sin API Key" style={{ color: 'var(--destructive)', display: 'flex' }}>
                      <AlertCircle size={13} />
                    </span>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        {/* Local models discovery footer */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-input)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <LocalModelsDiscoveryBadge />
        </div>
      </div>

      {/* RIGHT DETAIL PANEL: Provider Configuration & Diagnostics (Traycer Detail Surface) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {selectedProvider ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 20, gap: 16 }}>
            {/* Header / Brand info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-normal)' }}>
                  <BrandIcon vendor={selectedProvider.vendor} size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {getVendorLabel(selectedProvider.vendor)}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    ID: {selectedProvider.id} · Tipo: {selectedProvider.kind === 'local' ? 'Local / Self-hosted' : 'Cloud API'}
                  </span>
                </div>
              </div>

              {selectedProvider.hasVaultKey ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 999,
                  color: '#22c55e', fontSize: 10.5, fontWeight: 500,
                  fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0
                }}>
                  <Shield size={11} /> Vault safeStorage (0600)
                </div>
              ) : selectedProvider.kind === 'local' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', background: 'var(--accent-muted)',
                  border: '1px solid var(--accent)', borderRadius: 999,
                  color: 'var(--accent)', fontSize: 10.5, fontWeight: 500,
                  fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0
                }}>
                  <Cpu size={11} /> Modo Local
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 999,
                  color: 'var(--destructive)', fontSize: 10.5, fontWeight: 500,
                  fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0
                }}>
                  <AlertCircle size={11} /> Sin Cifrar
                </div>
              )}
            </div>

            {/* Provider Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Nombre del Proveedor / Etiqueta
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej: OpenRouter Personal, Anthropic Work..."
                  style={{
                    width: '100%', padding: '7px 10px', fontSize: 12,
                    background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none',
                  }}
                />
              </div>

              {selectedProvider.kind !== 'local' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      API Key
                    </label>
                    {selectedProvider.hasVaultKey && (
                      <span style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={10} /> Guardada y verificada en Vault
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={revealed ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder={selectedProvider.hasVaultKey ? 'Ingresa una nueva API Key...' : 'sk-...'}
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
                          title="Limpiar clave para ingresar una nueva"
                          style={{
                            padding: '7px 10px', background: 'var(--bg-input)',
                            border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
                            color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--destructive)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {selectedProvider.vendor === 'openrouter' && !apiKey && (
                    <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                      💡 Obtén tu API Key gratuita en{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                      >
                        openrouter.ai/keys
                      </a>
                    </div>
                  )}
                </div>
              )}

              {selectedProvider.kind === 'local' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    URL del Servidor Local (Endpoint)
                  </label>
                  <input
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:11434 o http://localhost:1234"
                    style={{
                      width: '100%', padding: '7px 10px', fontSize: 12,
                      background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)', outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Models Selector & Connection Diagnostic */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Modelo Predeterminado para este Proveedor
                  </label>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    style={{
                      background: 'none', border: 'none', color: 'var(--accent)',
                      fontSize: 11, cursor: testing ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500,
                    }}
                  >
                    {testing ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={11} />}
                    {testing ? 'Probando conexión...' : 'Probar conexión y buscar modelos'}
                  </button>
                </div>

                <Combobox
                  items={Array.from(new Set([
                    ...(testResult?.models || []),
                    ...(selectedProvider.models || []),
                    ...(DEFAULT_VENDOR_MODELS[selectedProvider.vendor] || []),
                  ]))}
                  value={selectedDefaultModel}
                  onValueChange={setSelectedDefaultModel}
                >
                  <ComboboxInput
                    placeholder="Buscar o seleccionar modelo..."
                    style={{ width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No se encontraron modelos</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item}</span>
                            {item === selectedDefaultModel && (
                              <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            )}
                          </div>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              {/* Diagnostic Feedback Banner */}
              {testResult && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: testResult.ok ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${testResult.ok ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    color: testResult.ok ? '#22c55e' : 'var(--destructive)',
                    fontSize: 11.5,
                    fontFamily: 'var(--font-ui)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                    <span>{testResult.ok ? 'Diagnóstico Correcto' : 'Error de Diagnóstico'}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 11, lineHeight: 1.4 }}>
                    {testResult.message}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setConfirmDeleteId(selectedProvider.id)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: 'var(--destructive)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 12px',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <Trash2 size={13} /> Eliminar Proveedor
              </button>

              <Button onClick={handleSaveProvider} style={{ fontSize: 12, padding: '6px 16px' }}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Selecciona un proveedor de la lista o agrega uno nuevo.
          </div>
        )}
      </div>

      <ChooseProviderDialog
        open={chooseOpen}
        onSelect={handleChooseVendor}
        onClose={() => setChooseOpen(false)}
      />

      <ConfirmDeleteDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}
        itemLabel={selectedProvider?.label || ''}
        onConfirm={async () => {
          if (confirmDeleteId) {
            const p = providers.find((pr) => pr.id === confirmDeleteId)
            await removeFromVault(confirmDeleteId, p?.vendor)
            removeProvider(confirmDeleteId)
            setSelectedProviderId(null)
            setConfirmDeleteId(null)
          }
        }}
      />
    </div>
  )
}
