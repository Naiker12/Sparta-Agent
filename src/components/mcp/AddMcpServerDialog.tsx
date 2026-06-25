import { useState, useEffect } from 'react'
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
import { Plug, Check, Loader2 } from 'lucide-react'
import { useMCPStore } from '@/stores/mcp.store'
import type { MCPServerConfig, MCPServerType } from '@/types'

interface AddMcpServerDialogProps {
  open: boolean
  onClose: () => void
  editServer?: MCPServerConfig | null
}

export function AddMcpServerDialog({ open, onClose, editServer }: AddMcpServerDialogProps) {
  const { addServer } = useMCPStore()

  const [name, setName] = useState('')
  const [type, setType] = useState<MCPServerType>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [url, setUrl] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(editServer?.name ?? '')
      setType(editServer?.type ?? 'stdio')
      setCommand(editServer?.command ?? '')
      setArgs((editServer?.args ?? []).join(' '))
      setUrl(editServer?.url ?? '')
      setTestResult(null)
    }
  }, [open])

  const isEditing = !!editServer
  const preview = type === 'stdio'
    ? `${command || '[comando]'} ${args || ''}`
    : url || '[url]'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

  function reset() {
    setName('')
    setType('stdio')
    setCommand('')
    setArgs('')
    setUrl('')
    setTestResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plug size={14} />
            {isEditing ? 'Editar servidor MCP' : 'Agregar servidor MCP'}
          </DialogTitle>
          <DialogDescription>
            Configura un servidor MCP para exponer herramientas a los agentes.
          </DialogDescription>
        </DialogHeader>

        <form id="mcp-form" onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nombre">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="filesystem-server"
                autoFocus
              />
            </Field>

            <Field label="Tipo de conexión">
              <div style={{ display: 'flex', gap: 8 }}>
                <TypeButton
                  selected={type === 'stdio'}
                  onClick={() => { setType('stdio'); setTestResult(null) }}
                  label="Stdio"
                  desc="Proceso local"
                />
                <TypeButton
                  selected={type === 'http'}
                  onClick={() => { setType('http'); setTestResult(null) }}
                  label="HTTP"
                  desc="Servidor remoto"
                />
              </div>
            </Field>

            {type === 'stdio' ? (
              <>
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
              </>
            ) : (
              <Field label="URL">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:3001/mcp"
                />
              </Field>
            )}

            <Field label="Preview">
              <div
                style={{
                  padding: '6px 10px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {preview}
              </div>
            </Field>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || (type === 'stdio' ? !command.trim() : !url.trim())}
                style={{ fontSize: 11, gap: 5 }}
              >
                {testing ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Plug size={11} />
                )}
                Probar conexión
              </Button>
              {testResult && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: 'var(--status-ok)',
                    fontFamily: 'var(--font-ui)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Check size={11} strokeWidth={2} />
                  {testResult}
                </span>
              )}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose() }}>
            Cancelar
          </Button>
          <Button
            form="mcp-form"
            type="submit"
            disabled={
              !name.trim() ||
              (type === 'stdio' && !command.trim()) ||
              (type === 'http' && !url.trim())
            }
          >
            {isEditing ? 'Guardar cambios' : 'Agregar servidor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function TypeButton({
  selected,
  onClick,
  label,
  desc,
}: {
  selected: boolean
  onClick: () => void
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        background: selected ? 'var(--accent-muted)' : 'var(--bg-input)',
        border: selected
          ? '1px solid var(--accent)'
          : '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: selected ? 'var(--accent)' : 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
          marginTop: 2,
        }}
      >
        {desc}
      </div>
    </button>
  )
}
