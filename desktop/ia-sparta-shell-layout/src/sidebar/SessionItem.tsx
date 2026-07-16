import { useState } from 'react'
import { MoreVertical, Pin, Pencil, Trash2, Share2, MessageSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from 'ia-sparta-design-system'
import { cn } from 'ia-sparta-core'
import { Button } from 'ia-sparta-design-system'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'ia-sparta-design-system'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'
import { useChatStore } from 'ia-sparta-core'
import { useSessionStore } from 'ia-sparta-core'
import { useUIStore } from 'ia-sparta-core'
import type { Session } from 'ia-sparta-core'
import { useTranslation } from 'ia-sparta-i18n'

interface SessionItemProps {
  session: Session
}

export function SessionItem({ session }: SessionItemProps) {
  const { activeSessionId, switchSession, pinSession, deleteSession, renameSession } = useSessionStore()
  const { deleteSessionMessages, streamingBySession } = useChatStore()
  const { setMainView } = useUIStore()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen]       = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [shareOpen, setShareOpen]     = useState(false)
  const [renaming, setRenaming]       = useState(false)
  const [renameValue, setRenameValue] = useState(session.title || t('sidebar.newChat'))

  const isActive = session.id === activeSessionId
  const isStreamingThis = streamingBySession[session.id]?.isStreaming ?? false
  const title    = session.title || t('sidebar.newChat')

  // Relative time helper
  const date = new Date(session.updatedAt ?? session.createdAt)
  const getRelativeTime = () => {
    const now = Date.now()
    const diff = now - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('sidebar.now')
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d`
    const months = Math.floor(days / 30)
    return `${months}${t('sidebar.month')}`
  }
  const relTime = getRelativeTime()

  return (
    <>
      <div
        className={cn('session-item-card', isActive && 'active', isStreamingThis && 'streaming')}
        onClick={() => { switchSession(session.id); setMainView({ type: 'chat', sessionId: session.id }) }}
      >
        {/* Icon + streaming indicator */}
        <div style={{ position: 'relative', display: 'flex' }}>
          <MessageSquare size={14} className="session-icon" />
          {isStreamingThis && (
            <motion.span
              className="size-1.5 rounded-full"
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                background: 'var(--status-think)',
                boxShadow: '0 0 4px var(--status-think)',
              }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Title — single line */}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim()) renameSession(session.id, renameValue.trim())
              setRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (renameValue.trim()) renameSession(session.id, renameValue.trim())
                setRenaming(false)
              }
              if (e.key === 'Escape') setRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="session-title"
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
              minWidth: 0,
            }}
          />
        ) : (
          <span className="session-title">{title}</span>
        )}

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
            <DropdownMenuContent align="end" sideOffset={4} className="min-w-0 w-[130px] p-1">
              <DropdownMenuItem
                className="px-2 py-1 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  pinSession(session.id)
                  setMenuOpen(false)
                }}
              >
                <Pin className="flex-shrink-0 size-3.5" />
                {session.pinned ? t('sidebar.unpin') : t('sidebar.pin')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-2 py-1 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  setRenameValue(title)
                  setRenaming(true)
                }}
              >
                <Pencil className="flex-shrink-0 size-3.5" />
                {t('sidebar.rename')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className="px-2 py-1 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setShareOpen(true)
                  setMenuOpen(false)
                }}
              >
                <Share2 className="flex-shrink-0 size-3.5" />
                {t('sidebar.shareMessage')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="px-2 py-1 text-xs gap-2 cursor-pointer rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmOpen(true)
                  setMenuOpen(false)
                }}
              >
                <Trash2 className="flex-shrink-0 size-3.5" />
                {t('sidebar.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        itemLabel={title}
        onConfirm={() => {
          deleteSession(session.id)
          deleteSessionMessages(session.id)
          if (isActive) setMainView({ type: 'chat' })
        }}
      />

      <Dialog open={shareOpen} onOpenChange={(open) => { if (!open) setShareOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('sidebar.shareSession')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
            }}>
              <code style={{
                flex: 1,
                fontSize: 11,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                sparta://session/{session.id}
              </code>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`sparta://session/${session.id}`)}>
                {t('sidebar.copy')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(false)}>
              {t('sidebar.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
