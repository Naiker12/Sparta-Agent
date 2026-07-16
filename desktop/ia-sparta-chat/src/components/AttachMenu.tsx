import { useRef, useEffect, type ReactNode } from 'react'
import { File, Globe, Brain } from 'lucide-react'
import { useSettingsStore } from 'ia-sparta-core'
import { useProviderStore } from 'ia-sparta-core'
import { modelSupportsThinking } from 'ia-sparta-core'
import { ConnectorsSubmenu } from './ConnectorsSubmenu'
import { ModeSwitch } from './ModeSwitch'

interface AttachMenuProps {
  onClose: () => void
}

const btnStyle: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 8px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.15s ease',
}

function AttachMenuBtn({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={btnStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  )
}

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        width: 28,
        height: 16,
        borderRadius: 8,
        background: enabled ? 'var(--accent)' : 'var(--border-normal)',
        position: 'relative',
        transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          transform: enabled ? 'translateX(12px)' : 'translateX(0)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#ffffff',
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
  onToggle,
}: {
  icon: ReactNode
  label: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={btnStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>
      <span style={{ flex: 1, color: enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
      <ToggleSwitch enabled={enabled} />
    </button>
  )
}

export function AttachMenu({ onClose }: AttachMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    onClose()
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: 0,
        width: 230,
        maxWidth: 'calc(100vw - 24px)',
        background: 'var(--bg-modal)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.05)',
        overflow: 'visible',
        padding: '5px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.py,.ts,.js,.json,.csv,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = (ev) => {
            const content = ev.target?.result as string
            const preview = content.slice(0, 3000)
            const truncated = content.length > 3000 ? '\n_(contenido truncado)_' : ''
            const fileBlock = `[Archivo: ${file.name}]\n\`\`\`\n${preview}\n\`\`\`${truncated}`
            const current = useSettingsStore.getState().input
            useSettingsStore.getState().setInput(current ? `${current}\n\n${fileBlock}` : fileBlock)
          }
          reader.readAsText(file)
          onClose()
          e.target.value = ''
        }}
      />

      <AttachMenuBtn
        icon={<File size={14} strokeWidth={1.5} />}
        label="Agregar archivo"
        onClick={handleFileClick}
      />

      <AttachMenuToggle
        icon={<Globe size={14} strokeWidth={1.5} />}
        label="Búsqueda web"
        enabled={webSearchEnabled}
        onToggle={() => { toggleWebSearch(); onClose() }}
      />

      <AttachMenuToggle
        icon={<Brain size={14} strokeWidth={1.5} />}
        label={thinkingSupported ? "Razonamiento" : "Razonamiento (no soportado)"}
        enabled={reasoningEnabled && thinkingSupported}
        onToggle={() => { if (thinkingSupported) { toggleReasoning(); onClose() } }}
      />

      <ConnectorsSubmenu />

      <div
        style={{
          marginTop: 4,
          paddingTop: 5,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <ModeSwitch />
      </div>
    </div>
  )
}