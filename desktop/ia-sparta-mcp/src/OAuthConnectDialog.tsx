import { useState, useEffect, useRef } from 'react'
import { Button } from 'ia-sparta-design-system'
import { Check, X, ExternalLink, Clock } from 'lucide-react'
import { BrandIcon } from 'ia-sparta-design-system'
import { useTranslation } from 'ia-sparta-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'ia-sparta-design-system'

interface OAuthConnectedResult {
  accountLabel?: string
  accessToken?: string
  refreshToken?: string
}

interface OAuthConnectDialogProps {
  open: boolean
  onClose: () => void
  serverId: string
  serverName: string
  vendor?: string
  authorizeUrl: string
  tokenEndpoint?: string
  clientId?: string
  onConnected: (result: OAuthConnectedResult) => void
}

type OAuthStatus = 'waiting' | 'success' | 'error' | 'timeout'

const OAUTH_TIMEOUT_MS = 120_000

export function OAuthConnectDialog({
  open,
  onClose,
  serverId,
  serverName,
  vendor,
  authorizeUrl,
  tokenEndpoint,
  clientId,
  onConnected,
}: OAuthConnectDialogProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<OAuthStatus>('waiting')
  const [accountLabel, setAccountLabel] = useState<string | undefined>()
  const [errorMsg, setErrorMsg] = useState<string | undefined>()
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef<number>(0)
  const isWaitingRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setStatus('waiting')
      setAccountLabel(undefined)
      setErrorMsg(undefined)
      setElapsed(0)
      isWaitingRef.current = false
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      return
    }

    startedRef.current = Date.now()
    isWaitingRef.current = true
    setStatus('waiting')

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedRef.current) / 1000))
    }, 1000)

    timeoutRef.current = setTimeout(() => {
      if (isWaitingRef.current) {
        setStatus('timeout')
        setErrorMsg('No se completó el inicio de sesión')
      }
    }, OAUTH_TIMEOUT_MS)

    startOAuth().finally(() => {
      // If startOAuth completed without changing status (e.g. sync error),
      // the timeout will handle it. If it succeeded, isWaitingRef is already false.
    })

    return () => {
      isWaitingRef.current = false
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [open])

  async function startOAuth() {
    try {
      if (typeof window !== 'undefined' && (window as unknown as { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electron) {
        const win = window as unknown as { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }
        const result = await win.electron.invoke('mcp:oauth:start', {
          serverId,
          authorizeUrl,
          tokenEndpoint,
          clientId,
        }) as { ok: boolean; account_label?: string; access_token?: string; refresh_token?: string; error?: string }

        if (result.ok) {
          isWaitingRef.current = false
          setStatus('success')
          setAccountLabel(result.account_label)
          setTimeout(() => {
            onConnected({
              accountLabel: result.account_label,
              accessToken: result.access_token,
              refreshToken: result.refresh_token,
            })
            onClose()
          }, 1500)
        } else {
          isWaitingRef.current = false
          setStatus('error')
          setErrorMsg(result.error ?? 'Error de autenticación')
        }
      } else if (typeof window !== 'undefined' && (window as unknown as { sparta: { testMcpConnection: (config: Record<string, unknown>) => Promise<unknown> } }).sparta) {
        isWaitingRef.current = false
        setStatus('timeout')
        setErrorMsg('OAuth no disponible en modo web')
      } else {
        isWaitingRef.current = false
        setStatus('timeout')
        setErrorMsg('OAuth no disponible en este entorno')
      }
    } catch (err) {
      isWaitingRef.current = false
      setStatus('error')
      setErrorMsg((err as Error).message ?? 'Error desconocido')
    }
  }

  function openBrowser() {
    window.open(authorizeUrl, '_blank', 'noopener,noreferrer')
  }

  function handleRetry() {
    setStatus('waiting')
    setErrorMsg(undefined)
    setElapsed(0)
    startedRef.current = Date.now()
    startOAuth()
  }

  const progressPercent = Math.min((elapsed / (OAUTH_TIMEOUT_MS / 1000)) * 100, 100)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose() } }}>
      <DialogContent
        className="max-w-[400px] w-full overflow-hidden"
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-normal)',
          borderRadius: 22,
          padding: 0,
          maxWidth: 400,
          width: '100%',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.14)',
        }}
      >
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          {vendor && (
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
            }}>
              <BrandIcon vendor={vendor} size={24} />
            </div>
          )}

          <DialogHeader>
            <DialogTitle style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {status === 'success'
                ? t('mcp.oauthConnected') || `Conectado a ${serverName}`
                : t('mcp.oauthConnecting') || `Conectando con ${serverName}`
              }
            </DialogTitle>
          </DialogHeader>

          {status === 'waiting' && (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t('mcp.oauthBrowserOpened') || 'Se abrió tu navegador para iniciar sesión.'}
              </p>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                <div style={{
                  width: '100%', height: 6, borderRadius: 3,
                  background: 'var(--bg-active)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressPercent}%`, height: '100%',
                    borderRadius: 3,
                    background: 'var(--accent)',
                    transition: 'width 1s linear',
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <Clock size={10} />
                  {timeStr}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openBrowser}
                  style={{ flex: 1, fontSize: 11, fontWeight: 600, gap: 6 }}
                >
                  <ExternalLink size={11} />
                  {t('mcp.oauthReopenBrowser') || 'Reabrir navegador'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {t('mcp.cancel')}
                </Button>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(34,197,94,0.12)',
              }}>
                <Check size={20} strokeWidth={2.5} style={{ color: 'var(--status-ok)' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--status-ok)', fontWeight: 600, margin: 0 }}>
                {accountLabel
                  ? (t('mcp.oauthConnectedAs') || `Conectado como ${accountLabel}`)
                  : (t('mcp.oauthSuccess') || 'Conexión exitosa')
                }
              </p>
            </>
          )}

          {(status === 'error' || status === 'timeout') && (
            <>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: status === 'timeout'
                  ? 'rgba(234,179,8,0.12)'
                  : 'rgba(239,68,68,0.12)',
              }}>
                <X size={20} strokeWidth={2.5} style={{
                  color: status === 'timeout' ? 'var(--status-warn)' : 'var(--status-err)',
                }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                {errorMsg}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRetry}
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {t('mcp.retry') || 'Reintentar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {t('mcp.cancel')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
