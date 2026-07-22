import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Wifi, WifiOff, Plus, Plug, Terminal } from 'lucide-react'

type McpTransport = 'stdio' | 'http'

interface McpServerCardProps {
  id: string
  name: string
  transport: McpTransport
  connected: boolean
  toolCount: number
  command?: string
  url?: string
  onConnect: (id: string) => void
  onAddNew: () => void
}

interface AddServerFormProps {
  onAdd: (config: { name: string; transport: McpTransport; command?: string; url?: string }) => void
  onCancel: () => void
}

/**
 * AddServerForm — formulario inline dentro de la misma tarjeta para agregar
 * un nuevo servidor MCP. Sigue el patrón de confirmación dentro de la tarjeta
 * (no alert() ni toast separado).
 */
function AddServerForm({ onAdd, onCancel }: AddServerFormProps) {
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<McpTransport>('stdio')
  const [command, setCommand] = useState('')
  const [url, setUrl] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del servidor (ej: filesystem)"
        autoFocus
        style={{
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          border: '1px solid var(--border-normal)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setTransport('stdio')}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            border: `1px solid ${transport === 'stdio' ? 'var(--accent)' : 'var(--border-normal)'}`,
            borderRadius: 'var(--radius-sm)',
            background: transport === 'stdio' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
            color: transport === 'stdio' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            justifyContent: 'center',
          }}
        >
          <Terminal size={10} strokeWidth={1.5} />
          stdio
        </button>
        <button
          onClick={() => setTransport('http')}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            border: `1px solid ${transport === 'http' ? 'var(--accent)' : 'var(--border-normal)'}`,
            borderRadius: 'var(--radius-sm)',
            background: transport === 'http' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
            color: transport === 'http' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            justifyContent: 'center',
          }}
        >
          <Wifi size={10} strokeWidth={1.5} />
          HTTP
        </button>
      </div>

      {transport === 'stdio' ? (
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Comando (ej: npx -y @modelcontextprotocol/server-filesystem /ruta)"
          style={{
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
      ) : (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL del servidor (ej: http://localhost:3000)"
          style={{
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
      )}

      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
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
          onClick={() => {
            if (!name.trim()) return
            onAdd({
              name: name.trim(),
              transport,
              command: transport === 'stdio' ? command.trim() : undefined,
              url: transport === 'http' ? url.trim() : undefined,
            })
          }}
          disabled={!name.trim() || (transport === 'stdio' && !command.trim()) || (transport === 'http' && !url.trim())}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-ui)',
            background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'white',
            cursor: 'pointer',
            opacity: name.trim() ? 1 : 0.5,
          }}
        >
          <Plug size={11} />
          Conectar
        </button>
      </div>
    </div>
  )
}

/**
 * McpServerCard — muestra un servidor MCP con su tipo de transporte,
 * estado de conexión, herramientas que expone y acciones.
 *
 * Consistente con ProviderCard y SkillCard.
 */
export function McpServerCard({
  id,
  name,
  transport,
  connected,
  toolCount,
  command,
  url,
  onConnect,
  onAddNew,
}: McpServerCardProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  async function handleConnect() {
    setIsConnecting(true)
    try {
      await onConnect(id)
    } finally {
      setIsConnecting(false)
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
        border: `1px solid ${connected ? 'var(--border-subtle)' : 'var(--border-normal)'}`,
        background: connected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        marginBottom: 6,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Transport icon */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {transport === 'stdio' ? <Terminal size={13} strokeWidth={1.5} /> : <Wifi size={13} strokeWidth={1.5} />}
        </div>

        {/* Name + transport */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {name}
            <span style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'var(--bg-active)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {transport}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
            {connected ? `${toolCount} herramientas` : 'Desconectado'}
          </div>
        </div>

        {/* Connection indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? 'var(--status-ok)' : 'var(--status-muted)',
            flexShrink: 0,
          }}
        />

        {/* Connect / disconnect button */}
        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-ui)',
              border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              color: 'var(--accent)', cursor: isConnecting ? 'not-allowed' : 'pointer',
              opacity: isConnecting ? 0.6 : 1,
            }}
          >
            {isConnecting ? (
              <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Plug size={10} strokeWidth={1.5} />
            )}
            Conectar
          </button>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--status-ok)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
            <WifiOff size={10} strokeWidth={1.5} />
            Conectado
          </span>
        )}
      </div>

      {/* Show command/URL detail when connected */}
      {connected && (command || url) && (
        <div style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          padding: '2px 0 0 36px',
        }}>
          {command ?? url}
        </div>
      )}

      {/* "Agregar nuevo servidor" — only shown for the "add" slot */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center',
            padding: '4px 0', fontSize: 10, fontFamily: 'var(--font-ui)',
            border: '1px dashed var(--border-normal)', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Plus size={11} strokeWidth={1.5} />
          Agregar nuevo servidor MCP
        </button>
      ) : (
        <AddServerForm
          onAdd={(_config) => {
            onAddNew()
            setShowAddForm(false)
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </motion.div>
  )
}