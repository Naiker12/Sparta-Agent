"use client"

import { useState, useEffect, useRef } from 'react'
import {
  ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Trash2,
  FileCode, FileJson, FileImage, FileCog, FileLock, FileType,
  ClipboardCopy, FilePlus, FolderPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FileTreeNode } from '@/types'

const EXT_ICON_MAP: Record<string, typeof FileCode> = {
  js: FileCode, jsx: FileCode, ts: FileCode, tsx: FileCode,
  py: FileCode, rb: FileCode, go: FileCode, rs: FileCode,
  java: FileCode, c: FileCode, cpp: FileCode, h: FileCode,
  cs: FileCode, swift: FileCode, kt: FileCode,
  html: FileCode, htm: FileCode, css: FileCode, scss: FileCode,
  vue: FileCode, svelte: FileCode,
  json: FileJson, yaml: FileJson, yml: FileJson, toml: FileJson,
  xml: FileJson, ini: FileJson,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage,
  svg: FileImage, webp: FileImage, ico: FileImage,
  sh: FileCog, bash: FileCog, zsh: FileCog, fish: FileCog,
  makefile: FileCog, dockerfile: FileCog,
  env: FileLock, pem: FileLock, key: FileLock,
  md: FileType, mdx: FileType, txt: FileType, pdf: FileType,
  lock: FileLock, log: FileText,
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const base = name.toLowerCase()
  if (base === 'dockerfile' || base === 'makefile' || base === 'gemfile') return FileCog
  return EXT_ICON_MAP[ext] ?? FileText
}

interface ContextMenuState {
  x: number
  y: number
  nodePath: string
  isDir: boolean
}

interface FileTreeItemProps {
  node: FileTreeNode
  depth?: number
  activePath?: string
  onSelectFile: (path: string) => void
  onDelete?: (node: FileTreeNode) => void
  onCopyPath?: (path: string) => void
  onNewFile?: (dirPath: string) => void
  onNewFolder?: (dirPath: string) => void
}

export function FileTreeItem({
  node, depth = 0, activePath, onSelectFile, onDelete,
  onCopyPath, onNewFile, onNewFolder,
}: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const [hovered, setHovered] = useState(false)
  const [ctx, setCtx] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isDirectory = node.type === 'directory'
  const isActive = node.path === activePath

  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('contextmenu', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [ctx])

  function handleClick() {
    if (isDirectory) {
      setExpanded(!expanded)
    } else {
      onSelectFile(node.path)
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ x: e.clientX, y: e.clientY, nodePath: node.path, isDir: isDirectory })
  }

  function handleCtxAction(action: string) {
    if (!ctx) return
    if (action === 'copyPath') onCopyPath?.(ctx.nodePath)
    else if (action === 'newFile' && ctx.isDir) onNewFile?.(ctx.nodePath)
    else if (action === 'newFolder' && ctx.isDir) onNewFolder?.(ctx.nodePath)
    else if (action === 'delete') onDelete?.({ ...node, path: ctx.nodePath, type: ctx.isDir ? 'directory' : 'file', name: ctx.nodePath.split(/[\\/]/).pop() ?? '' } as FileTreeNode)
    setCtx(null)
  }

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: ctx?.y ?? 0,
    left: ctx?.x ?? 0,
    zIndex: 999,
    minWidth: 160,
    background: 'var(--bg-elevated, #1e1e2e)',
    border: '1px solid var(--border-normal, #333)',
    borderRadius: 'var(--radius, 6px)',
    padding: '4px 0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    fontSize: 12,
    fontFamily: 'var(--font-ui, sans-serif)',
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px',
    cursor: 'pointer',
    color: 'var(--text-primary, #ccc)',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
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
          transition: 'background-color 0.12s ease-out, color 0.12s ease-out',
        }}
      >
        <span style={{ width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isDirectory ? (
            expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          ) : null}
        </span>
        {isDirectory ? (
          expanded ? <FolderOpen size={12} style={{ color: 'var(--accent)' }} /> : <Folder size={12} />
        ) : (() => {
          const Icon = getFileIcon(node.name)
          return <Icon size={12} />
        })()}
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
        {hovered && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(node)
            }}
            title={`Eliminar ${isDirectory ? 'carpeta' : 'archivo'}`}
            className="text-[var(--status-err)] opacity-70 hover:opacity-100"
          >
            <Trash2 size={11} />
          </Button>
        )}
      </div>
      {ctx && (
        <div ref={menuRef} style={menuStyle}>
          <button style={itemStyle} onClick={() => handleCtxAction('copyPath')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <ClipboardCopy size={13} /> Copiar ruta
          </button>
          {ctx.isDir && (
            <>
              <button style={itemStyle} onClick={() => handleCtxAction('newFile')}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <FilePlus size={13} /> Nuevo archivo
              </button>
              <button style={itemStyle} onClick={() => handleCtxAction('newFolder')}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <FolderPlus size={13} /> Nueva carpeta
              </button>
            </>
          )}
          <div style={{ height: 1, background: 'var(--border-normal, #333)', margin: '3px 0' }} />
          <button style={{ ...itemStyle, color: 'var(--status-err, #f44)' }} onClick={() => handleCtxAction('delete')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #333)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      )}
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
              onCopyPath={onCopyPath}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
