import { useState } from 'react'
import { X, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChatStore, useSessionStore } from 'ia-sparta-core'
import { cn } from 'ia-sparta-core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'ia-sparta-design-system'

interface TabItemProps {
  sessionId: string
  isActive: boolean
  onfocus: (sessionId: string) => void
  onClose: (sessionId: string) => void
  onCloseOthers: (sessionId: string) => void
  onCloseToRight: (sessionId: string) => void
}

export function TabItem({ sessionId, isActive, onfocus, onClose, onCloseOthers, onCloseToRight }: TabItemProps) {
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId))
  const isStreaming = useChatStore((s) => s.streamingBySession[sessionId]?.isStreaming ?? false)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const title = session?.title || 'Nueva conversación'

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1.5 cursor-pointer select-none',
        'transition-colors duration-100',
        isActive
          ? 'bg-[var(--bg-active)]'
          : 'hover:bg-[var(--bg-hover)]',
      )}
      style={{
        borderRadius: 6,
        maxWidth: 180,
        minWidth: 0,
        padding: '4px 6px 4px 10px',
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        color: isActive ? 'var(--text-display)' : 'var(--text-muted)',
        fontWeight: isActive ? 600 : 400,
      }}
      onClick={() => onfocus(sessionId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isStreaming && (
        <motion.span
          className="size-1.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--status-think)', boxShadow: '0 0 4px var(--status-think)' }}
          animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span className="truncate flex-1 min-w-0">{title}</span>

      {(hovered || isActive || menuOpen) && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center rounded-sm hover:bg-[var(--bg-active)]"
                style={{ width: 16, height: 16, color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={10} strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4} className="min-w-[160px] p-1">
              <DropdownMenuItem
                className="px-2 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => { e.stopPropagation(); onClose(sessionId) }}
              >
                <X size={12} strokeWidth={1.5} />
                Cerrar pestaña
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-2 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => { e.stopPropagation(); onCloseOthers(sessionId) }}
              >
                Cerrar otras
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className="px-2 py-1.5 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => { e.stopPropagation(); onCloseToRight(sessionId) }}
              >
                Cerrar a la derecha
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="flex items-center justify-center rounded-sm hover:bg-[var(--bg-active)]"
            style={{ width: 16, height: 16, color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onClose(sessionId) }}
          >
            <X size={10} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
