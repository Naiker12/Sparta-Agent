"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import { PanelLeft, X, FolderX, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/stores/ui.store'
import { useProjectStore } from '@/stores/project.store'
import { useEditorStore } from '@/stores/editor.store'
import { useDiffReviewStore } from '@/stores/diff-review.store'
import { useEventBusListener } from '@/hooks/useEventBus'
import { useEventBus } from '@/stores/event-bus.store'
import { FileTreeSidebar } from './FileTreeSidebar'
import { EditorTabs } from './EditorTabs'
import { MonacoEditor } from './MonacoEditor'
import { DiffReviewTab } from './DiffReviewTab'
import { InlineAskWidget } from './InlineAskWidget'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { FileTreeNode } from '@/types'

interface OpenFile {
  path: string
  name: string
  content: string
  originalContent: string
}

export function EditorPanel() {
  const toggleEditor = useUIStore((s) => s.toggleEditor)
  const editorExplorerVisible = useUIStore((s) => s.editorExplorerVisible)
  const editorExplorerWidth = useUIStore((s) => s.editorExplorerWidth)
  const toggleEditorExplorer = useUIStore((s) => s.toggleEditorExplorer)
  const setEditorExplorerWidth = useUIStore((s) => s.setEditorExplorerWidth)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const closeProject = useProjectStore((s) => s.closeProject)
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState<string | undefined>()
  const [pinnedPaths, setPinnedPaths] = useState<Set<string>>(new Set())
  // Agent editing state: toolCallId → filePath for currently-in-progress edits
  const [agentEditing, setAgentEditing] = useState<Map<string, string>>(new Map())
  const [agentEditingPaths, setAgentEditingPaths] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)
  const [closingUnsavedPath, setClosingUnsavedPath] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const treeKey = useRef(0)
  // Inline ask widget state
  const [inlineAsk, setInlineAsk] = useState<{
    selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
    selectedText: string
  } | null>(null)
  // Track files we just saved ourselves, to distinguish our own writes from external/agent writes
  const recentlySavedRef = useRef<Set<string>>(new Set())
  const handleEditorMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
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

  // Derive diff tab presence from store
  const { activeProposal } = useDiffReviewStore()
  const hasActiveDiff = activeProposal !== null

  // Active tab path — either a normal file or diff: prefix
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

  // Sync open files to global store (single source of truth for the agent)
  // Using a ref to avoid the extra render cycle from useEffect
  const openFilesRef = useRef(openFiles)
  openFilesRef.current = openFiles
  useEffect(() => {
    useEditorStore.getState().setOpenFiles(openFilesRef.current.map((f) => f.path))
  }, [openFiles])

  const openFile = useCallback(async (filePath: string) => {
    if (!window.fs) return
    const existing = openFiles.find((f) => f.path === filePath)
    if (existing) {
      setActivePath(filePath)
      return
    }

    const result = await window.fs.readFile(filePath)
    if (!result.success || result.content === undefined) return

    const name = filePath.split(/[\\/]/).pop() ?? filePath
    const newFile: OpenFile = {
      path: filePath,
      name,
      content: result.content,
      originalContent: result.content,
    }
    setOpenFiles((prev) => [...prev, newFile])
    setActivePath(filePath)
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
    // Mark this path as recently saved so file:changed ignores it
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

  // Listen for editor:open_file events (from DiffReviewTab after approving a change)
  useEventBusListener('editor:open_file', (data: { filePath?: string } | unknown) => {
    const filePath = (data as { filePath?: string })?.filePath
    if (filePath) openFile(filePath)
  })

  // Listen for editor:diff_proposed — open the diff tab
  useEventBusListener('editor:diff_proposed', () => {
    // Switch to diff tab to show the current proposal
    // The diff tab is virtual — it uses 'diff:active' as its path
    setActivePath('diff:active')
  })

  // Listen for tool:called / tool:result to track agent editing state
  useEventBusListener('tool:called', (data: Record<string, unknown> | unknown) => {
    const evt = data as Record<string, unknown>
    const name = (evt.name ?? evt.toolName ?? '') as string
    const id = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string
    if (!name || !id) return
    // Extract file path from tool input
    const input = evt.input as Record<string, unknown> | undefined
    const filePath = (input?.path ?? input?.file_path ?? '') as string | undefined
    if (!filePath) return

    setAgentEditing((prev) => {
      const next = new Map(prev)
      next.set(id, filePath)
      return next
    })
    setAgentEditingPaths((prev) => {
      const next = new Set(prev)
      next.add(filePath)
      return next
    })

    // Auto-open the file being edited (read-only preview)
    openFile(filePath)
  })

  useEventBusListener('tool:result', (data: Record<string, unknown> | unknown) => {
    const evt = data as Record<string, unknown>
    const id = (evt.toolCallId ?? evt.tool_call_id ?? evt.id ?? '') as string
    if (!id) return

    const filePath = agentEditing.get(id)
    setAgentEditing((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    if (filePath) {
      setAgentEditingPaths((prev) => {
        const next = new Set(prev)
        // Only remove if no other active edits for this path
        const stillEditing = Array.from(agentEditing.values()).filter((p) => p === filePath && p !== id)
        if (stillEditing.length === 0) next.delete(filePath)
        return next
      })
    }
  })

  // BUG-ED1 fix: Detect external file changes for open files
  useEventBusListener('file:changed', (data: { path?: string } | unknown) => {
    const changedPath = (data as { path?: string })?.path
    if (!changedPath || !window.fs) return
    const openFile = openFiles.find((f) => f.path === changedPath)
    if (!openFile) return

    // Skip if WE just saved this file (not an external/agent change)
    if (recentlySavedRef.current.has(changedPath)) return

    window.fs.readFile(changedPath).then((result) => {
      if (!result.success || result.content === undefined) return
      if (result.content === openFile.content) return // already up to date

      const hasLocalEdits = openFile.content !== openFile.originalContent

      if (!hasLocalEdits) {
        // No local edits — reload silently (agent edited the file)
        updateFileContent(changedPath, result.content as string)
        // Also update originalContent so the tab doesn't show "modified"
        setOpenFiles((prev) =>
          prev.map((f) => f.path === changedPath
            ? { ...f, content: result.content as string, originalContent: result.content as string }
            : f)
        )
      } else {
        // User has local edits — show conflict toast
        toast.info('Archivo modificado externamente', {
          description: `${openFile.name} tiene cambios locales y externos.`,
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
    // Show diff tab if there's an active proposal
    ...(hasActiveDiff
      ? [{ path: 'diff:active', name: 'Cambio propuesto', modified: false } as const]
      : []),
    // Regular open files
    ...openFiles.map((f) => ({
      path: f.path,
      name: f.name,
      modified: f.content !== f.originalContent,
    })),
  ]

  return (
    <div className="editor-panel" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minHeight: 0 }}>
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
              const startX = e.clientX
              const startW = editorExplorerWidth
              function onMove(ev: MouseEvent) {
                const newW = startW + (ev.clientX - startX)
                setEditorExplorerWidth(newW)
              }
              function onUp() {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
            style={{
              width: 4,
              cursor: 'col-resize',
              flexShrink: 0,
              background: 'transparent',
            }}
          />
        </>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <EditorToolbar
          explorerVisible={editorExplorerVisible}
          onToggleExplorer={toggleEditorExplorer}
          projectName={activeProject?.name}
          onCloseProject={handleCloseProject}
          onCloseEditor={toggleEditor}
        />
        <EditorTabs
          tabs={tabs}
          activePath={activePath}
          onSelect={setActivePath}
          onClose={(path) => {
            if (path === 'diff:active') {
              // Switching away from diff: resolve without action
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
            <Breadcrumb path={activeFile.path} />
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
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor onMount={handleEditorMount} />
            <EmptyEditorState
              projectName={activeProject?.name}
              onClose={toggleEditor}
            />
          </div>
        )}
      </div>

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
    </div>
  )
}

function EditorToolbar({
  explorerVisible,
  onToggleExplorer,
  projectName,
  onCloseProject,
  onCloseEditor,
}: {
  explorerVisible: boolean
  onToggleExplorer: () => void
  projectName?: string
  onCloseProject: () => void
  onCloseEditor: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-normal)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onToggleExplorer}
        title="Mostrar/ocultar explorador (Ctrl+B)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          border: 'none',
          background: explorerVisible ? 'var(--bg-active)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <PanelLeft size={14} />
      </button>

      <div style={{ flex: 1 }} />

      {projectName && (
        <>
          <button
            onClick={onCloseProject}
            title="Cerrar proyecto"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <FolderX size={12} />
            <span>Cerrar proyecto</span>
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 4px' }} />
        </>
      )}

      <button
        onClick={onCloseEditor}
        title="Cerrar editor"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          border: 'none',
          background: 'transparent',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function Breadcrumb({ path }: { path: string }) {
  const parts = path.replace(/\\/g, '/').split('/')
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 12px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
          {i > 0 && <ChevronRight size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
          <span style={{ color: i === parts.length - 1 ? 'var(--text-primary)' : undefined }}>
            {part}
          </span>
        </span>
      ))}
    </div>
  )
}

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON',
  yaml: 'YAML', yml: 'YAML', md: 'Markdown', sh: 'Shell', bash: 'Shell',
  xml: 'XML', toml: 'TOML', vue: 'Vue', svelte: 'Svelte',
}

function StatusBar({ path, line, col }: { path: string; line: number; col: number }) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const lang = LANG_MAP[ext] ?? (ext.toUpperCase() || 'Plain text')
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      padding: '2px 12px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      fontSize: 10.5,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <span>Ln {line}, Col {col}</span>
      <span>UTF-8</span>
      <span>{lang}</span>
    </div>
  )
}

function EmptyEditorState({ projectName, onClose }: { projectName?: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--text-muted)',
      fontSize: 12,
      fontFamily: 'var(--font-ui)',
      background: 'var(--bg-surface)',
    }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
        {projectName ? `Proyecto: ${projectName}` : 'Ningún proyecto seleccionado'}
      </div>
      <p>Selecciona un archivo del explorador para empezar a editar.</p>
      <button
        onClick={onClose}
        style={{
          padding: '5px 12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-normal)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Cerrar editor
      </button>
    </div>
  )
}

function UnsavedChangesDialog({
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: {
  fileName: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 420, maxWidth: '92vw',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px 12px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
            Cambios sin guardar
          </h3>
        </div>
        <div style={{ padding: '0 24px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5, margin: 0 }}>
            <span style={{ fontWeight: 600 }}>{fileName}</span> tiene cambios sin guardar.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <button onClick={onCancel} style={{
            padding: '5px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onDiscard} style={{
            padding: '5px 12px', background: 'transparent', border: '1px solid var(--border-normal)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}>
            Descartar
          </button>
          <button onClick={onSave} style={{
            padding: '5px 12px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500,
          }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
