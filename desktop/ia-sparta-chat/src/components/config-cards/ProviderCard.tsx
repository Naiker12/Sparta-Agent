import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Loader2, Eye, EyeOff, Shield, Star } from 'lucide-react'

interface ProviderCardProps {
  id: string
  name: string
  logo?: string
  status: 'active' | 'inactive'
  defaultModel?: string
  onToggle: (id: string, newStatus: 'active' | 'inactive') => void
  onSetApiKey: (id: string, key: string) => void
}

/**
 * ProviderCard — muestra un proveedor de IA con su estado, modelo por defecto
 * y botón para configurar API key.
 *
 * Consistente con tokens de diseño de `ia-sparta-design-system`:
 * - `var(--status-*)` para colores de estado
 * - `var(--bg-*)` y `var(--text-*)` para fondos y texto
 */
export function ProviderCard({
  id,
  name,
  logo,
  status,
  defaultModel,
  onToggle,
  onSetApiKey,
}: ProviderCardProps) {
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const isActive = status === 'active'

  async function handleSaveKey() {
    if (!keyValue.trim()) return
    setIsUpdating(true)
    try {
      await onSetApiKey(id, keyValue.trim())
      setKeyValue('')
      setShowKeyInput(false)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isActive ? 'var(--border-subtle)' : 'var(--border-normal)'}`,
        background: isActive ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        marginBottom: 6,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Logo / icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {logo ?? <Shield size={14} strokeWidth={1.5} />}
        </div>

        {/* Name + default model */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {name}
          </div>
          {defaultModel && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              <Star size={10} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
              {defaultModel}
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isActive ? 'var(--status-ok)' : 'var(--status-muted)',
            flexShrink: 0,
          }}
        />

        {/* Toggle */}
        <button
          onClick={() => onToggle(id, isActive ? 'inactive' : 'active')}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 500,
            fontFamily: 'var(--font-ui)',
            border: `1px solid ${isActive ? 'var(--status-ok)' : 'var(--border-normal)'}`,
            borderRadius: 'var(--radius-sm)',
            background: isActive ? 'color-mix(in srgb, var(--status-ok) 10%, transparent)' : 'transparent',
            color: isActive ? 'var(--status-ok)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
        >
          {isActive ? 'Activo' : 'Inactivo'}
        </button>
      </div>

      {/* API Key section */}
      {!showKeyInput ? (
        <button
          onClick={() => setShowKeyInput(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-ui)',
            border: '1px dashed var(--border-normal)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <EyeOff size={11} strokeWidth={1.5} />
          Configurar API Key
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={`API Key para ${name}`}
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
              title={showKey ? 'Ocultar key' : 'Mostrar key'}
            >
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowKeyInput(false); setKeyValue('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-ui)',
                background: 'none', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={11} />
              Cancelar
            </button>
            <button
              onClick={handleSaveKey}
              disabled={!keyValue.trim() || isUpdating}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-ui)',
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-sm)', color: 'white',
                cursor: keyValue.trim() && !isUpdating ? 'pointer' : 'not-allowed',
                opacity: keyValue.trim() && !isUpdating ? 1 : 0.5,
              }}
            >
              {isUpdating ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}