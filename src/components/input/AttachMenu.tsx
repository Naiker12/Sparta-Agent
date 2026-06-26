import { useRef, useEffect, type ReactNode } from 'react'
import { FileIcon, Globe, Brain } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { ConnectorsSubmenu } from './ConnectorsSubmenu'
import { ModeSwitch } from './ModeSwitch'

interface AttachMenuProps {
  onClose: () => void
}

const btnStyle: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '7px 12px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-secondary)',
  fontSize: 12.5,
  fontFamily: 'var(--font-ui)',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.12s',
}

function AttachMenuBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={btnStyle}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
    >
      {icon}
      <span style={{ flex: 1, color: active ? 'var(--accent)' : undefined }}>{label}</span>
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
        background: enabled ? 'var(--accent)' : 'var(--bg-active)',
        position: 'relative',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: enabled ? 14 : 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.15s',
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
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
    >
      {icon}
      <span style={{ flex: 1, color: enabled ? 'var(--accent)' : undefined }}>{label}</span>
      <ToggleSwitch enabled={enabled} />
    </button>
  )
}

export function AttachMenu({ onClose }: AttachMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { webSearchEnabled, reasoningEnabled, toggleWebSearch, toggleReasoning } = useSettingsStore()

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
        bottom: 'calc(100% + 4px)',
        left: 0,
        width: 220,
        background: 'var(--bg-modal)',
        border: '1px solid var(--border-normal)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        padding: '4px',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={() => {}}
      />

      <AttachMenuBtn
        icon={<FileIcon size={14} strokeWidth={1.5} />}
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
        label="Razonamiento"
        enabled={reasoningEnabled}
        onToggle={() => { toggleReasoning(); onClose() }}
      />

      <ConnectorsSubmenu />

      <div
        style={{
          marginTop: 4,
          paddingTop: 6,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <ModeSwitch />
      </div>
    </div>
  )
}
