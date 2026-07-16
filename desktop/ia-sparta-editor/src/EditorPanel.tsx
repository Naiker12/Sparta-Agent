"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { toastReplace } from 'ia-sparta-core'
import { useUIStore } from 'ia-sparta-core'
import { useProjectStore } from 'ia-sparta-core'
import { useEditorStore } from 'ia-sparta-core'
import { useSettingsStore } from 'ia-sparta-core'
import { useDiffReviewStore } from 'ia-sparta-core'
import { useEventBusListener } from 'ia-sparta-core'
import { FileTreeSidebar } from './FileTreeSidebar'
import { EditorTabs } from './EditorTabs'
import { MonacoEditor } from './MonacoEditor'
import { DiffReviewTab } from './DiffReviewTab'
import { InlineAskWidget } from './InlineAskWidget'
import { ConfirmDeleteDialog } from 'ia-sparta-design-system'
import { AgentActivityPanel } from 'ia-sparta-agents'
import { EditorToolbar } from './EditorToolbar'
import { Breadcrumb } from './EditorBreadcrumb'
import { StatusBar } from './EditorStatusBar'
import { EmptyEditorState } from './EditorEmptyState'
import { UnsavedChangesDialog } from './EditorDialogs'
import { EditorSkeleton } from './EditorSkeleton'
import { useAgentEditingTracker } from './hooks/useAgentEditingTracker'
import { useInlineDiffDecorations } from './hooks/useInlineDiffDecorations'
import type { FileTreeNode } from 'ia-sparta-core'
import { IS_ELECTRON } from 'ia-sparta-core'
import { Card, CardContent } from 'ia-sparta-design-system'
import { Button } from 'ia-sparta-design-system'
import { Monitor, Download } from 'lucide-react'
import { useTranslation } from 'ia-sparta-i18n'

interface OpenFile {
  path: string
  name: string
  content: string
  originalContent: string
}

export function EditorPanel() {
  const { t } = useTranslation()
  const setMainView = useUIStore((s) => s.setMainView)
  const editorExplorerVisible = useUIStore((s) => s.editorExplorerVisible)
  const editorExplorerWidth = useUIStore((s) => s.editorExplorerWidth)
  const toggleEditorExplorer = useUIStore((s) => s.toggleEditorExplorer)
  const setEditorExplorerWidth = useUIStore((s) => s.setEditorExplorerWidth)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const closeProject = useProjectStore((s) => s.closeProject)
  const agentPanelWidth = useUIStore((s) => s.agentPanelWidth)
  const setAgentPanelWidth = useUIStore((s) => s.setAgentPanelWidth)
  const editorAgentPanelVisible = useUIStore((s) => s.editorAgentPanelVisible)
  const toggleEditorAgentPanel = useUIStore((s) => s.toggleEditorAgentPanel)
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState<string | undefined>()
  const [pinnedPaths, setPinnedPaths] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)
  const [closingUnsavedPath, setClosingUnsavedPath] = useState<string | null>(null)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)
  const treeKey = useRef(0)
  const [inlineAsk, setInlineAsk] = useState<{
    selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
    selectedText: string
  } | null>(null)
  const recentlySavedRef = useRef<Set<string>>(new Set())

  const handleEditorMount = useCallback((ed: MonacoEditorNS.IStandaloneCodeEditor) => {
    editorRef.current = ed
    ed.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column })
    })
  }, [])

  const handleInlineAsk = useCallback((
    selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number },
    selectedText: string
  ) => {
    setInlineAsk({ selection, selectedText })
  }, [])

  const handleCloseInlineAsk = useCallback(() => {
    setInlineAsk(null)
  }, [])

  const activeFile = openFiles.find((f) => f.path === activePath)
  const { activeProposal } = useDiffReviewStore()
  const hasActiveDiff = activeProposal !== null

  let activeTab: { kind: 'file'; path: string } | { kind: 'diff' }
  if (activePath && activePath.startsWith('diff:')) {
    activeTab = { kind: 'diff' }
  } else if (activePath) {
    activeTab = { kind: 'file', path: activePath }
  } else if (hasActiveDiff) {
    activeTab = { kind: 'diff' }
  } else if (activeFile) {
    activeTab = { kind: 'file', path: activeFile.path }
  } else {
    activeTab = { kind: 'file', path: '' }
  }

  const openFilesRef = useRef(openFiles)
  openFilesRef.current = openFiles
  useEffect(() => {
    useEditorStore.getState().setOpenFiles(openFilesRef.current.map((f) => f.path))
  }, [openFiles])

  useEffect(() => {
    useEditorStore.getState().setActiveFilePath(activePath)
  }, [activePath])

  const openFile = useCallback(async (filePath: string) => {
    if (!window.fs) {
      console.warn('[EditorPanel] window.fs not available')
      return
    }
    const existing = openFiles.find((f) => f.path === filePath)
    if (existing) {
      setActivePath(filePath)
      return
    }

    setLoadingPath(filePath)
    try {
      const result = await window.fs.readFile(filePath)
      if (!result.success || result.content === undefined) {
        console.warn('[EditorPanel] readFile failed:', filePath, result.error)
        toastReplace('error', 'open-file', `No se pudo abrir: ${result.error ?? 'error desconocido'}`)
        return
      }

      const name = filePath.split(/[\\/]/).pop() ?? filePath
      const newFile: OpenFile = {
        path: filePath,
        name,
        content: result.content,
        originalContent: result.content,
      }
      setOpenFiles((prev) => [...prev, newFile])
      setActivePath(filePath)
    } catch (err) {
      console.error('[EditorPanel] openFile error:', filePath, err)
    } finally {
      setLoadingPath(null)
    }
  }, [openFiles])

  const closeFile = useCallback((filePath: string) => {
    const file = openFiles.find((f) => f.path === filePath)
    if (file && file.content !== file.originalContent) {
      setClosingUnsavedPath(filePath)
      return
    }
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== filePath)
      if (activePath === filePath) {
        setActivePath(next.length > 0 ? next[next.length - 1].path : undefined)
      }
      return next
    })
  }, [activePath, openFiles])

  const confirmCloseUnsaved = useCallback((save: boolean) => {
    if (!closingUnsavedPath) return
    if (save) {
      const file = openFiles.find((f) => f.path === closingUnsavedPath)
      if (file && window.fs) {
        window.fs.writeFile(file.path, file.content)
      }
    }
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== closingUnsavedPath)
      if (activePath === closingUnsavedPath) {
        setActivePath(next.length > 0 ? next[next.length - 1].path : undefined)
      }
      return next
    })
    setClosingUnsavedPath(null)
  }, [closingUnsavedPath, activePath, openFiles])

  const updateFileContent = useCallback((filePath: string, value: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content: value } : f))
    )
  }, [])

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || !window.fs) return
    recentlySavedRef.current.add(activeFile.path)
    setTimeout(() => { recentlySavedRef.current.delete(activeFile.path) }, 500)

    const result = await window.fs.writeFile(activeFile.path, activeFile.content)
    if (result.success) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === activeFile.path ? { ...f, originalContent: activeFile.content } : f
        )
      )
    }
  }, [activeFile])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || !window.fs) return
    const isDir = deleteTarget.type === 'directory'
    const result = isDir
      ? await window.fs.deleteFolder(deleteTarget.path)
      : await window.fs.deleteFile(deleteTarget.path)
    if (result.success) {
      closeFile(deleteTarget.path)
      treeKey.current++
      setDeleteTarget(null)
    }
  }, [deleteTarget, closeFile])

  const handleCloseProject = useCallback(() => {
    if (!activeProject) return
    closeProject(activeProject.id)
    setOpenFiles([])
    setActivePath(undefined)
    setPinnedPaths(new Set())
  }, [activeProject, closeProject])

  const handleTogglePin = useCallback((path: string) => {
    setPinnedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleCloseAll = useCallback(() => {
    setOpenFiles([])
    setActivePath(undefined)
    setPinnedPaths(new Set())
  }, [])

  const handleCloseOthers = useCallback((keepPath: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path === keepPath))
    setActivePath(keepPath)
  }, [])

  const handleReorder = useCallback((fromIdx: number, toIdx: number) => {
    setOpenFiles((prev) => {
      const pinnedList = prev.filter((f) => pinnedPaths.has(f.path))
      const unpinnedList = prev.filter((f) => !pinnedPaths.has(f.path))
      const all = [...pinnedList, ...unpinnedList]
      const [moved] = all.splice(fromIdx, 1)
      all.splice(toIdx, 0, moved)
      return all
    })
  }, [pinnedPaths])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      saveActiveFile()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      toggleEditorExplorer()
    }
  }, [saveActiveFile, toggleEditorExplorer])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Hooks for agent editing tracking and inline diff decorations
  const { agentEditingPaths } = useAgentEditingTracker(openFile)
  const { applyInlineDiffDecorations } = useInlineDiffDecorations(editorRef)

  // Event listeners
  useEventBusListener('editor:open_file', (data: { filePath?: string } | unknown) => {
    const filePath = (data as { filePath?: string })?.filePath
    if (filePath) openFile(filePath)
  })

  useEventBusListener('editor:diff_proposed', (data: Record<string, unknown> | unknown) => {
    const evt = data as Record<string, unknown>
    const filePath = (evt.filePath ?? evt.path ?? '') as string
    const originalContent = evt.originalContent as string | undefined
    const newContent = evt.newContent as string | undefined
    if (filePath && originalContent && newContent && activeFile?.path === filePath) {
      applyInlineDiffDecorations(filePath, originalContent, newContent)
    }
    setActivePath('diff:active')
  })

  useEventBusListener('file:changed', (data: { path?: string } | unknown) => {
    const changedPath = (data as { path?: string })?.path
    if (!changedPath || !window.fs) return
    const existingOpen = openFiles.find((f) => f.path === changedPath)

    if (!existingOpen) {
      const autonomy = useSettingsStore.getState().agentAutonomy
      if (autonomy !== 'autonomous_readonly') {
        openFile(changedPath)
      }
      return
    }

    if (recentlySavedRef.current.has(changedPath)) return

    window.fs.readFile(changedPath).then((result) => {
      if (!result.success || result.content === undefined) return
      if (result.content === existingOpen.content) return

      const hasLocalEdits = existingOpen.content !== existingOpen.originalContent

      if (!hasLocalEdits) {
        updateFileContent(changedPath, result.content as string)
        setOpenFiles((prev) =>
          prev.map((f) => f.path === changedPath
            ? { ...f, content: result.content as string, originalContent: result.content as string }
            : f)
        )
      } else {
        toastReplace('info', 'file-external-change', 'Archivo modificado externamente', {
          description: `${existingOpen.name} tiene cambios locales y externos.`,
          action: {
            label: 'Recargar',
            onClick: () => {
              updateFileContent(changedPath, result.content as string)
              setOpenFiles((prev) =>
                prev.map((f) => f.path === changedPath
                  ? { ...f, originalContent: result.content as string }
                  : f)
              )
            },
          },
          duration: 8000,
        })
      }
    })
  })

  const tabs = [
    ...(hasActiveDiff
      ? [{ path: 'diff:active', name: 'Cambio propuesto', modified: false } as const]
      : []),
    ...openFiles.map((f) => ({
      path: f.path,
      name: f.name,
      modified: f.content !== f.originalContent,
    })),
  ]


  return (
    <div className="editor-panel" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minHeight: 0, position: 'relative' }}>
      {!IS_ELECTRON ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center animate-in fade-in duration-150"
          style={{ background: 'var(--bg-surface)' }}
        >
          <Card className="w-full max-w-[400px] flex flex-col items-center gap-4 p-8 text-center shadow-lg animate-in zoom-in-95 duration-150">
            <div
              className="flex size-12 items-center justify-center rounded-lg"
              style={{
                background: 'var(--bg-hover)',
              }}
            >
              <Monitor
                size={24}
                strokeWidth={1.25}
                style={{ color: 'var(--text-muted)' }}
              />
            </div>

            <CardContent className="flex flex-col items-center gap-1 p-0">
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('editor.desktopOnly.title')}
              </h3>
              <p className="max-w-[340px] text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t('editor.desktopOnly.desc')}
              </p>
              <p className="max-w-[340px] text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                {t('editor.desktopOnly.downloadHint')}
              </p>
            </CardContent>

            <div className="flex w-full flex-col gap-1.5 mt-2">
              <Button className="w-full gap-2">
                <Download size={14} />
                {t('editor.empty.openFolder').replace(/.*Folder.*/i, 'Download App').replace(/.*carpeta.*/i, 'Descargar App')}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setMainView({ type: 'chat' })}>
                {t('editor.empty.closeEditor')}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          {editorExplorerVisible && (
            <>
              <div style={{ width: editorExplorerWidth, flexShrink: 0, height: '100%', minHeight: 0 }}>
                <FileTreeSidebar
                  key={treeKey.current}
                  activePath={activePath}
                  onSelectFile={openFile}
                  onDeleteFile={setDeleteTarget}
                />
              </div>
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const startX = e.clientX
                  const startW = editorExplorerWidth
                  document.body.classList.add('is-resizing')
                  function onMove(ev: MouseEvent) {
                    const newW = startW + (ev.clientX - startX)
                    setEditorExplorerWidth(newW)
                  }
                  function onUp() {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.body.classList.remove('is-resizing')
                  }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                }}
                className="pane-resizer"
              />
            </>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <EditorToolbar
              explorerVisible={editorExplorerVisible}
              onToggleExplorer={toggleEditorExplorer}
              agentPanelVisible={editorAgentPanelVisible}
              onToggleAgentPanel={toggleEditorAgentPanel}
              projectName={activeProject?.name}
              onCloseProject={handleCloseProject}
              onCloseEditor={() => setMainView({ type: 'chat' })}
            />
            <EditorTabs
              tabs={tabs}
              activePath={activePath}
              onSelect={setActivePath}
              onClose={(path) => {
                if (path === 'diff:active') {
                  useDiffReviewStore.getState().next()
                  setActivePath(undefined)
                } else {
                  closeFile(path)
                }
              }}
              pinnedPaths={pinnedPaths}
              onTogglePin={handleTogglePin}
              onCloseAll={handleCloseAll}
              onCloseOthers={handleCloseOthers}
              onReorder={handleReorder}
              agentEditingPaths={agentEditingPaths}
              diffsPending={useDiffReviewStore.getState().pendingPaths}
            />
            {activeTab.kind === 'diff' ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <DiffReviewTab />
              </div>
            ) : activeTab.kind === 'file' && activeFile ? (
              <>
                <Breadcrumb path={activeFile.path} agentEditingPaths={agentEditingPaths} />
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <MonacoEditor
                    path={activeFile.path}
                    content={activeFile.content}
                    onChange={(value) => updateFileContent(activeFile.path, value)}
                    onMount={handleEditorMount}
                    onInlineAsk={handleInlineAsk}
                  />
                  {inlineAsk && activeFile && (
                    <InlineAskWidget
                      editor={editorRef.current!}
                      selection={inlineAsk.selection}
                      filePath={activeFile.path}
                      selectedText={inlineAsk.selectedText}
                      language={activeFile.path.split('.').pop()?.toLowerCase() ?? 'plaintext'}
                      onClose={handleCloseInlineAsk}
                    />
                  )}
                </div>
                <StatusBar
                  path={activeFile.path}
                  line={cursorPos.line}
                  col={cursorPos.col}
                />
              </>
            ) : loadingPath ? (
              <EditorSkeleton path={loadingPath} />
            ) : (
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <MonacoEditor onMount={handleEditorMount} />
                {!activeProject?.rootPath && (
                  <EmptyEditorState
                    projectName={activeProject?.name}
                    hasRootPath={!!activeProject?.rootPath}
                    explorerVisible={editorExplorerVisible}
                    onShowExplorer={() => { if (!editorExplorerVisible) toggleEditorExplorer() }}
                    onOpenFolder={async () => {
                      if (!window.fs) return
                      try {
                        const path = await window.fs.openFolderDialog()
                        if (path) {
                          let project = useProjectStore.getState().getActiveProject()
                          if (!project) {
                            const folderName = path.split(/[/\\]/).pop() ?? 'Proyecto'
                            useProjectStore.getState().addProject(folderName)
                            project = useProjectStore.getState().getActiveProject()
                          }
                          if (project) {
                            useProjectStore.getState().setProjectRootPath(project.id, path)
                            await window.fs.setWorkspaceRoot(path)
                          }
                        }
                      } catch (err) {
                        // Dialog cancelled or error
                      }
                    }}
                    onCloseProject={handleCloseProject}
                    onClose={() => setMainView({ type: 'chat' })}
                  />
                )}
              </div>
            )}
          </div>

          {editorAgentPanelVisible && (
            <>
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const startX = e.clientX
                  const startW = agentPanelWidth
                  document.body.classList.add('is-resizing')
                  function onMove(ev: MouseEvent) {
                    const newW = startW - (ev.clientX - startX)
                    setAgentPanelWidth(newW)
                  }
                  function onUp() {
                    document.removeEventListener('mousemove', onMove)
                    document.removeEventListener('mouseup', onUp)
                    document.body.classList.remove('is-resizing')
                  }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                }}
                className="pane-resizer"
              />
              <AgentActivityPanel />
            </>
          )}

          <ConfirmDeleteDialog
            open={!!deleteTarget}
            onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
            title={`Eliminar ${deleteTarget?.type === 'directory' ? 'carpeta' : 'archivo'}`}
            itemLabel={deleteTarget?.name ?? ''}
            onConfirm={handleDeleteConfirm}
          />

          {closingUnsavedPath && (
            <UnsavedChangesDialog
              fileName={openFiles.find((f) => f.path === closingUnsavedPath)?.name ?? ''}
              onSave={() => confirmCloseUnsaved(true)}
              onDiscard={() => confirmCloseUnsaved(false)}
              onCancel={() => setClosingUnsavedPath(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
