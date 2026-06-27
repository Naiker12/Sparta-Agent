import { XIcon } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number | string
  height?: number | string
  maxHeight?: number | string
  className?: string
}

export function Modal({
  open,
  onClose,
  children,
  width = 500,
  height,
  maxHeight = 460,
  className,
}: ModalProps) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.15)',
        animation: 'modalBackdropIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width,
          height,
          maxHeight,
          maxWidth: '92vw',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalScaleIn 0.15s ease-out',
        }}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  onClose?: () => void
}

export function ModalHeader({ title, description, onClose }: ModalHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '16px 20px 0',
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            marginBottom: description ? 4 : 14,
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.5,
              marginBottom: 14,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: -2,
          }}
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  )
}

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function ModalBody({ children, className, style }: ModalBodyProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 20px',
        minHeight: 0,
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function ModalFooter({ children, className, style }: ModalFooterProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '12px 20px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}
