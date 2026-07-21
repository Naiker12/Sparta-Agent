import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'ia-sparta-design-system'
import { X, XCircle, ArrowRight } from 'lucide-react'

interface TabContextMenuProps {
  children: React.ReactNode
  sessionId: string
  onClose: (sessionId: string) => void
  onCloseOthers: (sessionId: string) => void
  onCloseToRight: (sessionId: string) => void
}

export function TabContextMenu({
  children,
  sessionId,
  onClose,
  onCloseOthers,
  onCloseToRight,
}: TabContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="min-w-[160px] p-1">
        <DropdownMenuItem
          className="px-2 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
          onClick={() => onClose(sessionId)}
        >
          <X size={12} strokeWidth={1.5} />
          Cerrar pestaña
        </DropdownMenuItem>
        <DropdownMenuItem
          className="px-2 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
          onClick={() => onCloseOthers(sessionId)}
        >
          <XCircle size={12} strokeWidth={1.5} />
          Cerrar otras
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          className="px-2 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
          onClick={() => onCloseToRight(sessionId)}
        >
          <ArrowRight size={12} strokeWidth={1.5} />
          Cerrar a la derecha
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
