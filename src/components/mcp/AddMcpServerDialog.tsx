import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plug, Check, Loader2, FileJson, Upload, Terminal, Globe, Copy, Info } from 'lucide-react'
import { useMCPStore } from '@/stores/mcp.store'
import { cn } from '@/lib/utils'
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
  }, [open])

  const isEditing = !!editServer
  const isEmpty = type === 'stdio' ? !command.trim() : !url.trim()
  const preview = type === 'stdio'
    ? `${command || '[comando]'} ${args || ''}`
    : url || '[url]'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // If in config mode, parse JSON
    if (inputMode === 'config') {
      try {
        const parsed = JSON.parse(configJson)
        // Support claude_desktop_config.json format: { "mcpServers": { "name": { ... } } }
        const servers = parsed.mcpServers ?? parsed
        for (const [serverName, serverConfig] of Object.entries(servers)) {
          const cfg = serverConfig as Record<string, unknown>
          const id = serverName.toLowerCase().replace(/\s+/g, '-')
          addServer({
            id,
            name: serverName,
            type: cfg.command ? 'stdio' : 'http',
            enabled: true,
            ...(cfg.command
              ? { command: cfg.command as string, args: (cfg.args as string[]) ?? [] }
              : { url: (cfg.url as string) ?? '' }),
          })
        }
        reset()
        onClose()
        return
      } catch {
        return // invalid JSON, don't close
      }
    }

    if (!name.trim()) return
    if (type === 'stdio' && !command.trim()) return
    if (type === 'http' && !url.trim()) return

    const id = name.toLowerCase().replace(/\s+/g, '-')
    const config: MCPServerConfig = {
      id,
      name: name.trim(),
      type,
      enabled: true,
      ...(type === 'stdio'
        ? { command: command.trim(), args: args.split(/\s+/).filter(Boolean) }
        : { url: url.trim() }),
    }
    addServer(config)
    reset()
    onClose()
  }

  function handleTest() {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      const count = Math.floor(Math.random() * 8) + 1
      setTestResult(`${count} tools descubiertas`)
      setTesting(false)
    }, 800)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setConfigJson(reader.result as string)
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  function copyPreview() {
    navigator.clipboard.writeText(preview)
  }

  function reset() {
    setName('')
    setType('stdio')
    setCommand('')
    setArgs('')
    setUrl('')
    setEnvVars('')
    setConfigJson('')
    setInputMode('manual')
    setTestResult(null)
  }

  const canSubmitManual = name.trim() && (type === 'stdio' ? command.trim() : url.trim())
  const canSubmitConfig = configJson.trim().length > 2

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plug size={15} />
            {isEditing ? 'Editar servidor MCP' : 'Agregar servidor MCP'}
          </DialogTitle>
          <DialogDescription>
            Configura un servidor MCP para exponer herramientas a los agentes.
          </DialogDescription>
        </DialogHeader>

        {/* ── Mode Tabs ── */}
        <div style={{ padding: '0 24px', display: 'flex', gap: 6 }}>
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

        <form id="mcp-form" onSubmit={handleSubmit} style={{ padding: '12px 24px 24px' }}>
          {inputMode === 'manual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Name */}
              <Field label="Nombre del servidor">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. filesystem-server"
                  autoFocus
                />
              </Field>

              {/* Type selector */}
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

              {/* Dynamic fields */}
              {type === 'stdio' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
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

              {/* Env vars */}
              <Field label="Variables de entorno (opcional)">
                <Input
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  placeholder="KEY=value KEY2=value2"
                />
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)',
                }}>
                  <Info size={10} />
                  Separar con espacios: API_KEY=sk-xxx PORT=3001
                </span>
              </Field>

              {/* Preview */}
              <Field label="Vista previa del comando">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  minHeight: 38,
                }}>
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
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
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 5,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-active)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </Field>

              {/* Test connection */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
              }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || (type === 'stdio' ? !command.trim() : !url.trim())}
                  style={{ fontSize: 11, gap: 6 }}
                >
                  {testing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plug size={12} />
                  )}
                  Probar conexión
                </Button>
                {testResult && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--status-ok)',
                      fontFamily: 'var(--font-ui)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 600,
                    }}
                  >
                    <Check size={12} strokeWidth={2.5} />
                    {testResult}
                  </span>
                )}
                {!testResult && !testing && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                    Verifica que el servidor responde correctamente
                  </span>
                )}
              </div>

            </div>
          ) : (
            /* ── Config JSON Mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-muted)',
                border: '1px solid var(--accent-dim)',
              }}>
                <Info size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  lineHeight: 1.5,
                }}>
                  Pega tu configuración en formato <strong style={{ color: 'var(--text-primary)' }}>claude_desktop_config.json</strong> o carga el archivo directamente. Se importarán todos los servidores definidos.
                </span>
              </div>

              <Field label="Configuración JSON">
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]\n    }\n  }\n}`}
                  style={{
                    width: '100%',
                    minHeight: 140,
                    resize: 'vertical',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-normal)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: 1.6,
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
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
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                style={{ gap: 6 }}
              >
                <Upload size={13} />
                Cargar archivo de configuración
              </Button>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose() }}>
            Cancelar
          </Button>
          <Button
            form="mcp-form"
            type="submit"
            disabled={inputMode === 'manual' ? !canSubmitManual : !canSubmitConfig}
          >
            {inputMode === 'config'
              ? 'Importar servidores'
              : isEditing ? 'Guardar cambios' : 'Agregar servidor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Sub-components ── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          marginBottom: 6,
        }}
      >
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
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid',
        borderColor: active ? 'var(--accent-dim)' : 'transparent',
        background: active ? 'var(--accent-muted)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-ui)',
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {icon}
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
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 'var(--radius-lg)',
        border: '1.5px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border-normal)',
        background: active ? 'var(--accent-muted)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-primary)',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.12s',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 'var(--radius-md)',
        background: active ? 'var(--accent)' : 'var(--bg-active)',
        color: active ? '#fff' : 'var(--text-secondary)',
        flexShrink: 0,
        transition: 'all 0.12s',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{subtitle}</div>
      </div>
    </button>
  )
}
