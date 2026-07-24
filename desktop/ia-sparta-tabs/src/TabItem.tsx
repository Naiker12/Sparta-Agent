import { useState, useRef, useEffect } from 'react'
import { X, Pin } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChatStore, useSessionStore } from 'ia-sparta-core'
import { cn } from 'ia-sparta-core'
import { TabContextMenu } from './TabContextMenu'

interface TabItemProps {
  sessionId: string
  isActive: boolean
  onfocus: (sessionId: string) => void
  onClose: (sessionId: string) => void
  onCloseOthers?: (sessionId: string) => void
  onCloseToRight?: (sessionId: string) => void
}

export function TabItem({ sessionId, isActive, onfocus, onClose }: TabItemProps) {
  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId))
  const renameSession = useSessionStore((s) => s.renameSession)
  const isStreaming = useChatStore((s) => s.streamingBySession[sessionId]?.isStreaming ?? false)
  const [hovered, setHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session?.title || '')
  const inputRef = useRef<HTMLInputElement>(null)

  const title = session?.title || 'Nueva conversación'
  const isPinned = session?.pinned ?? false

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle.trim() !== title) {
      renameSession(sessionId, editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRename()
    if (e.key === 'Escape') {
      setEditTitle(title)
      setIsEditing(false)
    }
  }

  return (
    <TabContextMenu
      sessionId={sessionId}
      onClose={onClose}
      onStartRename={() => {
        setEditTitle(title)
        setIsEditing(true)
      }}
    >
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
          padding: '4px 8px 4px 10px',
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: isActive ? 'var(--text-display)' : 'var(--text-muted)',
          fontWeight: isActive ? 600 : 400,
        }}
        onClick={() => !isEditing && onfocus(sessionId)}
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

        {isPinned && !isStreaming && (
          <Pin size={10} className="text-accent shrink-0 rotate-45" />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent outline-none border-b border-accent text-xs font-medium"
            style={{ color: 'var(--text-display)' }}
          />
        ) : (
          <span className="truncate flex-1 min-w-0">{title}</span>
        )}

        {(hovered || isActive) && !isEditing && (
          <button
            className="flex items-center justify-center rounded-sm hover:bg-[var(--bg-active)] flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            style={{
              width: 16,
              height: 16,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onClose(sessionId)
            }}
            title="Cerrar pestaña"
          >
            <X size={11} strokeWidth={2} />
          </button>
        )}
      </div>
    </TabContextMenu>
  )
}
