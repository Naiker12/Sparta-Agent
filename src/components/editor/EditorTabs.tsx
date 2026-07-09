"use client"

import { useState, useRef, useCallback } from 'react'
import { X, Pin, PinOff, XCircle, MinusCircle } from 'lucide-react'

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
}

interface TabContextMenu {
  x: number
  y: number
  path: string
}

export function EditorTabs({
  tabs, activePath, onSelect, onClose,
  pinnedPaths = new Set(), onTogglePin, onCloseAll, onCloseOthers, onReorder,
}: EditorTabsProps) {
  const [ctx, setCtx] = useState<TabContextMenu | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pinned = tabs.filter((t) => pinnedPaths.has(t.path))
  const unpinned = tabs.filter((t) => !pinnedPaths.has(t.path))
  const ordered = [...pinned, ...unpinned]

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, path })
  }, [])

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

  if (ordered.length === 0) return null

  return (
    <>
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
          return (
            <div
              key={tab.path}
              onClick={() => onSelect(tab.path)}
              onContextMenu={(e) => handleContextMenu(e, tab.path)}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
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
                border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                borderBottomColor: isActive ? 'var(--bg-base)' : 'transparent',
                marginBottom: isActive ? -1 : 0,
                userSelect: 'none',
                opacity: dragIdx === idx ? 0.4 : 1,
                borderTop: dragOverIdx === idx && dragIdx !== idx ? '2px solid var(--accent)' : undefined,
              }}
            >
              {isPinned && <Pin size={9} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {tab.name}
                {tab.modified && <span style={{ color: 'var(--status-warn)', marginLeft: 3 }}>●</span>}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(tab.path) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <X size={10} strokeWidth={2} />
              </button>
            </div>
          )
        })}
      </div>
      {ctx && (
        <TabContextMenu
          x={ctx.x} y={ctx.y}
          isPinned={pinnedPaths.has(ctx.path)}
          onClose={() => setCtx(null)}
          onCloseTab={() => { onClose(ctx.path); setCtx(null) }}
          onCloseOthers={onCloseOthers ? () => { onCloseOthers(ctx.path); setCtx(null) } : undefined}
          onCloseAll={onCloseAll ? () => { onCloseAll(); setCtx(null) } : undefined}
          onTogglePin={onTogglePin ? () => { onTogglePin(ctx.path); setCtx(null) } : undefined}
        />
      )}
    </>
  )
}

function TabContextMenu({
  x, y, isPinned, onClose, onCloseTab, onCloseOthers, onCloseAll, onTogglePin,
}: {
  x: number; y: number; isPinned: boolean
  onClose: () => void
  onCloseTab: () => void
  onCloseOthers?: () => void
  onCloseAll?: () => void
  onTogglePin?: () => void
}) {
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 12px', cursor: 'pointer', color: 'var(--text-primary, #ccc)',
    border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: 12,
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: y, left: x, zIndex: 9999,
        minWidth: 170, background: 'var(--bg-elevated, #1e1e2e)',
        border: '1px solid var(--border-normal, #333)', borderRadius: 'var(--radius, 6px)',
        padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', fontSize: 12,
      }}>
        {onTogglePin && (
          <button style={itemStyle} onClick={onTogglePin}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            {isPinned ? 'Desanclar' : 'Anclar'}
          </button>
        )}
        <button style={itemStyle} onClick={onCloseTab}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <MinusCircle size={13} /> Cerrar
        </button>
        {onCloseOthers && (
          <button style={itemStyle} onClick={onCloseOthers}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <XCircle size={13} /> Cerrar otros
          </button>
        )}
        {onCloseAll && (
          <button style={itemStyle} onClick={onCloseAll}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <XCircle size={13} /> Cerrar todos
          </button>
        )}
      </div>
    </>
  )
}
