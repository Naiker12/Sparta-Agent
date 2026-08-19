import { useRef, useEffect, type ReactNode } from 'react'
import { File, FolderOpen, Globe, Brain } from 'lucide-react'
import { useSettingsStore, useProviderStore, modelSupportsThinking } from 'ia-sparta-core'
import { ConnectorsSubmenu } from './ConnectorsSubmenu'
import { processFile, type ProcessedAttachment } from '../lib/attachment-pipeline'

interface AttachMenuProps {
  onClose: () => void
  onAttach?: (attachment: ProcessedAttachment) => void
}

function AttachMenuBtn({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: ReactNode
  label: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        padding: '7px 10px',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 10,
        color: '#423A31',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F5EFE6'
        e.currentTarget.style.color = '#1C1713'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.color = '#423A31'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: '#8A7D6F' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: '#B45309',
            backgroundColor: '#F5EFE6',
            padding: '1.5px 6px',
            borderRadius: 6,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        width: 30,
        height: 17,
        borderRadius: 999,
        backgroundColor: enabled ? '#B45309' : '#DED7CB',
        position: 'relative',
        transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
        display: 'inline-block',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          transform: enabled ? 'translateX(13px)' : 'translateX(0)',
          width: 13,
          height: 13,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </span>
  )
}

function AttachMenuToggle({
  icon,
  label,
  enabled,
  disabled = false,
  onToggle,
}: {
  icon: ReactNode
  label: string
  enabled: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={() => {
        if (!disabled) onToggle()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        padding: '7px 10px',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 10,
        color: disabled ? '#A89F91' : '#423A31',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s ease',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#F5EFE6'
          e.currentTarget.style.color = '#1C1713'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#423A31'
        }
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: enabled ? '#B45309' : '#8A7D6F' }}>
        {icon}
      </span>
      <span style={{ flex: 1, color: enabled ? '#1C1713' : 'inherit', fontWeight: enabled ? 600 : 500 }}>
        {label}
      </span>
      <ToggleSwitch enabled={enabled} />
    </button>
  )
}

export function AttachMenu({ onClose, onAttach }: AttachMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const { defaultModel, webSearchEnabled, reasoningEnabled, toggleWebSearch, toggleReasoning } = useSettingsStore()
  const providers = useProviderStore((s) => s.providers)
  const activeVendor = providers.find((p) => p.models?.includes(defaultModel))?.vendor
  const thinkingSupported = modelSupportsThinking(defaultModel, activeVendor)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function handleFileClick() {
    fileInputRef.current?.click()
  }

  function handleFolderClick() {
    folderInputRef.current?.click()
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        width: 250,
        maxWidth: 'calc(100vw - 24px)',
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAE3D8',
        borderRadius: 18,
        boxShadow: '0 12px 32px -4px rgba(40, 25, 10, 0.12), 0 2px 8px rgba(0,0,0,0.04)',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        zIndex: 50,
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
      }}
    >
      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.py,.ts,.js,.jsx,.tsx,.json,.csv,.pdf,.docx,.doc,.docm,.xlsx,.xls,.xlsm,.xlsb,.pptx,.ppt,.pptm,.ppsx,.odt,.ods,.odp,.rtf,.epub,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const files = e.target.files
          if (!files || files.length === 0) {
            onClose()
            return
          }
          try {
            for (let i = 0; i < files.length; i++) {
              const file = files[i]
              const processed = await processFile(file)
              if (onAttach) {
                onAttach(processed)
              } else {
                const current = useSettingsStore.getState().input
                useSettingsStore.getState().setInput(current ? `${current}\n\n${processed.previewText}` : processed.previewText)
              }
            }
          } catch (err) {
            console.error('Error processing attached files:', err)
          } finally {
            onClose()
            e.target.value = ''
          }
        }}
      />

      {/* Folder input */}
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as any)}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const files = e.target.files
          if (!files || files.length === 0) {
            onClose()
            return
          }
          try {
            const folderSummary = `[Directorio cargado: ${files.length} archivos adjuntos del proyecto]`
            const current = useSettingsStore.getState().input
            useSettingsStore.getState().setInput(current ? `${current}\n\n${folderSummary}` : folderSummary)
          } catch (err) {
            console.error('Error processing folder:', err)
          } finally {
            onClose()
            e.target.value = ''
          }
        }}
      />

      {/* 1. Agregar archivo */}
      <AttachMenuBtn
        icon={<File size={15} strokeWidth={1.75} />}
        label="Agregar archivos"
        onClick={handleFileClick}
      />

      {/* 2. Agregar carpeta */}
      <AttachMenuBtn
        icon={<FolderOpen size={15} strokeWidth={1.75} />}
        label="Agregar carpeta / Proyecto"
        badge="Workspace"
        onClick={handleFolderClick}
      />

      {/* Divisor sutil */}
      <div style={{ height: 1, backgroundColor: '#F0ECE4', margin: '3px 4px' }} />

      {/* 3. Búsqueda web en vivo */}
      <AttachMenuToggle
        icon={<Globe size={15} strokeWidth={1.75} />}
        label="Búsqueda web en vivo"
        enabled={webSearchEnabled}
        onToggle={() => {
          toggleWebSearch()
          onClose()
        }}
      />

      {/* 4. Razonamiento profundo (Thinking / CoT) */}
      <AttachMenuToggle
        icon={<Brain size={15} strokeWidth={1.75} />}
        label={thinkingSupported ? "Razonamiento profundo" : "Razonamiento (no soportado)"}
        enabled={reasoningEnabled && thinkingSupported}
        disabled={!thinkingSupported}
        onToggle={() => {
          if (thinkingSupported) {
            toggleReasoning()
            onClose()
          }
        }}
      />

      {/* Divisor sutil */}
      <div style={{ height: 1, backgroundColor: '#F0ECE4', margin: '3px 4px' }} />

      {/* 5. Submenú de conectores MCP */}
      <ConnectorsSubmenu />
    </div>
  )
}