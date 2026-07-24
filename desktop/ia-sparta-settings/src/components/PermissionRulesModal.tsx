import React, { useState } from 'react'
import { usePermissionStore, type PermissionActionKind, type PermissionRule } from 'ia-sparta-core'
import { X, Plus, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react'

interface PermissionRulesModalProps {
  title: string
  subtitle: string
  kind: PermissionActionKind
  isOpen: boolean
  onClose: () => void
}

export function PermissionRulesModal({
  title,
  subtitle,
  kind,
  isOpen,
  onClose,
}: PermissionRulesModalProps) {
  const store = usePermissionStore()
  const [newTarget, setNewTarget] = useState('')
  const [newEffect, setNewEffect] = useState<'allow' | 'deny'>('allow')

  if (!isOpen) return null

  const getRuleList = (): PermissionRule[] => {
    switch (kind) {
      case 'file_read':
        return store.fileReads
      case 'file_write':
        return store.fileWrites
      case 'network_url':
        return store.networkRules
      case 'terminal_command':
        return store.terminalRules
      case 'unsandboxed_command':
        return store.unsandboxedRules
      case 'mcp_tool':
        return store.mcpRules
      default:
        return []
    }
  }

  const rules = getRuleList()

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTarget.trim()) return
    store.addRule({
      kind,
      target: newTarget.trim(),
      effect: newEffect,
    })
    setNewTarget('')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal, #141416)',
          border: '1px solid var(--border-normal, rgba(255,255,255,0.1))',
          borderRadius: 12,
          width: 520,
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form to Add Rule */}
        <form
          onSubmit={handleAdd}
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <input
            type="text"
            placeholder={
              kind.startsWith('file')
                ? 'Ej. /path/to/dir o *.js'
                : kind === 'network_url'
                ? 'Ej. api.github.com'
                : 'Ej. git o pnpm'
            }
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'var(--bg-input, rgba(0,0,0,0.3))',
              border: '1px solid var(--border-normal, rgba(255,255,255,0.12))',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
          <select
            value={newEffect}
            onChange={(e) => setNewEffect(e.target.value as 'allow' | 'deny')}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              background: 'var(--bg-input, rgba(0,0,0,0.3))',
              border: '1px solid var(--border-normal, rgba(255,255,255,0.12))',
              color: 'var(--text-primary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <option value="allow">Permitir (Allow)</option>
            <option value="deny">Denegar (Deny)</option>
          </select>
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'var(--accent, #6366f1)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            <span>Agregar</span>
          </button>
        </form>

        {/* Rule List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {rules.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 0',
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No hay reglas personalizadas configuradas para esta sección.
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-subtle, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {rule.effect === 'allow' ? (
                    <ShieldCheck size={16} style={{ color: 'var(--status-ok, #10b981)' }} />
                  ) : (
                    <ShieldAlert size={16} style={{ color: 'var(--destructive, #ef4444)' }} />
                  )}
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {rule.target}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        rule.effect === 'allow'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                      color:
                        rule.effect === 'allow'
                          ? 'var(--status-ok, #10b981)'
                          : 'var(--destructive, #ef4444)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {rule.effect}
                  </span>
                </div>
                <button
                  onClick={() => store.removeRule(rule.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                  }}
                  title="Eliminar regla"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            background: 'rgba(0,0,0,0.1)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              background: 'var(--bg-input, rgba(255,255,255,0.08))',
              border: '1px solid var(--border-normal, rgba(255,255,255,0.1))',
              color: 'var(--text-primary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
