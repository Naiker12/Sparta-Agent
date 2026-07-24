import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'ia-sparta-design-system'
import { X, Pencil, Pin, Trash2 } from 'lucide-react'
import { useSessionStore } from 'ia-sparta-core'

interface TabContextMenuProps {
  children: React.ReactNode
  sessionId: string
  onClose: (sessionId: string) => void
  onStartRename?: (sessionId: string) => void
}

export function TabContextMenu({
  children,
  sessionId,
  onClose,
  onStartRename,
}: TabContextMenuProps) {
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId))
  const pinSession = useSessionStore((s) => s.pinSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)

  const isPinned = session?.pinned ?? false

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="min-w-[160px] p-1 shadow-md">
        {onStartRename && (
          <DropdownMenuItem
            className="px-2.5 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
            onClick={(e) => {
              e.stopPropagation()
              onStartRename(sessionId)
            }}
          >
            <Pencil size={12} strokeWidth={1.5} />
            Renombrar
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          className="px-2.5 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
          onClick={(e) => {
            e.stopPropagation()
            pinSession(sessionId)
          }}
        >
          <Pin size={12} strokeWidth={1.5} />
          {isPinned ? 'Desfijar' : 'Fijar conversación'}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          className="px-2.5 py-1.5 text-xs gap-2 cursor-pointer rounded-sm text-red-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            deleteSession(sessionId)
            onClose(sessionId)
          }}
        >
          <Trash2 size={12} strokeWidth={1.5} />
          Eliminar conversación
        </DropdownMenuItem>

        <DropdownMenuItem
          className="px-2.5 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
          onClick={(e) => {
            e.stopPropagation()
            onClose(sessionId)
          }}
        >
          <X size={12} strokeWidth={1.5} />
          Cerrar pestaña
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
