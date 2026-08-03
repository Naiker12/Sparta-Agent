import { X, FileText, FileSpreadsheet, FileCode, File, Image as ImageIcon } from 'lucide-react'
import type { ProcessedAttachment } from '../../lib/attachment-pipeline'

interface AttachmentCardProps {
  attachment: ProcessedAttachment
  onRemove?: () => void
  readOnly?: boolean
}

export function AttachmentCard({ attachment, onRemove, readOnly = false }: AttachmentCardProps) {
  const ext = attachment.fileName.split('.').pop()?.toUpperCase() ?? 'FILE'
  const isImage = attachment.kind === 'image' && attachment.base64Data

  function renderIcon() {
    if (isImage) {
      return (
        <img
          src={`data:${attachment.mimeType};base64,${attachment.base64Data}`}
          alt={attachment.fileName}
          style={{
            width: 36,
            height: 36,
            objectFit: 'cover',
            borderRadius: 6,
            flexShrink: 0,
          }}
        />
      )
    }

    const lowerExt = ext.toLowerCase()
    let IconComponent = File
    let iconColor = 'var(--text-muted)'

    if (['pdf', 'docx', 'doc', 'txt', 'md'].includes(lowerExt)) {
      IconComponent = FileText
      iconColor = 'var(--accent)'
    } else if (['xlsx', 'xls', 'csv'].includes(lowerExt)) {
      IconComponent = FileSpreadsheet
      iconColor = '#10b981'
    } else if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'rs', 'go', 'cpp', 'c'].includes(lowerExt)) {
      IconComponent = FileCode
      iconColor = '#3b82f6'
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(lowerExt)) {
      IconComponent = ImageIcon
      iconColor = '#ec4899'
    }

    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
          flexShrink: 0,
        }}
      >
        <IconComponent size={18} strokeWidth={1.75} />
      </div>
    )
  }

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        borderRadius: 10,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        maxWidth: 240,
        position: 'relative',
        userSelect: 'none',
        transition: 'all 0.15s ease',
      }}
    >
      {renderIcon()}

      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-ui)',
          }}
          title={attachment.fileName}
        >
          {attachment.fileName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {formatSize(attachment.size)}
          </span>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.03em',
            }}
          >
            {ext}
          </span>
        </div>
      </div>

      {!readOnly && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 3,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 2,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)'
            e.currentTarget.style.color = 'var(--status-err, #ef4444)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
          title="Eliminar adjunto"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
