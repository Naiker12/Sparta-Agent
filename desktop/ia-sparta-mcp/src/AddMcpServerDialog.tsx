import { useState, useEffect, useRef } from 'react'
import {
  Plug, Check, Loader2, Upload,
  Terminal, Globe, Copy, Info,
} from 'lucide-react'
import { useMCPStore } from 'ia-sparta-core'
import type { MCPServerConfig, MCPServerType, MCPAuthType, MCPTool } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'
import { getVendorForServer, getAuthTypeForServer } from './data/mcp-catalog'
import { OAuthConnectDialog } from './OAuthConnectDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'ia-sparta-design-system'

interface AddMcpServerDialogProps {
  open: boolean
  onClose: () => void
  editServer?: MCPServerConfig | null
  initialTools?: MCPTool[]
}

type InputMode = 'manual' | 'config'

/* ── Shared input style ─────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #DED7CB',
  backgroundColor: '#FFFFFF',
  color: '#1C1713',
  fontSize: 12,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

export function AddMcpServerDialog({ open, onClose, editServer, initialTools }: AddMcpServerDialogProps) {
  const { addServer, removeServer } = useMCPStore()
  const { t } = useTranslation()

  const [name, setName] = useState('')
  const [type, setType] = useState<MCPServerType>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [url, setUrl] = useState('')
  const [envVars, setEnvVars] = useState('')
  const [configJson, setConfigJson] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [authType, setAuthType] = useState<MCPAuthType>('none')
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false)
  const [oauthAuthorizeUrl, setOauthAuthorizeUrl] = useState<string | undefined>()
  const [oauthTokenEndpoint, setOauthTokenEndpoint] = useState<string | undefined>()
  const [oauthClientId, setOauthClientId] = useState<string | undefined>()

  useEffect(() => {
    if (open) {
      setName(editServer?.name ?? '')
      setType(editServer?.type ?? 'stdio')
      setCommand(editServer?.command ?? '')
      setArgs((editServer?.args ?? []).join(' '))
      setUrl(editServer?.url ?? '')
      setEnvVars('')
      setConfigJson('')
      setInputMode('manual')
      setTestResult(null)
      setAuthType(editServer?.auth_type ?? getAuthTypeForServer(editServer?.id ?? '') ?? 'none')
    }
  }, [open, editServer])

  const isEditing = !!editServer
  const isEmpty = type === 'stdio' ? !command.trim() : !url.trim()
  const preview = type === 'stdio'
    ? `${command || '[cmd]'} ${args || ''}`.trim()
    : url || '[url]'

  async function storeSecretsInVault(config: MCPServerConfig): Promise<MCPServerConfig> {
    /** Move env/headers secrets to Electron vault, return config with refs only. */
    if (typeof window === 'undefined' || !window.vault?.isAvailable) return config

    const result = { ...config } as Record<string, unknown> & MCPServerConfig

    // Store env vars
    if (config.env && Object.keys(config.env).length > 0) {
      const refs: string[] = []
      for (const [k, v] of Object.entries(config.env)) {
        if (v) {
          const vaultKey = `mcp:${config.id}:${k}`
          await window.vault.storeKey(vaultKey, v, 'mcp')
          refs.push(k)
        }
      }
      delete result.env
      if (refs.length > 0) result.env_vault_refs = refs
    }

    // Store headers
    if (config.headers && Object.keys(config.headers).length > 0) {
      const refs: string[] = []
      for (const [k, v] of Object.entries(config.headers)) {
        if (v) {
          const vaultKey = `mcp:${config.id}:${k}`
          await window.vault.storeKey(vaultKey, v, 'mcp')
          refs.push(k)
        }
      }
      delete result.headers
      if (refs.length > 0) result.headers_vault_refs = refs
    }

    return result as MCPServerConfig
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (inputMode === 'config') {
      try {
        const parsed = JSON.parse(configJson)
        const servers = parsed.mcpServers ?? parsed
        for (const [serverName, serverConfig] of Object.entries(servers)) {
          const cfg = serverConfig as Record<string, unknown>
          const id = serverName.toLowerCase().replace(/\s+/g, '-')
          const baseCfg: MCPServerConfig = {
            id, name: serverName, type: cfg.command ? 'stdio' : 'http', enabled: true,
            auth_type: 'none',
            ...(cfg.command
              ? { command: cfg.command as string, args: (cfg.args as string[]) ?? [] }
              : { url: (cfg.url as string) ?? '' }),
            env: cfg.env as Record<string, string> | undefined,
            headers: cfg.headers as Record<string, string> | undefined,
          }
          const safe = await storeSecretsInVault(baseCfg)
          addServer(safe)
        }
        reset(); onClose()
        return
      } catch { return }
    }
    if (!name.trim()) return
    if (type === 'stdio' && !command.trim()) return
    if (type === 'http' && !url.trim()) return

    if (authType === 'oauth2') {
      const serverUrl = getOAuthServerUrl(editServer?.id ?? name.toLowerCase().replace(/\s+/g, '-'))
      if (serverUrl) {
        try {
          const win = window as unknown as { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }
          const discovery = await win.electron.invoke('mcp:oauth:discover', { serverUrl }) as {
            ok: boolean
            authorization_endpoint?: string
            token_endpoint?: string
            client_id?: string
            error?: string
          }
          if (discovery.ok && discovery.authorization_endpoint) {
            setOauthAuthorizeUrl(discovery.authorization_endpoint)
            setOauthTokenEndpoint(discovery.token_endpoint)
            setOauthClientId(discovery.client_id)
            setOauthDialogOpen(true)
            return
          }
        } catch {
          // Discovery failed — fall back to catalog URL
        }
      }
      const fallbackUrl = getOAuthFallbackUrl(editServer?.id ?? name.toLowerCase().replace(/\s+/g, '-'))
      if (fallbackUrl) {
        setOauthAuthorizeUrl(fallbackUrl)
        setOauthDialogOpen(true)
        return
      }
    }

    const safe = await storeSecretsInVault(buildConfig())
    if (isEditing && editServer.id && editServer.id !== safe.id) removeServer(editServer.id)
    addServer(safe)
    if (initialTools) {
      useMCPStore.getState().setServerTools(safe.id, initialTools)
    }
    reset(); onClose()
  }

  function getOAuthServerUrl(serverId: string): string | undefined {
    const urls: Record<string, string> = {
      supabase: 'https://mcp.supabase.com/mcp',
      'google-drive': 'https://workspace-mcp.googleapis.com/mcp',
      gmail: 'https://gmail-mcp.googleapis.com/mcp',
      'google-calendar': 'https://calendar-mcp.googleapis.com/mcp',
      notion: 'https://mcp.notion.com/mcp',
      slack: 'https://mcp.slack.com/mcp',
      figma: 'https://mcp.figma.com/mcp',
      sentry: 'https://mcp.sentry.dev/mcp',
    }
    return urls[serverId]
  }

  function getOAuthFallbackUrl(serverId: string): string | undefined {
    const urls: Record<string, string> = {
      supabase: 'https://mcp.supabase.com/mcp/auth',
      'google-drive': 'https://accounts.google.com/o/oauth2/v2/auth',
      onedrive: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      gmail: 'https://accounts.google.com/o/oauth2/v2/auth',
      'google-calendar': 'https://accounts.google.com/o/oauth2/v2/auth',
      notion: 'https://api.notion.com/v1/oauth/authorize',
      slack: 'https://slack.com/oauth/v2/authorize',
      figma: 'https://www.figma.com/oauth',
      sentry: 'https://sentry.dev/oauth/authorize',
    }
    return urls[serverId]
  }

  async function handleOAuthConnected(result: { accountLabel?: string; accessToken?: string; refreshToken?: string }) {
    const config = buildConfig()
    config.auth_type = 'oauth2'
    config.oauth = {
      provider_authorize_url: oauthAuthorizeUrl ?? getOAuthFallbackUrl(config.id) ?? '',
      connected_at: new Date().toISOString(),
      account_label: result.accountLabel,
      token_endpoint: oauthTokenEndpoint,
      client_id: oauthClientId,
    }
    let safe = { ...config } as MCPServerConfig
    if (result.accessToken && typeof window !== 'undefined' && await window.vault?.isAvailable()) {
      const vaultKey = `mcp:${config.id}:oauth_token`
      await window.vault.storeKey(vaultKey, result.accessToken, 'mcp')
      safe.oauth = { ...safe.oauth!, token_vault_ref: vaultKey }
      if (result.refreshToken) {
        const refreshVaultKey = `mcp:${config.id}:oauth_refresh_token`
        await window.vault.storeKey(refreshVaultKey, result.refreshToken, 'mcp')
        safe.oauth = { ...safe.oauth!, refresh_token_vault_ref: refreshVaultKey }
      }
    }
    safe = await storeSecretsInVault(safe)
    if (isEditing && editServer.id && editServer.id !== safe.id) removeServer(editServer.id)
    addServer(safe)
    if (initialTools) {
      useMCPStore.getState().setServerTools(safe.id, initialTools)
    }
    reset()
    setOauthDialogOpen(false)
    onClose()
  }

  function buildConfig(): MCPServerConfig {
    return {
      id: (editServer?.id ?? name.toLowerCase().replace(/\s+/g, '-')),
      name: name.trim(),
      type,
      command: type === 'stdio' ? command.trim() : undefined,
      args: type === 'stdio' ? parseShellArgs(args) : undefined,
      env: type === 'stdio' && envVars.trim()
        ? Object.fromEntries(
            envVars.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
              const idx = l.indexOf('=')
              return idx > 0 ? [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] : [l, '']
            })
          )
        : undefined,
      url: type === 'http' ? url.trim() : undefined,
      headers: type === 'http' && envVars.trim()
        ? Object.fromEntries(
            envVars.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
              const idx = l.indexOf('=')
              return idx > 0 ? [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] : [l, '']
            })
          )
        : undefined,
      enabled: true,
      auth_type: authType,
    }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    const config = buildConfig()
    try {
      let result: { ok: boolean; tools?: Array<{ name: string; description: string; inputSchema: unknown }>; toolCount?: number; error?: string }
      if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).electron) {
        const win = window as unknown as { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }
        result = await win.electron.invoke('mcp:test', config) as typeof result
      } else if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).sparta) {
        const win = window as unknown as { sparta: { testMcpConnection: (config: Record<string, unknown>) => Promise<typeof result> } }
        result = await win.sparta.testMcpConnection(config as unknown as Record<string, unknown>)
      } else {
        setTestResult('Modo web: no disponible'); setTesting(false); return
      }
      if (result.ok) {
        setTestResult(`Conectado — ${result.toolCount ?? 0} ${t('mcp.toolsDiscovered')}`)
        if (result.tools) {
          const store = useMCPStore.getState()
          store.setServerTools(config.id, result.tools.map((t) => ({ ...t, serverId: config.id })))
          store.setConnected(config.id, true)
        }
      } else {
        setTestResult(`Error: ${result.error ?? 'Conexión fallida'}`)
      }
    } catch (err) {
      setTestResult(`Error: ${(err as Error).message ?? 'Error desconocido'}`)
    } finally {
      setTesting(false)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setConfigJson(reader.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }

  function copyPreview() {
    navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function reset() {
    setName(''); setType('stdio'); setCommand(''); setArgs('')
    setUrl(''); setEnvVars(''); setConfigJson('')
    setInputMode('manual'); setTestResult(null)
    setAuthType('none'); setOauthDialogOpen(false)
    setOauthAuthorizeUrl(undefined); setOauthTokenEndpoint(undefined); setOauthClientId(undefined)
  }

  const canSubmitManual = name.trim() && (type === 'stdio' ? command.trim() : url.trim())
  const canSubmitConfig = configJson.trim().length > 2

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { reset(); onClose() } }}>
      <DialogContent
        className="max-w-[540px] w-full overflow-hidden p-0"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #EAE3D8',
          borderRadius: 20,
          padding: 0,
          maxWidth: 540,
          width: '100%',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          boxShadow: '0 24px 64px -12px rgba(40, 25, 10, 0.18), 0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px 14px',
          borderBottom: '1px solid #F0ECE4',
        }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 700, color: '#1C1713', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
              {isEditing ? t('mcp.editServer') || 'Editar servidor MCP' : t('mcp.addServerTitle') || 'Agregar servidor MCP'}
            </DialogTitle>
            <DialogDescription style={{ fontSize: 12, color: '#786C5E', lineHeight: 1.5, margin: '3px 0 0 0' }}>
              {t('mcp.addServerDesc') || 'Conecta un servidor MCP para exponer herramientas al agente.'}
            </DialogDescription>
          </DialogHeader>

          {/* Mode tabs */}
          <div style={{
            display: 'flex', marginTop: 14, gap: 4,
            borderBottom: '1px solid #F0ECE4',
          }}>
            {(['manual', 'config'] as InputMode[]).map((mode) => {
              const label = mode === 'manual' ? (t('mcp.manualConfig') || 'Configuración manual') : (t('mcp.importJson') || 'Importar JSON')
              const active = inputMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInputMode(mode)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: `2px solid ${active ? '#B45309' : 'transparent'}`,
                    color: active ? '#B45309' : '#8A7D6F',
                    marginBottom: -1,
                    outline: 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <form id="mcp-form" onSubmit={handleSubmit}>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto' }}>

            {inputMode === 'manual' ? (
              <>
                {/* Server name */}
                <FieldRow label={t('mcp.serverName') || 'NOMBRE DEL SERVIDOR'}>
                  <FocusInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('mcp.serverNamePlaceholder') || 'Ej: MongoDB, GitHub, Filesystem...'}
                    autoFocus
                  />
                </FieldRow>

                {/* Auth type — show badge or selector */}
                {editServer && getAuthTypeForServer(editServer.id) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderRadius: 8,
                    backgroundColor: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AUTH
                    </span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)',
                      padding: '2px 8px', borderRadius: 5,
                      backgroundColor: authType === 'oauth2'
                        ? '#EFF6FF'
                        : authType === 'api_key'
                          ? '#FEF3C7'
                          : '#F5EFE6',
                      color: authType === 'oauth2'
                        ? '#1D4ED8'
                        : authType === 'api_key'
                          ? '#92400E'
                          : '#5C5245',
                      border: `1px solid ${
                        authType === 'oauth2'
                          ? '#BFDBFE'
                          : authType === 'api_key'
                            ? '#FDE68A'
                            : '#E6DFD5'
                      }`,
                    }}>
                      {authType === 'oauth2' ? 'OAuth 2.0' : authType === 'api_key' ? 'API Key' : 'Sin auth'}
                    </span>
                  </div>
                )}

                {/* Connection type */}
                <FieldRow label={t('mcp.connectionType') || 'TIPO DE CONEXIÓN'}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <TypeCard
                      active={type === 'stdio'}
                      icon={<Terminal size={14} />}
                      title={t('mcp.stdio') || 'Stdio'}
                      subtitle={t('mcp.stdioDesc') || 'Proceso local'}
                      onClick={() => { setType('stdio'); setTestResult(null) }}
                    />
                    <TypeCard
                      active={type === 'http'}
                      icon={<Globe size={14} />}
                      title={t('mcp.httpSse') || 'HTTP / SSE'}
                      subtitle={t('mcp.httpSseDesc') || 'Servidor remoto'}
                      onClick={() => { setType('http'); setTestResult(null) }}
                    />
                  </div>
                </FieldRow>

                {/* Command / URL */}
                {type === 'stdio' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10 }}>
                    <FieldRow label={t('mcp.command') || 'COMANDO'}>
                      <FocusInput value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
                    </FieldRow>
                    <FieldRow label={t('mcp.arguments') || 'ARGUMENTOS'}>
                      <FocusInput
                        value={args}
                        onChange={(e) => setArgs(e.target.value)}
                        placeholder="-y @modelcontextprotocol/server-filesystem ./"
                      />
                    </FieldRow>
                  </div>
                ) : (
                  <FieldRow label={t('mcp.serverUrl') || 'URL DEL SERVIDOR'}>
                    <FocusInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001/mcp" />
                  </FieldRow>
                )}

                {/* Env vars */}
                <FieldRow label={t('mcp.envVars') || 'VARIABLES DE ENTORNO'}>
                  <FocusInput
                    value={envVars}
                    onChange={(e) => setEnvVars(e.target.value)}
                    placeholder="KEY=value KEY2=value2"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <Info size={11} color="#8A7D6F" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: '#8A7D6F', lineHeight: 1.4 }}>
                      {t('mcp.envVarsHint') || 'Opcional · separar con espacios: API_KEY=sk-xxx PORT=3001'}
                    </span>
                  </div>
                </FieldRow>

                {/* Command preview */}
                <FieldRow label={t('mcp.commandPreview') || 'VISTA PREVIA DEL COMANDO'}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 12px', minHeight: 36, borderRadius: 8,
                    border: '1px solid #EAE3D8',
                    backgroundColor: '#FAF8F5',
                    fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
                  }}>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: isEmpty ? '#A89F91' : '#2A241E',
                      fontStyle: isEmpty ? 'italic' : 'normal',
                      userSelect: 'all',
                    }}>
                      {isEmpty ? (t('mcp.commandPreviewPlaceholder') || 'El comando se mostrará aquí') : preview}
                    </span>
                    {!isEmpty && (
                      <button
                        type="button"
                        onClick={copyPreview}
                        title="Copiar comando"
                        style={{
                          width: 24, height: 24, borderRadius: 6, border: 'none',
                          backgroundColor: copied ? '#DCFCE7' : 'transparent',
                          color: copied ? '#166534' : '#8A7D6F',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.12s',
                        }}
                      >
                        {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                </FieldRow>

                {/* Test connection */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  border: '1px solid #EAE3D8',
                  backgroundColor: '#FAF8F5',
                }}>
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || (type === 'stdio' ? !command.trim() : !url.trim())}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 30,
                      padding: '0 12px',
                      borderRadius: 7,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #DED7CB',
                      color: '#2A241E',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: testing || (type === 'stdio' ? !command.trim() : !url.trim()) ? 'default' : 'pointer',
                      opacity: testing || (type === 'stdio' ? !command.trim() : !url.trim()) ? 0.6 : 1,
                      flexShrink: 0,
                      transition: 'background-color 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!testing && (type === 'stdio' ? command.trim() : url.trim())) {
                        e.currentTarget.style.backgroundColor = '#F5EFE6'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF'
                    }}
                  >
                    {testing
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Plug size={12} color="#B45309" />}
                    <span>{t('mcp.testConnection') || 'Probar conexión'}</span>
                  </button>
                  {testResult ? (
                    <span style={{ fontSize: 11, color: testResult.startsWith('Error') ? '#DC2626' : '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {!testResult.startsWith('Error') && <Check size={12} strokeWidth={2.5} />}
                      {testResult}
                    </span>
                  ) : !testing && (
                    <span style={{ fontSize: 10.5, color: '#8A7D6F', lineHeight: 1.4 }}>
                      {t('mcp.testHint') || 'Verifica que el servidor responde correctamente antes de guardar'}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Info banner with modern ecosystem badges */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 10,
                  backgroundColor: '#FAF8F5', border: '1px solid #EAE3D8',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Info size={14} color="#B45309" style={{ flexShrink: 0 }} />
                    <span
                      style={{ fontSize: 11.5, color: '#423A31', lineHeight: 1.45, fontFamily: 'var(--font-ui, system-ui, sans-serif)', fontWeight: 500 }}
                      dangerouslySetInnerHTML={{ __html: t('mcp.importJsonHint') || 'Compatible con configuraciones de <strong>Claude Desktop</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong> y formato universal <code>mcpServers</code>.' }}
                    />
                  </div>

                  {/* Format Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {['Claude Desktop', 'Cursor IDE', 'Windsurf', 'Sparta Universal'].map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 999,
                          backgroundColor: '#F5EFE6',
                          color: '#786C5E',
                          border: '1px solid #E6DFD5',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Templates & Quick Load Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
                      PLANTILLAS:
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfigJson(`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]\n    }\n  }\n}`)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: '#FAF8F5',
                        border: '1px solid #DED7CB',
                        borderRadius: 6,
                        color: '#2A241E',
                        cursor: 'pointer',
                      }}
                    >
                      + Stdio (npx)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigJson(`{\n  "mcpServers": {\n    "remote-mcp": {\n      "url": "http://localhost:3001/mcp"\n    }\n  }\n}`)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: '#FAF8F5',
                        border: '1px solid #DED7CB',
                        borderRadius: 6,
                        color: '#2A241E',
                        cursor: 'pointer',
                      }}
                    >
                      + HTTP / SSE
                    </button>
                  </div>

                  {configJson.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(configJson)
                          setConfigJson(JSON.stringify(parsed, null, 2))
                        } catch { /* ignore */ }
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        border: '1px solid #DED7CB',
                        borderRadius: 6,
                        color: '#786C5E',
                        cursor: 'pointer',
                      }}
                      title="Formatear indentación JSON"
                    >
                      {'{ } Formatear'}
                    </button>
                  )}
                </div>

                {/* JSON textarea */}
                <FieldRow label={t('mcp.jsonConfig') || 'CONFIGURACIÓN JSON'}>
                  <textarea
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]\n    }\n  }\n}`}
                    style={{
                      width: '100%', minHeight: 160, resize: 'vertical',
                      padding: '10px 12px', borderRadius: 8,
                      border: '1px solid #DED7CB',
                      backgroundColor: '#FFFFFF', color: '#1C1713',
                      fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5, lineHeight: 1.5,
                      outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#B45309' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#DED7CB' }}
                  />
                </FieldRow>

                {/* Live validation status / detected servers */}
                {configJson.trim() && (
                  (() => {
                    try {
                      const parsed = JSON.parse(configJson)
                      const serversObj = parsed.mcpServers ?? parsed
                      const keys = typeof serversObj === 'object' && serversObj !== null ? Object.keys(serversObj) : []
                      if (keys.length > 0) {
                        return (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 7,
                            backgroundColor: '#DCFCE7', color: '#166534',
                            border: '1px solid #86EFAC', fontSize: 11, fontWeight: 600,
                          }}>
                            <Check size={13} strokeWidth={2.5} />
                            <span>{keys.length} {keys.length === 1 ? 'servidor detectado' : 'servidores detectados'}: {keys.join(', ')}</span>
                          </div>
                        )
                      }
                      return null
                    } catch (err) {
                      return (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 7,
                          backgroundColor: '#FEE2E2', color: '#991B1B',
                          border: '1px solid #FCA5A5', fontSize: 11, fontWeight: 500,
                        }}>
                          <Info size={13} />
                          <span>Sintaxis JSON incompleta o con errores: {(err as Error).message}</span>
                        </div>
                      )
                    }
                  })()
                )}

                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #DED7CB',
                    backgroundColor: '#FFFFFF', color: '#423A31',
                    fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                    alignSelf: 'flex-start', transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F5EFE6' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
                >
                  <Upload size={13} />
                  {t('mcp.loadConfigFile') || 'Cargar archivo JSON'}
                </button>
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
            padding: '14px 24px', borderTop: '1px solid #F0ECE4',
          }}>
            <button
              type="button"
              onClick={() => { reset(); onClose() }}
              style={{
                padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid #DED7CB',
                backgroundColor: '#FFFFFF', color: '#5C5245',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F5EFE6' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF' }}
            >
              {t('mcp.cancel') || 'Cancelar'}
            </button>
            <button
              form="mcp-form"
              type="submit"
              disabled={inputMode === 'manual' ? !canSubmitManual : !canSubmitConfig}
              style={{
                padding: '7px 20px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#B45309',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: (inputMode === 'manual' ? !canSubmitManual : !canSubmitConfig) ? 'default' : 'pointer',
                opacity: (inputMode === 'manual' ? !canSubmitManual : !canSubmitConfig) ? 0.5 : 1,
                transition: 'background-color 0.12s',
                fontFamily: 'var(--font-ui, system-ui, sans-serif)',
                minWidth: 140,
              }}
              onMouseEnter={(e) => {
                if (inputMode === 'manual' ? canSubmitManual : canSubmitConfig) {
                  e.currentTarget.style.backgroundColor = '#92400E'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#B45309'
              }}
            >
              {inputMode === 'config'
                ? (t('mcp.importServers') || 'Importar servidores')
                : isEditing ? (t('mcp.saveChanges') || 'Guardar cambios') : (t('mcp.addServer') || 'Agregar servidor')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

      <OAuthConnectDialog
        open={oauthDialogOpen}
        onClose={() => setOauthDialogOpen(false)}
        serverId={editServer?.id ?? name.toLowerCase().replace(/\s+/g, '-')}
        serverName={(name.trim() || editServer?.name) ?? ''}
        vendor={getVendorForServer(editServer?.id ?? '')}
        authorizeUrl={oauthAuthorizeUrl ?? ''}
        tokenEndpoint={oauthTokenEndpoint}
        clientId={oauthClientId}
        onConnected={handleOAuthConnected}
      />
    </>
  )
}

function parseShellArgs(input: string): string[] {
  const matches = input.trim().match(/"[^"]*"|'[^']*'|\S+/g)
  if (!matches) return []
  return matches.map((tok) => {
    if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) {
      return tok.slice(1, -1)
    }
    return tok
  })
}

/* ─── Sub-components ─────────────────────────────────────────── */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: '#8A7D6F', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono, monospace)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function FocusInput({
  value, onChange, placeholder, autoFocus,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={inputStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#B45309'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(180, 83, 9, 0.12)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#DED7CB'
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
  )
}

function TypeCard({ active, icon, title, subtitle, onClick }: {
  active: boolean; icon: React.ReactNode; title: string; subtitle: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        border: active ? '1.5px solid #B45309' : '1px solid #EAE3D8',
        backgroundColor: active ? '#FDF8F3' : '#FFFFFF',
        outline: 'none', textAlign: 'left', width: '100%',
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = '#DED6CA'
          e.currentTarget.style.backgroundColor = '#FAF8F5'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = '#EAE3D8'
          e.currentTarget.style.backgroundColor = '#FFFFFF'
        }
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? '#B45309' : '#F5EFE6',
        color: active ? '#FFFFFF' : '#8A7D6F',
        transition: 'all 0.12s',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#B45309' : '#1C1713', lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 10.5, color: '#786C5E', marginTop: 2, lineHeight: 1.3 }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}
