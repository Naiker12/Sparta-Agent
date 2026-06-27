"use client"

import { useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Trash2 } from 'lucide-react'
import type { FileTreeNode } from '@/types'

interface FileTreeItemProps {
  node: FileTreeNode
  depth?: number
  activePath?: string
  onSelectFile: (path: string) => void
  onDelete?: (node: FileTreeNode) => void
}

export function FileTreeItem({ node, depth = 0, activePath, onSelectFile, onDelete }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [hovered, setHovered] = useState(false)
  const isDirectory = node.type === 'directory'
  const isActive = node.path === activePath

  function handleClick() {
    if (isDirectory) {
      setExpanded(!expanded)
    } else {
      onSelectFile(node.path)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px 3px 8px',
          paddingLeft: `${8 + depth * 14}px`,
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          background: isActive ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          userSelect: 'none',
        }}
      >
        <span style={{ width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isDirectory ? (
            expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          ) : null}
        </span>
        {isDirectory ? (
          expanded ? <FolderOpen size={12} style={{ color: 'var(--accent)' }} /> : <Folder size={12} />
        ) : (
          <FileText size={12} />
        )}
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
        {hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(node)
            }}
            title={`Eliminar ${isDirectory ? 'carpeta' : 'archivo'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              border: 'none',
              background: 'transparent',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--status-err)',
              opacity: 0.7,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {isDirectory && expanded && node.children ? (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelectFile={onSelectFile}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
