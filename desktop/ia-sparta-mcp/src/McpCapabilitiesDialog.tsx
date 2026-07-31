import { useEffect, useState } from 'react'
import { Loader2, Check, Shield, Search, SlidersHorizontal, Terminal, Zap, Copy, ExternalLink, ShieldCheck, Cpu, BookOpen, Sparkles } from 'lucide-react'
import { useMCPStore, openExternal } from 'ia-sparta-core'
import { Button } from 'ia-sparta-design-system'
import { useTranslation } from 'ia-sparta-i18n'
import { McpToolItem } from './McpToolItem'
import { BrandIcon } from 'ia-sparta-design-system'
import type { MCPTool, MCPServerConfig, MCPAuthType } from 'ia-sparta-core'
import { MCP_CATALOG } from './data/mcp-catalog'
import { REFERENCE_TOOLS_CATALOG } from './data/mcp-reference-tools'
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
  const [activeTab, setActiveTab] = useState<'tools' | 'config'>('tools')
  const [tools, setTools] = useState<MCPTool[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const catalogEntry = MCP_CATALOG[server.id]
  const needsOAuth = authType === 'oauth2' || config?.auth_type === 'oauth2' || catalogEntry?.auth_type === 'oauth2'
  const fallbackCatalogTools = REFERENCE_TOOLS_CATALOG[server.id] ?? []

  useEffect(() => {
    if (!open) {
      setTools([])
      setError(null)
      setSearchQuery('')
      setActiveTab('tools')
      setCopied(false)
      return
    }
    if (mode === 'known') {
      const found = servers.find((s) => s.id === server.id)
      setTools(found?.tools?.length ? found.tools : fallbackCatalogTools)
      return
    }
    if (!config || needsOAuth) {
      setTools(fallbackCatalogTools)
      return
    }

    const cwd = typeof process !== 'undefined' ? process.cwd() : '.'
    const testConfig: MCPServerConfig = {
      ...config,
      args: (config.args ?? catalogEntry?.args ?? []).map((arg) =>
        arg.replace(/\${DIR}|\${REPO_DIR}/g, cwd)
      ),
    }

    setLoading(true)
    setError(null)

    async function probe() {
      try {
        const win = window as unknown as {
          sparta?: { testMcpConnection: (c: Record<string, unknown>) => Promise<{ ok: boolean; tools?: unknown[]; error?: string }> }
          electron?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> }
        }
        let result: { ok: boolean; tools?: unknown[]; error?: string }
        if (win.sparta) {
          result = await win.sparta.testMcpConnection(testConfig as unknown as Record<string, unknown>)
        } else if (win.electron) {
          result = await win.electron.invoke('mcp:test', testConfig) as { ok: boolean; tools?: unknown[]; error?: string }
        } else {
          setError('No disponible en modo web')
          setTools(fallbackCatalogTools)
          setLoading(false)
          return
        }
        if (result.ok && result.tools && result.tools.length > 0) {
          const mapped = (result.tools as MCPTool[]).map((tool) => ({ ...tool, serverId: server.id }))
          setTools(mapped)
          onToolsDiscovered?.(mapped)
        } else {
          setTools(fallbackCatalogTools)
        }
      } catch {
        setTools(fallbackCatalogTools)
      } finally {
        setLoading(false)
      }
    }
    probe()
  }, [open, mode, config, server.id, servers, needsOAuth, catalogEntry?.args])

  const displayTools = tools.length > 0 ? tools : fallbackCatalogTools

  const filteredTools = displayTools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const cwdPath = typeof process !== 'undefined' ? process.cwd() : 'd:\\sparta-agent'

  const resolvedCommand = config?.type === 'http' || catalogEntry?.type === 'http'
    ? (config?.url || catalogEntry?.url || 'https://api.sparta-agent.com/mcp')
    : `${config?.command || catalogEntry?.command || 'npx'} ${(config?.args || catalogEntry?.args || []).join(' ')}`.replace(/\${DIR}|\${REPO_DIR}/g, cwdPath)

  function copyCommandText() {
    navigator.clipboard.writeText(resolvedCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const envRequired = catalogEntry?.env_required ?? config?.env ? Object.keys(config?.env ?? {}) : []
  const vendorName = server.vendor || catalogEntry?.vendor || 'Oficial'
  const categoryName = catalogEntry?.category || 'DevTools'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[640px] w-full"
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-normal)',
          borderRadius: 22,
          padding: 0,
          maxWidth: 640,
          width: '100%',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.18)',
        }}
      >
        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <DialogHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
                }}>
                  <BrandIcon vendor={vendorName} size={20} />
                </div>
                <div>
                  <DialogTitle style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {server.name}
                  </DialogTitle>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      color: needsOAuth ? '#60a5fa' : 'var(--text-muted)',
                      background: needsOAuth ? 'rgba(59,130,246,0.12)' : 'var(--bg-active)',
                      padding: '1px 6px', borderRadius: 4,
                    }}>
                      {needsOAuth ? 'OAuth 2.0' : (config?.type === 'http' || catalogEntry?.type === 'http') ? 'HTTP / Remote' : 'Stdio / Process'}
                    </span>
                    <span style={{
                      fontSize: 9.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      padding: '1px 6px', borderRadius: 4,
                    }}>
                      {categoryName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogDescription style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
              {catalogEntry?.description ?? (mode === 'probe'
                ? 'Explora las herramientas, configuración de comandos y especificaciones técnicas de este servidor MCP.'
                : 'Herramientas disponibles para la ejecución de tareas con el agente.')}
            </DialogDescription>
          </DialogHeader>

          {/* ── Modal Tabs ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 14, marginTop: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 2 }}>
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', fontSize: 11.5, fontWeight: activeTab === 'tools' ? 600 : 500,
                color: activeTab === 'tools' ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${activeTab === 'tools' ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent', border: 'none', cursor: 'pointer',
                marginBottom: -3, transition: 'all 0.12s',
              }}
            >
              <Zap size={13} strokeWidth={2} />
              Herramientas ({filteredTools.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', fontSize: 11.5, fontWeight: activeTab === 'config' ? 600 : 500,
                color: activeTab === 'config' ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${activeTab === 'config' ? 'var(--accent)' : 'transparent'}`,
                background: 'transparent', border: 'none', cursor: 'pointer',
                marginBottom: -3, transition: 'all 0.12s',
              }}
            >
              <SlidersHorizontal size={13} strokeWidth={2} />
              Configuración & Especificaciones
            </button>
          </div>
        </div>

        {/* ── Tab Content Area ────────────────────────────────────────── */}
        <div style={{ padding: '16px 24px', minHeight: 240, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* TAB 1: TOOLS */}
          {activeTab === 'tools' && (
            <>
              {needsOAuth && mode === 'probe' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '16px 18px', textAlign: 'center', borderRadius: 14,
                  background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(59,130,246,0.14)', color: '#60a5fa',
                  }}>
                    <Shield size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Autenticación OAuth 2.0 Requerida
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5, maxWidth: 380 }}>
                      Al hacer clic en **"Autorizar e instalar"**, tu navegador se abrirá automáticamente sin pasos de configuración manuales.
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-elevated)' }}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  <span>Verificando servidor en tiempo real… (mostrando catálogo de referencia)</span>
                </div>
              )}

              {error && (
                <div style={{ fontSize: 11, color: 'var(--status-err)', padding: '8px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--status-err) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--status-err) 20%, transparent)' }}>
                  {error}
                </div>
              )}

              {filteredTools.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Buscar herramientas expuestas por el servidor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%', padding: '6px 10px 6px 30px', borderRadius: 8,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
                        color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-ui)', outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    {filteredTools.map((tool, i) => (
                      <div key={tool.name} style={i > 0 ? { borderTop: '1px solid var(--border-subtle)' } : {}}>
                        <McpToolItem tool={tool} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: CONFIGURATION & SPECIFICATIONS */}
          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* SUB-CARD 1: COMMAND / ENDPOINT TERMINAL */}
              <div style={{
                borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-normal)',
                padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Terminal size={14} style={{ color: 'var(--accent)' }} />
                    {catalogEntry?.type === 'http' || config?.type === 'http' ? 'Endpoint HTTP SSE' : 'Comando de Inicio CLI (Stdio)'}
                  </div>
                  <button
                    type="button"
                    onClick={copyCommandText}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                      fontSize: 10, fontWeight: 600, color: copied ? 'var(--status-ok)' : 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.12s',
                    }}
                  >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>

                <div style={{
                  padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)',
                  fontSize: 11, color: 'var(--text-primary)', wordBreak: 'break-all', lineHeight: 1.45,
                }}>
                  {resolvedCommand}
                </div>
              </div>

              {/* SUB-CARD 2: SPECIFICATIONS & ARCHITECTURE GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div style={{
                  borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Cpu size={11} /> Transporte
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {catalogEntry?.type === 'http' || config?.type === 'http' ? 'HTTP Remoto (Server-Sent Events)' : 'Stdio (IPC Aislado Local)'}
                  </span>
                </div>

                <div style={{
                  borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} /> Mantenimiento
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: catalogEntry?.maintained !== false ? 'var(--status-ok)' : 'var(--text-secondary)' }}>
                    {catalogEntry?.maintained !== false ? '✓ Oficial por Proveedor' : 'Comunidad'}
                  </span>
                </div>
              </div>

              {/* SUB-CARD 3: VAULT & ENVIRONMENT VARIABLES */}
              <div style={{
                borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <ShieldCheck size={13} style={{ color: 'var(--status-ok)' }} />
                  Seguridad & Variables de Entorno
                </div>

                {envRequired.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {envRequired.map((envName) => (
                      <span key={envName} style={{
                        fontSize: 10.5, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 6,
                        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                        color: 'var(--accent)', fontWeight: 600,
                      }}>
                        🔑 {envName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    No requiere variables de entorno adicionales. Protegido localmente por Sparta Vault.
                  </span>
                )}
              </div>

              {/* SUB-CARD 4: DOCUMENTATION & NOTES */}
              {catalogEntry?.docs_url && (
                <div style={{
                  borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
                      Documentación oficial del desarrollador
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternal(catalogEntry.docs_url!)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
                      fontSize: 10.5, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer',
                    }}
                  >
                    Ver guía
                    <ExternalLink size={10} />
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

        {/* ── Modal Footer ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-normal)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 11.5, fontWeight: 500, fontFamily: 'var(--font-ui)',
              transition: 'all 0.12s',
            }}
          >
            {t('mcp.close') ?? 'Cerrar'}
          </button>
          {mode === 'probe' && onInstall && (
            <Button
              onClick={() => { onInstall(); onClose() }}
              disabled={loading}
              style={{ fontSize: 11.5, fontWeight: 600, height: 34, paddingLeft: 18, paddingRight: 18, gap: 6 }}
            >
              {needsOAuth ? <Shield size={13} strokeWidth={2.5} /> : <Check size={13} strokeWidth={2.5} />}
              {needsOAuth
                ? (t('mcp.authorizeAndInstall') ?? 'Autorizar e instalar')
                : (t('mcp.install') ?? 'Instalar Servidor')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
