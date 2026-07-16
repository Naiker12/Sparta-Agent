import { useState, useEffect, useRef } from 'react'
import { Check, X, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'ia-sparta-i18n'
import { SettingRow, SettingGroup } from './primitives'

export function SearchTab() {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const loaded = useRef(false)

  useEffect(() => {
    if (!window.vault || loaded.current) return
    loaded.current = true
    window.vault.hasKey('brave-search').then((exists) => {
      setHasKey(exists)
      if (exists) {
        window.vault.getKey('brave-search').then((key) => {
          if (key) setApiKey(key)
        })
      }
    })
  }, [])

  async function handleSave() {
    if (!window.vault) return
    const trimmed = apiKey.trim()
    if (!trimmed) {
      await window.vault.deleteKey('brave-search')
      setHasKey(false)
      setStatus('saved')
      return
    }
    try {
      const ok = await window.vault.storeKey('brave-search', trimmed, 'brave-search')
      if (ok) {
        setHasKey(true)
        setStatus('saved')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (status === 'saved') {
      const timer = setTimeout(() => setStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [status])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title={t('search.provider') || 'Búsqueda web'}
        description={
          t('search.providerDesc')
          || 'La búsqueda funciona automáticamente con DuckDuckGo, sin necesidad de API key. Opcionalmente podés agregar una key de Brave Search para usar Brave como alternativa.'
        }
      >
        <SettingRow
          title={t('search.apiKey') || 'Brave Search API Key (opcional)'}
          description=""
          control={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {hasKey && !showKey && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--status-ok)' }}>
                  <Check size={12} strokeWidth={2.5} />
                  Brave configurada
                </span>
              )}
            </div>
          }
        />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Brave API key (opcional — DuckDuckGo por defecto)"
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                paddingRight: 30,
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 2,
                display: 'flex',
              }}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('search.save') || 'Guardar'}
          </button>
          {status === 'saved' && (
            <span style={{ fontSize: 11, color: 'var(--status-ok)' }}>
              <Check size={12} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              Guardada
            </span>
          )}
          {status === 'error' && (
            <span style={{ fontSize: 11, color: 'var(--status-err)' }}>
              <X size={12} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              Error
            </span>
          )}
        </div>
      </SettingGroup>
    </div>
  )
}
