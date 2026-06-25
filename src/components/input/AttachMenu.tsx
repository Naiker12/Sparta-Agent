import { useRef, useEffect } from 'react'
import { FileIcon, Globe, Brain } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import { ConnectorsSubmenu } from './ConnectorsSubmenu'
import { ModeSwitch } from './ModeSwitch'

interface AttachMenuProps {
  onClose: () => void
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

      <button
        onClick={handleFileClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 12.5,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <FileIcon size={14} strokeWidth={1.5} />
        <span style={{ flex: 1 }}>Agregar archivo</span>
      </button>

      <button
        onClick={() => { toggleWebSearch(); onClose() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 12.5,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <Globe size={14} strokeWidth={1.5} />
        <span style={{ flex: 1 }}>Búsqueda web</span>
        <span
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            background: webSearchEnabled ? 'var(--accent)' : 'var(--bg-active)',
            position: 'relative',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: webSearchEnabled ? 14 : 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.15s',
            }}
          />
        </span>
      </button>

      <button
        onClick={() => { toggleReasoning(); onClose() }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: 12.5,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        <Brain size={14} strokeWidth={1.5} />
        <span style={{ flex: 1 }}>Razonamiento</span>
        <span
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            background: reasoningEnabled ? 'var(--accent)' : 'var(--bg-active)',
            position: 'relative',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: reasoningEnabled ? 14 : 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.15s',
            }}
          />
        </span>
      </button>

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
