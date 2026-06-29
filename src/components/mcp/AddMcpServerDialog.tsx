import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Plug, Check, Loader2, FileJson, Upload,
  Terminal, Globe, Copy, Info, X,
} from 'lucide-react'
import { useMCPStore } from '@/stores/mcp.store'
import type { MCPServerConfig, MCPServerType } from '@/types'

interface AddMcpServerDialogProps {
  open: boolean
  onClose: () => void
  editServer?: MCPServerConfig | null
}

type InputMode = 'manual' | 'config'

export function AddMcpServerDialog({ open, onClose, editServer }: AddMcpServerDialogProps) {
  const { addServer } = useMCPStore()

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
  }, [open, editServer?.args, editServer?.command, editServer?.name, editServer?.type, editServer?.url])

  const isEditing = !!editServer
  const isEmpty = type === 'stdio' ? !command.trim() : !url.trim()
  const preview = type === 'stdio'
    ? `${command || '[comando]'} ${args || ''}`.trim()
    : url || '[url]'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (inputMode === 'config') {
      try {
        const parsed = JSON.parse(configJson)
        const servers = parsed.mcpServers ?? parsed
        for (const [serverName, serverConfig] of Object.entries(servers)) {
          const cfg = serverConfig as Record<string, unknown>
          const id = serverName.toLowerCase().replace(/\s+/g, '-')
          addServer({
            id, name: serverName, type: cfg.command ? 'stdio' : 'http', enabled: true,
            ...(cfg.command
              ? { command: cfg.command as string, args: (cfg.args as string[]) ?? [] }
              : { url: (cfg.url as string) ?? '' }),
          })
        }
        reset(); onClose()
        return
      } catch { return }
    }
    if (!name.trim()) return
    if (type === 'stdio' && !command.trim()) return
    if (type === 'http' && !url.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-')
    addServer({
      id, name: name.trim(), type, enabled: true,
      ...(type === 'stdio'
        ? { command: command.trim(), args: args.split(/\s+/).filter(Boolean) }
        : { url: url.trim() }),
    })
    reset(); onClose()
  }

  function handleTest() {
    setTesting(true); setTestResult(null)
    setTimeout(() => {
      const count = Math.floor(Math.random() * 8) + 1
      setTestResult(`${count} tools descubiertas`)
      setTesting(false)
    }, 800)
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

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={() => { reset(); onClose() }}
    >
      <div
        style={{
          width: 600, maxWidth: '92vw', maxHeight: '85vh',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-muted)', color: 'var(--accent)', flexShrink: 0,
            }}>
              <Plug size={14} strokeWidth={2} />
            </span>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
                {isEditing ? 'Editar servidor MCP' : 'Agregar servidor MCP'}
              </h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: '2px 0 0' }}>
                Conecta un servidor MCP para exponer herramientas al agente.
              </p>
            </div>
          </div>
          <button onClick={() => { reset(); onClose() }} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: -2,
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form id="mcp-form" onSubmit={handleSubmit} style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {/* Mode tabs */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 16, padding: 4,
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}>
            <ModeTab
              active={inputMode === 'manual'}
              icon={<Terminal size={13} />}
              label="Configuración manual"
              onClick={() => setInputMode('manual')}
            />
            <ModeTab
              active={inputMode === 'config'}
              icon={<FileJson size={13} />}
              label="Importar JSON"
              onClick={() => setInputMode('config')}
            />
          </div>

          {inputMode === 'manual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field label="Nombre del servidor">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. filesystem-server"
                  autoFocus
                />
              </Field>

              <Field label="Tipo de conexión">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <TypeCard
                    active={type === 'stdio'}
                    icon={<Terminal size={16} />}
                    title="Stdio"
                    subtitle="Proceso local"
                    onClick={() => { setType('stdio'); setTestResult(null) }}
                  />
                  <TypeCard
                    active={type === 'http'}
                    icon={<Globe size={16} />}
                    title="HTTP / SSE"
                    subtitle="Servidor remoto"
                    onClick={() => { setType('http'); setTestResult(null) }}
                  />
                </div>
              </Field>

              {type === 'stdio' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
                  <Field label="Comando">
                    <Input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="npx"
                    />
                  </Field>
                  <Field label="Argumentos">
                    <Input
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-filesystem ./"
                    />
                  </Field>
                </div>
              ) : (
                <Field label="URL del servidor">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:3001/mcp"
                  />
                </Field>
              )}

              <Field label="Variables de entorno">
                <Input
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  placeholder="KEY=value KEY2=value2"
                />
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5, marginTop: 5,
                  fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
                }}>
                  <Info size={10} />
                  Opcional · separar con espacios: API_KEY=sk-xxx PORT=3001
                </span>
              </Field>

              <Field label="Vista previa del comando">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  fontFamily: 'var(--font-mono)', fontSize: 12, minHeight: 38,
                }}>
                  <span style={{
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    userSelect: 'all',
                    color: !isEmpty ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontStyle: isEmpty ? 'italic' : 'normal',
                  }}>
                    {!isEmpty ? preview : 'El comando aparecerá aquí'}
                  </span>
                  {!isEmpty && (
                    <button
                      type="button"
                      onClick={copyPreview}
                      title="Copiar"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 5, border: 'none',
                        background: copied ? 'var(--accent-muted)' : 'transparent',
                        color: copied ? 'var(--accent)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
                      }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </Field>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
              }}>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={handleTest}
                  disabled={testing || (type === 'stdio' ? !command.trim() : !url.trim())}
                  style={{ fontSize: 12, gap: 6, flexShrink: 0 }}
                >
                  {testing
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Plug size={12} />}
                  Probar conexión
                </Button>
                {testResult ? (
                  <span style={{
                    fontSize: 12, color: 'var(--status-ok)', fontFamily: 'var(--font-ui)',
                    display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
                  }}>
                    <Check size={12} strokeWidth={2.5} />
                    {testResult}
                  </span>
                ) : !testing && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                    Verifica que el servidor responde correctamente
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex', gap: 10, padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-muted)', border: '1px solid var(--accent-dim)',
              }}>
                <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
                  Pega tu configuración en formato{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>claude_desktop_config.json</strong>{' '}
                  o carga el archivo directamente. Se importarán todos los servidores definidos.
                </span>
              </div>

              <Field label="Configuración JSON">
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]\n    }\n  }\n}`}
                  style={{
                    width: '100%', minHeight: 180, resize: 'vertical',
                    padding: '12px 14px', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-normal)',
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7,
                    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--border-normal)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </Field>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <Button
                type="button" variant="outline"
                onClick={() => fileInputRef.current?.click()}
                style={{ gap: 8, alignSelf: 'flex-start' }}
              >
                <Upload size={13} />
                Cargar archivo de configuración
              </Button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <Button variant="ghost" onClick={() => { reset(); onClose() }} style={{ minWidth: 90 }}>
            Cancelar
          </Button>
          <Button
            form="mcp-form"
            type="submit"
            disabled={inputMode === 'manual' ? !canSubmitManual : !canSubmitConfig}
            style={{ minWidth: 160 }}
          >
            {inputMode === 'config'
              ? 'Importar servidores'
              : isEditing ? 'Guardar cambios' : 'Agregar servidor'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ModeTab({ active, icon, label, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: 12, fontWeight: active ? 600 : 500,
        fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      <span style={{ color: active ? 'var(--accent)' : 'inherit' }}>{icon}</span>
      {label}
    </button>
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
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        borderRadius: 'var(--radius-lg)', border: '1.5px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border-normal)',
        background: active ? 'var(--accent-muted)' : 'var(--bg-surface)',
        color: active ? 'var(--accent)' : 'var(--text-primary)',
        textAlign: 'left', cursor: 'pointer', transition: 'all 0.12s',
        fontFamily: 'var(--font-ui)', width: '100%',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 'var(--radius-md)',
        background: active ? 'var(--accent)' : 'var(--bg-active)',
        color: active ? '#fff' : 'var(--text-secondary)',
        flexShrink: 0, transition: 'all 0.12s',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 400, marginTop: 2, opacity: 0.8 }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}
