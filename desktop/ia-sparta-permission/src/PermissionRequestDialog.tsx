/**
 * PermissionRequestDialog
 *
 * Modal shown when the Python sidecar requests access to a file or directory
 * outside the current workspace. Consumes the permission store and calls
 * usePermissionRequests().respond() on user action.
 *
 * UX rules (from auditoría):
 *  - Never auto-approve write/delete outside workspace.
 *  - Read: low-friction "allow in this session" option available.
 *  - Write/delete: always explicit confirm, even if reads were already allowed.
 *  - Three buttons: [Allow once] [Allow in session] [Deny]
 */
import { usePermissionStore } from 'ia-sparta-core'
import { usePermissionRequests } from 'ia-sparta-core'
import { ShieldAlert, FolderOpen, FileEdit, Trash2, Download, Terminal, X } from 'lucide-react'

const TOOL_META: Record<string, { label: string; icon: React.ReactNode; risk: 'low' | 'high' }> = {
  read_file_tool:    { label: 'Leer archivo',    icon: <FolderOpen size={18} />, risk: 'low' },
  write_file_tool:   { label: 'Escribir archivo', icon: <FileEdit size={18} />,  risk: 'high' },
  patch_file_tool:   { label: 'Editar archivo',   icon: <FileEdit size={18} />,  risk: 'high' },
  delete_file_tool:  { label: 'Eliminar archivo', icon: <Trash2 size={18} />,    risk: 'high' },
  search_files_tool: { label: 'Buscar archivos',  icon: <FolderOpen size={18} />, risk: 'low' },
  terminal_execute_tool: { label: 'Ejecutar comando', icon: <Terminal size={18} />, risk: 'high' },
  terminal_execute_background_tool: { label: 'Ejecutar comando (fondo)', icon: <Terminal size={18} />, risk: 'high' },
}

const MCP_INSTALL_META = {
  label: 'Instalar servidor MCP',
  icon: <Download size={18} />,
  risk: 'high' as const,
}

export function PermissionRequestDialog() {
  const { queue } = usePermissionStore()
  const { respond } = usePermissionRequests()

  // Show only the first pending request — queue is FIFO
  const req = queue[0]
  if (!req) return null

  const isMcpInstall = req.kind === 'mcp_install'
  const meta = isMcpInstall
    ? MCP_INSTALL_META
    : (TOOL_META[req.tool] ?? { label: req.tool, icon: <ShieldAlert size={18} />, risk: 'high' })
  const isHighRisk = meta.risk === 'high'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--bg-modal)',
        border: '1px solid var(--border-strong)',
        borderRadius: 14,
        width: 440,
        maxWidth: '90vw',
        fontFamily: 'var(--font-ui)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: isHighRisk
            ? 'color-mix(in srgb, #ef4444 8%, var(--bg-modal))'
            : 'color-mix(in srgb, var(--accent) 6%, var(--bg-modal))',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isHighRisk ? 'rgba(239,68,68,0.15)' : 'color-mix(in srgb, var(--accent) 15%, transparent)',
            border: `1px solid ${isHighRisk ? 'rgba(239,68,68,0.3)' : 'color-mix(in srgb, var(--accent) 25%, transparent)'}`,
            color: isHighRisk ? '#f87171' : 'var(--accent)',
          }}>
            {meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="perm-title" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Permiso requerido: {meta.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              El agente quiere acceder a una ruta fuera del workspace
            </div>
          </div>
          {/* Deny × button */}
          <button
            aria-label="Denegar"
            onClick={() => respond(req.requestId, false, 'once')}
            style={{
              width: 28, height: 28, borderRadius: 7, border: 'none',
              background: 'transparent', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {isMcpInstall ? (
            <>
              {/* MCP Install layout */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', marginBottom: 5,
                }}>
                  Servidor MCP a instalar
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 7,
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
                  wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {req.path}
                </div>
              </div>

              {/* Command preview */}
              {req.preview && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', marginBottom: 5,
                  }}>
                    Detalle
                  </div>
                  <pre style={{
                    margin: 0, padding: '8px 12px', borderRadius: 7,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
                    maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}>
                    {req.preview.slice(0, 1000)}{req.preview.length > 1000 ? '\n…' : ''}
                  </pre>
                </div>
              )}

              <div style={{
                display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <ShieldAlert size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Esto ejecutará un proceso de terceros en tu máquina.
                  Verifica que el comando sea seguro antes de aprobar.
                  Esta instalación no se recordará — cada instalación requiere confirmación.
                </span>
              </div>
            </>
          ) : req.kind === 'terminal_exec' ? (
            <>
              {/* Terminal exec layout */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', marginBottom: 5,
                }}>
                  Comando a ejecutar
                </div>
                <pre style={{
                  margin: 0, padding: '8px 12px', borderRadius: 7,
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
                  wordBreak: 'break-all', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {req.path}
                </pre>
              </div>

              <div style={{
                display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <ShieldAlert size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  El agente quiere ejecutar este comando en tu sistema.
                  Revisa el comando antes de aprobar. Esta acción no se recordará —
                  cada comando requiere confirmación individual.
                </span>
              </div>
            </>
          ) : (
            <>
              {/* File access layout (original) */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', marginBottom: 5,
                }}>
                  Ruta solicitada
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 7,
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
                  wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {req.path}
                </div>
              </div>

              {req.preview && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', marginBottom: 5,
                  }}>
                    Vista previa
                  </div>
                  <pre style={{
                    margin: 0, padding: '8px 12px', borderRadius: 7,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)',
                    maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}>
                    {req.preview.slice(0, 600)}{req.preview.length > 600 ? '\n…' : ''}
                  </pre>
                </div>
              )}

              {isHighRisk && (
                <div style={{
                  display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <ShieldAlert size={13} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Esta operación modificará o eliminará archivos fuera del proyecto actual.
                    Revisa la ruta antes de aprobar.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          {isMcpInstall ? (
            <>
              <ActionBtn
                label="Cancelar"
                variant="ghost"
                onClick={() => respond(req.requestId, false, 'once')}
              />
              <ActionBtn
                label="Instalar"
                variant="danger"
                onClick={() => respond(req.requestId, true, 'once')}
              />
            </>
          ) : req.kind === 'terminal_exec' ? (
            <>
              <ActionBtn
                label="Denegar"
                variant="ghost"
                onClick={() => respond(req.requestId, false, 'once')}
              />
              <ActionBtn
                label="Permitir una vez"
                variant="outline"
                onClick={() => respond(req.requestId, true, 'once')}
              />
              <ActionBtn
                label="Ejecutar"
                variant="danger"
                onClick={() => respond(req.requestId, true, 'once')}
              />
            </>
          ) : (
            <>
              <ActionBtn
                label="Denegar"
                variant="ghost"
                onClick={() => respond(req.requestId, false, 'once')}
              />
              <ActionBtn
                label="Permitir una vez"
                variant="outline"
                onClick={() => respond(req.requestId, true, 'once')}
              />
              {!isHighRisk && (
                <ActionBtn
                  label="Permitir en sesión"
                  variant="primary"
                  onClick={() => respond(req.requestId, true, 'session')}
                />
              )}
              {isHighRisk && (
                <ActionBtn
                  label="Confirmar y permitir"
                  variant="danger"
                  onClick={() => respond(req.requestId, true, 'once')}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Internal button component ─────────────────────────────── */
type BtnVariant = 'ghost' | 'outline' | 'primary' | 'danger'

function ActionBtn({ label, variant, onClick }: {
  label: string; variant: BtnVariant; onClick: () => void
}) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: 'var(--text-secondary)',
    },
    outline: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-normal)',
      color: 'var(--text-primary)',
    },
    primary: {
      background: 'var(--accent)',
      border: '1px solid var(--accent)',
      color: '#fff',
    },
    danger: {
      background: 'rgba(239,68,68,0.15)',
      border: '1px solid rgba(239,68,68,0.4)',
      color: '#f87171',
    },
  }

  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
        transition: 'all 0.12s',
        ...styles[variant],
      }}
    >
      {label}
    </button>
  )
}
