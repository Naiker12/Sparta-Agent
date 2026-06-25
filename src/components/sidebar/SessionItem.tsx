import { useState } from 'react'
import { MoreVertical, Pin, Pencil, Trash2, Share2, MessageSquare } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useChatStore } from '@/stores/chat.store'
import { useUIStore } from '@/stores/ui.store'
import type { Session } from '@/types'

interface SessionItemProps {
  session: Session
}

export function SessionItem({ session }: SessionItemProps) {
  const { activeSessionId, switchSession, pinSession, deleteSession, renameSession } = useChatStore()
  const { setMainView } = useUIStore()
  const [menuOpen, setMenuOpen]       = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [shareOpen, setShareOpen]     = useState(false)

  const isActive = session.id === activeSessionId
  const title    = session.title || 'Nueva conversación'

  // Relative time helper
  const date = new Date(session.updatedAt ?? session.createdAt)
  const getRelativeTime = () => {
    const now = Date.now()
    const diff = now - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d`
    const months = Math.floor(days / 30)
    return `${months}mes`
  }
  const relTime = getRelativeTime()

  return (
    <>
      <div
        className={cn('session-item-card', isActive && 'active')}
        onClick={() => { switchSession(session.id); setMainView({ type: 'chat', sessionId: session.id }) }}
      >
        {/* Icon */}
        <MessageSquare size={14} className="session-icon" />

        {/* Title — single line */}
        <span className="session-title">{title}</span>

        {/* Hover actions: date badge + 3-dot menu */}
        <div className={cn('session-hover-actions', menuOpen && 'force-visible')}>
          <span className="session-date-badge">{relTime}</span>

          {/* Context menu trigger - nested inside the card! */}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              onClick={e => {
                e.stopPropagation() // Prevent switching session when clicking menu trigger
              }}
              className={cn('session-menu-trigger', menuOpen && 'open')}
            >
              <MoreVertical size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  pinSession(session.id)
                  setMenuOpen(false)
                }}
              >
                <Pin size={13} className="flex-shrink-0" />
                {session.pinned ? 'Quitar fijado' : 'Fijar'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  const next = prompt('Renombrar:', title)
                  if (next?.trim()) renameSession(session.id, next.trim())
                }}
              >
                <Pencil size={13} className="flex-shrink-0" />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setShareOpen(true)
                  setMenuOpen(false)
                }}
              >
                <Share2 size={13} className="flex-shrink-0" />
                Compartir
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmOpen(true)
                  setMenuOpen(false)
                }}
              >
                <Trash2 size={13} className="flex-shrink-0" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        itemLabel={title}
        onConfirm={() => deleteSession(session.id)}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Compartir sesión</DialogTitle>
            <DialogDescription>Copia este enlace para compartir la sesión.</DialogDescription>
          </DialogHeader>
          <div style={{ padding: '0 24px 20px' }}>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)]">
              <code className="flex-1 text-[11px] font-mono text-[var(--text-primary)] truncate">
                sparta://session/{session.id}
              </code>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`sparta://session/${session.id}`)}>
                Copiar
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
