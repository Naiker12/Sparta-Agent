import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFolderStore } from 'ia-sparta-core'
import { FolderOpen, X, Clock, FolderPlus, CheckCircle } from 'lucide-react'

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
}

async function pickFolder(): Promise<string | null> {
  if (typeof window !== 'undefined' && window.fs?.openFolderDialog) {
    return window.fs.openFolderDialog()
  }
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
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-accent/10 border border-border flex items-center justify-center text-accent">
              <FolderPlus className="size-5" />
            </div>
            <div>
              <DialogTitle>Conectar Carpeta de Trabajo</DialogTitle>
              <DialogDescription>Dale contexto completo a los agentes conectando una carpeta local.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {connectedPath && (
            <div className="p-3.5 rounded-xl border border-border bg-muted text-xs font-mono text-foreground flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle className="size-4 shrink-0 text-accent" />
                <span className="truncate font-medium">{connectedPath}</span>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={handleDisconnect} title="Desconectar carpeta">
                <X className="size-3.5" />
              </Button>
            </div>
          )}

          <Button onClick={handlePick} disabled={isPicking} variant="secondary" className="w-full h-11 justify-start gap-3">
            <FolderOpen className="size-4 text-accent shrink-0" />
            <span>{isPicking ? 'Abriendo explorador...' : connectedPath ? 'Cambiar carpeta principal...' : 'Seleccionar carpeta local...'}</span>
          </Button>

          {recentPaths.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <span>Recientes</span>
                <span className="text-[10px] font-mono">{recentPaths.length} guardadas</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {recentPaths.map((p) => (
                  <button key={p} type="button" onClick={() => handleRecentPick(p)}
                    className="flex items-center gap-3 w-full px-3.5 py-2.5 text-xs font-mono text-muted-foreground hover:text-foreground bg-muted hover:bg-hover border border-border-subtle hover:border-border rounded-xl transition-all text-left">
                    <Clock className="size-3.5 shrink-0" />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
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

