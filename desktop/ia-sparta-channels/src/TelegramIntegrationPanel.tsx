import { useState } from 'react'
import { Check, Loader2, Eye, EyeOff, ExternalLink, Shield } from 'lucide-react'
import { BrandIcon } from '@/components/ui/BrandIcon'
import { useChannelStore } from '@/stores/channel.store'
import { IntegrationStatusBadge } from './IntegrationStatusBadge'
import type { Channel } from '@/types'

interface TelegramIntegrationPanelProps {
  channel: Channel
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_configured: { label: 'No configurado', color: 'var(--text-muted)' },
  connecting: { label: 'Verificando token...', color: 'var(--status-warn)' },
  connected: { label: 'Conectado', color: 'var(--status-ok)' },
  error: { label: 'Error de conexión', color: 'var(--status-err)' },
}

export function TelegramIntegrationPanel({ channel }: TelegramIntegrationPanelProps) {
  const { updateIntegration } = useChannelStore()
  const integration = channel.integration!

  const [token, setToken] = useState(integration.botToken || '')
  const [webhookUrl, setWebhookUrl] = useState(integration.webhookUrl || '')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  async function handleTest() {
    if (!token.trim()) return
    setTesting(true)
    setTestResult(null)
    updateIntegration(channel.id, { status: 'connecting' })

    try {
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`)
      if (!res.ok) throw new Error('Token inválido')
      const data = await res.json()
      if (data.ok) {
        const botInfo = {
          name: data.result.first_name || 'Bot',
          username: data.result.username || '',
          avatarUrl: undefined as string | undefined,
        }
        updateIntegration(channel.id, {
          status: 'connected',
          botToken: token.trim(),
          webhookUrl: webhookUrl.trim() || undefined,
          botInfo,
        })
        setTestResult(`Conectado como @${botInfo.username}`)
      } else {
        throw new Error('Respuesta inválida de la API')
      }
    } catch (err) {
      updateIntegration(channel.id, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Error de conexión',
      })
      setTestResult('Error: Token inválido o problema de red')
    } finally {
      setTesting(false)
    }
  }

  function handleSave() {
    updateIntegration(channel.id, {
      botToken: token.trim() || undefined,
      webhookUrl: webhookUrl.trim() || undefined,
    })
  }

  const statusInfo = STATUS_LABELS[integration.status] || STATUS_LABELS.not_configured

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrandIcon vendor="telegram" size={18} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Telegram Integration
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div
          style={{
            padding: 20, background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            marginBottom: 20, textAlign: 'center',
          }}
        >
          <BrandIcon vendor="telegram" size={36} />
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
            Conecta Sparta Agent con Telegram
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', maxWidth: 400, lineHeight: 1.5 }}>
            Recibe y envía mensajes desde tu bot de Telegram directamente en esta vista.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <IntegrationStatusBadge status={integration.status} size={8} />
          <span style={{ fontSize: 12, color: statusInfo.color, fontFamily: 'var(--font-ui)' }}>
            {statusInfo.label}
          </span>
          {integration.status === 'connected' && integration.botInfo && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
              @{integration.botInfo.username}
            </span>
          )}
        </div>

        {integration.status === 'error' && integration.errorMessage && (
          <div
            style={{
              padding: '8px 12px', marginBottom: 16,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)', fontSize: 11, color: 'var(--status-err)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {integration.errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <Field label="BOT TOKEN">
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type={showToken ? 'text' : 'password'}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  style={inputStyle}
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: 4, display: 'flex',
                  }}
                >
                  {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>
          </Field>

          <Field label="WEBHOOK URL (opcional)">
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://tu-dominio.com/webhook/telegram"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleTest}
              disabled={testing || !token.trim()}
              style={{
                padding: '6px 14px', background: 'var(--bg-active)',
                border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-ui)',
                cursor: testing || !token.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, opacity: testing || !token.trim() ? 0.5 : 1,
              }}
            >
              {testing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={11} />}
              Probar conexión
            </button>
            <button
              onClick={handleSave}
              disabled={!token.trim()}
              style={{
                padding: '6px 14px', background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
                fontFamily: 'var(--font-ui)', cursor: !token.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, opacity: !token.trim() ? 0.5 : 1,
              }}
            >
              <Check size={11} strokeWidth={2} />
              Guardar configuración
            </button>
          </div>

          {testResult && (
            <div
              style={{
                padding: '8px 12px', background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)',
                fontSize: 11, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Check size={11} strokeWidth={2} />
              {testResult}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 16, background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ExternalLink size={10} strokeWidth={2} />
            Cómo obtener tu Bot Token
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['Abre @BotFather en Telegram', 'Envía /newbot', 'Sigue las instrucciones', 'Copia el token y pégalo arriba'].map((step, i) => (
              <li key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div
          style={{
            padding: 16, background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--status-warn)', fontFamily: 'var(--font-ui)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BrandIcon vendor="telegram" size={14} />
            PRÓXIMAMENTE
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: 0, lineHeight: 1.6 }}>
            Una vez conectado, los mensajes de tu bot de Telegram aparecerán aquí en tiempo real.
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 11.5,
  background: 'var(--bg-base)', border: '1px solid var(--border-normal)',
  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', outline: 'none',
}
