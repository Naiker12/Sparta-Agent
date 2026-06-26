import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  itemLabel: string
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open, onOpenChange, title = '¿Eliminar este elemento?', itemLabel, onConfirm,
}: ConfirmDeleteDialogProps) {
  function handleConfirm() {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{
        width: '420px',
        maxWidth: '92vw',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        gap: 0,
        overflow: 'hidden',
        background: 'var(--bg-modal)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '24px 28px 20px', flexShrink: 0 }}>
          <DialogHeader>
            <DialogTitle style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-display)',
              fontFamily: 'var(--font-ui)',
              marginBottom: 4,
            }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--status-err)',
                flexShrink: 0,
              }}>
                <AlertTriangle size={15} strokeWidth={2.25} />
              </span>
              {title}
            </DialogTitle>
            <DialogDescription style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              marginLeft: 40,
              lineHeight: 1.5,
            }}>
              Vas a eliminar{' '}
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {itemLabel}
              </span>
              . Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '12px 24px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            style={{ minWidth: 110, height: 36, padding: '0 22px', fontSize: 13, fontWeight: 500 }}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            style={{ minWidth: 130, height: 38, padding: '0 28px', fontSize: 13, fontWeight: 600 }}
          >
            Eliminar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
