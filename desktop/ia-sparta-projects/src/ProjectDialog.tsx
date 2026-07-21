import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'ia-sparta-design-system'
import { Button } from 'ia-sparta-design-system'
import { useFolderStore } from 'ia-sparta-core'
import { FolderOpen, X, Clock } from 'lucide-react'

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
}

async function pickFolder(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.fs?.openFolderDialog) {
    return window.fs.openFolderDialog()
  }
  // Web fallback: prompt for path
  const path = prompt('Ruta de la carpeta:')
  return path?.trim() || null
}

export function ProjectDialog({ open, onClose }: ProjectDialogProps) {
  const { connectFolder, disconnectFolder, connectedPath, recentPaths } = useFolderStore()
  const [isPicking, setIsPicking] = useState(false)

  useEffect(() => {
    if (open) setIsPicking(false)
  }, [open])

  async function handlePick() {
    setIsPicking(true)
    try {
      const path = await pickFolder()
      if (path) {
        connectFolder(path)
        onClose()
      }
    } finally {
      setIsPicking(false)
    }
  }

  function handleRecentPick(path: string) {
    connectFolder(path)
    onClose()
  }

  function handleDisconnect() {
    disconnectFolder()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar carpeta</DialogTitle>
          <DialogDescription>
            Conectá una carpeta del disco para dar contexto al agente sobre tu proyecto.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 flex flex-col gap-3">
          {connectedPath && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-normal)',
              background: 'var(--bg-subtle)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}>
              <FolderOpen size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connectedPath}
              </span>
              <button
                onClick={handleDisconnect}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 2, display: 'flex',
                }}
                title="Desconectar carpeta"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handlePick}
            disabled={isPicking}
            style={{ justifyContent: 'flex-start', gap: 8, fontFamily: 'var(--font-ui)' }}
          >
            <FolderOpen size={14} />
            {isPicking ? 'Seleccionando...' : connectedPath ? 'Cambiar carpeta' : 'Seleccionar carpeta...'}
          </Button>

          {recentPaths.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recientes
              </div>
              {recentPaths.map((p) => (
                <button
                  key={p}
                  onClick={() => handleRecentPick(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    width: '100%', padding: '5px 8px', background: 'none',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', textAlign: 'left', fontSize: 11,
                    fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <Clock size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
