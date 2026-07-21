import { Plus } from 'lucide-react'

interface NewTabButtonProps {
  onClick: () => void
}

export function NewTabButton({ onClick }: NewTabButtonProps) {
  return (
    <button
      className="flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] transition-colors"
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        color: 'var(--text-muted)',
      }}
      onClick={onClick}
      title="Nueva conversación"
    >
      <Plus size={13} strokeWidth={2} />
    </button>
  )
}
