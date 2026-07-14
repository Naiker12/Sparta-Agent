"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Pin, PinOff, XCircle, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface EditorTab {
  path: string
  name: string
  modified?: boolean
}

interface EditorTabsProps {
  tabs: EditorTab[]
  activePath?: string
  onSelect: (path: string) => void
  onClose: (path: string) => void
  pinnedPaths?: Set<string>
  onTogglePin?: (path: string) => void
  onCloseAll?: () => void
  onCloseOthers?: (path: string) => void
  onReorder?: (from: number, to: number) => void
  /** Paths currently being edited by the agent (pulsing indicator) */
  agentEditingPaths?: Set<string>
  /** Paths with pending diffs awaiting review */
  diffsPending?: Set<string>
}

export function EditorTabs({
  tabs, activePath, onSelect, onClose,
  pinnedPaths = new Set(), onTogglePin, onCloseAll, onCloseOthers, onReorder,
  agentEditingPaths = new Set(), diffsPending = new Set(),
}: EditorTabsProps) {
  const [ctxPath, setCtxPath] = useState<string | null>(null)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pinned = tabs.filter((t) => pinnedPaths.has(t.path))
  const unpinned = tabs.filter((t) => !pinnedPaths.has(t.path))
  const ordered = [...pinned, ...unpinned]

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', String(idx))
    setDragIdx(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    const fromIdx = dragIdx
    setDragIdx(null)
    setDragOverIdx(null)
    if (fromIdx !== null && fromIdx !== toIdx && onReorder) {
      onReorder(fromIdx, toIdx)
    }
  }, [dragIdx, onReorder])

  // Close context menu on Escape
  useEffect(() => {
    if (!ctxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ctxOpen])

  if (ordered.length === 0) return null

  return (
    <div ref={containerRef} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      padding: '4px 4px 0',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      overflowX: 'auto',
    }}>
      {ordered.map((tab, idx) => {
        const isActive = tab.path === activePath
        const isPinned = pinnedPaths.has(tab.path)
        const isAgentEditing = agentEditingPaths.has(tab.path)
        const isPendingDiff = diffsPending.has(tab.path)

        const tabContent = (
          <div
            onClick={() => onSelect(tab.path)}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
            className="group/tab"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              minWidth: 80,
              maxWidth: 180,
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              background: isActive ? 'var(--bg-base)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              border: isAgentEditing
                ? '1px solid transparent'
                : isActive
                  ? '1px solid var(--border-subtle)'
                  : '1px solid transparent',
              borderBottomColor: isActive && !isAgentEditing ? 'var(--bg-base)' : 'transparent',
              borderTop: isAgentEditing
                ? '2px solid var(--status-warn)'
                : dragOverIdx === idx && dragIdx !== idx
                  ? '2px solid var(--accent)'
                  : undefined,
              marginBottom: isActive ? -1 : 0,
              userSelect: 'none',
              opacity: dragIdx === idx ? 0.4 : 1,
            }}
          >
            {isPinned && <Pin size={9} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}>
              {tab.name}
              {/* Agent editing indicator: pulsing orange dot */}
              {isAgentEditing && (
                <span
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                  title="Agente editando..."
                />
              )}
              {/* Pending diff review indicator: solid orange dot */}
              {isPendingDiff && !isAgentEditing && (
                <span
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--status-warn)',
                  }}
                  title="Pendiente de revisión"
                />
              )}
              {tab.modified && <span style={{ color: 'var(--status-warn)', marginLeft: 3 }}>●</span>}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover/tab:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onClose(tab.path) }}
            >
              <X size={10} strokeWidth={2} />
            </Button>
          </div>
        )

        return (
          <DropdownMenu key={tab.path} open={ctxOpen && ctxPath === tab.path} onOpenChange={(open) => {
            if (!open) { setCtxOpen(false); setCtxPath(null) }
          }}>
            <DropdownMenuTrigger>
              <div
                onContextMenu={(e) => {
                  e.preventDefault()
                  setCtxPath(tab.path)
                  setCtxOpen(true)
                }}
              >
                {tabContent}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[170px]">
              {onTogglePin && (
                <DropdownMenuItem onClick={() => { onTogglePin(tab.path); setCtxOpen(false) }}>
                  {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                  <span>{isPinned ? 'Desanclar' : 'Anclar'}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { onClose(tab.path); setCtxOpen(false) }}>
                <MinusCircle size={13} />
                <span>Cerrar</span>
              </DropdownMenuItem>
              {onCloseOthers && (
                <DropdownMenuItem onClick={() => { onCloseOthers(tab.path); setCtxOpen(false) }}>
                  <XCircle size={13} />
                  <span>Cerrar otros</span>
                </DropdownMenuItem>
              )}
              {onCloseAll && (
                <DropdownMenuItem onClick={() => { onCloseAll(); setCtxOpen(false) }}>
                  <XCircle size={13} />
                  <span>Cerrar todos</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
