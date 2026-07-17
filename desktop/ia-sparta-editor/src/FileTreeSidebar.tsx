"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import { toastReplace } from 'ia-sparta-core'
import type { FileTreeNode } from 'ia-sparta-core'
import { useProjectStore } from 'ia-sparta-core'
import { useEventBusListener } from 'ia-sparta-core'
import { FileTreeItem } from './FileTreeItem'
import { ScrollArea } from 'ia-sparta-design-system'
import { Skeleton } from 'ia-sparta-design-system'
import { Button } from 'ia-sparta-design-system'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'ia-sparta-design-system'
import { useTranslation } from 'ia-sparta-i18n'

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
  css: 'CSS', scss: 'SCSS', html: 'HTML', vue: 'Vue', svelte: 'Svelte',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', md: 'Markdown', toml: 'TOML',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', dockerfile: 'Docker',
}

interface FileTreeSidebarProps {
  activePath?: string
  onSelectFile: (path: string) => void
  onDeleteFile?: (node: FileTreeNode) => void
}

export function FileTreeSidebar({ activePath, onSelectFile, onDeleteFile }: FileTreeSidebarProps) {
  const { t } = useTranslation()
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [treeStats, setTreeStats] = useState<{ fileCount: number; languages: string[] } | null>(null)

  const countTotalFiles = useCallback((nodes: FileTreeNode[]): number => {
    let count = 0
    for (const n of nodes) {
      if (n.type === 'file') count++
    }
    return count
  }, [])

  const detectTopLanguages = useCallback((nodes: FileTreeNode[]): string[] => {
    const langMap = new Map<string, number>()
    for (const n of nodes) {
      if (n.type === 'file') {
        const ext = n.name.split('.').pop()?.toLowerCase() ?? ''
        const lang = LANG_MAP[ext]
        if (lang) langMap.set(lang, (langMap.get(lang) ?? 0) + 1)
      }
    }
    return [...langMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang)
  }, [])

  const loadDirChildren = useCallback(async (dirPath: string): Promise<FileTreeNode[]> => {
    if (!window.fs?.readDirLevel) return []
    const result = await window.fs.readDirLevel(dirPath)
    const { nodes: n, error } = result
    if (error) {
      console.error(`[FileTreeSidebar] Error loading ${dirPath}: ${error}`)
    }
    return n ?? []
  }, [])

  const loadTree = useCallback(async () => {
    if (!activeProject?.rootPath || !window.fs) return
    setLoading(true)
    setTreeStats(null)
    try {
      // Use single-level read for the root
      const result = await window.fs.readDirLevel(activeProject.rootPath)
      const { nodes: n, error } = result
      if (error) {
        toastReplace('error', 'load-tree', `Error cargando proyecto: ${error}`)
      }
      const nodes = n ?? []
      setTree(nodes)
      const fileCount = countTotalFiles(nodes)
      const languages = detectTopLanguages(nodes)
      setTreeStats({ fileCount, languages })
    } catch (err) {
      toastReplace('error', 'load-tree', `Error cargando archivos: ${err instanceof Error ? err.message : err}`)
      setTree([])
      setTreeStats(null)
    } finally {
      setLoading(false)
    }
  }, [activeProject?.rootPath, loadDirChildren, countTotalFiles, detectTopLanguages])

  const handleExpandDir = useCallback(async (dirPath: string): Promise<FileTreeNode[]> => {
    return loadDirChildren(dirPath)
  }, [loadDirChildren])

  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerLoadTree = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current)
    }
    loadTimerRef.current = setTimeout(() => {
      loadTree()
    }, 300)
  }, [loadTree])

  useEffect(() => {
    if (activeProject?.rootPath) {
      loadTree()
    } else {
      setTree([])
    }
    return () => {
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current)
      }
    }
  }, [activeProject?.rootPath, loadTree])

  useEventBusListener('file:changed', () => {
    if (activeProject?.rootPath) triggerLoadTree()
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
      <div className="flex h-full w-full flex-col"
        style={{ borderRight: '1px solid var(--border-normal)', background: 'var(--bg-sidebar)' }}
      >
        <SidebarHeader t={t} onOpenFolder={handleOpenFolder} />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden"
      style={{ borderRight: '1px solid var(--border-normal)', background: 'var(--bg-sidebar)' }}
    >
      <SidebarHeader t={t} onOpenFolder={handleOpenFolder} onRefresh={loadTree} loading={loading} />
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-1.5">
          {loading && tree.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 animate-in fade-in duration-200">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
              <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('editor.sidebar.scanning')}
              </p>
            </div>
          ) : tree.length > 0 ? (
            <>
              {treeStats && treeStats.fileCount > 0 && (
                <div
                  className="flex items-center gap-1 px-2 py-1 text-[10px] opacity-70"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {treeStats.fileCount} {t('editor.sidebar.files')}
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
                  onExpandDir={handleExpandDir}
                />
              ))}
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}

function SidebarHeader({
  t,
  onOpenFolder,
  onRefresh,
  loading,
}: {
  t: (key: string) => string
  onOpenFolder: () => void
  onRefresh?: () => void
  loading?: boolean
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-between"
      style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-normal)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span>{t('editor.sidebar.explorer')}</span>
      <div className="flex gap-0.5">
        <TooltipProvider delay={400}>
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={loading}
                  onClick={onRefresh}
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t('editor.sidebar.refresh')}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onOpenFolder}
              >
                <FolderOpen size={11} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t('editor.sidebar.openFolder')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
