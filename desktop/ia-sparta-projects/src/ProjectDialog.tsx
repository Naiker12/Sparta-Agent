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
      <DialogContent className="sm:max-w-lg bg-[#0E0E14]/95 border-white/10 backdrop-blur-2xl text-neutral-100 shadow-2xl rounded-2xl overflow-hidden p-0">
        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <FolderPlus className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white tracking-tight">
                  Conectar Carpeta de Trabajo
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
                  Dale contexto completo a los agentes conectando una carpeta local.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Carpeta Actualmente Conectada */}
            {connectedPath && (
              <div className="relative group p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-sm text-xs font-mono text-indigo-200 flex items-center justify-between gap-3 shadow-lg shadow-indigo-950/20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle className="size-4 shrink-0 text-indigo-400" />
                  <span className="truncate font-medium">{connectedPath}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-rose-500/20 text-indigo-300 hover:text-rose-300 transition-colors cursor-pointer border border-indigo-500/20 hover:border-rose-500/30"
                  title="Desconectar carpeta"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Botón Principal para Seleccionar */}
            <Button
              onClick={handlePick}
              disabled={isPicking}
              className="w-full h-11 px-4 justify-start gap-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-600/30 to-violet-600/30 hover:from-indigo-600/50 hover:to-violet-600/50 border border-indigo-500/40 hover:border-indigo-400/60 rounded-xl transition-all shadow-md cursor-pointer group"
            >
              <FolderOpen className="size-4 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
              <span>{isPicking ? 'Abriendo explorador...' : connectedPath ? 'Cambiar carpeta principal...' : 'Seleccionar carpeta local...'}</span>
            </Button>

            {/* Historial de Carpetas Recientes */}
            {recentPaths.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-1">
                  <span>Recientes</span>
                  <span className="text-[10px] text-neutral-500 font-mono">{recentPaths.length} guardadas</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                  {recentPaths.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleRecentPick(p)}
                      className="flex items-center gap-3 w-full px-3.5 py-2.5 text-xs font-mono text-neutral-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 rounded-xl transition-all text-left cursor-pointer group"
                    >
                      <Clock className="size-3.5 shrink-0 text-neutral-500 group-hover:text-indigo-400 transition-colors" />
                      <span className="truncate">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-white/10 flex justify-end">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

