"use client"

import { useEffect, useState, useCallback } from 'react'
import { FolderOpen, RefreshCw, Loader2 } from 'lucide-react'
import { toastReplace } from '@/lib/toast-helpers'
import type { FileTreeNode } from '@/types'
import { useProjectStore } from '@/stores/project.store'
import { useEventBusListener } from '@/hooks/useEventBus'
import { FileTreeItem } from './FileTreeItem'
import { ProjectFolderPicker } from './ProjectFolderPicker'

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
  css: 'CSS', scss: 'SCSS', html: 'HTML', vue: 'Vue', svelte: 'Svelte',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', md: 'Markdown', toml: 'TOML',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', dockerfile: 'Docker',
}

function countFiles(nodes: FileTreeNode[]): number {
  let count = 0
  for (const n of nodes) {
    if (n.type === 'file') count++
    else if (n.children) count += countFiles(n.children)
  }
  return count
}

function detectLanguages(nodes: FileTreeNode[], acc: Map<string, number> = new Map()): Map<string, number> {
  for (const n of nodes) {
    if (n.type === 'file') {
      const ext = n.name.split('.').pop()?.toLowerCase() ?? ''
      const lang = LANG_MAP[ext]
      if (lang) acc.set(lang, (acc.get(lang) ?? 0) + 1)
    } else if (n.children) {
      detectLanguages(n.children, acc)
    }
  }
  return acc
}

interface FileTreeSidebarProps {
  activePath?: string
  onSelectFile: (path: string) => void
  onDeleteFile?: (node: FileTreeNode) => void
}

export function FileTreeSidebar({ activePath, onSelectFile, onDeleteFile }: FileTreeSidebarProps) {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [treeStats, setTreeStats] = useState<{ fileCount: number; languages: string[] } | null>(null)

  const loadTree = useCallback(async () => {
    if (!activeProject?.rootPath || !window.fs) return
    setLoading(true)
    setTreeStats(null)
    try {
      const result = await window.fs.readDir(activeProject.rootPath)
      let nodes: FileTreeNode[] = []
      if (Array.isArray(result)) {
        nodes = result
      } else if (result && typeof result === 'object') {
        const { nodes: n, error } = result as { nodes?: FileTreeNode[]; error?: string }
        if (error) {
          toastReplace('error', 'load-tree', `Error cargando proyecto: ${error}`)
        }
        nodes = n ?? []
      }
      setTree(nodes)
      const fileCount = countFiles(nodes)
      const langMap = detectLanguages(nodes)
      const languages = [...langMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lang]) => lang)
      setTreeStats({ fileCount, languages })
    } catch (err) {
      toastReplace('error', 'load-tree', `Error cargando archivos: ${err instanceof Error ? err.message : err}`)
      setTree([])
      setTreeStats(null)
    } finally {
      setLoading(false)
    }
  }, [activeProject?.rootPath])

  const debouncedLoadTree = useCallback(() => {
    const id = setTimeout(loadTree, 400)
    return () => clearTimeout(id)
  }, [loadTree])

  useEffect(() => {
    if (activeProject?.rootPath) {
      loadTree()
    } else {
      setTree([])
    }
  }, [activeProject?.rootPath, loadTree])

  useEventBusListener('file:changed', () => {
    if (activeProject?.rootPath) debouncedLoadTree()
  })

  useEffect(() => {
    if (activeProject?.rootPath && window.fs?.startWatcher) {
      window.fs.startWatcher(activeProject.rootPath)
    }
    return () => {
      window.fs?.stopWatcher?.()
    }
  }, [activeProject?.rootPath])

  async function handleOpenFolder() {
    if (!window.fs || !activeProject) return
    const path = await window.fs.openFolderDialog()
    if (path) {
      useProjectStore.getState().setProjectRootPath(activeProject.id, path)
    }
  }

  function handleCopyPath(p: string) {
    navigator.clipboard.writeText(p).then(
      () => toastReplace('success', 'copy-path', 'Ruta copiada'),
      () => toastReplace('error', 'copy-path', 'No se pudo copiar'),
    )
  }

  async function handleNewFile(dirPath: string) {
    const name = prompt('Nombre del nuevo archivo:')
    if (!name) return
    const filePath = dirPath.includes('/') ? `${dirPath}/${name}` : `${dirPath}\\${name}`
    if (!window.fs) return
    const res = await window.fs.writeFile(filePath, '')
    if (res.success) {
      toastReplace('success', 'create-file', `Archivo creado: ${name}`)
      loadTree()
      onSelectFile(filePath)
    } else {
      toastReplace('error', 'create-file', `Error: ${res.error}`)
    }
  }

  async function handleNewFolder(dirPath: string) {
    const name = prompt('Nombre de la nueva carpeta:')
    if (!name) return
    const folderPath = dirPath.includes('/') ? `${dirPath}/${name}` : `${dirPath}\\${name}`
    if (!window.fs) return
    const res = await window.fs.mkdir(folderPath)
    if (res.success) {
      toastReplace('success', 'create-folder', `Carpeta creada: ${name}`)
      loadTree()
    } else {
      toastReplace('error', 'create-folder', `Error: ${res.error}`)
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
        {loading && tree.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}>
              Escaneando estructura del proyecto…
            </div>
          </div>
        ) : tree.length > 0 ? (
          <>
            {treeStats && treeStats.fileCount > 0 && (
              <div style={{
                padding: '4px 8px 6px',
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: 0.7,
              }}>
                {treeStats.fileCount} archivos
                {treeStats.languages.length > 0 && (
                  <> · {treeStats.languages.join(', ')}</>
                )}
              </div>
            )}
            {tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                activePath={activePath}
                onSelectFile={onSelectFile}
                onDelete={onDeleteFile}
                onCopyPath={handleCopyPath}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
              />
            ))}
          </>
        ) : null}
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
