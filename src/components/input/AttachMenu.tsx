import { FileIcon, CodeIcon, ImageIcon, LinkIcon } from 'lucide-react'

const items = [
  { icon: FileIcon, label: 'File' },
  { icon: CodeIcon, label: 'Code snippet' },
  { icon: ImageIcon, label: 'Image' },
  { icon: LinkIcon, label: 'URL' },
]

interface AttachMenuProps {
  onClose: () => void
}

export function AttachMenu({ onClose }: AttachMenuProps) {
  return (
    <div className="absolute bottom-full left-0 mb-1 w-36 bg-[var(--bg-modal)] border border-[var(--border-normal)] rounded-lg shadow-lg overflow-hidden py-1">
      {items.map(({ icon: Icon, label }) => (
        <button
          key={label}
          onClick={onClose}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}
