"use client"

import { useEffect, useState, useCallback } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import type { FileTreeNode } from '@/types'
import { useProjectStore } from '@/stores/project.store'
import { FileTreeItem } from './FileTreeItem'
import { ProjectFolderPicker } from './ProjectFolderPicker'

interface FileTreeSidebarProps {
  activePath?: string
  onSelectFile: (path: string) => void
  onDeleteFile?: (node: FileTreeNode) => void
}

export function FileTreeSidebar({ activePath, onSelectFile, onDeleteFile }: FileTreeSidebarProps) {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(false)

  const loadTree = useCallback(async () => {
    if (!activeProject?.rootPath || !window.fs) return
    setLoading(true)
    try {
      const nodes = await window.fs.readDir(activeProject.rootPath)
      setTree(nodes)
    } finally {
      setLoading(false)
    }
  }, [activeProject?.rootPath])

  useEffect(() => {
    if (activeProject?.rootPath) {
      loadTree()
    } else {
      setTree([])
    }
  }, [activeProject?.rootPath, loadTree])

  async function handleOpenFolder() {
    if (!window.fs || !activeProject) return
    const path = await window.fs.openFolderDialog()
    if (path) {
      useProjectStore.getState().setProjectRootPath(activeProject.id, path)
    }
  }

  if (!activeProject?.rootPath) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-normal)',
        background: 'var(--bg-sidebar)',
      }}>
        <SidebarHeader onOpenFolder={handleOpenFolder} />
        <ProjectFolderPicker projectId={activeProject?.id ?? ''} />
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-normal)',
      background: 'var(--bg-sidebar)',
      overflow: 'hidden',
    }}>
      <SidebarHeader onOpenFolder={handleOpenFolder} onRefresh={loadTree} loading={loading} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 4px' }}>
        {tree.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            activePath={activePath}
            onSelectFile={onSelectFile}
            onDelete={onDeleteFile}
          />
        ))}
      </div>
    </div>
  )
}

function SidebarHeader({
  onOpenFolder,
  onRefresh,
  loading,
}: {
  onOpenFolder: () => void
  onRefresh?: () => void
  loading?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 10px',
      borderBottom: '1px solid var(--border-normal)',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      <span>Explorador</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refrescar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
        <button
          onClick={onOpenFolder}
          title="Abrir carpeta"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <FolderOpen size={11} />
        </button>
      </div>
    </div>
  )
}
