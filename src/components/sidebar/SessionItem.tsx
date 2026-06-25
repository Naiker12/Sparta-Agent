import { useState } from 'react'
import { MoreVertical, Pin, Share2, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useChatStore } from '@/stores/chat.store'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

interface SessionItemProps {
  session: Session
  variant?: 'default' | 'compact'
}

function getSessionDefaultTitle(session: Session): string {
  return session.title || `Sesión ${new Date(session.createdAt).toLocaleString('es', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })}`
}

export function SessionItem({ session, variant = 'default' }: SessionItemProps) {
  const { activeSessionId, pinSession, deleteSession, switchSession } = useChatStore()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const active = session.id === activeSessionId
  const title = getSessionDefaultTitle(session)

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 rounded-md cursor-pointer select-none transition-all duration-100',
        variant === 'compact' ? 'px-3 py-1 text-xs' : 'px-3 py-1.5 text-xs',
      )}
      style={{
        background: active ? 'var(--bg-active)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span
        style={{
          color: session.pinned ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        {session.pinned ? '\uD83D\uDCCC' : active ? '\u203A' : '\u00B7'}
      </span>

      <button
        className="flex-1 text-left truncate"
        style={{
          color: 'inherit',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 'inherit',
        }}
        onClick={() => switchSession(session.id)}
      >
        {title}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Acciones de sesión"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[var(--bg-active)] shrink-0"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <MoreVertical size={variant === 'compact' ? 11 : 12} strokeWidth={1.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem onClick={() => pinSession(session.id)}>
            <Pin size={13} />
            {session.pinned ? 'Quitar de fijados' : 'Fijar'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <Share2 size={13} />
            Compartir
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 size={13} />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemLabel={title}
        onConfirm={() => deleteSession(session.id)}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Compartir sesión</DialogTitle>
            <DialogDescription>
              Copia este enlace para compartir la sesión.
            </DialogDescription>
          </DialogHeader>
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
            }}
          >
            <code
              style={{
                flex: 1,
                fontSize: 11,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              sparta://session/{session.id}
            </code>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(`sparta://session/${session.id}`)}
            >
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
