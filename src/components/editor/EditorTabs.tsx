"use client"

import { X } from 'lucide-react'

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
}

export function EditorTabs({ tabs, activePath, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      padding: '4px 4px 0',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      overflowX: 'auto',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.path === activePath
        return (
          <div
            key={tab.path}
            onClick={() => onSelect(tab.path)}
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
            }}
          >
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
  )
}
