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
import { FolderOpen, X, Clock } from 'lucide-react'

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

        <div className="flex flex-col gap-3.5 py-2">
          {connectedPath && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-input text-xs font-mono text-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="size-4 shrink-0 text-primary" />
                <span className="truncate">{connectedPath}</span>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
                title="Desconectar carpeta"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handlePick}
            disabled={isPicking}
            className="w-full justify-start gap-3 h-10 px-3.5 text-sm font-normal text-foreground"
          >
            <FolderOpen className="size-4 text-muted-foreground shrink-0" />
            <span>{isPicking ? 'Seleccionando...' : connectedPath ? 'Cambiar carpeta' : 'Seleccionar carpeta...'}</span>
          </Button>

          {recentPaths.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 font-mono">
                Recientes
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {recentPaths.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleRecentPick(p)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-hover rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <Clock className="size-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
