"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import { toastReplace } from '@/lib/toast-helpers'
import type { FileTreeNode } from '@/types'
import { useProjectStore } from '@/stores/project.store'
import { useEventBusListener } from '@/hooks/useEventBus'
import { FileTreeItem } from './FileTreeItem'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'

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
  const { t } = useTranslation()
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
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center gap-3 animate-in fade-in duration-200">
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-hover)',
            color: 'var(--text-muted)',
          }}>
            <FolderOpen size={18} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">
              Sin proyecto abierto
            </p>
            <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed max-w-[180px] mx-auto">
              Arrastrá una carpeta al editor o hacé clic abajo para empezar.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpenFolder}
            className="mt-2 text-[11px] font-medium h-7 px-3"
          >
            Abrir carpeta
          </Button>
        </div>
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
