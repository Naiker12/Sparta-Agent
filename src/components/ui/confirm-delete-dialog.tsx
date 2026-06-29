import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  itemLabel: string
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = '¿Eliminar este elemento?',
  itemLabel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  function handleConfirm() {
    onConfirm()
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{
          width: 420, maxWidth: '92vw',
          background: 'var(--bg-modal)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.12)', color: 'var(--status-err)', flexShrink: 0,
            }}>
              <AlertTriangle size={15} strokeWidth={2.25} />
            </span>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: 0 }}>
              {title}
            </h3>
          </div>
          <button onClick={() => onOpenChange(false)} style={{
            width: 24, height: 24, background: 'none', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: -2,
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '12px 24px 20px' }}>
          <p style={{
            fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
            lineHeight: 1.5, margin: 0,
          }}>
            Vas a eliminar{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{itemLabel}</span>.
            Esta acción no se puede deshacer.
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  )
}
