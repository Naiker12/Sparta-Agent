import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plug, Check, Loader2, Upload,
  Terminal, Globe, Copy, Info,
} from 'lucide-react'
import { useMCPStore } from '@/stores/mcp.store'
import type { MCPServerConfig, MCPServerType } from '@/types'
import { useTranslation } from '@/i18n'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

interface AddMcpServerDialogProps {
  open: boolean
  onClose: () => void
  editServer?: MCPServerConfig | null
}

type InputMode = 'manual' | 'config'

/* ── Shared input style ─────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px',
  borderRadius: 7, border: '1px solid var(--border-normal)',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  fontSize: 11, fontFamily: 'var(--font-ui)',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.12s',
}

export function AddMcpServerDialog({ open, onClose, editServer }: AddMcpServerDialogProps) {
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

    const safe = await storeSecretsInVault(buildConfig())
    if (isEditing && editServer.id && editServer.id !== safe.id) removeServer(editServer.id)
    addServer(safe)
    reset(); onClose()
  }

  function buildConfig(): MCPServerConfig {
    return {
      id: (editServer?.id ?? name.toLowerCase().replace(/\s+/g, '-')),
      name: name.trim(),
      type,
      command: type === 'stdio' ? command.trim() : undefined,
      args: type === 'stdio' ? args.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
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
    }
  }

  async function handleTest() {
    setTesting(true); setTestResult(null)
    const config = buildConfig()
    try {
      if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).electron) {
        const win = window as unknown as { electron: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }
        const result = await win.electron.invoke('mcp:test', config) as { ok: boolean; toolCount?: number; error?: string }
        if (result.ok) {
          setTestResult(`Conectado — ${result.toolCount ?? 0} ${t('mcp.toolsDiscovered')}`)
        } else {
          setTestResult(`Error: ${result.error ?? 'Conexión fallida'}`)
        }
      } else if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).sparta) {
        const win = window as unknown as { sparta: { testMcpConnection: (config: Record<string, unknown>) => Promise<{ ok: boolean; toolCount?: number; error?: string }> } }
        const result = await win.sparta.testMcpConnection(config as unknown as Record<string, unknown>)
        if (result.ok) {
          setTestResult(`Conectado — ${result.toolCount ?? 0} ${t('mcp.toolsDiscovered')}`)
        } else {
          setTestResult(`Error: ${result.error ?? 'Conexión fallida'}`)
        }
      } else {
        setTestResult('Modo web: no disponible')
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
  }

  const canSubmitManual = name.trim() && (type === 'stdio' ? command.trim() : url.trim())
  const canSubmitConfig = configJson.trim().length > 2

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { reset(); onClose() } }}>
      <DialogContent
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-normal)',
          borderRadius: 14,
          padding: 0,
          maxWidth: 500,
          width: '100%',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {isEditing ? t('mcp.editServer') : t('mcp.addServerTitle')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('mcp.addServerDesc')}
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex', marginTop: 14, gap: 0,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {(['manual', 'config'] as InputMode[]).map((mode) => {
              const label = mode === 'manual' ? t('mcp.manualConfig') : t('mcp.importJson')
              const active = inputMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInputMode(mode)}
                  style={{
                    padding: '6px 14px 8px', fontSize: 11, fontWeight: active ? 600 : 500,
                    fontFamily: 'var(--font-ui)', cursor: 'pointer',
                    border: 'none', background: 'transparent',
                    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    marginBottom: -1, outline: 'none', transition: 'all 0.12s',
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
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {inputMode === 'manual' ? (
              <>
                {/* Server name */}
                <FieldRow label={t('mcp.serverName')}>
                  <FocusInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('mcp.serverNamePlaceholder')}
                    autoFocus
                  />
                </FieldRow>

                {/* Connection type */}
                <FieldRow label={t('mcp.connectionType')}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <TypeCard
                      active={type === 'stdio'}
                      icon={<Terminal size={13} />}
                      title={t('mcp.stdio')}
                      subtitle={t('mcp.stdioDesc')}
                      onClick={() => { setType('stdio'); setTestResult(null) }}
                    />
                    <TypeCard
                      active={type === 'http'}
                      icon={<Globe size={13} />}
                      title={t('mcp.httpSse')}
                      subtitle={t('mcp.httpSseDesc')}
                      onClick={() => { setType('http'); setTestResult(null) }}
                    />
                  </div>
                </FieldRow>

                {/* Command / URL */}
                {type === 'stdio' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                    <FieldRow label={t('mcp.command')}>
                      <FocusInput value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
                    </FieldRow>
                    <FieldRow label={t('mcp.arguments')}>
                      <FocusInput
                        value={args}
                        onChange={(e) => setArgs(e.target.value)}
                        placeholder="-y @modelcontextprotocol/server-filesystem ./"
                      />
                    </FieldRow>
                  </div>
                ) : (
                  <FieldRow label={t('mcp.serverUrl')}>
                    <FocusInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001/mcp" />
                  </FieldRow>
                )}

                {/* Env vars */}
                <FieldRow label={t('mcp.envVars')}>
                  <FocusInput
                    value={envVars}
                    onChange={(e) => setEnvVars(e.target.value)}
                    placeholder="KEY=value KEY2=value2"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <Info size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {t('mcp.envVarsHint')}
                    </span>
                  </div>
                </FieldRow>

                {/* Command preview */}
                <FieldRow label={t('mcp.commandPreview')}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 10px', minHeight: 34, borderRadius: 7,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                  }}>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)',
                      fontStyle: isEmpty ? 'italic' : 'normal',
                      userSelect: 'all',
                    }}>
                      {isEmpty ? t('mcp.commandPreviewPlaceholder') : preview}
                    </span>
                    {!isEmpty && (
                      <button
                        type="button"
                        onClick={copyPreview}
                        title="Copy"
                        style={{
                          width: 22, height: 22, borderRadius: 5, border: 'none',
                          background: copied ? 'rgba(34,197,94,0.12)' : 'transparent',
                          color: copied ? 'var(--status-ok)' : 'var(--text-muted)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.12s',
                        }}
                      >
                        {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </FieldRow>

                {/* Test connection */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testing || (type === 'stdio' ? !command.trim() : !url.trim())}
                    style={{ fontSize: 11, fontWeight: 600, gap: 6, height: 28, paddingLeft: 10, paddingRight: 10, flexShrink: 0 }}
                  >
                    {testing
                      ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Plug size={11} />}
                    {t('mcp.testConnection')}
                  </Button>
                  {testResult ? (
                    <span style={{ fontSize: 11, color: 'var(--status-ok)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={11} strokeWidth={2.5} />
                      {testResult}
                    </span>
                  ) : !testing && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {t('mcp.testHint')}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Info banner */}
                <div style={{
                  display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                  background: 'var(--accent-muted)', border: '1px solid var(--accent-dim)',
                }}>
                  <Info size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  <span
                    style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-ui)' }}
                    dangerouslySetInnerHTML={{ __html: t('mcp.importJsonHint') }}
                  />
                </div>

                {/* JSON textarea */}
                <FieldRow label={t('mcp.jsonConfig')}>
                  <textarea
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]\n    }\n  }\n}`}
                    style={{
                      width: '100%', minHeight: 160, resize: 'vertical',
                      padding: '10px 12px', borderRadius: 7,
                      border: '1px solid var(--border-normal)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5,
                      outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.12s',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-normal)' }}
                  />
                </FieldRow>

                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                    border: '1px solid var(--border-normal)',
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
                    alignSelf: 'flex-start', transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-normal)' }}
                >
                  <Upload size={12} />
                  {t('mcp.loadConfigFile')}
                </button>
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
            padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={() => { reset(); onClose() }}
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
              {t('mcp.cancel')}
            </button>
            <Button
              form="mcp-form"
              type="submit"
              disabled={inputMode === 'manual' ? !canSubmitManual : !canSubmitConfig}
              style={{ fontSize: 11, fontWeight: 600, height: 32, minWidth: 130, paddingLeft: 16, paddingRight: 16 }}
            >
              {inputMode === 'config'
                ? t('mcp.importServers')
                : isEditing ? t('mcp.saveChanges') : t('mcp.addServer')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Sub-components ─────────────────────────────────────────── */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-ui)' }}>
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
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-normal)' }}
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
        padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
        border: active ? '1px solid var(--accent)' : '1px solid var(--border-normal)',
        background: active ? 'var(--accent-muted)' : 'var(--bg-elevated)',
        outline: 'none', textAlign: 'left', width: '100%',
        transition: 'all 0.12s',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent)' : 'var(--bg-active)',
        color: active ? '#fff' : 'var(--text-muted)',
        transition: 'all 0.12s',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}
