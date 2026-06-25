import { useState } from 'react'
import { Plug, Power, Trash2 } from 'lucide-react'
import { useMCPStore } from '@/stores/mcp.store'
import type { MCPServerConfig } from '@/types'

export function McpView() {
  const { servers, addServer, removeServer, toggleServer } = useMCPStore()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'stdio' | 'http'>('stdio')
  const [commandUrl, setCommandUrl] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const id = name.toLowerCase().replace(/\s+/g, '-')
    addServer({ id, name: name.trim(), type, enabled: true, ...(type === 'stdio' ? { command: commandUrl } : { url: commandUrl }) } as MCPServerConfig)
    setName(''); setCommandUrl(''); setShowForm(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
          MCP Servers
        </h2>
        <button onClick={() => setShowForm(true)} style={{
          padding: '5px 12px', background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11,
          fontFamily: 'var(--font-ui)', cursor: 'pointer',
        }}>
          + Agregar servidor
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden auto', padding: 16 }}>
        {showForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-base)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }} autoFocus />
            <select value={type} onChange={e => setType(e.target.value as any)} style={{ padding: '6px 10px', fontSize: 12, background: 'var(--bg-base)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="stdio">Stdio</option>
              <option value="http">HTTP</option>
            </select>
            <input value={commandUrl} onChange={e => setCommandUrl(e.target.value)} placeholder={type === 'stdio' ? 'Comando...' : 'URL...'} style={{ flex: 2, padding: '6px 10px', fontSize: 12, background: 'var(--bg-base)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <button onClick={handleAdd} disabled={!name.trim()} style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', color: 'white', fontSize: 11, cursor: 'pointer', opacity: name.trim() ? 1 : 0.5 }}>Agregar</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>Cancelar</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {servers.map((server) => (
            <div key={server.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            }}>
              <Plug size={16} style={{ color: server.connected ? 'var(--status-ok)' : 'var(--text-muted)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                  {server.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {server.type} · {server.tools.length} herramientas · {server.connected ? 'Conectado' : 'Desconectado'}
                </div>
              </div>
              <button onClick={() => toggleServer(server.id)} title="Encender/Apagar" style={{ width: 28, height: 28, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: server.config.enabled ? 'var(--status-ok)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Power size={13} strokeWidth={1.5} />
              </button>
              <button onClick={() => removeServer(server.id)} title="Eliminar" style={{ width: 28, height: 28, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.background = 'var(--bg-hover)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}>
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
