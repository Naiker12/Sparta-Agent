import { useState, useRef, useEffect } from 'react'
import { Pin, Folder, Copy, FolderGit2, Settings, Trash2, FolderPlus, Check, ChevronDown } from 'lucide-react'
import { useFolderStore, useProjectStore, useSettingsStore } from 'ia-sparta-core'
import { toast } from 'ia-sparta-design-system'

async function triggerNativeFolderPicker(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    const win = window as any
    if (win.electronAPI?.openDirectory) {
      try {
        return await win.electronAPI.openDirectory()
      } catch {
        // Fallthrough
      }
    }
    if (win.fs?.openFolderDialog) {
      try {
        return await win.fs.openFolderDialog()
      } catch {
        // Fallthrough
      }
    }
  }
  const manualPath = prompt('Ingresa la ruta de la carpeta de trabajo:')
  return manualPath?.trim() || null
}

export function WorkspaceModePicker() {
  const [open, setOpen] = useState(false)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { connectedPath, folderName, recentPaths, connectFolder, disconnectFolder, removeRecentPath } = useFolderStore()
  const { getActiveProject, closeProject, activeProjectId } = useProjectStore()
  const { sessionMode, setSessionMode } = useSettingsStore()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [open])

  const activeProject = getActiveProject()
  const displayFolderName = folderName || (connectedPath ? connectedPath.split(/[/\\]/).filter(Boolean).pop() : null) || activeProject?.name || 'Sin carpeta'
  const isConnected = !!connectedPath || !!activeProject?.rootPath

  function handleCopyPath(path: string) {
    navigator.clipboard.writeText(path)
    setCopiedPath(path)
    toast.success('Ruta copiada al portapapeles')
    setTimeout(() => setCopiedPath(null), 2000)
  }

  async function handleAddFolder() {
    setOpen(false)
    const selectedPath = await triggerNativeFolderPicker()
    if (selectedPath) {
      connectFolder(selectedPath)
      toast.success(`Carpeta conectada: ${selectedPath}`)
    }
  }

  function handleDisconnect() {
    disconnectFolder()
    if (activeProjectId) {
      closeProject(activeProjectId)
    }
    toast.info('Carpeta desconectada')
  }

  function handleRemoveRecent(e: React.MouseEvent, path: string) {
    e.stopPropagation()
    removeRecentPath(path)
    toast.info(`Carpeta removida de recientes: ${path}`)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }} className="no-drag">
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          background: open ? 'var(--bg-active)' : 'transparent',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 11.5,
          fontFamily: 'var(--font-ui)',
          fontWeight: 400,
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
        title="Selector de carpeta de trabajo y modo de conversación"
      >
        <Folder size={13} style={{ color: isConnected ? 'var(--accent)' : 'var(--text-muted)' }} />
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{displayFolderName}</span>
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            width: 440,
            background: 'var(--bg-modal)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'modalScaleIn 0.12s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Active Folder Row (Real State from useFolderStore & useProjectStore) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              {/* Pin badge indicator */}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: isConnected ? 'var(--accent-muted)' : 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isConnected ? 'var(--accent)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                <Pin size={12} fill={isConnected ? 'var(--accent)' : 'none'} />
              </div>

              {/* Folder Name & Path Copy */}
              <Folder size={14} style={{ color: isConnected ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={connectedPath || displayFolderName}
              >
                {displayFolderName}
              </span>

              {connectedPath && (
                <button
                  onClick={() => handleCopyPath(connectedPath)}
                  title="Copiar ruta absoluta"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedPath === connectedPath ? '#22c55e' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedPath === connectedPath ? <Check size={12} /> : <Copy size={12} />}
                </button>
              )}
            </div>

            {/* Controls: conversation mode, settings, disconnect */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: sessionMode === 'agent' ? 'var(--accent-muted)' : 'var(--bg-input)',
                  border: `1px solid ${sessionMode === 'agent' ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  color: sessionMode === 'agent' ? 'var(--accent)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                }}
                onClick={() => setSessionMode(sessionMode === 'agent' ? 'chat' : 'agent')}
                title="Modo Agéntico (Autónomo vs Chat directo)"
              >
                <FolderGit2 size={12} style={{ color: sessionMode === 'agent' ? 'var(--accent)' : 'var(--text-secondary)' }} />
                <span>{sessionMode === 'agent' ? 'Agente' : 'Chat'}</span>
              </div>

              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                title="Configuración de proyecto"
              >
                <Settings size={13} />
              </button>

              {/* ALWAYS DISPLAYED DISCONNECT / DELETE BUTTON */}
              <button
                onClick={handleDisconnect}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--destructive)',
                  cursor: 'pointer',
                  padding: '3px 7px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                }}
                title="Desconectar / Eliminar carpeta activa"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Recent Folders List with Individual Delete/Remove Buttons */}
          {recentPaths.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: 4 }}>
                Carpetas Recientes
              </span>
              {recentPaths.slice(0, 5).map((path) => {
                const name = path.split(/[/\\]/).filter(Boolean).pop() || path
                const isItemActive = path === connectedPath
                return (
                  <div
                    key={path}
                    onClick={() => {
                      connectFolder(path)
                      toast.success(`Conectado a ${name}`)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 'var(--radius-md)',
                      background: isItemActive ? 'var(--accent-muted)' : 'var(--bg-input)',
                      border: isItemActive ? '1px solid var(--accent)' : '1px solid transparent',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: isItemActive ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      <Folder size={12} style={{ color: isItemActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
                      <button
                        onClick={(e) => handleRemoveRecent(e, path)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 3,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--destructive)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Eliminar de recientes"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add folder button (Triggers Direct Native Folder Picker Dialog) */}
          <button
            onClick={handleAddFolder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-normal)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)'
              e.currentTarget.style.borderColor = 'var(--border-normal)'
            }}
          >
            <FolderPlus size={14} style={{ color: 'var(--accent)' }} />
            <span>Add folder</span>
          </button>
        </div>
      )}
    </div>
  )
}
