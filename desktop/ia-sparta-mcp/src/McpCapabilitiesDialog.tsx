import { useEffect, useState } from 'react'
import { Loader2, Check, Wrench, Shield } from 'lucide-react'
import { useMCPStore } from 'ia-sparta-core'
import { Button } from 'ia-sparta-design-system'
import { useTranslation } from 'ia-sparta-i18n'
import { McpToolItem } from './McpToolItem'
import { BrandIcon } from 'ia-sparta-design-system'
import type { MCPTool, MCPServerConfig, MCPAuthType } from 'ia-sparta-core'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'ia-sparta-design-system'

interface McpCapabilitiesDialogProps {
  open: boolean
  onClose: () => void
  server: { id: string; name: string; vendor?: string }
  mode: 'probe' | 'known'
  config?: MCPServerConfig
  authType?: MCPAuthType
  onInstall?: () => void
  onToolsDiscovered?: (tools: MCPTool[]) => void
}

export function McpCapabilitiesDialog({
  open, onClose, server, mode, config, authType, onInstall, onToolsDiscovered,
}: McpCapabilitiesDialogProps) {
  const { t } = useTranslation()
  const servers = useMCPStore((s) => s.servers)
  const [tools, setTools] = useState<MCPTool[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const needsOAuth = authType === 'oauth2' || config?.auth_type === 'oauth2'

  useEffect(() => {
    if (!open) { setTools([]); setError(null); return }
    if (mode === 'known') {
      const found = servers.find((s) => s.id === server.id)
      setTools(found?.tools ?? [])
      return
    }
    if (!config || needsOAuth) return
    setLoading(true); setError(null)
    async function probe() {
      try {
        const win = window as unknown as {
          sparta?: { testMcpConnection: (c: Record<string, unknown>) => Promise<{ ok: boolean; tools?: unknown[]; error?: string }> }
          electron?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> }
        }
        let result: { ok: boolean; tools?: unknown[]; error?: string }
        if (win.sparta) {
          result = await win.sparta.testMcpConnection(config as unknown as Record<string, unknown>)
        } else if (win.electron) {
          result = await win.electron.invoke('mcp:test', config) as { ok: boolean; tools?: unknown[]; error?: string }
        } else {
          setError('No disponible en modo web')
          setLoading(false)
          return
        }
        if (result.ok && result.tools) {
          const mapped = (result.tools as MCPTool[]).map((t) => ({ ...t, serverId: server.id }))
          setTools(mapped)
          onToolsDiscovered?.(mapped)
        } else if (result.ok) {
          setTools([])
          onToolsDiscovered?.([])
        } else {
          setError(result.error ?? 'Conexión fallida')
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    probe()
  }, [open, mode, config, server.id, servers, needsOAuth])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[480px] w-full"
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-normal)',
          borderRadius: 22,
          padding: 0,
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.14)',
        }}
      >
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <DialogHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {server.vendor && <BrandIcon vendor={server.vendor} size={18} />}
              <DialogTitle style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {server.name}
              </DialogTitle>
            </div>
            <DialogDescription style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {mode === 'probe'
                ? (needsOAuth
                    ? t('mcp.capabilitiesOAuth') ?? 'Requiere autenticación OAuth 2.0'
                    : t('mcp.capabilitiesProbe') ?? 'Consultando capacidades del servidor…')
                : t('mcp.capabilitiesKnown') ?? 'Herramientas disponibles'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div style={{ padding: '16px 20px', minHeight: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {needsOAuth && mode === 'probe' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '24px 16px', textAlign: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.2)',
                color: '#60a5fa',
              }}>
                <Shield size={22} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Autenticación requerida
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5, maxWidth: 320 }}>
                  Este servidor requiere autorización OAuth 2.0. Al instalarlo se abrirá el navegador para que inicies sesión y concedas acceso.
                </p>
              </div>
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', padding: '20px 0' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Conectando con el servidor MCP…</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>La primera conexión puede tomar hasta 60s (descarga de paquetes)</span>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: 'var(--status-err)', padding: '8px 10px', borderRadius: 6, background: 'color-mix(in srgb, var(--status-err) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--status-err) 20%, transparent)' }}>
              {error}
            </div>
          )}
          {!loading && !error && !needsOAuth && tools.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              {mode === 'probe'
                ? t('mcp.noToolsFound') ?? 'No se encontraron herramientas'
                : t('mcp.noTools') ?? 'Sin herramientas'}
            </div>
          )}
          {!loading && tools.length > 0 && (
            <div style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Wrench size={9} strokeWidth={2.5} />
                  {t('mcp.availableTools')}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-active)', padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                  {tools.length}
                </span>
              </div>
              <div>
                {tools.map((tool, i) => (
                  <div key={tool.name} style={i > 0 ? { borderTop: '1px solid var(--border-subtle)' } : {}}>
                    <McpToolItem tool={tool} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid var(--border-normal)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-ui)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          >
            {t('mcp.close') ?? 'Cerrar'}
          </button>
          {mode === 'probe' && onInstall && (
            <Button
              onClick={() => { onInstall(); onClose() }}
              disabled={loading}
              style={{ fontSize: 11, fontWeight: 600, height: 32, gap: 6 }}
            >
              {needsOAuth ? <Shield size={12} strokeWidth={2.5} /> : <Check size={12} strokeWidth={2.5} />}
              {needsOAuth
                ? (t('mcp.authorizeAndInstall') ?? 'Autorizar e instalar')
                : (t('mcp.install') ?? 'Instalar')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
