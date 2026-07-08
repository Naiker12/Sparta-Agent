"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import { PanelLeft, X, FolderX } from 'lucide-react'
import { useUIStore } from '@/stores/ui.store'
import { useProjectStore } from '@/stores/project.store'
import { useEditorStore } from '@/stores/editor.store'
import { FileTreeSidebar } from './FileTreeSidebar'
import { EditorTabs } from './EditorTabs'
import { MonacoEditor } from './MonacoEditor'
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
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const treeKey = useRef(0)

  const activeFile = openFiles.find((f) => f.path === activePath)

  // Sync open files to global store so the agent can query them
  useEffect(() => {
    useEditorStore.getState().setOpenFiles(openFiles.map((f) => f.path))
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
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== filePath)
      if (activePath === filePath) {
        setActivePath(next.length > 0 ? next[next.length - 1].path : undefined)
      }
      return next
    })
  }, [activePath])

  const updateFileContent = useCallback((filePath: string, value: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content: value } : f))
    )
  }, [])

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || !window.fs) return
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
  }, [activeProject, closeProject])

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

  const tabs = openFiles.map((f) => ({
    path: f.path,
    name: f.name,
    modified: f.content !== f.originalContent,
  }))

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
          onClose={closeFile}
        />
        {activeFile ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor
              path={activeFile.path}
              content={activeFile.content}
              onChange={(value) => updateFileContent(activeFile.path, value)}
              onMount={(editor) => { editorRef.current = editor }}
            />
          </div>
        ) : (
          <EmptyEditorState
            projectName={activeProject?.name}
            onClose={toggleEditor}
          />
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={`Eliminar ${deleteTarget?.type === 'directory' ? 'carpeta' : 'archivo'}`}
        itemLabel={deleteTarget?.name ?? ''}
        onConfirm={handleDeleteConfirm}
      />
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

function EmptyEditorState({ projectName, onClose }: { projectName?: string; onClose: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--text-muted)',
      fontSize: 12,
      fontFamily: 'var(--font-ui)',
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
