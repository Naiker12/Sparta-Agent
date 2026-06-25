import { useMCPStore } from '@/stores/mcp.store'
import { SettingGroup } from './primitives'
import { Plus, Trash2, Power } from 'lucide-react'
import { useState } from 'react'
import type { MCPServerConfig } from '@/types'

export function McpTab() {
  const { servers, addServer, removeServer, toggleServer } = useMCPStore()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'stdio' | 'http'>('stdio')
  const [commandUrl, setCommandUrl] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-')
    const config: MCPServerConfig = {
      id,
      name: name.trim(),
      type,
      enabled: true,
      ...(type === 'stdio' ? { command: commandUrl } : { url: commandUrl }),
    }
    addServer(config)
    setName('')
    setCommandUrl('')
    setShowForm(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SettingGroup
        title="Servidores MCP"
        description="Servidores de protocolo MCP conectados. Proporcionan herramientas a los agentes."
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          {servers.map((server) => (
            <div
              key={server.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: server.connected ? 'var(--status-ok)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                  {server.name}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {server.type} · {server.tools.length} herramientas
                </div>
              </div>
              <button
                onClick={() => toggleServer(server.id)}
                title={server.config.enabled ? 'Deshabilitar' : 'Habilitar'}
                style={{
                  width: 26, height: 26,
                  background: 'none', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: server.config.enabled ? 'var(--status-ok)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <Power size={12} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => removeServer(server.id)}
                title="Eliminar"
                style={{
                  width: 26, height: 26,
                  background: 'none', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
              >
                <Trash2 size={12} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>

        {showForm ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: 12, background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            marginTop: 8,
          }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del servidor"
              style={{
                background: 'var(--bg-base)', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)', padding: '6px 10px',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
              autoFocus
            />
            <select
              value={type}
              onChange={e => setType(e.target.value as 'stdio' | 'http')}
              style={{
                background: 'var(--bg-base)', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)', padding: '6px 10px',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
            >
              <option value="stdio">Stdio</option>
              <option value="http">HTTP</option>
            </select>
            <input
              value={commandUrl}
              onChange={e => setCommandUrl(e.target.value)}
              placeholder={type === 'stdio' ? 'Comando (ej. npx @modelcontextprotocol/server-filesystem)' : 'URL (ej. http://localhost:3000/mcp)'}
              style={{
                background: 'var(--bg-base)', border: '1px solid var(--border-normal)',
                borderRadius: 'var(--radius-md)', padding: '6px 10px',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: '5px 12px', background: 'none', border: '1px solid var(--border-normal)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
                  fontSize: 11, fontFamily: 'var(--font-ui)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={!name.trim()}
                style={{
                  padding: '5px 12px', background: 'var(--accent)', border: 'none',
                  borderRadius: 'var(--radius-md)', color: 'white',
                  fontSize: 11, fontFamily: 'var(--font-ui)', cursor: 'pointer',
                  opacity: name.trim() ? 1 : 0.5,
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', marginTop: 4,
              background: 'none', border: '1px dashed var(--border-normal)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
              fontSize: 11.5, fontFamily: 'var(--font-ui)', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-normal)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Plus size={13} strokeWidth={1.5} />
            Agregar servidor MCP
          </button>
        )}
      </SettingGroup>
    </div>
  )
}
